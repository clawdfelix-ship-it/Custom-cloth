/**
 * admin-order-edit.js — 後台訂單內容編輯
 *
 * 功能：
 *   GET  /api/admin/order-edit/search-products  搜尋商品 + SKU（加品用）
 *   POST /api/admin/orders/:id/items            加商品
 *   PUT  /api/admin/orders/:id/items/:itemId    改數量/單價
 *   DELETE /api/admin/orders/:id/items/:itemId  刪除商品行
 *   POST /api/admin/orders/:id/split            分單（開獨立新訂單）
 *   GET  /api/admin/orders/:id/relations        關聯分單清單
 *
 * 規則：
 *   - 全部喺 transaction 內做，改完重算全單金額
 *   - 已出貨嘅行鎖定唔俾改（除非冇 fulfillment）
 *   - 每個動作寫 order_edit_logs
 *   - 權限沿用 orders:write / orders:read
 */
module.exports = function (app, pool) {
  const { requirePermission } = require('./middleware/auth');

  const round2 = (n) => Math.round(Number(n) * 100) / 100;

  async function logEdit(client, orderId, action, detail, adminId) {
    await client.query(
      `INSERT INTO order_edit_logs (order_id, action, detail, admin_id)
       VALUES ($1,$2,$3,$4)`,
      [orderId, action, JSON.stringify(detail || {}), adminId || null]
    );
  }

  // 重算全單 subtotal；shipping_fee / discount 保留，total = subtotal - 折扣 + 運費
  async function recalcOrder(client, orderId) {
    const sum = await client.query(
      `SELECT COALESCE(SUM(quantity * unit_price),0) AS subtotal
       FROM order_items WHERE order_id=$1`,
      [orderId]
    );
    const subtotal = round2(sum.rows[0].subtotal);
    const o = await client.query(
      `SELECT shipping_fee, COALESCE(discount_amount,0) AS discount_amount,
              COALESCE(coupon_discount,0) AS coupon_discount
       FROM orders WHERE id=$1`,
      [orderId]
    );
    const row = o.rows[0];
    const total = round2(
      subtotal - Number(row.discount_amount) - Number(row.coupon_discount) + Number(row.shipping_fee)
    );
    const finalTotal = Math.max(0, total);
    await client.query(
      `UPDATE orders
       SET subtotal_amount=$1, total_amount=$2, updated_at=NOW()
       WHERE id=$3`,
      [subtotal, finalTotal, orderId]
    );
    return { subtotal, total: finalTotal };
  }

  // 取某 order item 已出貨數量
  async function shippedQty(client, itemId) {
    const r = await client.query(
      `SELECT COALESCE(SUM(offi.quantity),0) AS q
       FROM order_fulfillment_items offi
       JOIN order_fulfillments f ON f.id = offi.fulfillment_id
       WHERE offi.order_item_id=$1 AND f.state<>'cancelled'`,
      [itemId]
    );
    return Number(r.rows[0].q);
  }

  // 取訂單連商品明細
  async function fetchOrderItems(client, orderId) {
    const r = await client.query(
      `SELECT oi.*, p.image_url
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id=$1
       ORDER BY oi.id ASC`,
      [orderId]
    );
    return r.rows;
  }

  /* ----------------------------------------------------------------------
     每項已出貨數量（前端鎖定顯示用）
     ?order_id=
  ---------------------------------------------------------------------- */
  app.get(
    '/api/admin/order-edit/shipped-map',
    requirePermission('orders:read'),
    async (req, res) => {
      try {
        const orderId = parseInt(req.query.order_id, 10);
        if (!Number.isInteger(orderId)) return res.json({ map: {} });
        const r = await pool.query(
          `SELECT oi.id AS item_id,
                  COALESCE(SUM(offi.quantity),0) AS q
           FROM order_items oi
           LEFT JOIN order_fulfillment_items offi ON offi.order_item_id = oi.id
           LEFT JOIN order_fulfillments f ON f.id = offi.fulfillment_id AND f.state<>'cancelled'
           WHERE oi.order_id=$1
           GROUP BY oi.id`,
          [orderId]
        );
        const map = {};
        r.rows.forEach((row) => { map[Number(row.item_id)] = Number(row.q); });
        res.json({ map });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: '載入出貨資料失敗' });
      }
    }
  );

  /* ----------------------------------------------------------------------
     搜尋商品 + SKU
     ?q=關鍵字（名/sku/barcode）
  ---------------------------------------------------------------------- */
  app.get(
    '/api/admin/order-edit/search-products',
    requirePermission('orders:read'),
    async (req, res) => {
      try {
        const q = String(req.query.q || '').trim();
        if (q.length < 1) return res.json({ products: [] });
        const like = '%' + q + '%';

        // 先搵商品
        const pr = await pool.query(
          `SELECT id, name, price, original_price, image_url, status
           FROM products
           WHERE (name ILIKE $1 OR CAST(id AS TEXT) = $2)
           ORDER BY id DESC
           LIMIT 15`,
          [like, q]
        );

        // 商品對應 SKU
        const ids = pr.rows.map((p) => p.id);
        let skuByProduct = {};
        if (ids.length) {
          const sr = await pool.query(
            `SELECT id, product_id, sku, barcode, attributes, price, stock, is_active
             FROM product_skus
             WHERE product_id = ANY($1)
             ORDER BY id ASC`,
            [ids]
          );
          skuByProduct = sr.rows.reduce((acc, s) => {
            (acc[s.product_id] = acc[s.product_id] || []).push(s);
            return acc;
          }, {});
        }

        // 直接命中 SKU/barcode 嘅商品（補入）
        const skr = await pool.query(
          `SELECT DISTINCT p.id, p.name, p.price, p.original_price, p.image_url, p.status
           FROM product_skus s JOIN products p ON p.id=s.product_id
           WHERE s.sku ILIKE $1 OR s.barcode ILIKE $1
           LIMIT 15`,
          [like]
        );
        skr.rows.forEach((p) => {
          if (!pr.rows.some((x) => x.id === p.id)) pr.rows.push(p);
        });

        const products = pr.rows.slice(0, 15).map((p) => ({
          id: p.id,
          name: p.name,
          price: Number(p.price),
          image_url: p.image_url,
          status: p.status,
          skus: (skuByProduct[p.id] || []).map((s) => ({
            id: s.id,
            sku: s.sku,
            barcode: s.barcode,
            attributes: s.attributes,
            price: s.price != null ? Number(s.price) : Number(p.price),
            stock: s.stock,
            is_active: s.is_active,
          })),
        }));

        res.json({ products });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: '搜尋失敗' });
      }
    }
  );

  /* ----------------------------------------------------------------------
     加商品到訂單
     body: { product_id, sku_id?, quantity, unit_price? }
  ---------------------------------------------------------------------- */
  app.post(
    '/api/admin/orders/:id/items',
    requirePermission('orders:write'),
    async (req, res) => {
      const client = await pool.connect();
      try {
        const orderId = parseInt(req.params.id, 10);
        const productId = parseInt(req.body.product_id, 10);
        const skuId = req.body.sku_id ? parseInt(req.body.sku_id, 10) : null;
        const quantity = parseInt(req.body.quantity, 10);
        let unitPrice = req.body.unit_price != null ? Number(req.body.unit_price) : null;

        if (!Number.isInteger(productId) || !Number.isInteger(quantity) || quantity < 1) {
          return res.status(400).json({ error: '商品同數量唔正確' });
        }

        await client.query('BEGIN');

        const or = await client.query('SELECT * FROM orders WHERE id=$1', [orderId]);
        if (!or.rows.length) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: '訂單不存在' });
        }
        if (or.rows[0].status === 'cancelled') {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: '已取消訂單唔可以加商品' });
        }

        // 取商品 + SKU 資料
        const pr = await client.query(
          'SELECT id, name, price, status FROM products WHERE id=$1',
          [productId]
        );
        if (!pr.rows.length) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: '商品不存在' });
        }
        const product = pr.rows[0];
        let skuAttributes = null;
        if (skuId) {
          const sr = await client.query(
            'SELECT id, attributes, price FROM product_skus WHERE id=$1 AND product_id=$2',
            [skuId, productId]
          );
          if (!sr.rows.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'SKU 唔存在' });
          }
          skuAttributes = sr.rows[0].attributes;
          if (unitPrice === null) {
            unitPrice = sr.rows[0].price != null ? Number(sr.rows[0].price) : Number(product.price);
          }
        } else if (unitPrice === null) {
          unitPrice = Number(product.price);
        }
        unitPrice = round2(unitPrice);
        const subtotal = round2(unitPrice * quantity);

        // 同已有同 product+sku 嘅行合併
        const existing = await client.query(
          `SELECT id FROM order_items
           WHERE order_id=$1 AND product_id=$2
             AND COALESCE(sku_id,0)=COALESCE($3,0)`,
          [orderId, productId, skuId]
        );

        let itemId;
        if (existing.rows.length) {
          itemId = existing.rows[0].id;
          const shipped = await shippedQty(client, itemId);
          await client.query(
            `UPDATE order_items
             SET quantity=quantity+$1, subtotal=(quantity+$1)*unit_price
             WHERE id=$2`,
            [quantity, itemId]
          );
        } else {
          const ir = await client.query(
            `INSERT INTO order_items
               (order_id, product_id, sku_id, product_name, sku_attributes, quantity, unit_price, subtotal)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
            [orderId, productId, skuId, product.name, skuAttributes, quantity, unitPrice, subtotal]
          );
          itemId = ir.rows[0].id;
        }

        const totals = await recalcOrder(client, orderId);
        await logEdit(
          client,
          orderId,
          'add_item',
          { item_id: itemId, product_id: productId, sku_id: skuId, quantity, unit_price: unitPrice },
          req.session.userId
        );

        await client.query('COMMIT');
        res.json({
          success: true,
          totals,
          items: await fetchOrderItems(pool, orderId),
        });
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error(err);
        res.status(500).json({ error: '加商品失敗' });
      } finally {
        client.release();
      }
    }
  );

  /* ----------------------------------------------------------------------
     改數量 / 單價
     body: { quantity?, unit_price? }
  ---------------------------------------------------------------------- */
  app.put(
    '/api/admin/orders/:id/items/:itemId',
    requirePermission('orders:write'),
    async (req, res) => {
      const client = await pool.connect();
      try {
        const orderId = parseInt(req.params.id, 10);
        const itemId = parseInt(req.params.itemId, 10);
        const hasQty = req.body.quantity != null;
        const hasPrice = req.body.unit_price != null;
        const quantity = parseInt(req.body.quantity, 10);
        const unitPrice = hasPrice ? round2(Number(req.body.unit_price)) : null;

        if (hasQty && (!Number.isInteger(quantity) || quantity < 1)) {
          return res.status(400).json({ error: '數量要係正整數' });
        }
        if (hasPrice && (Number.isNaN(unitPrice) || unitPrice < 0)) {
          return res.status(400).json({ error: '單價唔正確' });
        }

        await client.query('BEGIN');

        const ir = await client.query(
          'SELECT * FROM order_items WHERE id=$1 AND order_id=$2',
          [itemId, orderId]
        );
        if (!ir.rows.length) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: '訂單項目不存在' });
        }

        // 已出貨鎖定：數量唔可以細過已出貨量
        const shipped = await shippedQty(client, itemId);
        const before = ir.rows[0];
        if (hasQty && quantity < shipped) {
          await client.query('ROLLBACK');
          return res
            .status(400)
            .json({ error: `該項已出貨 ${shipped} 件，數量唔可以細過呢個數` });
        }

        const nextQty = hasQty ? quantity : Number(before.quantity);
        const nextPrice = hasPrice ? unitPrice : Number(before.unit_price);
        await client.query(
          `UPDATE order_items
           SET quantity=$1, unit_price=$2, subtotal=$3
           WHERE id=$4`,
          [nextQty, nextPrice, round2(nextQty * nextPrice), itemId]
        );

        const totals = await recalcOrder(client, orderId);
        await logEdit(
          client,
          orderId,
          'update_item',
          {
            item_id: itemId,
            from: { quantity: Number(before.quantity), unit_price: Number(before.unit_price) },
            to: { quantity: nextQty, unit_price: nextPrice },
          },
          req.session.userId
        );

        await client.query('COMMIT');
        res.json({
          success: true,
          totals,
          items: await fetchOrderItems(pool, orderId),
        });
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error(err);
        res.status(500).json({ error: '更新失敗' });
      } finally {
        client.release();
      }
    }
  );

  /* ----------------------------------------------------------------------
     刪除商品行
  ---------------------------------------------------------------------- */
  app.delete(
    '/api/admin/orders/:id/items/:itemId',
    requirePermission('orders:write'),
    async (req, res) => {
      const client = await pool.connect();
      try {
        const orderId = parseInt(req.params.id, 10);
        const itemId = parseInt(req.params.itemId, 10);

        await client.query('BEGIN');

        const ir = await client.query(
          'SELECT * FROM order_items WHERE id=$1 AND order_id=$2',
          [itemId, orderId]
        );
        if (!ir.rows.length) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: '訂單項目不存在' });
        }

        const shipped = await shippedQty(client, itemId);
        if (shipped > 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: `該項已出貨 ${shipped} 件，唔可以直接刪除` });
        }

        // 唔可以刪到最後一行
        const cr = await client.query(
          'SELECT COUNT(*)::int AS c FROM order_items WHERE order_id=$1',
          [orderId]
        );
        if (cr.rows[0].c <= 1) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: '訂單最少要保留一項商品' });
        }

        await client.query('DELETE FROM order_items WHERE id=$1', [itemId]);

        const totals = await recalcOrder(client, orderId);
        await logEdit(
          client,
          orderId,
          'remove_item',
          { item_id: itemId, product_id: ir.rows[0].product_id, product_name: ir.rows[0].product_name },
          req.session.userId
        );

        await client.query('COMMIT');
        res.json({
          success: true,
          totals,
          items: await fetchOrderItems(pool, orderId),
        });
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error(err);
        res.status(500).json({ error: '刪除失敗' });
      } finally {
        client.release();
      }
    }
  );

  /* ----------------------------------------------------------------------
     分單：將選定項目/數量搬去一張獨立新訂單
     body: { items: [{ order_item_id, quantity }], note? }
  ---------------------------------------------------------------------- */
  app.post(
    '/api/admin/orders/:id/split',
    requirePermission('orders:write'),
    async (req, res) => {
      const client = await pool.connect();
      try {
        const orderId = parseInt(req.params.id, 10);
        const splitItems = Array.isArray(req.body.items) ? req.body.items : [];
        const note = req.body.note || null;

        if (!splitItems.length) {
          return res.status(400).json({ error: '請揀要分單嘅商品' });
        }

        await client.query('BEGIN');

        const or = await client.query('SELECT * FROM orders WHERE id=$1', [orderId]);
        if (!or.rows.length) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: '訂單不存在' });
        }
        const parent = or.rows[0];

        // 驗證每項：數量要 <= 可分數量（原數量 - 已出貨）
        const parsed = [];
        let splitSubtotal = 0;
        for (const s of splitItems) {
          const oiId = parseInt(s.order_item_id, 10);
          const qty = parseInt(s.quantity, 10);
          if (!Number.isInteger(oiId) || !Number.isInteger(qty) || qty < 1) {
            throw Object.assign(new Error('分單項目唔正確'), { code: 'BAD_SPLIT' });
          }
          const ir = await client.query(
            'SELECT * FROM order_items WHERE id=$1 AND order_id=$2',
            [oiId, orderId]
          );
          if (!ir.rows.length) {
            throw Object.assign(new Error('訂單項目不存在'), { code: 'BAD_SPLIT' });
          }
          const it = ir.rows[0];
          const shipped = await shippedQty(client, oiId);
          const available = Number(it.quantity) - shipped;
          if (qty > available) {
            throw Object.assign(
              new Error(`「${it.product_name}」可分數量只有 ${available} 件`),
              { code: 'BAD_SPLIT' }
            );
          }
          const lineSubtotal = round2(Number(it.unit_price) * qty);
          splitSubtotal += lineSubtotal;
          parsed.push({ it, qty, lineSubtotal });
        }
        splitSubtotal = round2(splitSubtotal);

        // 按 subtotal 比例分攤折扣（coupon + discount）；運費留喺 parent（通常再出貨先計）
        const parentSubtotal = Number(parent.subtotal_amount);
        const totalDiscount =
          Number(parent.discount_amount || 0) + Number(parent.coupon_discount || 0);
        const ratio = parentSubtotal > 0 ? splitSubtotal / parentSubtotal : 0;
        const splitDiscount = round2(totalDiscount * ratio);
        const splitShipping = 0;
        const splitTotal = Math.max(0, round2(splitSubtotal - splitDiscount + splitShipping));

        // 新訂單：複製聯絡/送貨/付款資料
        const nr = await client.query(
          `INSERT INTO orders
             (user_id, contact_name, contact_phone, contact_email, contact_address,
              pickup_point_id, district, note,
              subtotal_amount, shipping_fee, discount_amount, coupon_discount, total_amount,
              payment_method_code, payment_status, status,
              is_cod, parent_order_id, split_no)
           VALUES
             ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,0,$12,$13,$14,$15,$16,$17,$18)
           RETURNING id`,
          [
            parent.user_id,
            parent.contact_name,
            parent.contact_phone,
            parent.contact_email,
            parent.contact_address,
            parent.pickup_point_id,
            parent.district,
            note,
            splitSubtotal,
            splitShipping,
            splitDiscount,
            splitTotal,
            parent.payment_method_code,
            // 分單視作未付款，要重新核數
            'pending',
            'pending',
            parent.is_cod,
            parent.id,
            0,
          ]
        );
        const newOrderId = nr.rows[0].id;

        // split_no = 目前同 parent 嘅分單數 +1
        const cnt = await client.query(
          'SELECT COUNT(*)::int AS c FROM orders WHERE parent_order_id=$1',
          [orderId]
        );
        await client.query('UPDATE orders SET split_no=$1 WHERE id=$2', [
          cnt.rows[0].c,
          newOrderId,
        ]);

        // 新訂單號
        const now = new Date();
        const ym =
          String(now.getFullYear()).slice(2) +
          String(now.getMonth() + 1).padStart(2, '0') +
          String(now.getDate()).padStart(2, '0');
        const newOrderNumber = `OHYA-${ym}-${String(newOrderId).padStart(6, '0')}-S${cnt.rows[0].c}`;
        await client.query('UPDATE orders SET order_number=$1 WHERE id=$2', [
          newOrderNumber,
          newOrderId,
        ]);

        // 搬商品：全部分走 → 插入新行 + 刪舊行；部分 → 插入新行 + 舊行減數
        for (const p of parsed) {
          await client.query(
            `INSERT INTO order_items
               (order_id, product_id, sku_id, product_name, sku_attributes, quantity, unit_price, subtotal)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [
              newOrderId,
              p.it.product_id,
              p.it.sku_id,
              p.it.product_name,
              p.it.sku_attributes,
              p.qty,
              p.it.unit_price,
              p.lineSubtotal,
            ]
          );
          const remainQty = Number(p.it.quantity) - p.qty;
          if (remainQty <= 0) {
            // 全走：清走舊行嘅 fulfillment 以外（已出貨 shipped>0 嘅情況唔會 qty=full，
            // 因為 available = qty-shipped；故呢度 remainQty 0 只會喺 shipped=0 發生）
            await client.query('DELETE FROM order_items WHERE id=$1', [p.it.id]);
          } else {
            await client.query(
              `UPDATE order_items
               SET quantity=$1, subtotal=$2
               WHERE id=$3`,
              [remainQty, round2(remainQty * Number(p.it.unit_price)), p.it.id]
            );
          }
        }

        // parent 扣返已分走嘅折扣（保留 parent 其餘折扣），重算
        const parentKeepDiscount = round2(Math.max(0, totalDiscount - splitDiscount));
        // 按原兩欄比例歸還（簡化：全部入 discount_amount，coupon_discount 歸 0）
        await client.query(
          `UPDATE orders SET discount_amount=$1, coupon_discount=0 WHERE id=$2`,
          [parentKeepDiscount, orderId]
        );
        const parentTotals = await recalcOrder(client, orderId);

        await logEdit(
          client,
          orderId,
          'split',
          {
            new_order_id: newOrderId,
            new_order_number: newOrderNumber,
            items: parsed.map((p) => ({ item_id: p.it.id, quantity: p.qty })),
            split_total: splitTotal,
          },
          req.session.userId
        );

        await client.query('COMMIT');
        res.json({
          success: true,
          new_order_id: newOrderId,
          new_order_number: newOrderNumber,
          new_total: splitTotal,
          parent_totals: parentTotals,
        });
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        if (err && err.code === 'BAD_SPLIT') {
          return res.status(400).json({ error: err.message });
        }
        console.error(err);
        res.status(500).json({ error: '分單失敗' });
      } finally {
        client.release();
      }
    }
  );

  /* ----------------------------------------------------------------------
     關聯分單清單
  ---------------------------------------------------------------------- */
  app.get(
    '/api/admin/orders/:id/relations',
    requirePermission('orders:read'),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id, 10);
        const children = await pool.query(
          `SELECT id, order_number, total_amount, status, payment_status, split_no, created_at
           FROM orders WHERE parent_order_id=$1 ORDER BY id ASC`,
          [id]
        );
        const parent = await pool.query(
          `SELECT id, order_number, total_amount, status
           FROM orders WHERE id=(SELECT parent_order_id FROM orders WHERE id=$1)`,
          [id]
        );
        res.json({
          parent: parent.rows[0] || null,
          children: children.rows,
        });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: '載入關聯失敗' });
      }
    }
  );
};
