// ===========================================
// Logistics & Order Tracking API
// Includes: ShipAny integration, returns & refunds
// Hong Kong E-commerce Full Feature
// ===========================================

module.exports = function(app, pool) {

  const requireAuth = require('./middleware/auth').requireAuth;
  const requireAdmin = require('./middleware/auth').requireAdmin;
  const { requirePermission } = require('./middleware/auth');
  const { verifyShipanySignature } = require('../utils/webhookSignatures');
  const { parseAllowedIps, extractClientIp, isIpAllowed } = require('../utils/ipAllowlist');

  // ===========================================
  // Returns & Refunds (After-sales)
  // ===========================================

  // User: get my returns
  app.get('/api/user/returns', requireAuth, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT r.*, o.order_number
        FROM return_requests r
        JOIN orders o ON r.order_id = o.id
        WHERE r.user_id = $1
        ORDER BY r.created_at DESC
      `, [req.user.id]);
      res.json({ returns: result.rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // User: create return request
  app.post('/api/user/returns', requireAuth, async (req, res) => {
    try {
      const { order_id, reason, items, return_method, images } = req.body;

      // Verify order belongs to user
      const orderCheck = await pool.query(
        'SELECT id, status FROM orders WHERE id = $1 AND user_id = $2',
        [order_id, req.user.id]
      );
      if (orderCheck.rows.length === 0) {
        return res.status(404).json({ error: '訂單不存在' });
      }

      const result = await pool.query(`
        INSERT INTO return_requests (
          user_id, order_id, reason, items, return_method, images, status
        ) VALUES ($1, $2, $3, $4, $5, $6, 'pending')
        RETURNING id
      `, [
        req.user.id, order_id, reason,
        items ? JSON.stringify(items) : null,
        return_method,
        images ? JSON.stringify(images) : null
      ]);

      res.json({ success: true, return_id: result.rows[0].id });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // Admin: list all return requests
  app.get('/api/admin/returns', requirePermission('returns:read'), async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const pageSize = parseInt(req.query.page_size) || 30;
      const offset = (page - 1) * pageSize;
      const status = req.query.status;

      let where = '1=1';
      let params = [];
      if (status) {
        where += ` AND r.status = $1`;
        params.push(status);
      }

      const countResult = await pool.query(`SELECT COUNT(*) FROM return_requests r WHERE ${where}`, params);
      const total = parseInt(countResult.rows[0].count);

      const result = await pool.query(`
        SELECT r.*, o.order_number, o.total_amount, u.username
        FROM return_requests r
        JOIN orders o ON r.order_id = o.id
        JOIN users u ON r.user_id = u.id
        WHERE ${where}
        ORDER BY r.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, [...params, pageSize, offset]);

      res.json({
        returns: result.rows,
        pagination: { page, page_size: pageSize, total }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  app.get('/api/admin/returns/:id', requirePermission('returns:read'), async (req, res) => {
    try {
      const { id } = req.params;
      const r = await pool.query(
        `SELECT r.*, o.order_number, o.total_amount, o.payment_status, u.username, u.whatsapp, u.marketing_consent
         FROM return_requests r
         JOIN orders o ON r.order_id = o.id
         JOIN users u ON r.user_id = u.id
         WHERE r.id = $1`,
        [id]
      );
      if (r.rows.length === 0) return res.status(404).json({ error: '售後單不存在' });
      res.json({ return_request: r.rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // Admin: update return status
  app.put('/api/admin/returns/:id/status', requirePermission('returns:write'), async (req, res) => {
    try {
      const { id } = req.params;
      const { status, admin_note, refund_amount, tracking_number } = req.body;

      const updateResult = await pool.query(`
        UPDATE return_requests SET
          status = $1, admin_note = $2, refund_amount = $3,
          tracking_number = $4, updated_at = NOW()
        WHERE id = $5
        RETURNING order_id
      `, [status, admin_note, refund_amount, tracking_number, id]);

      if (updateResult.rows.length === 0) {
        return res.status(404).json({ error: '售後單不存在' });
      }

      await pool.query(
        `INSERT INTO order_status_histories (order_id, status, notes, created_by)
         VALUES ($1, $2, $3, $4)`,
        [updateResult.rows[0].order_id, `return_${status}`, admin_note || null, req.user.id]
      );

      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // ===========================================
  // Supplier & Purchasing Management
  // ===========================================

  app.get('/api/admin/suppliers', requirePermission('inventory:read'), async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT * FROM suppliers ORDER BY is_active DESC, name
      `);
      res.json({ suppliers: result.rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  app.post('/api/admin/suppliers', requirePermission('inventory:write'), async (req, res) => {
    try {
      const name = req.body && req.body.name ? String(req.body.name).trim() : '';
      const contactName = req.body && req.body.contact_name ? String(req.body.contact_name).trim() : null;
      const contactPhone = req.body && req.body.contact_phone ? String(req.body.contact_phone).trim() : null;
      const emailRaw = (req.body && (req.body.email || req.body.contact_email)) ? String(req.body.email || req.body.contact_email).trim() : '';
      const email = emailRaw ? emailRaw : null;
      const address = req.body && req.body.address ? String(req.body.address).trim() : null;
      const paymentTerms = req.body && req.body.payment_terms ? String(req.body.payment_terms).trim() : null;
      const notesRaw = (req.body && (req.body.notes || req.body.note)) ? String(req.body.notes || req.body.note).trim() : '';
      const notes = notesRaw ? notesRaw : null;

      if (!name) return res.status(400).json({ error: 'name 必填' });
      const result = await pool.query(`
        INSERT INTO suppliers (name, contact_name, contact_phone, email, address, payment_terms, notes, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, true)
        RETURNING *
      `, [name, contactName, contactPhone, email, address, paymentTerms, notes]);
      res.json({ success: true, supplier: result.rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  app.put('/api/admin/suppliers/:id', requirePermission('inventory:write'), async (req, res) => {
    try {
      const { id } = req.params;
      const name = req.body && req.body.name ? String(req.body.name).trim() : '';
      const contactName = req.body && req.body.contact_name ? String(req.body.contact_name).trim() : null;
      const contactPhone = req.body && req.body.contact_phone ? String(req.body.contact_phone).trim() : null;
      const emailRaw = (req.body && (req.body.email || req.body.contact_email)) ? String(req.body.email || req.body.contact_email).trim() : '';
      const email = emailRaw ? emailRaw : null;
      const address = req.body && req.body.address ? String(req.body.address).trim() : null;
      const paymentTerms = req.body && req.body.payment_terms ? String(req.body.payment_terms).trim() : null;
      const notesRaw = (req.body && (req.body.notes || req.body.note)) ? String(req.body.notes || req.body.note).trim() : '';
      const notes = notesRaw ? notesRaw : null;
      const isActive = typeof req.body.is_active === 'boolean' ? req.body.is_active : true;

      const supplierId = Number(id);
      if (!Number.isInteger(supplierId) || supplierId <= 0) return res.status(400).json({ error: 'id 不正確' });
      if (!name) return res.status(400).json({ error: 'name 必填' });

      const result = await pool.query(`
        UPDATE suppliers SET
          name = $1, contact_name = $2, contact_phone = $3, email = $4,
          address = $5, payment_terms = $6, notes = $7, is_active = $8, updated_at = NOW()
        WHERE id = $9
        RETURNING *
      `, [name, contactName, contactPhone, email, address, paymentTerms, notes, isActive, supplierId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: '供應商不存在' });
      }

      res.json({ success: true, supplier: result.rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // Purchase Orders (PO) to suppliers
  app.get('/api/admin/purchase-orders', requirePermission('inventory:read'), async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const pageSize = parseInt(req.query.page_size) || 30;
      const offset = (page - 1) * pageSize;
      const status = req.query.status;

      let where = '1=1';
      let params = [];
      if (status) {
        where += ` AND po.status = $1`;
        params.push(status);
      }

      const countResult = await pool.query(`SELECT COUNT(*) FROM purchase_orders po WHERE ${where}`, params);
      const total = parseInt(countResult.rows[0].count);

      const result = await pool.query(`
        SELECT po.*, s.name as supplier_name
        FROM purchase_orders po
        JOIN suppliers s ON po.supplier_id = s.id
        WHERE ${where}
        ORDER BY po.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, [...params, pageSize, offset]);

      res.json({
        purchase_orders: result.rows,
        pagination: { page, page_size: pageSize, total }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  app.post('/api/admin/purchase-orders', requirePermission('inventory:write'), async (req, res) => {
    try {
      const supplierId = Number(req.body && req.body.supplier_id);
      if (!Number.isInteger(supplierId) || supplierId <= 0) return res.status(400).json({ error: 'supplier_id 不正確' });

      const expectedArrivalRaw = req.body && (req.body.expected_arrival_date || req.body.expected_arrival) ? String(req.body.expected_arrival_date || req.body.expected_arrival).trim() : '';
      const expectedArrivalDate = expectedArrivalRaw ? expectedArrivalRaw : null;
      const notesRaw = req.body && (req.body.notes || req.body.note) ? String(req.body.notes || req.body.note).trim() : '';
      const notes = notesRaw ? notesRaw : null;

      const itemsRaw = Array.isArray(req.body && req.body.items) ? req.body.items : [];
      if (itemsRaw.length === 0) return res.status(400).json({ error: 'items 必填' });

      const items = itemsRaw.map((it) => {
        const skuId = Number(it && (it.sku_id || it.product_sku_id));
        const quantity = parseInt(it && it.quantity, 10);
        const costPrice = Number(it && it.cost_price);
        return { sku_id: skuId, quantity, cost_price: costPrice };
      });
      for (const it of items) {
        if (!Number.isInteger(it.sku_id) || it.sku_id <= 0) return res.status(400).json({ error: 'items.sku_id 不正確' });
        if (!Number.isInteger(it.quantity) || it.quantity <= 0) return res.status(400).json({ error: 'items.quantity 不正確' });
        if (!Number.isFinite(it.cost_price) || it.cost_price < 0) return res.status(400).json({ error: 'items.cost_price 不正確' });
      }

      const now = new Date();
      const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
      const poNumber = `PO-${ymd}-${String(Date.now()).slice(-6)}`;

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const skuIds = [...new Set(items.map((it) => it.sku_id))];
        const skuRows = await client.query(
          `SELECT id, product_id
           FROM product_skus
           WHERE id = ANY($1::int[])`,
          [skuIds]
        );
        if (skuRows.rows.length !== skuIds.length) return res.status(400).json({ error: '包含不存在的 sku_id' });

        const skuToProductId = new Map(skuRows.rows.map((r) => [Number(r.id), Number(r.product_id)]));
        const total = items.reduce((acc, it) => acc + it.quantity * it.cost_price, 0);

        const result = await client.query(
          `INSERT INTO purchase_orders (supplier_id, po_number, status, total_amount, expected_arrival_date, notes, created_by)
           VALUES ($1, $2, 'draft', $3, $4, $5, $6)
           RETURNING id, po_number`,
          [supplierId, poNumber, total, expectedArrivalDate, notes, req.user.id]
        );
        const poId = result.rows[0].id;

        for (const it of items) {
          const productId = skuToProductId.get(it.sku_id);
          await client.query(
            `INSERT INTO purchase_order_items (po_id, product_id, sku_id, quantity, cost_price, received_quantity)
             VALUES ($1, $2, $3, $4, $5, 0)`,
            [poId, productId, it.sku_id, it.quantity, it.cost_price]
          );
        }

        await client.query('COMMIT');
        res.json({ success: true, purchase_order_id: poId, po_number: result.rows[0].po_number });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  app.get('/api/admin/purchase-orders/:id', requirePermission('inventory:read'), async (req, res) => {
    try {
      const poId = Number(req.params.id);
      if (!Number.isInteger(poId) || poId <= 0) return res.status(400).json({ error: 'id 不正確' });

      const po = await pool.query(
        `SELECT po.*, s.name AS supplier_name
         FROM purchase_orders po
         JOIN suppliers s ON po.supplier_id = s.id
         WHERE po.id = $1`,
        [poId]
      );
      if (po.rows.length === 0) return res.status(404).json({ error: '採購單不存在' });

      const items = await pool.query(
        `SELECT poi.*,
                ps.sku, ps.barcode,
                COALESCE(p.name_zh_hk, p.name) AS product_name
         FROM purchase_order_items poi
         LEFT JOIN product_skus ps ON ps.id = poi.sku_id
         LEFT JOIN products p ON p.id = poi.product_id
         WHERE poi.po_id = $1
         ORDER BY poi.id ASC`,
        [poId]
      );

      return res.json({ purchase_order: po.rows[0], items: items.rows });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: '服務器錯誤' });
    }
  });

  app.put('/api/admin/purchase-orders/:id/status', requirePermission('inventory:write'), async (req, res) => {
    try {
      const poId = Number(req.params.id);
      const status = req.body && req.body.status ? String(req.body.status) : '';
      const allowed = ['draft', 'ordered', 'received', 'cancelled'];
      if (!Number.isInteger(poId) || poId <= 0) return res.status(400).json({ error: 'id 不正確' });
      if (!allowed.includes(status)) return res.status(400).json({ error: 'status 不正確' });

      const r = await pool.query(
        `UPDATE purchase_orders SET status = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING id, status`,
        [status, poId]
      );
      if (r.rows.length === 0) return res.status(404).json({ error: '採購單不存在' });
      return res.json({ success: true, purchase_order: r.rows[0] });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: '服務器錯誤' });
    }
  });

  app.post('/api/admin/purchase-orders/:id/receive', requirePermission('inventory:write'), async (req, res) => {
    try {
      const poId = Number(req.params.id);
      if (!Number.isInteger(poId) || poId <= 0) return res.status(400).json({ error: 'id 不正確' });

      const linesRaw = Array.isArray(req.body && req.body.lines) ? req.body.lines : [];
      if (linesRaw.length === 0) return res.status(400).json({ error: 'lines 必填' });

      const lines = linesRaw.map((l) => {
        const skuId = Number(l && l.sku_id);
        const quantity = parseInt(l && l.quantity, 10);
        const noteRaw = l && l.note ? String(l.note).trim() : '';
        return { sku_id: skuId, quantity, note: noteRaw ? noteRaw : null };
      });
      for (const l of lines) {
        if (!Number.isInteger(l.sku_id) || l.sku_id <= 0) return res.status(400).json({ error: 'lines.sku_id 不正確' });
        if (!Number.isInteger(l.quantity) || l.quantity <= 0) return res.status(400).json({ error: 'lines.quantity 不正確' });
      }

      let warehouseId = req.body && req.body.warehouse_id ? Number(req.body.warehouse_id) : null;
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const po = await client.query('SELECT id, po_number FROM purchase_orders WHERE id = $1', [poId]);
        if (po.rows.length === 0) return res.status(404).json({ error: '採購單不存在' });
        const poNumberStr = String(po.rows[0].po_number || '');

        if (warehouseId) {
          const w = await client.query(
            'SELECT id FROM inventory_warehouses WHERE id = $1 AND is_active = true LIMIT 1',
            [warehouseId]
          );
          if (w.rows.length === 0) return res.status(400).json({ error: '倉庫不存在或已停用' });
        }
        if (!warehouseId) {
          const w = await client.query(
            'SELECT id FROM inventory_warehouses WHERE is_active = true ORDER BY is_default DESC, id ASC LIMIT 1'
          );
          if (w.rows.length === 0) return res.status(500).json({ error: '未設定倉庫' });
          warehouseId = w.rows[0].id;
        }

        for (const line of lines) {
          const poi = await client.query(
            `SELECT id, product_id, quantity, received_quantity
             FROM purchase_order_items
             WHERE po_id = $1 AND sku_id = $2
             FOR UPDATE`,
            [poId, line.sku_id]
          );
          if (poi.rows.length === 0) return res.status(400).json({ error: `採購單未包含 SKU #${line.sku_id}` });

          const item = poi.rows[0];
          const maxQty = Number(item.quantity);
          const receivedQty = Number(item.received_quantity || 0);
          if (receivedQty + line.quantity > maxQty) return res.status(400).json({ error: `SKU #${line.sku_id} 收貨數量超過採購數量` });

          await client.query(
            'UPDATE purchase_order_items SET received_quantity = received_quantity + $1 WHERE id = $2',
            [line.quantity, item.id]
          );

          await client.query(
            `INSERT INTO inventory_levels (warehouse_id, sku_id, stock)
             VALUES ($1, $2, 0)
             ON CONFLICT (warehouse_id, sku_id) DO NOTHING`,
            [warehouseId, line.sku_id]
          );

          const skuRow = await client.query(
            `SELECT ps.id, ps.product_id, ps.stock AS total_stock, il.stock AS warehouse_stock
             FROM product_skus ps
             JOIN inventory_levels il ON il.sku_id = ps.id AND il.warehouse_id = $2
             WHERE ps.id = $1
             FOR UPDATE OF ps, il`,
            [line.sku_id, warehouseId]
          );
          if (skuRow.rows.length === 0) return res.status(400).json({ error: `SKU #${line.sku_id} 不存在` });

          const warehousePreviousStock = Number(skuRow.rows[0].warehouse_stock || 0);
          const warehouseNewStock = warehousePreviousStock + line.quantity;
          const totalNewStock = Number(skuRow.rows[0].total_stock || 0) + line.quantity;

          await client.query(
            'UPDATE inventory_levels SET stock = $1, updated_at = NOW() WHERE warehouse_id = $2 AND sku_id = $3',
            [warehouseNewStock, warehouseId, line.sku_id]
          );
          await client.query(
            'UPDATE product_skus SET stock = $1, updated_at = NOW() WHERE id = $2',
            [totalNewStock, line.sku_id]
          );

          const txNote = [poNumberStr ? `PO ${poNumberStr}` : `PO #${poId}`, line.note].filter(Boolean).join(' | ');
          await client.query(
            `INSERT INTO inventory_transactions
              (product_id, sku_id, warehouse_id, type, quantity, previous_stock, new_stock, reference_id, note)
             VALUES ($1,$2,$3,'purchase_receive',$4,$5,$6,$7,$8)`,
            [
              skuRow.rows[0].product_id,
              line.sku_id,
              warehouseId,
              line.quantity,
              warehousePreviousStock,
              warehouseNewStock,
              poId,
              txNote || null
            ]
          );
        }

        const check = await client.query(
          `SELECT
             COUNT(*)::int AS total,
             SUM(CASE WHEN COALESCE(received_quantity, 0) >= quantity THEN 1 ELSE 0 END)::int AS received
           FROM purchase_order_items
           WHERE po_id = $1`,
          [poId]
        );
        const totalItems = check.rows[0] ? Number(check.rows[0].total || 0) : 0;
        const receivedItems = check.rows[0] ? Number(check.rows[0].received || 0) : 0;
        if (totalItems > 0 && receivedItems === totalItems) {
          await client.query(
            "UPDATE purchase_orders SET status = 'received', updated_at = NOW() WHERE id = $1",
            [poId]
          );
        }

        await client.query('COMMIT');
        return res.json({ success: true });
      } catch (txErr) {
        await client.query('ROLLBACK');
        throw txErr;
      } finally {
        client.release();
      }
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // ===========================================
  // ShipAny 物流接駁 Integration
  // ===========================================

  // Generate ShipAny label (when order is ready to ship)
  app.post('/api/admin/shipany/generate-label', requirePermission('orders:write'), async (req, res) => {
    try {
      const { order_id, recipient_name, recipient_phone, recipient_address, district, service_type, weight } = req.body;

      // Get ShipAny credentials from environment
      const apiKey = process.env.SHIPANY_API_KEY;
      const apiUrl = process.env.SHIPANY_API_URL || 'https://api.shipany.com/v1';

      if (!apiKey) {
        return res.status(500).json({ error: 'ShipAny 未設定，請檢查環境變量' });
      }

      // Format address for ShipAny (Hong Kong)
      const fullAddress = `${recipient_address}, Hong Kong, ${district}`;

      // Call ShipAny API
      // Reference: https://docs.shipany.com/
      const shipanyPayload = {
        order: {
          order_number: order_id,
          service_type: service_type, // e.g. "sf_express", "ecargo"
          sender: {
            name: process.env.SHIPANY_SENDER_NAME || 'Store Name',
            phone: process.env.SHIPANY_SENDER_PHONE || '',
            address: process.env.SHIPANY_SENDER_ADDRESS || ''
          },
          recipient: {
            name: recipient_name,
            phone: recipient_phone,
            address: fullAddress,
            district: district
          },
          parcel: {
            weight: weight || 1
          }
        }
      };

      // Make request to ShipAny
      const https = require('https');
      const url = require('url');
      const postData = JSON.stringify(shipanyPayload);
      const parsedUrl = url.parse(apiUrl + '/orders/create');

      const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'Authorization': `Bearer ${apiKey}`
        }
      };

      const shipanyReq = https.request(options, (shipanyRes) => {
        let data = '';
        shipanyRes.on('data', (chunk) => {
          data += chunk;
        });
        shipanyRes.on('end', async () => {
          try {
            const result = JSON.parse(data);
            if (result.success || result.status === 'ok') {
              // Save tracking number to order
              const trackingNumber = result.tracking_number || result.tn;
              await pool.query(
                'UPDATE orders SET tracking_number = $1, shipany_label_url = $2, status = $3 WHERE id = $4',
                [trackingNumber, result.label_url, 'shipping', order_id]
              );

              // Save to order history
              await pool.query(`
                INSERT INTO order_status_histories (order_id, status, notes, created_by)
                VALUES ($1, 'shipping', $2, $3)
              `, [order_id, `ShipAny 標籤已生成：${trackingNumber}`, req.user.id]);

              res.json({
                success: true,
                tracking_number: trackingNumber,
                label_url: result.label_url,
                pdf_url: result.pdf_url
              });
            } else {
              res.status(400).json({ error: result.message || 'ShipAny 錯誤' });
            }
          } catch (e) {
            console.error(e);
            res.status(500).json({ error: '解析 ShipAny 回應失敗', raw: data });
          }
        });
      });

      shipanyReq.on('error', (err) => {
        console.error(err);
        res.status(500).json({ error: '連接 ShipAny API 失敗' });
      });

      shipanyReq.write(postData);
      shipanyReq.end();

    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  app.get('/api/admin/orders/:id/tracking', requirePermission('orders:read'), async (req, res) => {
    try {
      const { id } = req.params;
      const orderResult = await pool.query(
        'SELECT id, order_number, tracking_number, tracking_status, tracking_updated_at FROM orders WHERE id = $1',
        [id]
      );
      if (orderResult.rows.length === 0) {
        return res.status(404).json({ error: '訂單不存在' });
      }
      const order = orderResult.rows[0];
      if (!order.tracking_number) {
        return res.json({
          order_number: order.order_number,
          tracking_number: null,
          status: 'not_shipped'
        });
      }

      const apiKey = process.env.SHIPANY_API_KEY;
      const apiUrl = process.env.SHIPANY_API_URL || 'https://api.shipany.com/v1';
      if (!apiKey) {
        return res.json({
          tracking_number: order.tracking_number,
          status: order.tracking_status,
          updated_at: order.tracking_updated_at
        });
      }

      const https = require('https');
      const url = require('url');
      const parsedUrl = url.parse(apiUrl + '/orders/tracking?tracking_number=' + encodeURIComponent(order.tracking_number));
      const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.path,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      };

      const shipanyReq = https.request(options, (shipanyRes) => {
        let data = '';
        shipanyRes.on('data', (chunk) => { data += chunk; });
        shipanyRes.on('end', () => {
          try {
            const result = JSON.parse(data);
            return res.json(result);
          } catch (e) {
            console.error(e);
            return res.status(500).json({ error: '解析 ShipAny 回應失敗', raw: data });
          }
        });
      });

      shipanyReq.on('error', (err) => {
        console.error(err);
        return res.status(500).json({ error: '連接 ShipAny API 失敗' });
      });

      shipanyReq.end();
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // Webhook: ShipAny tracking status update
  app.post('/webhooks/shipany', async (req, res) => {
    try {
      // Verify webhook signature if secret is configured
      const webhookSecret = process.env.SHIPANY_WEBHOOK_SECRET;
      if (webhookSecret) {
        const signature = req.headers['x-shipany-signature'];
        const ok = verifyShipanySignature({ secret: webhookSecret, rawBody: req.rawBody, headerValue: signature });
        if (!ok) return res.status(403).json({ success: false, error: 'Invalid signature' });
      }

      const allowedIps = parseAllowedIps(process.env.SHIPANY_WEBHOOK_ALLOWED_IPS);
      if (allowedIps.size > 0) {
        const ip = extractClientIp({ xForwardedFor: req.headers['x-forwarded-for'], remoteAddress: req.socket && req.socket.remoteAddress });
        if (!isIpAllowed(allowedIps, ip)) return res.status(403).json({ success: false, error: 'IP not allowed' });
      }

      const { tracking_number, status, updated_at } = req.body;

      // Update order tracking status
      await pool.query(`
        UPDATE orders SET
          tracking_status = $1, tracking_updated_at = $2
        WHERE tracking_number = $3
      `, [status, updated_at, tracking_number]);

      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false });
    }
  });

  // Get tracking info from ShipAny
  app.get('/api/orders/:id/tracking', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;

      // Get order
      const orderResult = await pool.query(
        'SELECT id, order_number, tracking_number, tracking_status, tracking_updated_at FROM orders WHERE id = $1 AND user_id = $2',
        [id, req.user.id]
      );

      if (orderResult.rows.length === 0) {
        return res.status(404).json({ error: '訂單不存在' });
      }

      const order = orderResult.rows[0];

      if (!order.tracking_number) {
        return res.json({
          order_number: order.order_number,
          tracking_number: null,
          status: 'not_shipped'
        });
      }

      // Query ShipAny for latest tracking
      const apiKey = process.env.SHIPANY_API_KEY;
      const apiUrl = process.env.SHIPANY_API_URL || 'https://api.shipany.com/v1';

      if (!apiKey) {
        // Return stored info
        return res.json({
          tracking_number: order.tracking_number,
          status: order.tracking_status,
          updated_at: order.tracking_updated_at
        });
      }

      // Call ShipAny API
      const https = require('https');
      const url = require('url');
      const parsedUrl = url.parse(`${apiUrl}/tracking?tn=${order.tracking_number}`);

      const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.path,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      };

      const shipanyReq = https.request(options, (response) => {
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', async () => {
          try {
            const result = JSON.parse(data);
            if (result.success) {
              // Update stored status
              await pool.query(`
                UPDATE orders SET tracking_status = $1, tracking_updated_at = NOW() WHERE id = $2
              `, [result.status, id]);

              res.json({
                tracking_number: order.tracking_number,
                status: result.status,
                events: result.events || [],
                updated_at: new Date()
              });
            } else {
              res.json({
                tracking_number: order.tracking_number,
                status: order.tracking_status,
                updated_at: order.tracking_updated_at,
                error: result.message
              });
            }
          } catch (e) {
            res.json({
              tracking_number: order.tracking_number,
              status: order.tracking_status,
              updated_at: order.tracking_updated_at
            });
          }
        });
      });

      shipanyReq.on('error', () => {
        res.json({
          tracking_number: order.tracking_number,
          status: order.tracking_status,
          updated_at: order.tracking_updated_at
        });
      });

      shipanyReq.end();

    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // ===========================================
  // Payment Gateways Webhooks
  // ===========================================

  async function upsertPaymentTransaction(pool, { orderId, payment_method_code, transaction_id, amount, status, raw }) {
    await pool.query(`
      INSERT INTO payment_transactions
        (order_id, payment_method_code, transaction_id, amount, status, gateway_raw_response, created_at, updated_at)
      VALUES
        ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      ON CONFLICT (payment_method_code, transaction_id)
      DO UPDATE SET
        order_id = EXCLUDED.order_id,
        amount = EXCLUDED.amount,
        status = EXCLUDED.status,
        gateway_raw_response = EXCLUDED.gateway_raw_response,
        updated_at = NOW()
    `, [orderId, payment_method_code, transaction_id, amount, status, raw ? JSON.stringify(raw) : null]);
  }

  // FPS / PayMe webhook
  app.post('/webhooks/fps-payme', async (req, res) => {
    try {
      const { transaction_id, order_id, amount, status } = req.body;

      // Update order payment status
      await pool.query(
        'UPDATE orders SET payment_status = $1, payment_transaction_id = $2, paid_at = NOW() WHERE id = $3',
        [status === 'success' ? 'paid' : 'failed', transaction_id, order_id]
      );

      await upsertPaymentTransaction(pool, {
        orderId: order_id,
        payment_method_code: 'fps_payme',
        transaction_id,
        amount,
        status: status === 'success' ? 'success' : 'failed',
        raw: req.body,
      });

      if (status === 'success') {
        await pool.query(`
          INSERT INTO order_status_histories (order_id, status, notes)
          VALUES ($1, 'paid', $2)
        `, [order_id, 'FPS/PayMe 付款成功']);
      }

      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false });
    }
  });

  // AlipayHK webhook
  app.post('/webhooks/alipayhk', async (req, res) => {
    try {
      const { out_trade_no, trade_no, trade_status } = req.body;

      // AlipayHK: trade_status = TRADE_SUCCESS means paid
      if (trade_status === 'TRADE_SUCCESS') {
        await pool.query(
          'UPDATE orders SET payment_status = $1, payment_transaction_id = $2, paid_at = NOW() WHERE order_number = $3',
          ['paid', trade_no, out_trade_no]
        );

        const orderResult = await pool.query('SELECT id FROM orders WHERE order_number = $1', [out_trade_no]);
        if (orderResult.rows.length > 0) {
          const orderId = orderResult.rows[0].id;
          const amountResult = await pool.query('SELECT total_amount FROM orders WHERE id = $1', [orderId]);
          const amount = amountResult.rows.length > 0 ? amountResult.rows[0].total_amount : null;

          await upsertPaymentTransaction(pool, {
            orderId,
            payment_method_code: 'alipayhk',
            transaction_id: trade_no,
            amount,
            status: 'success',
            raw: req.body,
          });

          await pool.query(`
            INSERT INTO order_status_histories (order_id, status, notes)
            VALUES ($1, 'paid', $2)
          `, [orderId, 'AlipayHK 付款成功']);
        }
      }

      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false });
    }
  });

  // WeChat Pay HK webhook
  app.post('/webhooks/wechatpay', async (req, res) => {
    try {
      const { out_trade_no, transaction_id, trade_state } = req.body;

      if (trade_state === 'SUCCESS') {
        await pool.query(
          'UPDATE orders SET payment_status = $1, payment_transaction_id = $2, paid_at = NOW() WHERE order_number = $3',
          ['paid', transaction_id, out_trade_no]
        );

        const orderResult = await pool.query('SELECT id FROM orders WHERE order_number = $1', [out_trade_no]);
        if (orderResult.rows.length > 0) {
          const orderId = orderResult.rows[0].id;
          const amountResult = await pool.query('SELECT total_amount FROM orders WHERE id = $1', [orderId]);
          const amount = amountResult.rows.length > 0 ? amountResult.rows[0].total_amount : null;

          await upsertPaymentTransaction(pool, {
            orderId,
            payment_method_code: 'wechatpay_hk',
            transaction_id,
            amount,
            status: 'success',
            raw: req.body,
          });

          await pool.query(`
            INSERT INTO order_status_histories (order_id, status, notes)
            VALUES ($1, 'paid', $2)
          `, [orderId, 'WeChat Pay HK 付款成功']);
        }
      }

      res.send('<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[OK]]></return_msg></xml>');
    } catch (err) {
      console.error(err);
      res.send('<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[ERROR]]></return_msg></xml>');
    }
  });

};
