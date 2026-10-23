module.exports = function (app, pool) {
  const { requirePermission } = require('./middleware/auth');
  const { reconcileDaily } = require('../utils/reconciliation');

  app.get('/api/admin/reconciliation/daily', requirePermission('reconciliation:read'), async (req, res) => {
    try {
      const date = String(req.query.date || '').slice(0, 10);
      const method = req.query.payment_method_code ? String(req.query.payment_method_code) : null;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ error: 'date 格式必須為 YYYY-MM-DD' });
      }

      const dateStart = date + ' 00:00:00';
      const dateEnd = date + ' 23:59:59';

      const ordersParams = [dateStart, dateEnd];
      let ordersWhere = `o.payment_status = 'paid' AND COALESCE(o.paid_at, o.created_at) BETWEEN $1 AND $2`;
      if (method) {
        ordersWhere += ` AND o.payment_method_code = $3`;
        ordersParams.push(method);
      }

      const ordersResult = await pool.query(
        `SELECT o.id, o.order_number, o.total_amount, o.payment_status, o.payment_method_code, o.paid_at, o.created_at
         FROM orders o
         WHERE ${ordersWhere}
         ORDER BY COALESCE(o.paid_at, o.created_at) ASC`,
        ordersParams
      );

      const txParams = [dateStart, dateEnd];
      let txWhere = `t.status = 'success' AND t.created_at BETWEEN $1 AND $2`;
      if (method) {
        txWhere += ` AND t.payment_method_code = $3`;
        txParams.push(method);
      }

      const txResult = await pool.query(
        `SELECT t.order_id, t.payment_method_code, t.transaction_id, t.amount, t.status, t.created_at
         FROM payment_transactions t
         WHERE ${txWhere}
         ORDER BY t.created_at ASC`,
        txParams
      );

      const out = reconcileDaily({ orders: ordersResult.rows, transactions: txResult.rows });
      res.json({ date, payment_method_code: method, ...out });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });
};
