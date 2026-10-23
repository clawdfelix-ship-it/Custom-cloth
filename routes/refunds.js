module.exports = function (app, pool) {
  const { requirePermission } = require('./middleware/auth');
  const { computePaymentStatusAfterRefund } = require('../utils/refundsLogic');

  app.get('/api/admin/refunds', requirePermission('refunds:read'), async (req, res) => {
    try {
      const status = req.query.status ? String(req.query.status) : null;
      const q = req.query.q ? String(req.query.q) : '';

      let where = '1=1';
      const params = [];
      if (status) {
        params.push(status);
        where += ` AND r.status = $${params.length}`;
      }
      if (q) {
        params.push(`%${q}%`);
        where += ` AND (o.order_number ILIKE $${params.length} OR o.id::text ILIKE $${params.length})`;
      }

      const result = await pool.query(
        `SELECT r.*, o.order_number, o.total_amount, o.payment_status
         FROM refunds r
         JOIN orders o ON r.order_id = o.id
         WHERE ${where}
         ORDER BY r.created_at DESC`,
        params
      );
      res.json({ refunds: result.rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  app.post('/api/admin/refunds', requirePermission('refunds:write'), async (req, res) => {
    try {
      const { order_id, reason, type, amount } = req.body || {};
      if (!order_id || !reason || !type || amount === undefined) {
        return res.status(400).json({ error: 'order_id / reason / type / amount 必填' });
      }
      const out = await pool.query(
        `INSERT INTO refunds (order_id, reason, amount, type, status, created_at)
         VALUES ($1, $2, $3, $4, 'pending', NOW())
         RETURNING *`,
        [order_id, reason, amount, type]
      );

      await pool.query(
        `INSERT INTO order_status_histories (order_id, status, notes, created_by)
         VALUES ($1, 'refund_requested', $2, $3)`,
        [order_id, `退款申請：${type} ${amount}`, req.user.id]
      );

      res.json({ success: true, refund: out.rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  app.post('/api/admin/refunds/:id/approve', requirePermission('refunds:write'), async (req, res) => {
    try {
      const { id } = req.params;
      const r = await pool.query(
        `UPDATE refunds
         SET status='approved', approved_by=$1, approved_at=NOW()
         WHERE id=$2
         RETURNING *`,
        [req.user.id, id]
      );
      if (r.rows.length === 0) return res.status(404).json({ error: '退款單不存在' });

      await pool.query(
        `INSERT INTO order_status_histories (order_id, status, notes, created_by)
         VALUES ($1, 'refund_approved', $2, $3)`,
        [r.rows[0].order_id, `退款已批准：${r.rows[0].amount}`, req.user.id]
      );

      res.json({ success: true, refund: r.rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  app.post('/api/admin/refunds/:id/reject', requirePermission('refunds:write'), async (req, res) => {
    try {
      const { id } = req.params;
      const note = req.body && req.body.note ? String(req.body.note) : '';
      if (!note) return res.status(400).json({ error: 'note 必填' });
      const r = await pool.query(
        `UPDATE refunds
         SET status='rejected', rejected_by=$1, rejected_at=NOW(), note=$2
         WHERE id=$3
         RETURNING *`,
        [req.user.id, note, id]
      );
      if (r.rows.length === 0) return res.status(404).json({ error: '退款單不存在' });

      await pool.query(
        `INSERT INTO order_status_histories (order_id, status, notes, created_by)
         VALUES ($1, 'refund_rejected', $2, $3)`,
        [r.rows[0].order_id, `退款被拒絕：${note}`, req.user.id]
      );

      res.json({ success: true, refund: r.rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  app.post('/api/admin/refunds/:id/complete', requirePermission('refunds:write'), async (req, res) => {
    try {
      const { id } = req.params;
      const { refund_transaction_id, payment_transaction_id, note } = req.body || {};
      if (!refund_transaction_id) return res.status(400).json({ error: 'refund_transaction_id 必填' });

      const r = await pool.query(`SELECT * FROM refunds WHERE id=$1`, [id]);
      if (r.rows.length === 0) return res.status(404).json({ error: '退款單不存在' });
      const refund = r.rows[0];

      const o = await pool.query(`SELECT id, total_amount FROM orders WHERE id=$1`, [refund.order_id]);
      if (o.rows.length === 0) return res.status(404).json({ error: '訂單不存在' });
      const order = o.rows[0];

      const paymentStatus = computePaymentStatusAfterRefund({ orderTotal: order.total_amount, refundAmount: refund.amount });

      await pool.query(
        `UPDATE refunds
         SET status='completed', refund_transaction_id=$1, payment_transaction_id=$2,
             processed_by=$3, processed_at=NOW(), note=COALESCE($4, note)
         WHERE id=$5`,
        [refund_transaction_id, payment_transaction_id || null, req.user.id, note || null, id]
      );

      await pool.query(
        `UPDATE orders SET payment_status=$1, updated_at=NOW() WHERE id=$2`,
        [paymentStatus, refund.order_id]
      );

      await pool.query(
        `INSERT INTO order_status_histories (order_id, status, notes, created_by)
         VALUES ($1, 'refund_completed', $2, $3)`,
        [refund.order_id, `退款完成：${refund.amount}（憑證：${refund_transaction_id}）`, req.user.id]
      );

      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });
};
