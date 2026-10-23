// ===========================================
// Brands API
// Product brand management
// ===========================================

module.exports = function(app, pool, requireAdmin) {

  // Public: Get all active brands
  app.get('/api/brands', async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT id, name, slug, description, image_url, website
        FROM brands WHERE is_active = true ORDER BY sort_order, name
      `);
      res.json({ brands: result.rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // Public: Get single brand
  app.get('/api/brands/:slug', async (req, res) => {
    try {
      const { slug } = req.params;
      const result = await pool.query(`
        SELECT id, name, slug, description, image_url, website
        FROM brands WHERE slug = $1 AND is_active = true
      `, [slug]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: '品牌不存在' });
      }

      // Get active products for this brand
      const products = await pool.query(`
        SELECT id, name, slug, price, image_url, stock_status
        FROM products WHERE brand_id = $1 AND status = 'active'
        ORDER BY created_at DESC
      `, [result.rows[0].id]);

      res.json({
        brand: result.rows[0],
        products: products.rows
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // Admin: Get all brands
  app.get('/api/admin/brands', requireAdmin, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT b.*, COUNT(p.id) as product_count
        FROM brands b
        LEFT JOIN products p ON b.id = p.brand_id
        GROUP BY b.id
        ORDER BY b.sort_order, b.name
      `);
      res.json({ brands: result.rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // Admin: Create brand
  app.post('/api/admin/brands', requireAdmin, async (req, res) => {
    try {
      const { name, slug, description, image_url, website, sort_order, is_active } = req.body;

      const result = await pool.query(`
        INSERT INTO brands (name, slug, description, image_url, website, sort_order, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [name, slug, description || null, image_url || null, website || null, sort_order || 0, is_active !== false]);

      res.json({ success: true, brand: result.rows[0] });
    } catch (err) {
      console.error(err);
      if (err.code === '23505') {
        return res.status(400).json({ error: 'Slug 已存在' });
      }
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // Admin: Update brand
  app.put('/api/admin/brands/:id', requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { name, slug, description, image_url, website, sort_order, is_active } = req.body;

      const result = await pool.query(`
        UPDATE brands SET
          name = $1, slug = $2, description = $3, image_url = $4,
          website = $5, sort_order = $6, is_active = $7
        WHERE id = $8
        RETURNING *
      `, [name, slug, description || null, image_url || null, website || null, sort_order, is_active, id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: '品牌不存在' });
      }

      res.json({ success: true, brand: result.rows[0] });
    } catch (err) {
      console.error(err);
      if (err.code === '23505') {
        return res.status(400).json({ error: 'Slug 已存在' });
      }
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // Admin: Delete brand
  app.delete('/api/admin/brands/:id', requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      // Check if has products
      const check = await pool.query('SELECT COUNT(*) FROM products WHERE brand_id = $1', [id]);
      if (parseInt(check.rows[0].count) > 0) {
        return res.status(400).json({ error: '品牌仲有產品，唔可以刪除' });
      }
      await pool.query('DELETE FROM brands WHERE id = $1', [id]);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

};
