module.exports = function(app, pool, requireAuth, requireAdmin) {
  const path = require('path');
  const multer = require('multer');
  const { requirePermission } = require('./middleware/auth');
  const { createOrderService } = require('../utils/orderService');

  // 入數證明：memory storage，只收圖片，上限 8MB
  const proofUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const ok = /^image\/(jpeg|png|gif|webp|heic|heif)$/.test(file.mimetype);
      cb(ok ? null : new Error('只接受圖片檔（JPG/PNG/GIF/WEBP）'), ok);
    },
  });

  // 只准本人操作自己張訂單
  async function loadOwnedOrder(userId, id) {
    const r = await pool.query('SELECT * FROM orders WHERE id=$1 AND user_id=$2', [id, userId]);
    return r.rows[0] || null;
  }

  // Get my orders (current user)
  app.get('/api/orders', requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const page = parseInt(req.query.page) || 1;
      const perPage = parseInt(req.query.per_page) || 10;
      const offset = (page - 1) * perPage;

      const countResult = await pool.query('SELECT COUNT(*) as total FROM orders WHERE user_id = $1', [userId]);
      const total = parseInt(countResult.rows[0].total);

      const result = await pool.query(`
        SELECT o.*, COUNT(oi.id) as item_count
        FROM orders o
        LEFT JOIN order_items oi ON o.id = oi.order_id
        WHERE o.user_id = $1
        GROUP BY o.id
        ORDER BY o.created_at DESC
        LIMIT $2 OFFSET $3
      `, [userId, perPage, offset]);

      res.json({
        orders: result.rows,
        pagination: {
          page,
          perPage,
          total,
          totalPages: Math.ceil(total / perPage)
        }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // Get single order detail
  app.get('/api/orders/:id', requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const { id } = req.params;

      const orderResult = await pool.query(`
        SELECT o.*
        FROM orders o
        WHERE o.id = $1 AND o.user_id = $2
      `, [id, userId]);

      if (orderResult.rows.length === 0) {
        return res.status(404).json({ error: '訂單不存在' });
      }

      const itemsResult = await pool.query(`
        SELECT oi.*, p.name, p.image_url
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = $1
      `, [id]);

      res.json({
        order: orderResult.rows[0],
        items: itemsResult.rows
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // Create new order from cart
  // 付款：銀行轉帳 / FPS（人工核實，payment_status 起步 pending）；運費：到付（shipping_fee=0）
  app.post('/api/orders', requireAuth, async (req, res) => {
    const client = await pool.connect();
    try {
      const userId = req.session.userId;
      const { contact_name, contact_phone, contact_address, note, payment_method } = req.body;
      const redeemPointsReq = parseInt(req.body.points_redeem, 10);
      const usePoints = Number.isInteger(redeemPointsReq) && redeemPointsReq > 0;

      if (!contact_name || !contact_phone || !contact_address) {
        return res.status(400).json({ error: '聯絡資訊不全' });
      }

      // 暫時只開放銀行轉帳 / FPS
      const ALLOWED_PAYMENT = { bank_transfer: '銀行轉帳', fps: 'FPS 轉數快' };
      const paymentCode = ALLOWED_PAYMENT[payment_method] ? payment_method : null;
      if (!paymentCode) {
        return res.status(400).json({ error: '請選擇付款方式（銀行轉帳或 FPS 轉數快）' });
      }

      await client.query('BEGIN');

      // Get cart items（預購模式：不追蹤庫存，只驗商品仍上架）
      const cartResult = await client.query(`
        SELECT ci.id AS cart_item_id, ci.product_id, ci.quantity,
               p.price, p.name, p.status
        FROM cart_items ci
        JOIN products p ON ci.product_id = p.id
        WHERE ci.user_id = $1
        FOR UPDATE OF p
      `, [userId]);

      if (cartResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: '購物車是空的' });
      }

      // 預購模式：商品仍有效即可，數量不受庫存限制
      for (const item of cartResult.rows) {
        if (item.status !== 'active') {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: `商品「${item.name}」已落架` });
        }
      }

      // 小計（DB products.price 單位為 HKD；運費到付，落單唔收運費）
      let subtotal = 0;
      cartResult.rows.forEach(item => {
        subtotal += Number(item.price) * Number(item.quantity);
      });
      const subtotalMoney = Number(subtotal.toFixed(2));

      // ---- 積分兌換：伺服器權威驗證（唔信前台） ----
      let pointsDiscount = 0;
      let appliedRedeem = 0;
      let pointsCfg = null;
      if (usePoints) {
        const pointsService = require('../lib/pointsService');
        pointsCfg = await pointsService.loadConfig(pool);
        if (!pointsCfg.enabled) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: '積分系統已關閉' });
        }
        if (redeemPointsReq < pointsCfg.minRedeem) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: '最低兌換 ' + pointsCfg.minRedeem + ' 分' });
        }

        // 鎖用戶行，查真實結餘
        const u = await client.query('SELECT points FROM users WHERE id=$1 FOR UPDATE', [userId]);
        const balance = parseInt(u.rows[0] && u.rows[0].points || 0, 10);
        if (redeemPointsReq > balance) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: '積分結餘不足' });
        }

        pointsDiscount = pointsService.pointsToHkd(redeemPointsReq, pointsCfg);
        // 折扣唔可以超過商品小計（運費到付，唔包運費）；貼近可扣上限時向下取整到 redeemHkd 整數倍
        if (pointsDiscount > subtotalMoney) {
          pointsDiscount = subtotalMoney;
        }
        // 保證折扣對應嘅分數係 redeemHkd 整數倍（向下取整，唔會多扣）
        const redeemHkd = pointsCfg.redeemHkd;
        appliedRedeem = Math.floor(pointsDiscount * redeemHkd);
        if (appliedRedeem > balance) appliedRedeem = balance;
        pointsDiscount = Number((appliedRedeem / redeemHkd).toFixed(2));

        if (appliedRedeem <= 0 || pointsDiscount <= 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: '積分兌換金額有誤' });
        }
      }

      const totalMoney = Number((subtotalMoney - pointsDiscount).toFixed(2));

      const orderResult = await client.query(`
        INSERT INTO orders
          (user_id, contact_name, contact_phone, contact_address, note,
           subtotal_amount, shipping_fee, discount_amount, coupon_discount, is_cod, total_amount,
           payment_method_code, payment_status, status)
        VALUES ($1, $2, $3, $4, $5, $6, 0, $7, 0, true, $8, $9, 'pending', 'pending')
        RETURNING id
      `, [userId, contact_name, contact_phone, contact_address, note || null,
           subtotalMoney, pointsDiscount, totalMoney, paymentCode]);

      const orderId = orderResult.rows[0].id;

      // 積分兌換落帳：同一交易內扣 users.points + 寫流水（冪等 type='redeem'）
      if (usePoints && appliedRedeem > 0) {
        const pointsService = require('../lib/pointsService');
        await pointsService.postEntry(client, {
          userId,
          points: -appliedRedeem,
          type: 'redeem',
          description: '結帳兌換即減 HK$' + pointsDiscount.toFixed(2),
          orderId,
        });
      }

      // 人睇嘅訂單編號 OHYA-YYMMDD-000123
      const now = new Date();
      const ym = String(now.getFullYear()).slice(2) +
        String(now.getMonth() + 1).padStart(2, '0') +
        String(now.getDate()).padStart(2, '0');
      const orderNumber = `OHYA-${ym}-${String(orderId).padStart(6, '0')}`;
      await client.query('UPDATE orders SET order_number = $1 WHERE id = $2', [orderNumber, orderId]);

      // Create order items（預購模式不扣庫存）
      for (const item of cartResult.rows) {
        await client.query(`
          INSERT INTO order_items (order_id, product_id, quantity, unit_price)
          VALUES ($1, $2, $3, $4)
        `, [orderId, item.product_id, item.quantity, item.price]);
      }

      // Clear cart
      await client.query('DELETE FROM cart_items WHERE user_id = $1', [userId]);

      // 喺同一個交易入面將交易電郵寫入 outbox（訂單 commit 成功 = 郵件一定已入隊）。
      // 唔喺呢度直接 SMTP：serverless 冷啟動開新連線會逾時/被 relay 节流，
      // 改由定時 worker（cron）補發，保證最終送到。
      try {
        const { buildOrderConfirmation, buildAdminNewOrder } = require('../utils/orderEmails');
        const userEmailRow = await client.query('SELECT email FROM users WHERE id = $1', [userId]);
        const emailOrder = {
          order_number: orderNumber,
          contact_name: contact_name,
          contact_phone: contact_phone,
          contact_address: contact_address,
          note: note || null,
          subtotal_amount: subtotalMoney,
          points_discount: pointsDiscount,
          total_amount: totalMoney,
          payment_method_code: paymentCode,
          email: (userEmailRow.rows[0] && userEmailRow.rows[0].email) || null,
        };
        const emailItems = cartResult.rows.map((r) => ({
          name: r.name, quantity: r.quantity, unit_price: r.price,
        }));
        const messages = [
          buildOrderConfirmation(emailOrder, emailItems),
          buildAdminNewOrder(emailOrder, emailItems),
        ].filter(Boolean);
        for (const msg of messages) {
          await client.query(`
            INSERT INTO email_outbox
              (to_address, subject, html_body, text_body, related_type, related_id)
            VALUES ($1, $2, $3, $4, 'order', $5)
          `, [msg.to, msg.subject, msg.html, msg.text, orderId]);
        }
      } catch (queueErr) {
        // 入隊失敗唔可以靜默：交易回滚，避免訂單成立但冇通知。
        await client.query('ROLLBACK');
        console.error('[orders] outbox enqueue failed:', queueErr);
        return res.status(500).json({ error: '建立訂單通知失敗，請重試' });
      }

      await client.query('COMMIT');

      // Best-effort：warm 實例即場試發（成功即時到，失敗由 cron 補發，唔阻塞回應）。
      try {
        const { flushOutbox } = require('../utils/outboxWorker');
        await flushOutbox(pool, { limit: 5, maxRuntimeMs: 4000 });
      } catch (_) { /* cron 會補發 */ }

      res.json({ success: true, orderId, orderNumber, paymentMethod: paymentCode });
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    } finally {
      client.release();
    }
  });

  // Cancel order (user)
  app.post('/api/orders/:id/cancel', requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const { id } = req.params;

      // Check order exists and belongs to user
      const orderCheck = await pool.query('SELECT * FROM orders WHERE id = $1 AND user_id = $2', [id, userId]);
      if (orderCheck.rows.length === 0) {
        return res.status(404).json({ error: '訂單不存在' });
      }

      const order = orderCheck.rows[0];
      if (!['pending', 'paid'].includes(order.status)) {
        return res.status(400).json({ error: '此訂單無法取消' });
      }

      // Start transaction to restore stock
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // 預購模式：取消訂單不退還庫存
        // Update order status
        await client.query('UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2', ['cancelled', id]);

        await client.query('COMMIT');
        res.json({ success: true });
      } catch (txErr) {
        await client.query('ROLLBACK');
        throw txErr;
      } finally {
        client.release();
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // Admin: Get all orders
  app.get('/api/admin/orders', requirePermission('orders:read'), async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const perPage = parseInt(req.query.per_page) || 30;
      const status = req.query.status;
      const search = req.query.search || '';
      const offset = (page - 1) * perPage;

      let where = '1=1';
      let params = [];
      let paramIndex = 1;

      if (status) {
        where += ` AND o.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      if (search) {
        where += ` AND (o.contact_name ILIKE $${paramIndex} OR o.contact_phone ILIKE $${paramIndex} OR o.id::text ILIKE $${paramIndex})`;
        params.push(`%${search}%`);
        paramIndex++;
      }

      const countResult = await pool.query(`SELECT COUNT(*) as total FROM orders o WHERE ${where}`, params);
      const total = parseInt(countResult.rows[0].total);

      const result = await pool.query(`
        SELECT o.*, u.username
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        WHERE ${where}
        ORDER BY o.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `, [...params, perPage, offset]);

      res.json({
        orders: result.rows,
        pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // Admin: Update order status
  app.put('/api/admin/orders/:id/status', requirePermission('orders:write'), async (req, res) => {
    const client = await pool.connect();
    try {
      const orderId = parseInt(req.params.id, 10);
      const { status, tracking_number } = req.body;

      const allowedStatuses = ['pending', 'paid', 'shipping', 'completed', 'cancelled'];
      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({ error: '無效狀態' });
      }
      const adminId = req.session.userId;
      const base = '後台手動更新狀態';
      const pointsService = require('../lib/pointsService');
      const pointsCfg = await pointsService.loadConfig(pool);
      const svc = createOrderService(client);
      let derived;
      let pointsResult = null;

      await client.query('BEGIN');
      const orderRowR = await client.query(
        'SELECT * FROM orders WHERE id = $1 FOR UPDATE',
        [orderId]
      );
      if (!orderRowR.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: '訂單不存在' });
      }
      const orderRow = orderRowR.rows[0];
      if (status === 'paid') {
        derived = await svc.transitionPayment(orderId, 'paid', { note: base + '→已付款', processedBy: adminId });
        await client.query('UPDATE orders SET paid_at=COALESCE(paid_at,NOW()) WHERE id=$1', [orderId]);
      } else if (status === 'shipping') {
        const itemsR = await client.query(`
          SELECT oi.id, oi.quantity
            - COALESCE((
                SELECT SUM(offi.quantity) FROM order_fulfillment_items offi
                JOIN order_fulfillments f ON f.id=offi.fulfillment_id
                WHERE offi.order_item_id=oi.id AND f.state<>'cancelled'), 0) AS remaining
          FROM order_items oi WHERE oi.order_id=$1`, [orderId]);
        const remaining = itemsR.rows
          .map(r => ({ order_item_id: r.id, quantity: Number(r.remaining) }))
          .filter(x => x.quantity > 0);
        if (!remaining.length) {
          throw Object.assign(new Error('所有商品已出貨，無需再建出貨單'), { code: 'NOTHING_TO_SHIP' });
        }
        if (tracking_number) {
          await client.query('UPDATE orders SET tracking_number=$1 WHERE id=$2', [tracking_number, orderId]);
        }
        derived = await svc.createFulfillment(orderId, remaining,
          { tracking_number: tracking_number || null },
          { note: base + '→派送中', processedBy: adminId });
      } else if (status === 'completed') {
        derived = await svc.completeOrder(orderId, { note: base + '→已完成', processedBy: adminId });
        // 完成即發分（冪等）
        pointsResult = await pointsService.awardOrderPoints(client, orderRow, pointsCfg);
      } else if (status === 'cancelled') {
        derived = await svc.cancelOrder(orderId, { note: base + '→已取消', processedBy: adminId });
        // 取消即追回之前嘅發分（若有）
        pointsResult = await pointsService.revokeOrderPoints(client, orderRow, pointsCfg);
      } else {
        throw Object.assign(new Error('唔可以手動設為待付款；如需重置請用駁回憑證'), { code: 'INVALID_ORDER_TRANSITION' });
      }
      await client.query('COMMIT');

      const result = await pool.query('SELECT * FROM orders WHERE id=$1', [orderId]);
      res.json({ success: true, status: derived, order: result.rows[0], points: pointsResult });
    } catch (err) {
      await client.query('ROLLBACK').catch(()=>{});
      if (err && (err.code === 'INVALID_ORDER_TRANSITION' || err.code === 'NOTHING_TO_SHIP')) {
        return res.status(400).json({ error: err.message });
      }
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    } finally {
      client.release();
    }
  });

  // Admin: Get order details (full info with items)
  app.get('/api/admin/orders/:id', requirePermission('orders:read'), async (req, res) => {
    try {
      const { id } = req.params;

      const orderResult = await pool.query(`
        SELECT o.*, u.username, u.contact, u.whatsapp, u.marketing_consent
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        WHERE o.id = $1
      `, [id]);

      if (orderResult.rows.length === 0) {
        return res.status(404).json({ error: '訂單不存在' });
      }

      const itemsResult = await pool.query(`
        SELECT oi.*, p.name, p.image_url
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = $1
      `, [id]);

      res.json({
        order: orderResult.rows[0],
        items: itemsResult.rows
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // ---- 入數證明（後台審批）----

  // 後台列出待審憑證
  app.get('/api/admin/payment-proofs/pending', requirePermission('orders:read'), async (req, res) => {
    try {
      const r = await pool.query(`
        SELECT pp.id, pp.order_id, pp.file_name, pp.mime_type, pp.file_size, pp.created_at,
               o.order_number, o.total_amount, o.payment_method_code, o.contact_name
        FROM payment_proofs pp JOIN orders o ON o.id = pp.order_id
        WHERE pp.status='pending' ORDER BY pp.created_at ASC
      `);
      res.json({ proofs: r.rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // 後台取憑證圖
  app.get('/api/admin/orders/:id/proof/image', requirePermission('orders:read'), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const r = await pool.query('SELECT mime_type, file_data FROM payment_proofs WHERE order_id=$1 ORDER BY created_at DESC LIMIT 1', [id]);
      if (!r.rows[0]) return res.status(404).end();
      res.setHeader('Content-Type', r.rows[0].mime_type || 'image/jpeg');
      res.setHeader('Cache-Control', 'private, max-age=300');
      res.send(r.rows[0].file_data);
    } catch (err) {
      console.error(err);
      res.status(500).end();
    }
  });

  // 確認收款：憑證 approved、訂單 payment_status=paid
  app.post('/api/admin/orders/:id/proof/approve', requirePermission('orders:write'), async (req, res) => {
    const client = await pool.connect();
    try {
      const reviewerId = req.session.userId;
      const id = parseInt(req.params.id, 10);
      await client.query('BEGIN');
      const pu = await client.query(`
        UPDATE payment_proofs SET status='approved', reviewed_by=$1, reviewed_at=NOW()
        WHERE order_id=$2 AND status='pending' RETURNING id
      `, [reviewerId, id]);
      if (pu.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: '冇待審嘅憑證' });
      }
      await client.query(`
        UPDATE orders SET paid_at=NOW() WHERE id=$1
      `, [id]);
      const orderSvc = createOrderService(client);
      const derived = await orderSvc.transitionPayment(id, 'paid', {
        note: '入數證明已審批確認收款', processedBy: reviewerId,
      });
      await client.query('COMMIT');
      res.json({ ok: true, payment_status: 'paid', status: derived });
    } catch (err) {
      await client.query('ROLLBACK').catch(()=>{});
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    } finally {
      client.release();
    }
  });

  // 駁回：憑證 rejected、訂單 payment_status 返 pending，等買家重傳
  app.post('/api/admin/orders/:id/proof/reject', requirePermission('orders:write'), async (req, res) => {
    const client = await pool.connect();
    try {
      const reviewerId = req.session.userId;
      const id = parseInt(req.params.id, 10);
      const reason = (req.body && req.body.reason ? String(req.body.reason) : '').slice(0, 300);
      await client.query('BEGIN');
      const pu = await client.query(`
        UPDATE payment_proofs SET status='rejected', reviewed_by=$1, reviewed_at=NOW(), reject_reason=$3
        WHERE order_id=$2 AND status='pending' RETURNING id
      `, [reviewerId, id, reason]);
      if (pu.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: '冇待審嘅憑證' });
      }
      await client.query("UPDATE orders SET updated_at=NOW() WHERE id=$1", [id]);
      const orderSvc = createOrderService(client);
      const derived = await orderSvc.transitionPayment(id, 'unpaid', {
        note: '入數證明被駁回：' + (reason || '冇註明原因'), processedBy: reviewerId,
      });
      await client.query('COMMIT');
      res.json({ ok: true, payment_status: 'pending', status: derived });
    } catch (err) {
      await client.query('ROLLBACK').catch(()=>{});
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    } finally {
      client.release();
    }
  });

  // ---- 入數證明（會員）----

  // 上傳入數證明：待付款或被駁回先准上傳
  app.post('/api/orders/:id/proof', requireAuth, proofUpload.single('proof'), async (req, res) => {
    try {
      const userId = req.session.userId;
      const id = parseInt(req.params.id, 10);
      if (!Number.isFinite(id)) return res.status(400).json({ error: '訂單編號無效' });

      const order = await loadOwnedOrder(userId, id);
      if (!order) return res.status(404).json({ error: '訂單不存在' });
      if (order.status === 'cancelled') return res.status(400).json({ error: '訂單已取消，唔可以上傳' });
      if (order.payment_status === 'paid') return res.status(400).json({ error: '訂單已確認收款' });
      if (!req.file) return res.status(400).json({ error: '請揀一張入數相' });

      // 舊 pending/rejected 憑證作廢（重傳場景），再插新一張
      await pool.query("UPDATE payment_proofs SET status='superseded', reviewed_at=NOW() WHERE order_id=$1 AND status IN ('pending','rejected')", [id]);
      const ins = await pool.query(`
        INSERT INTO payment_proofs (order_id, uploaded_by, file_name, mime_type, file_size, file_data, status)
        VALUES ($1,$2,$3,$4,$5,$6,'pending') RETURNING id
      `, [id, userId, req.file.originalname, req.file.mimetype, req.file.size, req.file.buffer]);

      await pool.query("UPDATE orders SET payment_status='proof_pending', updated_at=NOW() WHERE id=$1", [id]);

      res.json({ ok: true, proof_id: ins.rows[0].id, payment_status: 'proof_pending' });
    } catch (err) {
      console.error('proof upload error:', err);
      res.status(500).json({ error: err.message || '上傳失敗' });
    }
  });

  // 查詢我嘅最新憑證狀態（供頁面顯示）
  app.get('/api/orders/:id/proof', requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const id = parseInt(req.params.id, 10);
      if (!Number.isFinite(id)) return res.status(400).json({ error: '訂單編號無效' });
      const order = await loadOwnedOrder(userId, id);
      if (!order) return res.status(404).json({ error: '訂單不存在' });

      const r = await pool.query(`
        SELECT id, file_name, mime_type, file_size, status, reject_reason, created_at, reviewed_at
        FROM payment_proofs WHERE order_id=$1 ORDER BY created_at DESC LIMIT 1
      `, [id]);
      res.json({ payment_status: order.payment_status, proof: r.rows[0] || null });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // 取回我嘅憑證圖（只准本人）
  app.get('/api/orders/:id/proof/image', requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const id = parseInt(req.params.id, 10);
      const order = await loadOwnedOrder(userId, id);
      if (!order) return res.status(404).end();
      const r = await pool.query('SELECT mime_type, file_data FROM payment_proofs WHERE order_id=$1 ORDER BY created_at DESC LIMIT 1', [id]);
      if (!r.rows[0]) return res.status(404).end();
      res.setHeader('Content-Type', r.rows[0].mime_type || 'image/jpeg');
      res.setHeader('Cache-Control', 'private, max-age=300');
      res.send(r.rows[0].file_data);
    } catch (err) {
      console.error(err);
      res.status(500).end();
    }
  });

};
