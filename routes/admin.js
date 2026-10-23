module.exports = function(app, pool, requireAdmin, upload) {
  const { requirePermission } = require('./middleware/auth');

  // Dashboard statistics
  app.get('/api/admin/dashboard', requireAdmin, async (req, res) => {
    try {
      const [usersResult, productsResult, categoriesResult, ordersResult, pendingOrdersResult,
             todayResult, weekResult, lowStockResult, paidPendingResult,
             statusBreakdownResult] = await Promise.all([
        pool.query('SELECT COUNT(*) as count FROM users'),
        pool.query('SELECT COUNT(*) as count FROM products WHERE status = \'active\''),
        pool.query('SELECT COUNT(*) as count FROM categories WHERE status = \'active\''),
        pool.query('SELECT COUNT(*) as count FROM orders'),
        pool.query('SELECT COUNT(*) as count FROM orders WHERE status = \'pending\''),
        pool.query(`SELECT COUNT(*)::int AS orders, COALESCE(SUM(total_amount),0) AS revenue
                    FROM orders WHERE status <> 'cancelled' AND created_at >= NOW() - INTERVAL '24 hours'`),
        pool.query(`SELECT COUNT(*)::int AS orders, COALESCE(SUM(total_amount),0) AS revenue
                    FROM orders WHERE status <> 'cancelled' AND created_at >= NOW() - INTERVAL '7 days'`),
        pool.query(`SELECT COUNT(*)::int AS count FROM (
                      SELECT p.id FROM products p
                      JOIN product_skus ps ON ps.product_id = p.id AND ps.is_active = true
                      WHERE p.status = 'active'
                      GROUP BY p.id HAVING COALESCE(SUM(ps.stock),0) <= 5
                    ) low`),
        pool.query(`SELECT COUNT(*) as count FROM orders WHERE status IN ('pending','paid')`),
        pool.query(`SELECT status, COUNT(*)::int as count
                    FROM orders WHERE status IS NOT NULL
                    GROUP BY status`),
      ]);

      // Get recent orders
      const recentOrders = await pool.query(`
        SELECT o.*, u.username
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        ORDER BY o.created_at DESC
        LIMIT 8
      `);

      res.json({
        stats: {
          users: parseInt(usersResult.rows[0].count),
          products: parseInt(productsResult.rows[0].count),
          categories: parseInt(categoriesResult.rows[0].count),
          orders: parseInt(ordersResult.rows[0].count),
          pending_orders: parseInt(pendingOrdersResult.rows[0].count),
          today_orders: todayResult.rows[0].orders,
          today_revenue: Number(todayResult.rows[0].revenue) || 0,
          week_orders: weekResult.rows[0].orders,
          week_revenue: Number(weekResult.rows[0].revenue) || 0,
          actionable_orders: parseInt(paidPendingResult.rows[0].count),
          low_stock: lowStockResult.rows[0].count,
          status_breakdown: statusBreakdownResult.rows.map(r => ({ status: r.status, count: r.count }))
        },
        recent_orders: recentOrders.rows
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // Upload image (for product images)
  // Returns image path that can be stored in product
  app.post('/api/admin/upload', requireAdmin, upload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: '沒有上傳檔案' });
      }

      // In production Vercel, you'd typically upload to S3/Cloudinary
      // For self-hosted, save to public/images
      const fs = require('fs');
      const path = require('path');

      const fileName = `${Date.now()}-${Math.round(Math.random() * 10000)}-${req.file.originalname.replace(/\s+/g, '-')}`;
      const uploadPath = path.join(__dirname, '../public/images', fileName);

      fs.writeFileSync(uploadPath, req.file.buffer);

      // Return public URL
      const imageUrl = `/images/${fileName}`;
      res.json({ success: true, url: imageUrl });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '上傳失敗' });
    }
  });

  // Sales statistics by date range
  app.get('/api/admin/stats/sales', requireAdmin, async (req, res) => {
    try {
      const { start_date, end_date } = req.query;
      let where = '1=1';
      let params = [];

      if (start_date) {
        where += ` AND created_at >= $${params.length + 1}`;
        params.push(start_date);
      }
      if (end_date) {
        where += ` AND created_at <= $${params.length + 1}`;
        params.push(end_date);
      }

      const totalResult = await pool.query(`
        SELECT COUNT(*) as total_orders, COALESCE(SUM(total_amount), 0) as total_revenue
        FROM orders
        WHERE ${where} AND status != 'cancelled'
      `, params);

      const statusResult = await pool.query(`
        SELECT status, COUNT(*) as count, COALESCE(SUM(total_amount), 0) as revenue
        FROM orders
        WHERE ${where} AND status != 'cancelled'
        GROUP BY status
        ORDER BY count DESC
      `, params);

      res.json({
        total_orders: parseInt(totalResult.rows[0].total_orders),
        total_revenue: parseFloat(totalResult.rows[0].total_revenue),
        by_status: statusResult.rows
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  function csvEscape(val) {
    if (val === null || typeof val === 'undefined') return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) return `"${str.replace(/"/g, '""')}"`;
    return str;
  }

  function parseCsv(text) {
    const s = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const rows = [];
    let row = [];
    let field = '';
    let i = 0;
    let inQuotes = false;

    while (i < s.length) {
      const ch = s[i];
      if (inQuotes) {
        if (ch === '"') {
          const next = s[i + 1];
          if (next === '"') {
            field += '"';
            i += 2;
            continue;
          }
          inQuotes = false;
          i += 1;
          continue;
        }
        field += ch;
        i += 1;
        continue;
      }

      if (ch === '"') {
        inQuotes = true;
        i += 1;
        continue;
      }
      if (ch === ',') {
        row.push(field);
        field = '';
        i += 1;
        continue;
      }
      if (ch === '\n') {
        row.push(field);
        field = '';
        const allEmpty = row.every((v) => String(v || '').trim() === '');
        if (!allEmpty) rows.push(row);
        row = [];
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
    }

    row.push(field);
    const allEmpty = row.every((v) => String(v || '').trim() === '');
    if (!allEmpty) rows.push(row);
    return rows;
  }

  function parseOptionalMoney(v) {
    const s = String(v || '').trim();
    if (!s) return { ok: true, value: null };
    const n = Number(s);
    if (!Number.isFinite(n) || n < 0) return { ok: false, error: '金額不正確' };
    return { ok: true, value: n };
  }

  function parseOptionalBool(v) {
    const s = String(v || '').trim().toLowerCase();
    if (!s) return { ok: true, value: null };
    if (s === '1' || s === 'true') return { ok: true, value: true };
    if (s === '0' || s === 'false') return { ok: true, value: false };
    return { ok: false, error: 'is_active 不正確（請用 1/0/true/false）' };
  }

  function parseOptionalIntNonNeg(v) {
    const s = String(v || '').trim();
    if (!s) return { ok: true, value: null };
    const n = parseInt(s, 10);
    if (!Number.isInteger(n) || n < 0) return { ok: false, error: 'target_stock 不正確（必須 >= 0）' };
    return { ok: true, value: n };
  }

  async function pickWarehouseId(client, preferredWarehouseId) {
    if (preferredWarehouseId) return preferredWarehouseId;
    try {
      const r = await client.query(
        'SELECT id FROM inventory_warehouses WHERE is_active = true ORDER BY is_default DESC, id ASC LIMIT 1'
      );
      return r.rows[0] ? r.rows[0].id : null;
    } catch (e) {
      const r = await client.query(
        'SELECT id FROM inventory_warehouses WHERE is_active = true ORDER BY id ASC LIMIT 1'
      );
      return r.rows[0] ? r.rows[0].id : null;
    }
  }

  app.get('/api/admin/bulk-skus/template.csv', requirePermission('inventory:bulk'), async (req, res) => {
    const header = ['sku_id', 'barcode', 'cost_price', 'price', 'is_active', 'target_stock', 'note'];
    const example = [123, '4900000000000', '12.50', '19.90', '1', '10', 'bulk update'];
    let csv = header.join(',') + '\n';
    csv += example.map(csvEscape).join(',') + '\n';
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="bulk-skus-template-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  });

  app.post('/api/admin/bulk-skus/import', requirePermission('inventory:bulk'), upload.single('file'), async (req, res) => {
    try {
      const dryRun = String(req.query.dry_run || '') === '1';
      if (!req.file) return res.status(400).json({ error: '沒有上傳檔案' });

      const content = req.file.buffer.toString('utf8');
      const rows = parseCsv(content);
      if (rows.length === 0) return res.status(400).json({ error: 'CSV 內容為空' });

      const header = rows[0].map((s) => String(s || '').trim());
      const expected = ['sku_id', 'barcode', 'cost_price', 'price', 'is_active', 'target_stock', 'note'];
      const headerOk = expected.every((k, idx) => header[idx] === k);
      if (!headerOk) {
        return res.status(400).json({ error: `CSV header 不正確，必須為：${expected.join(',')}` });
      }

      const dataRows = rows.slice(1);
      if (dataRows.length > 2000) return res.status(400).json({ error: '最多只支援 2000 行' });

      const parsed = [];
      const errors = [];
      for (let i = 0; i < dataRows.length; i++) {
        const r = dataRows[i];
        const rowNum = i + 2;
        const skuId = parseInt(String(r[0] || '').trim(), 10);
        if (!Number.isInteger(skuId) || skuId <= 0) {
          errors.push(`第 ${rowNum} 行：sku_id 不正確`);
          continue;
        }

        const barcodeRaw = String(r[1] || '').trim();
        const barcode = barcodeRaw ? barcodeRaw : null;
        const cost = parseOptionalMoney(r[2]);
        if (!cost.ok) { errors.push(`第 ${rowNum} 行：${cost.error}`); continue; }
        const price = parseOptionalMoney(r[3]);
        if (!price.ok) { errors.push(`第 ${rowNum} 行：${price.error}`); continue; }
        const isActive = parseOptionalBool(r[4]);
        if (!isActive.ok) { errors.push(`第 ${rowNum} 行：${isActive.error}`); continue; }
        const targetStock = parseOptionalIntNonNeg(r[5]);
        if (!targetStock.ok) { errors.push(`第 ${rowNum} 行：${targetStock.error}`); continue; }
        const noteRaw = String(r[6] || '').trim();
        const note = noteRaw ? noteRaw : null;

        parsed.push({
          sku_id: skuId,
          barcode,
          cost_price: cost.value,
          price: price.value,
          is_active: isActive.value,
          target_stock: targetStock.value,
          note,
          _row: rowNum,
        });
      }

      if (parsed.length === 0) {
        return res.status(400).json({ error: '沒有可處理行', summary: { total: dataRows.length, valid: 0, invalid: errors.length }, errors });
      }

      const skuIds = Array.from(new Set(parsed.map((x) => x.sku_id)));
      const exist = await pool.query(
        `SELECT id, stock, cost_price
         FROM product_skus
         WHERE id = ANY($1::int[])`,
        [skuIds]
      );
      const byId = new Map(exist.rows.map((r) => [Number(r.id), r]));

      for (const r of parsed) {
        if (!byId.has(r.sku_id)) errors.push(`第 ${r._row} 行：SKU 不存在（sku_id=${r.sku_id}）`);
      }

      const summary = { total: dataRows.length, valid: parsed.length - Math.min(parsed.length, errors.length), invalid: errors.length };
      if (errors.length > 0) {
        return res.status(400).json({ ok: false, dry_run: dryRun, summary, errors });
      }

      if (dryRun) {
        return res.json({ ok: true, dry_run: true, summary: { total: dataRows.length, valid: parsed.length, invalid: 0 }, errors: [] });
      }

      const preferredWarehouseId = req.body.warehouse_id ? Number(req.body.warehouse_id) : null;

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const needsStock = parsed.some((x) => x.target_stock !== null && typeof x.target_stock !== 'undefined');
        const warehouseId = needsStock ? await pickWarehouseId(client, preferredWarehouseId) : null;
        if (needsStock && !warehouseId) return res.status(500).json({ error: '未設定倉庫' });

        let updatedSkus = 0;
        let stockAdjusted = 0;

        for (const r of parsed) {
          const skuRow = await client.query(
            `SELECT id, product_id, stock, cost_price
             FROM product_skus
             WHERE id = $1
             FOR UPDATE`,
            [r.sku_id]
          );
          if (skuRow.rows.length === 0) throw new Error(`SKU 不存在（sku_id=${r.sku_id}）`);
          const current = skuRow.rows[0];

          const sets = [];
          const params = [];
          if (r.barcode !== null) {
            sets.push(`barcode = $${params.length + 1}`);
            params.push(r.barcode);
          }
          if (r.cost_price !== null) {
            sets.push(`cost_price = $${params.length + 1}`);
            params.push(r.cost_price);
          }
          if (r.price !== null) {
            sets.push(`price = $${params.length + 1}`);
            params.push(r.price);
          }
          if (r.is_active !== null) {
            sets.push(`is_active = $${params.length + 1}`);
            params.push(Boolean(r.is_active));
          }

          if (sets.length > 0) {
            await client.query(
              `UPDATE product_skus
               SET ${sets.join(', ')}, updated_at = NOW()
               WHERE id = $${params.length + 1}`,
              [...params, r.sku_id]
            );
            updatedSkus += 1;

            if (r.cost_price !== null && String(current.cost_price ?? '') !== String(r.cost_price ?? '')) {
              await client.query(
                `INSERT INTO sku_cost_history (sku_id, old_cost_price, new_cost_price, changed_by_admin_id, reason)
                 VALUES ($1, $2, $3, $4, $5)`,
                [r.sku_id, current.cost_price, r.cost_price, req.user ? req.user.id : null, 'bulk_csv_import']
              );
            }
          }

          if (r.target_stock !== null && typeof r.target_stock !== 'undefined') {
            const delta = Number(r.target_stock) - Number(current.stock || 0);
            if (delta !== 0) {
              await client.query(
                `INSERT INTO inventory_levels (warehouse_id, sku_id, stock)
                 VALUES ($1, $2, 0)
                 ON CONFLICT (warehouse_id, sku_id) DO NOTHING`,
                [warehouseId, r.sku_id]
              );

              const levelRow = await client.query(
                `SELECT stock
                 FROM inventory_levels
                 WHERE warehouse_id = $1 AND sku_id = $2
                 FOR UPDATE`,
                [warehouseId, r.sku_id]
              );
              const warehousePreviousStock = Number(levelRow.rows[0] ? levelRow.rows[0].stock : 0);
              const totalPreviousStock = Number(current.stock || 0);
              const computeNewStock = require('../lib/inventory').computeNewStock;
              const { newStock: warehouseNewStock } = computeNewStock({ previousStock: warehousePreviousStock, delta });
              const { newStock: totalNewStock } = computeNewStock({ previousStock: totalPreviousStock, delta });

              await client.query(
                'UPDATE inventory_levels SET stock = $1, updated_at = NOW() WHERE warehouse_id = $2 AND sku_id = $3',
                [warehouseNewStock, warehouseId, r.sku_id]
              );

              await client.query(
                'UPDATE product_skus SET stock = $1, updated_at = NOW() WHERE id = $2',
                [totalNewStock, r.sku_id]
              );
              await client.query(
                `INSERT INTO inventory_transactions
                  (product_id, sku_id, warehouse_id, type, quantity, previous_stock, new_stock, reference_id, note)
                 VALUES ($1,$2,$3,'adjustment',$4,$5,$6,NULL,$7)`,
                [
                  current.product_id,
                  r.sku_id,
                  warehouseId,
                  delta,
                  warehousePreviousStock,
                  warehouseNewStock,
                  r.note || 'bulk_csv_import'
                ]
              );
              stockAdjusted += 1;
            }
          }
        }

        await client.query('COMMIT');
        return res.json({
          ok: true,
          dry_run: false,
          summary: { total: dataRows.length, updated_skus: updatedSkus, stock_adjusted: stockAdjusted },
          errors: [],
        });
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: err && err.message ? err.message : '服務器錯誤' });
    }
  });

};
