module.exports = function(app, pool, requireAdmin) {
  const { requirePermission } = require('./middleware/auth');

  function parseNullablePositiveInt(v) {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    if (!Number.isInteger(n) || n <= 0) return NaN;
    return n;
  }

  async function ensureValidCategoryParent(parentId, currentId = null) {
    if (parentId === null) return null;

    const parentRow = await pool.query('SELECT id FROM categories WHERE id = $1 LIMIT 1', [parentId]);
    if (parentRow.rows.length === 0) {
      return '上級分類不存在';
    }

    if (currentId === null) return null;
    if (parentId === currentId) {
      return '上級分類不可指向自己';
    }

    const cycleCheck = await pool.query(
      `WITH RECURSIVE descendants AS (
         SELECT id
         FROM categories
         WHERE parent_id = $1
         UNION ALL
         SELECT c.id
         FROM categories c
         JOIN descendants d ON c.parent_id = d.id
       )
       SELECT 1
       FROM descendants
       WHERE id = $2
       LIMIT 1`,
      [currentId, parentId]
    );

    if (cycleCheck.rows.length > 0) {
      return '上級分類不可設定為自己嘅子孫分類';
    }

    return null;
  }

  // Get all categories (public)
  app.get('/api/categories', async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT c.*, COUNT(p.id) as product_count
        FROM categories c
        LEFT JOIN products p ON c.id = p.category_id AND p.status = 'active'
        WHERE c.status = 'active'
        GROUP BY c.id
        ORDER BY c.sort_order ASC, c.name ASC
      `);
      res.json({ categories: result.rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // Get single category
  app.get('/api/categories/:id', async (req, res, next) => {
    try {
      const { id } = req.params;
      // Numeric ids only. Non-numeric values (e.g. 'tree') are specific
      // routes registered later in products-full.js. Generic :id is
      // registered earlier so it would otherwise swallow them and make
      // Postgres throw 22P02 invalid input syntax for integer.
      if (!/^\d+$/.test(id)) return next();
      const result = await pool.query('SELECT * FROM categories WHERE id = $1', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: '分類不存在' });
      }
      res.json({ category: result.rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // Create category (admin)
  app.post('/api/admin/categories', requirePermission('catalog:write'), async (req, res) => {
    try {
      const { name, slug, description, parent_id, sort_order } = req.body;

      if (!name) {
        return res.status(400).json({ error: '分類名稱不能為空' });
      }

      const parentId = parseNullablePositiveInt(parent_id);
      if (Number.isNaN(parentId)) {
        return res.status(400).json({ error: '上級分類不正確' });
      }
      {
        const parentError = await ensureValidCategoryParent(parentId, null);
        if (parentError) {
          return res.status(400).json({ error: parentError });
        }
      }

      const result = await pool.query(`
        INSERT INTO categories (name, slug, description, parent_id, sort_order, status)
        VALUES ($1, $2, $3, $4, $5, 'active')
        RETURNING *
      `, [
        name,
        slug || name.toLowerCase().replace(/\s+/g, '-'),
        description || null,
        parentId,
        sort_order || 0
      ]);

      res.json({ success: true, category: result.rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // Update category (admin)
  app.put('/api/admin/categories/:id', requirePermission('catalog:write'), async (req, res) => {
    try {
      const { id } = req.params;
      const { name, slug, description, parent_id, sort_order, status } = req.body;

      const parentId = parseNullablePositiveInt(parent_id);
      if (Number.isNaN(parentId)) {
        return res.status(400).json({ error: '上級分類不正確' });
      }

      {
        const parentError = await ensureValidCategoryParent(parentId, Number(id));
        if (parentError) {
          return res.status(400).json({ error: parentError });
        }
      }

      const result = await pool.query(`
        UPDATE categories
        SET name = $1, slug = $2, description = $3, parent_id = $4, sort_order = $5, status = $6, updated_at = NOW()
        WHERE id = $7
        RETURNING *
      `, [
        name,
        slug || name.toLowerCase().replace(/\s+/g, '-'),
        description || null,
        parentId,
        sort_order || 0,
        status || 'active',
        id
      ]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: '分類不存在' });
      }

      res.json({ success: true, category: result.rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // Delete category (admin)
  app.delete('/api/admin/categories/:id', requirePermission('catalog:write'), async (req, res) => {
    try {
      const { id } = req.params;

      const hasChildren = await pool.query('SELECT 1 FROM categories WHERE parent_id = $1 LIMIT 1', [id]);
      if (hasChildren.rows.length > 0) {
        return res.status(400).json({ error: '請先刪除子分類' });
      }

      // Check if has products
      const hasProducts = await pool.query('SELECT COUNT(*) as cnt FROM products WHERE category_id = $1', [id]);
      if (parseInt(hasProducts.rows[0].cnt) > 0) {
        return res.status(400).json({ error: '此分類下尚有產品，無法刪除' });
      }

      const result = await pool.query('DELETE FROM categories WHERE id = $1 RETURNING *', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: '分類不存在' });
      }

      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // Get all categories for admin
  app.get('/api/admin/categories', requirePermission('catalog:write'), async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT c.*, COUNT(p.id) as product_count
        FROM categories c
        LEFT JOIN products p ON c.id = p.category_id
        GROUP BY c.id
        ORDER BY c.sort_order ASC, c.name ASC
      `);
      res.json({ categories: result.rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

};
