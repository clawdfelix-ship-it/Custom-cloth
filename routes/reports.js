// ===========================================
// Reports & Statistics API
// Sales, inventory, financial reports
// Hong Kong E-commerce Full Feature
// ===========================================

module.exports = function(app, pool) {

  const { requirePermission } = require('./middleware/auth');

  // ===========================================
  // Dashboard Overview
  // ===========================================

  app.get('/api/admin/dashboard/overview', requirePermission('reports:read'), async (req, res) => {
    try {
      // Today
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      // Yesterday
      const yesterdayStart = new Date(todayStart);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);
      const yesterdayEnd = new Date(todayEnd);
      yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);
      yesterdayEnd.setHours(23, 59, 59, 999);

      // 7 days
      const sevenDaysAgo = new Date(todayStart);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Today stats
      const todayResult = await pool.query(`
        SELECT
          COUNT(*) as order_count,
          COALESCE(SUM(total_amount), 0) as total_sales
        FROM orders
        WHERE created_at >= $1 AND created_at <= $2 AND status != 'cancelled'
      `, [todayStart, todayEnd]);

      // Yesterday stats
      const yesterdayResult = await pool.query(`
        SELECT
          COUNT(*) as order_count,
          COALESCE(SUM(total_amount), 0) as total_sales
        FROM orders
        WHERE created_at >= $1 AND created_at <= $2 AND status != 'cancelled'
      `, [yesterdayStart, yesterdayEnd]);

      // 7 days
      const sevenDaysResult = await pool.query(`
        SELECT
          COUNT(*) as order_count,
          COALESCE(SUM(total_amount), 0) as total_sales
        FROM orders
        WHERE created_at >= $1 AND created_at <= $2 AND status != 'cancelled'
      `, [sevenDaysAgo, todayEnd]);

      // Total customers
      const customersResult = await pool.query('SELECT COUNT(*) as total FROM users WHERE is_active = true');

      // Total products
      const productsResult = await pool.query('SELECT COUNT(*) as total FROM products WHERE status = \'active\'');

      // Low stock products
      const lowStockResult = await pool.query(`
        SELECT COUNT(*) as low_stock_count FROM (
          SELECT p.id FROM products p
          LEFT JOIN product_skus ps ON p.id = ps.product_id
          WHERE p.status = 'active'
          GROUP BY p.id
          HAVING COALESCE(SUM(ps.stock), 0) <= 10
        ) t
      `);

      // Pending returns
      const pendingReturnsResult = await pool.query(`
        SELECT COUNT(*) as pending FROM return_requests WHERE status = 'pending'
      `);

      // Recent orders
      const recentOrdersResult = await pool.query(`
        SELECT o.id, o.order_number, o.total_amount, o.status, o.created_at, u.username
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        ORDER BY o.created_at DESC
        LIMIT 5
      `);

      res.json({
        today: {
          orders: parseInt(todayResult.rows[0].order_count),
          sales: parseFloat(todayResult.rows[0].total_sales)
        },
        yesterday: {
          orders: parseInt(yesterdayResult.rows[0].order_count),
          sales: parseFloat(yesterdayResult.rows[0].total_sales)
        },
        seven_days: {
          orders: parseInt(sevenDaysResult.rows[0].order_count),
          sales: parseFloat(sevenDaysResult.rows[0].total_sales)
        },
        total: {
          customers: parseInt(customersResult.rows[0].total),
          active_products: parseInt(productsResult.rows[0].total),
          low_stock: parseInt(lowStockResult.rows[0].low_stock_count),
          pending_returns: parseInt(pendingReturnsResult.rows[0].pending)
        },
        recent_orders: recentOrdersResult.rows
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // ===========================================
  // Sales Report by Date
  // ===========================================

  app.get('/api/admin/reports/sales-by-date', requirePermission('reports:read'), async (req, res) => {
    try {
      const startDate = req.query.start_date;
      const endDate = req.query.end_date;
      const groupBy = req.query.group_by || 'day'; // day, week, month

      let groupExpr = "DATE_TRUNC('day', created_at)::date";
      if (groupBy === 'week') groupExpr = "DATE_TRUNC('week', created_at)::date";
      if (groupBy === 'month') groupExpr = "DATE_TRUNC('month', created_at)::date";

      let where = '1=1';
      let params = [];
      if (startDate) {
        where += ` AND created_at >= $${params.length + 1}`;
        params.push(startDate);
      }
      if (endDate) {
        where += ` AND created_at <= $${params.length + 1}`;
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        params.push(end);
      }
      where += ` AND status != 'cancelled'`;

      const query = `
        SELECT
          ${groupExpr} as date_group,
          COUNT(*) as order_count,
          COUNT(DISTINCT user_id) as customer_count,
          COALESCE(SUM(total_amount), 0) as total_sales,
          COALESCE(AVG(total_amount), 0) as avg_order_value
        FROM orders
        WHERE ${where}
        GROUP BY 1
        ORDER BY 1 DESC
      `;

      const result = await pool.query(query, params);

      // Calculate summary
      const summary = result.rows.reduce((acc, row) => {
        acc.total_orders += parseInt(row.order_count);
        acc.total_customers += parseInt(row.customer_count);
        acc.total_sales += parseFloat(row.total_sales);
        return acc;
      }, {
        total_orders: 0,
        total_customers: 0,
        total_sales: 0
      });

      res.json({
        data: result.rows,
        summary,
        group_by: groupBy
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // ===========================================
  // Top Selling Products
  // ===========================================

  app.get('/api/admin/reports/top-products', requirePermission('reports:read'), async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 20;
      const startDate = req.query.start_date;
      const endDate = req.query.end_date;

      let where = '1=1';
      let params = [];

      if (startDate) {
        where += ` AND o.created_at >= $${params.length + 1}`;
        params.push(startDate);
      }
      if (endDate) {
        where += ` AND o.created_at <= $${params.length + 1}`;
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        params.push(end);
      }
      where += ` AND o.status != 'cancelled'`;

      const result = await pool.query(`
        SELECT
          p.id,
          p.name,
          p.slug,
          p.image_url,
          SUM(oi.quantity) as total_quantity,
          SUM(oi.quantity * oi.unit_price) as total_revenue
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE ${where}
        GROUP BY p.id, p.name, p.slug, p.image_url
        ORDER BY total_quantity DESC
        LIMIT $${params.length + 1}
      `, [...params, limit]);

      res.json({ products: result.rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // ===========================================
  // Inventory Report
  // ===========================================

  app.get('/api/admin/reports/inventory', requirePermission('reports:read'), async (req, res) => {
    try {
      const lowStockOnly = req.query.low_stock_only === 'true';
      const page = parseInt(req.query.page) || 1;
      const pageSize = parseInt(req.query.page_size) || 50;
      const offset = (page - 1) * pageSize;

      let having = lowStockOnly ? 'HAVING total_stock <= 10' : '';

      const countResult = await pool.query(`
        SELECT COUNT(*) FROM (
          SELECT p.id FROM products p
          LEFT JOIN product_skus ps ON p.id = ps.product_id
          WHERE p.status = 'active'
          GROUP BY p.id
          ${having}
        ) t
      `);

      const total = parseInt(countResult.rows[0].count);
      const totalPages = Math.ceil(total / pageSize);

      const result = await pool.query(`
        SELECT
          p.id, p.name, p.slug, p.price, p.cost_price,
          SUM(ps.stock) as total_stock,
          SUM(ps.stock * p.cost_price) as total_cost
        FROM products p
        LEFT JOIN product_skus ps ON p.id = ps.product_id
        WHERE p.status = 'active'
        GROUP BY p.id, p.name, p.slug, p.price, p.cost_price
        ${having}
        ORDER BY total_stock ASC
        LIMIT $1 OFFSET $2
      `, [pageSize, offset]);

      // Calculate grand total
      const totalValueResult = await pool.query(`
        SELECT
          SUM(ps.stock * p.cost_price) as total_inventory_value
        FROM products p
        LEFT JOIN product_skus ps ON p.id = ps.product_id
        WHERE p.status = 'active'
      `);

      res.json({
        products: result.rows,
        total_inventory_value: parseFloat(totalValueResult.rows[0].total_inventory_value || 0),
        pagination: { page, page_size: pageSize, total, total_pages: totalPages }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // ===========================================
  // Customer Statistics
  // ===========================================

  app.get('/api/admin/reports/customers', requirePermission('reports:read'), async (req, res) => {
    try {
      // New customers by date
      const startDate = req.query.start_date;
      const endDate = req.query.end_date;

      let where = '1=1';
      let params = [];
      if (startDate) {
        where += ` AND created_at >= $1`;
        params.push(startDate);
      }
      if (endDate) {
        where += ` AND created_at <= $2`;
        params.push(endDate);
      }

      const newCustomersResult = await pool.query(`
        SELECT DATE(created_at) as day, COUNT(*) as count
        FROM users
        WHERE ${where} AND is_active = true
        GROUP BY DATE(created_at)
        ORDER BY day DESC
      `, params);

      // Top customers by total spending
      const topCustomersResult = await pool.query(`
        SELECT
          u.id, u.username, u.email, u.phone,
          COUNT(o.id) as order_count,
          COALESCE(SUM(o.total_amount), 0) as total_spent
        FROM users u
        LEFT JOIN orders o ON u.id = o.user_id
        WHERE o.status != 'cancelled'
        ${startDate ? `AND o.created_at >= $${params.length + 1}` : ''}
        ${endDate ? `AND o.created_at <= $${params.length + (startDate ? 2 : 1)}` : ''}
        GROUP BY u.id, u.username, u.email, u.phone
        ORDER BY total_spent DESC
        LIMIT 20
      `, params);

      // Total stats
      const totalResult = await pool.query(`
        SELECT
          COUNT(*) as total_customers,
          COUNT(CASE WHEN last_login_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as active_30d
        FROM users WHERE is_active = true
      `);

      res.json({
        new_customers_by_day: newCustomersResult.rows,
        top_customers: topCustomersResult.rows,
        summary: {
          total_customers: parseInt(totalResult.rows[0].total_customers),
          active_30d: parseInt(totalResult.rows[0].active_30d)
        }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // ===========================================
  // Coupon Usage Report
  // ===========================================

  app.get('/api/admin/reports/coupons', requirePermission('reports:read'), async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          c.id, c.code, c.type, c.value,
          c.used_count,
          COALESCE(SUM(o.total_amount), 0) as total_order_value
        FROM coupons c
        LEFT JOIN coupon_usages cu ON c.id = cu.coupon_id
        LEFT JOIN orders o ON cu.order_id = o.id
        GROUP BY c.id, c.code, c.type, c.value, c.used_count
        ORDER BY c.used_count DESC
      `);

      res.json({ coupons: result.rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // ===========================================
  // Export Orders to CSV (for accounting)
  // ===========================================

  app.get('/api/admin/reports/export-orders/csv', requirePermission('reports:read'), async (req, res) => {
    try {
      const startDate = req.query.start_date;
      const endDate = req.query.end_date;
      const status = req.query.status;

      let where = '1=1';
      let params = [];

      if (startDate) {
        where += ` AND o.created_at >= $${params.length + 1}`;
        params.push(startDate);
      }
      if (endDate) {
        where += ` AND o.created_at <= $${params.length + 1}`;
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        params.push(end);
      }
      if (status) {
        where += ` AND o.status = $${params.length + 1}`;
        params.push(status);
      }

      const result = await pool.query(`
        SELECT
          o.id, o.order_number, o.created_at, o.status, o.payment_status,
          o.total_amount, o.subtotal_amount, o.shipping_fee, o.discount_amount,
          o.recipient_name, o.recipient_phone, o.full_address, o.district,
          u.email as customer_email, u.username
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        WHERE ${where}
        ORDER BY o.created_at DESC
      `, params);

      let csv = 'Order ID,Order Number,Created At,Status,Payment Status,Subtotal,Shipping Fee,Discount,Total Amount,Recipient Name,Recipient Phone,Address,District,Customer Email,Customer Name\n';

      result.rows.forEach(row => {
        const escape = (val) => {
          if (val === null) return '';
          const str = String(val);
          if (str.includes(',') || str.includes('"')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        };
        csv += [
          row.id, row.order_number, row.created_at,
          row.status, row.payment_status,
          row.subtotal_amount, row.shipping_fee, row.discount_amount,
          row.total_amount,
          row.recipient_name, row.recipient_phone,
          row.full_address, row.district,
          row.customer_email, row.username
        ].map(escape).join(',') + '\n';
      });

      const filename = `orders-${startDate || 'all'}-to-${endDate || 'now'}.csv`;
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csv);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // ===========================================
  // Tax Report (for Hong Kong tax filing)
  // ===========================================

  app.get('/api/admin/reports/tax', requirePermission('reports:read'), async (req, res) => {
    try {
      const month = req.query.month; // format YYYY-MM
      const year = req.query.year;

      let startDate, endDate;
      if (month) {
        startDate = new Date(month + '-01');
        endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 1);
        endDate.setDate(0);
        endDate.setHours(23, 59, 59);
      } else if (year) {
        startDate = new Date(year + '-01-01');
        endDate = new Date(year + '-12-31 23:59:59');
      }

      const result = await pool.query(`
        SELECT
          DATE(o.created_at) as date,
          COUNT(*) as order_count,
          COALESCE(SUM(o.subtotal_amount), 0) as subtotal,
          COALESCE(SUM(o.shipping_fee), 0) as shipping,
          COALESCE(SUM(o.total_amount), 0) as total,
          COUNT(DISTINCT o.user_id) as customers
        FROM orders o
        WHERE o.created_at BETWEEN $1 AND $2 AND o.status != 'cancelled'
        GROUP BY DATE(o.created_at)
        ORDER BY date
      `, [startDate, endDate]);

      const summary = result.rows.reduce((acc, row) => {
        acc.total_orders += parseInt(row.order_count);
        acc.subtotal += parseFloat(row.subtotal);
        acc.shipping += parseFloat(row.shipping);
        acc.total += parseFloat(row.total);
        acc.customers += parseInt(row.customers);
        return acc;
      }, {
        total_orders: 0,
        subtotal: 0,
        shipping: 0,
        total: 0,
        customers: 0
      });

      res.json({
        by_date: result.rows,
        summary,
        period: { start_date: startDate, end_date: endDate }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // Export Tax report to CSV
  app.get('/api/admin/reports/tax/export/csv', requirePermission('reports:read'), async (req, res) => {
    try {
      const month = req.query.month;
      const year = req.query.year;

      let startDate, endDate;
      if (month) {
        startDate = new Date(month + '-01');
        endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 1);
        endDate.setDate(0);
        endDate.setHours(23, 59, 59);
      } else if (year) {
        startDate = new Date(year + '-01-01');
        endDate = new Date(year + '-12-31 23:59:59');
      } else {
        return res.status(400).json({ error: '需要 month 或 year' });
      }

      const result = await pool.query(`
        SELECT
          o.order_number, o.created_at, o.status,
          o.subtotal_amount, o.shipping_fee, o.discount_amount, o.total_amount,
          u.email
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        WHERE o.created_at BETWEEN $1 AND $2 AND o.status != 'cancelled'
        ORDER BY o.created_at
      `, [startDate, endDate]);

      let csv = 'Order Number,Date,Status,Subtotal,Shipping Fee,Discount,Total Amount,Customer Email\n';

      result.rows.forEach(row => {
        const escape = (val) => {
          if (val === null) return '';
          const str = String(val);
          if (str.includes(',') || str.includes('"')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        };
        csv += [
          row.order_number, row.created_at, row.status,
          row.subtotal_amount, row.shipping_fee, row.discount_amount,
          row.total_amount, row.email
        ].map(escape).join(',') + '\n';
      });

      const filename = `tax-report-${month || year}.csv`;
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csv);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

};
