module.exports = function(app, pool, requireAdmin) {

  async function assertLeafSubcategory(categoryId) {
    const r = await pool.query(
      `SELECT c.id
       FROM categories c
       WHERE c.id = $1
         AND c.parent_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM categories c2 WHERE c2.parent_id = c.id)
       LIMIT 1`,
      [categoryId]
    );
    return r.rows.length > 0;
  }

  // Get public product list (with pagination, filtering)
  app.get('/api/products', async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const perPage = parseInt(req.query.per_page) || 24;
      const categoryId = req.query.category_id;
      const search = req.query.search || '';
      const offset = (page - 1) * perPage;

      let where = 'p.status = \'active\' AND p.name_zh_hk IS NOT NULL AND p.description_zh_hk IS NOT NULL';
      let params = [];
      let paramIndex = 1;

      if (categoryId) {
        where += ` AND p.category_id = $${paramIndex}`;
        params.push(categoryId);
        paramIndex++;
      }

      if (search) {
        where += ` AND (p.name_zh_hk ILIKE $${paramIndex} OR p.description_zh_hk ILIKE $${paramIndex})`;
        params.push(`%${search}%`);
        paramIndex++;
      }

      // Get total count
      const countResult = await pool.query(`SELECT COUNT(*) as total FROM products p WHERE ${where}`, params);
      const total = parseInt(countResult.rows[0].total);

      // Get products
      const result = await pool.query(`
        SELECT p.*, p.name_zh_hk as name, p.description_zh_hk as description, c.name_zh_hk as category_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE ${where}
        ORDER BY p.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `, [...params, perPage, offset]);

      res.json({
        products: result.rows,
        pagination: {
          page,
          perPage,
          total,
          totalPages: Math.ceil(total / perPage)
        }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '伺服器錯誤' });
    }
  });

  // Get single product
  app.get('/api/products/:id', async (req, res, next) => {
    try {
      const { id } = req.params;
      // Only handle numeric ids here. Non-numeric values like 'featured'
      // belong to specific routes registered in products-full.js
      // (/api/products/featured, /api/products/:slug). Without this guard
      // Express matches this generic :id first (it is registered earlier)
      // and Postgres throws 22P02 invalid input syntax for integer.
      if (!/^\d+$/.test(id)) return next();
      const result = await pool.query(`
        SELECT p.*, p.name_zh_hk as name, p.description_zh_hk as description, c.name_zh_hk as category_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.id = $1 AND p.status = 'active' AND p.name_zh_hk IS NOT NULL AND p.description_zh_hk IS NOT NULL
      `, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: '產品不存在' });
      }

      res.json({ product: result.rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '伺服器錯誤' });
    }
  });

};
