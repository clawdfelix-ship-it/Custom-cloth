// ===========================================
// Full Product & Inventory Management API
// For Hong Kong Full-featured E-commerce
// ===========================================

module.exports = function(app, pool) {

  const { requireAdmin, requirePermission } = require('./middleware/auth');
  const { computeNewStock } = require('../lib/inventory');

  async function assertLeafSubcategory(db, categoryId) {
    const categoryIdNum = Number(categoryId);
    if (!Number.isInteger(categoryIdNum) || categoryIdNum <= 0) return false;
    const r = await db.query(
      `SELECT c.id
       FROM categories c
       WHERE c.id = $1
         AND c.parent_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM categories c2 WHERE c2.parent_id = c.id)
       LIMIT 1`,
      [categoryIdNum]
    );
    return r.rows.length > 0;
  }

  // ===========================================
  // Brands
  // ===========================================

  // Get all brands
  app.get('/api/brands', async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT * FROM brands WHERE is_active = true ORDER BY sort_order, name
      `);
      res.json({ brands: result.rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // Admin: get all brands (including inactive)
  app.get('/api/admin/brands', requirePermission('catalog:read'), async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT * FROM brands ORDER BY sort_order, name
      `);
      res.json({ brands: result.rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // Admin: create brand
  app.post('/api/admin/brands', requirePermission('catalog:write'), async (req, res) => {
    try {
      const { name, slug, description, image_url, website, sort_order, is_active } = req.body;
      const result = await pool.query(`
        INSERT INTO brands (name, slug, description, image_url, website, sort_order, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [name, slug, description, image_url, website, sort_order || 0, is_active !== false]);
      res.json({ success: true, brand: result.rows[0] });
    } catch (err) {
      console.error(err);
      if (err.code === '23505') { // unique violation
        return res.status(400).json({ error: 'Slug 已經存在' });
      }
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // Admin: update brand
  app.put('/api/admin/brands/:id', requirePermission('catalog:write'), async (req, res) => {
    try {
      const { id } = req.params;
      const { name, slug, description, image_url, website, sort_order, is_active } = req.body;
      const result = await pool.query(`
        UPDATE brands
        SET name = $1, slug = $2, description = $3, image_url = $4, website = $5, sort_order = $6, is_active = $7, updated_at = NOW()
        WHERE id = $8
        RETURNING *
      `, [name, slug, description, image_url, website, sort_order, is_active, id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: '品牌不存在' });
      }
      res.json({ success: true, brand: result.rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // Admin: delete brand (soft delete handled elsewhere, just hard delete here)
  app.delete('/api/admin/brands/:id', requirePermission('catalog:write'), async (req, res) => {
    try {
      const { id } = req.params;
      await pool.query('DELETE FROM brands WHERE id = $1', [id]);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // ===========================================
  // Product Tags
  // ===========================================

  app.get('/api/product-tags', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM product_tags ORDER BY name');
      res.json({ tags: result.rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // ===========================================
  // Public Products API
  // ===========================================

  // Get product list (public)
  app.get('/api/products', async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const pageSize = parseInt(req.query.page_size) || 24;
      const offset = (page - 1) * pageSize;
      const categoryId = req.query.category_id;
      const brandId = req.query.brand_id;
      const tagId = req.query.tag_id;
      const search = req.query.search;
      const sort = typeof req.query.sort === 'string' ? req.query.sort : 'created_at';
      const orderRaw = typeof req.query.order === 'string' ? req.query.order : 'desc';
      const order = orderRaw.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

      let where = 'p.status = \'active\'';
      let params = [];

      if (categoryId) {
        where += ` AND p.category_id = $${params.length + 1}`;
        params.push(categoryId);
      }
      if (brandId) {
        where += ` AND p.brand_id = $${params.length + 1}`;
        params.push(brandId);
      }
      if (search) {
        where += ` AND (p.name ILIKE $${params.length + 1} OR p.description ILIKE $${params.length + 1})`;
        params.push(`%${search}%`);
      }

      // Count total
      const countResult = await pool.query(`SELECT COUNT(*) FROM products p WHERE ${where}`, params);
      const total = parseInt(countResult.rows[0].count);
      const totalPages = Math.ceil(total / pageSize);

      // Get products
      let query = `
        SELECT p.*, b.name as brand_name, c.name as category_name
        FROM products p
        LEFT JOIN brands b ON p.brand_id = b.id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE ${where}
      `;

      const allowedSort = {
        created_at: 'p.created_at',
        updated_at: 'p.updated_at',
        price: 'p.price',
        name: 'p.name',
        average_rating: 'p.average_rating',
        review_count: 'p.review_count',
      };

      if (sort === 'popular') {
        query += ` ORDER BY p.is_featured DESC, p.created_at DESC`;
      } else if (allowedSort[sort]) {
        query += ` ORDER BY ${allowedSort[sort]} ${order}`;
      } else {
        query += ` ORDER BY p.created_at DESC`;
      }

      query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(pageSize, offset);

      const result = await pool.query(query, params);

      // Get stock for each product (sum from SKUs)
      const productsWithStock = await Promise.all(result.rows.map(async (product) => {
        const skuResult = await pool.query(`
          SELECT SUM(stock) as total_stock FROM product_skus WHERE product_id = $1 AND is_active = true
        `, [product.id]);
        const totalStock = skuResult.rows[0].total_stock || 0;
        return {
          ...product,
          total_stock: parseInt(totalStock)
        };
      }));

      res.json({
        products: productsWithStock,
        pagination: { page, page_size: pageSize, total, total_pages: totalPages }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // Get featured products
  app.get('/api/products/featured', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 8;
      const result = await pool.query(`
        SELECT p.*, b.name as brand_name, c.name as category_name
        FROM products p
        LEFT JOIN brands b ON p.brand_id = b.id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.status = 'active' AND p.is_featured = true
        ORDER BY p.created_at DESC
        LIMIT $1
      `, [limit]);
      res.json({ products: result.rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // Get single product
  app.get('/api/products/:slug', async (req, res) => {
    try {
      const { slug } = req.params;
      const productResult = await pool.query(`
        SELECT p.*, b.name as brand_name, c.name as category_name
        FROM products p
        LEFT JOIN brands b ON p.brand_id = b.id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.slug = $1 AND p.status = 'active'
      `, [slug]);

      if (productResult.rows.length === 0) {
        return res.status(404).json({ error: '產品不存在' });
      }

      const product = productResult.rows[0];

      // Get SKUs. Wholesale visibility is driven by the real session
      // (set at login from users.is_b2b / users.is_admin), not by an
      // assumed role field — users has no role column.
      //   staff   = session.isAdmin
      //   b2b     = session.isB2b
      // Cost (HKD) stays staff-only and is never exposed here, even to B2B.
      const _isStaff = !!(req.session && req.session.isAdmin);
      const _isB2B = !!(req.session && req.session.isB2b);
      const _canSeeWholesale = _isStaff || _isB2B;

      // Public: retail price + stock + barcode (so customers can scan for their own purchase).
      // NO cost, NO wholesale price — both are B2B/internal sensitive.
      const publicSkuCols = `id, product_id, sku, barcode, attributes, price, original_price, stock, weight, weight_unit, is_active, created_at, updated_at`;
      // B2B-eligible: adds JPY cost + HKD wholesale price (cost_price HKD is staff-only, not exposed here).
      const b2bSkuCols = `${publicSkuCols}, cost_price_jpy, wholesale_price_hkd`;
      const skuCols = _canSeeWholesale ? b2bSkuCols : publicSkuCols;
      const skusResult = await pool.query(`
        SELECT ${skuCols} FROM product_skus WHERE product_id = $1 AND is_active = true ORDER BY id
      `, [product.id]);

      // Get related products
      const relatedResult = await pool.query(`
        SELECT p.id, p.name, p.slug, p.price, p.image_url, p.average_rating
        FROM products p
        JOIN related_products rp ON p.id = rp.related_product_id
        WHERE rp.product_id = $1 AND p.status = 'active'
        ORDER BY rp.sort_order
        LIMIT 10
      `, [product.id]);

      // Get approved reviews
      const reviewsResult = await pool.query(`
        SELECT r.*, u.username, u.first_name, u.last_name
        FROM product_reviews r
        JOIN users u ON r.user_id = u.id
        WHERE r.product_id = $1 AND r.status = 'approved'
        ORDER BY r.created_at DESC
      `, [product.id]);

      res.json({
        product,
        skus: skusResult.rows,
        related_products: relatedResult.rows,
        reviews: reviewsResult.rows
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // Get low stock (public/admin)
  app.get('/api/admin/products/low-stock', requirePermission('inventory:read'), async (req, res) => {
    try {
      const threshold = parseInt(req.query.threshold) || 10;
      const result = await pool.query(`
        SELECT p.*,
          SUM(ps.stock) as total_stock,
          b.name as brand_name,
          c.name as category_name
        FROM products p
        LEFT JOIN product_skus ps ON p.id = ps.product_id
        LEFT JOIN brands b ON p.brand_id = b.id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.status = 'active'
        GROUP BY p.id, b.name, c.name
        HAVING SUM(ps.stock) <= $1
        ORDER BY SUM(ps.stock) ASC
      `, [threshold]);
      res.json({ products: result.rows, threshold });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // Low stock (SKU-level)
  app.get('/api/admin/low-stock/skus', requirePermission('inventory:read'), async (req, res) => {
    try {
      const raw = parseInt(req.query.threshold);
      const threshold = Number.isInteger(raw) && raw >= 0 ? raw : 5;
      const result = await pool.query(
        `SELECT
           ps.id as sku_id,
           ps.sku,
           ps.barcode,
           ps.stock,
           ps.product_id,
           COALESCE(p.name_zh_hk, p.name) as product_name,
           p.slug as product_slug,
           ps.updated_at
         FROM product_skus ps
         JOIN products p ON ps.product_id = p.id
         WHERE ps.is_active = true
           AND ps.stock <= $1
         ORDER BY ps.stock ASC, ps.id ASC`,
        [threshold]
      );
      return res.json({ threshold, skus: result.rows });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: '服務器錯誤' });
    }
  });

  app.get('/api/admin/low-stock/skus/export.csv', requirePermission('inventory:read'), async (req, res) => {
    try {
      const raw = parseInt(req.query.threshold);
      const threshold = Number.isInteger(raw) && raw >= 0 ? raw : 5;
      const result = await pool.query(
        `SELECT
           ps.id as sku_id,
           ps.sku,
           ps.barcode,
           ps.stock,
           ps.product_id,
           COALESCE(p.name_zh_hk, p.name) as product_name,
           p.slug as product_slug,
           ps.updated_at
         FROM product_skus ps
         JOIN products p ON ps.product_id = p.id
         WHERE ps.is_active = true
           AND ps.stock <= $1
         ORDER BY ps.stock ASC, ps.id ASC`,
        [threshold]
      );

      const escape = (val) => {
        if (val === null || typeof val === 'undefined') return '';
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) return `"${str.replace(/"/g, '""')}"`;
        return str;
      };

      let csv = 'Product ID,Product Name,Product Slug,SKU ID,SKU,Barcode,Stock,Updated At\n';
      for (const row of result.rows) {
        csv += [
          row.product_id,
          row.product_name,
          row.product_slug,
          row.sku_id,
          row.sku,
          row.barcode,
          row.stock,
          row.updated_at,
        ].map(escape).join(',') + '\n';
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="low-stock-skus-${new Date().toISOString().slice(0, 10)}.csv"`
      );
      return res.send(csv);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // Export products to CSV (now includes wholesale + match columns)
  app.get('/api/admin/products/export/csv', requirePermission('catalog:read'), async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          p.id, p.name, p.slug, p.price, p.original_price, p.cost_price,
          MIN(ps.wholesale_price_hkd) AS wholesale_price_hkd,
          MIN(ps.cost_price_jpy)     AS cost_price_jpy,
          BOOL_OR(ps.match_status = 'unverified') AS has_unverified_match,
          SUM(ps.stock) as stock,
          c.name as category_name,
          b.name as brand_name,
          p.status, p.created_at
        FROM products p
        LEFT JOIN product_skus ps ON p.id = ps.product_id
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN brands b ON p.brand_id = b.id
        GROUP BY p.id, c.name, b.name
        ORDER BY p.created_at DESC
      `);

      let csv = 'ID,Name,Slug,Cost Price (HKD),Cost Price (JPY),Wholesale Price (HKD),Retail Price,Original Price,Total Stock,Has Unverified Match,Category,Brand,Status,Created At\n';
      result.rows.forEach(row => {
        const escape = (val) => {
          if (val === null) return '';
          const str = String(val);
          if (str.includes(',') || str.includes('"')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        };
        csv += Object.values([
          row.id, row.name, row.slug, row.cost_price, row.cost_price_jpy, row.wholesale_price_hkd,
          row.price, row.original_price,
          row.stock, row.has_unverified_match ? 'YES' : '',
          row.category_name, row.brand_name, row.status, row.created_at
        ]).map(escape).join(',') + '\n';
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="products-${new Date().toISOString().slice(0, 10)}.csv"`);
      res.send(csv);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // ===========================================
  // Admin: Products CRUD
  // ===========================================

  app.get('/api/admin/products', requirePermission('catalog:read'), async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const pageSize = parseInt(req.query.page_size) || 50;
      const offset = (page - 1) * pageSize;
      const search = req.query.search;
      const categoryId = req.query.category_id;
      const brandId = req.query.brand_id;
      const status = req.query.status;

      let where = '1=1';
      let params = [];

      if (search) {
        where += ` AND (p.name ILIKE $${params.length + 1} OR p.slug ILIKE $${params.length + 1})`;
        params.push(`%${search}%`);
      }
      if (categoryId) {
        where += ` AND p.category_id = $${params.length + 1}`;
        params.push(categoryId);
      }
      if (brandId) {
        where += ` AND p.brand_id = $${params.length + 1}`;
        params.push(brandId);
      }
      if (status) {
        where += ` AND p.status = $${params.length + 1}`;
        params.push(status);
      }

      const countResult = await pool.query(`SELECT COUNT(*) FROM products p WHERE ${where}`, params);
      const total = parseInt(countResult.rows[0].count);
      const totalPages = Math.ceil(total / pageSize);

      const query = `
        SELECT
          p.*,
          b.name as brand_name,
          c.name as category_name,
          COALESCE(SUM(CASE WHEN ps.is_active = true THEN ps.stock ELSE 0 END), 0) as total_stock,
          COALESCE(COUNT(ps.id) FILTER (WHERE ps.is_active = true), 0) as active_sku_count,
          -- Wholesale pricing rollup from SKUs (Japan import)
          MIN(ps.wholesale_price_hkd) AS min_wholesale_price_hkd,
          MAX(ps.wholesale_price_hkd) AS max_wholesale_price_hkd,
          MIN(ps.cost_price) AS min_cost_price,
          MAX(ps.cost_price) AS max_cost_price,
          MIN(ps.cost_price_jpy) AS min_cost_price_jpy,
          MAX(ps.cost_price_jpy) AS max_cost_price_jpy,
          -- Match status rollup: if any SKU is 'unverified' the whole product needs review
          BOOL_OR(ps.match_status = 'unverified') AS has_unverified_match,
          COUNT(ps.id) FILTER (WHERE ps.match_status IS NOT NULL) AS matched_sku_count
        FROM products p
        LEFT JOIN product_skus ps ON p.id = ps.product_id
        LEFT JOIN brands b ON p.brand_id = b.id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE ${where}
        GROUP BY p.id, b.name, c.name
        ORDER BY p.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;
      params.push(pageSize, offset);

      const result = await pool.query(query, params);

      res.json({
        products: result.rows,
        pagination: { page, page_size: pageSize, total, total_pages: totalPages }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  app.get('/api/admin/products/:id', requirePermission('catalog:read'), async (req, res) => {
    try {
      const { id } = req.params;
      const productResult = await pool.query(`
        SELECT * FROM products WHERE id = $1
      `, [id]);

      if (productResult.rows.length === 0) {
        return res.status(404).json({ error: '產品不存在' });
      }

      const product = productResult.rows[0];

      const skusResult = await pool.query(`
        SELECT id, product_id, sku, barcode, attributes, price, cost_price, cost_price_jpy,
               wholesale_price_hkd, original_price, stock, weight, weight_unit, is_active,
               match_status, match_sim, match_source_jan, match_matched_at,
               created_at, updated_at
        FROM product_skus WHERE product_id = $1 ORDER BY id
      `, [id]);

      // product_tags / related_products 表可能未喺該環境建立（migration 缺失），
      // 呢兩個查詢 fail-safe，唔好令成個編輯載入 500。
      let tagsRows = [];
      let relatedRows = [];
      try {
        const tagsResult = await pool.query(`
          SELECT pt.* FROM product_tags pt
          JOIN product_tag_assignments pta ON pt.id = pta.tag_id
          WHERE pta.product_id = $1
        `, [id]);
        tagsRows = tagsResult.rows;
      } catch (e) {
        if (!/relation .* does not exist/.test(e.message)) throw e;
      }
      try {
        const relatedResult = await pool.query(`
          SELECT p.id, p.name, p.slug FROM products p
          JOIN related_products rp ON p.id = rp.related_product_id
          WHERE rp.product_id = $1
          ORDER BY rp.sort_order
        `, [id]);
        relatedRows = relatedResult.rows;
      } catch (e) {
        if (!/relation .* does not exist/.test(e.message)) throw e;
      }

      res.json({
        product,
        skus: skusResult.rows,
        tags: tagsRows,
        related: relatedRows
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  app.post('/api/admin/products', requirePermission('catalog:write'), async (req, res) => {
    try {
      const {
        name, name_zh_hk, slug, description, description_zh_hk, short_description, short_description_zh_hk,
        brand_id, category_id,
        cost_price, price, original_price, member_price,
        status, is_featured,
        meta_title, meta_description,
        image_url, gallery_images, video_url,
        product_type, is_digital, digital_file_url,
        has_batch_expiry, enable_reviews,
        skus, tags, related_products
      } = req.body;

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        if (!(await assertLeafSubcategory(client, category_id))) {
          return res.status(400).json({ error: '請選擇子分類' });
        }

        const outName = name_zh_hk || name;
        const outDesc = description_zh_hk || description;
        const outShort = short_description_zh_hk || short_description;

        // Insert product
        const productResult = await client.query(`
          INSERT INTO products (
            name, name_zh_hk, slug, description, description_zh_hk, short_description, short_description_zh_hk,
            brand_id, category_id,
            cost_price, price, original_price, member_price,
            status, is_featured,
            meta_title, meta_description,
            image_url, gallery_images, video_url,
            product_type, is_digital, digital_file_url,
            has_batch_expiry, enable_reviews
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
          RETURNING id
        `, [
          outName, outName, slug, outDesc, outDesc, outShort, outShort,
          brand_id || null, category_id || null,
          cost_price, price, original_price, member_price,
          status || 'active', is_featured || false,
          meta_title, meta_description,
          image_url, gallery_images ? JSON.stringify(gallery_images) : null, video_url,
          product_type || 'physical', is_digital || false, digital_file_url,
          has_batch_expiry || false, enable_reviews !== false
        ]);

        const productId = productResult.rows[0].id;

        // Insert SKUs
        if (skus && skus.length > 0) {
          for (const sku of skus) {
            await client.query(`
              INSERT INTO product_skus (product_id, sku, barcode, attributes, price, cost_price, cost_price_jpy, wholesale_price_hkd, original_price, stock, weight, weight_unit, is_active)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            `, [
              productId,
              sku.sku || null,
              sku.barcode || null,
              JSON.stringify(sku.attributes || {}),
              sku.price || null,
              sku.cost_price || null,
              sku.cost_price_jpy || null,
              sku.wholesale_price_hkd || null,
              sku.original_price || null,
              sku.stock || 0,
              sku.weight || null,
              sku.weight_unit || 'g',
              sku.is_active !== false
            ]);
          }
        }

        // Log operation
        await client.query(`
          INSERT INTO admin_operation_logs (admin_id, action, entity_type, entity_id, new_data)
          VALUES ($1, 'create', 'product', $2, $3)
        `, [req.user.id, productId, JSON.stringify(req.body)]);

        await client.query('COMMIT');

        res.json({ success: true, product_id: productId });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (err) {
      console.error(err);
      if (err.code === '23505') {
        return res.status(400).json({ error: 'Slug 已經存在' });
      }
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // 輕量狀態切換（列表 Switch 用）：只改 status，唔掂其他欄
  app.patch('/api/admin/products/:id/status', requirePermission('catalog:write'), async (req, res) => {
    try {
      const status = String((req.body && req.body.status) || '');
      if (!['active', 'inactive'].includes(status)) {
        return res.status(400).json({ error: '無效狀態' });
      }
      const result = await pool.query(
        'UPDATE products SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, status',
        [status, req.params.id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: '商品不存在' });
      }
      res.json({ success: true, product: result.rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  app.put('/api/admin/products/:id', requirePermission('catalog:write'), async (req, res) => {
    try {
      const { id } = req.params;
      const {
        name, name_zh_hk, slug, description, description_zh_hk, short_description, short_description_zh_hk,
        brand_id, category_id,
        cost_price, price, original_price, member_price,
        status, is_featured,
        meta_title, meta_description,
        image_url, gallery_images, video_url,
        product_type, is_digital, digital_file_url,
        has_batch_expiry, enable_reviews,
        skus
      } = req.body;

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        if (category_id !== undefined && category_id !== null && category_id !== '') {
          if (!(await assertLeafSubcategory(client, category_id))) {
            return res.status(400).json({ error: '請選擇子分類' });
          }
        }

        // Get old data for log
        const oldResult = await client.query('SELECT * FROM products WHERE id = $1', [id]);
        const oldData = oldResult.rows[0];

        const outName = name_zh_hk || name;
        const outDesc = description_zh_hk || description;
        const outShort = short_description_zh_hk || short_description;

        // Update product
        await client.query(`
          UPDATE products SET
            name = $1, name_zh_hk = $2, slug = $3, description = $4, description_zh_hk = $5, short_description = $6, short_description_zh_hk = $7,
            brand_id = $8, category_id = $9,
            cost_price = $10, price = $11, original_price = $12, member_price = $13,
            status = $14, is_featured = $15,
            meta_title = $16, meta_description = $17,
            image_url = $18, gallery_images = $19, video_url = $20,
            product_type = $21, is_digital = $22, digital_file_url = $23,
            has_batch_expiry = $24, enable_reviews = $25,
            updated_at = NOW()
          WHERE id = $26
        `, [
          outName, outName, slug, outDesc, outDesc, outShort, outShort,
          brand_id || null, category_id || null,
          cost_price, price, original_price, member_price,
          status, is_featured,
          meta_title, meta_description,
          image_url, gallery_images ? JSON.stringify(gallery_images) : null, video_url,
          product_type, is_digital, digital_file_url,
          has_batch_expiry, enable_reviews,
          id
        ]);

        if (Array.isArray(skus)) {
          const existing = await client.query(
            'SELECT id, cost_price FROM product_skus WHERE product_id = $1',
            [id]
          );
          const existingById = new Map(existing.rows.map((r) => [Number(r.id), r]));
          const seenIds = new Set();

          for (const sku of skus) {
            const skuId = sku && sku.id ? Number(sku.id) : null;
            const nextCost = sku && sku.cost_price !== undefined ? sku.cost_price : undefined;

            if (skuId && Number.isInteger(skuId) && skuId > 0) {
              seenIds.add(skuId);
              const old = existingById.get(skuId);

              if (old && nextCost !== undefined && old.cost_price !== nextCost) {
                await client.query(
                  `INSERT INTO sku_cost_history (sku_id, old_cost_price, new_cost_price, changed_by_admin_id, reason)
                   VALUES ($1, $2, $3, $4, NULL)`,
                  [skuId, old.cost_price, nextCost, req.user.id]
                );
              }

              await client.query(
                `UPDATE product_skus
                 SET sku = $1,
                     barcode = $2,
                     attributes = $3,
                     price = $4,
                     cost_price = $5,
                     cost_price_jpy = $6,
                     wholesale_price_hkd = $7,
                     original_price = $8,
                     weight = $9,
                     weight_unit = $10,
                     is_active = $11,
                     updated_at = NOW()
                 WHERE id = $12 AND product_id = $13`,
                [
                  sku.sku || null,
                  sku.barcode || null,
                  JSON.stringify(sku.attributes || {}),
                  sku.price || null,
                  sku.cost_price || null,
                  sku.cost_price_jpy || null,
                  sku.wholesale_price_hkd || null,
                  sku.original_price || null,
                  sku.weight || null,
                  sku.weight_unit || 'g',
                  sku.is_active !== false,
                  skuId,
                  id,
                ]
              );
            } else {
              await client.query(
                `INSERT INTO product_skus
                  (product_id, sku, barcode, attributes, price, cost_price, cost_price_jpy, wholesale_price_hkd, original_price, stock, weight, weight_unit, is_active)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
                [
                  id,
                  sku.sku || null,
                  sku.barcode || null,
                  JSON.stringify(sku.attributes || {}),
                  sku.price || null,
                  sku.cost_price || null,
                  sku.cost_price_jpy || null,
                  sku.wholesale_price_hkd || null,
                  sku.original_price || null,
                  sku.stock || 0,
                  sku.weight || null,
                  sku.weight_unit || 'g',
                  sku.is_active !== false,
                ]
              );
            }
          }

          const toDisable = [];
          for (const row of existing.rows) {
            const existingId = Number(row.id);
            if (!seenIds.has(existingId)) toDisable.push(existingId);
          }
          if (toDisable.length > 0) {
            await client.query(
              'UPDATE product_skus SET is_active = false, updated_at = NOW() WHERE id = ANY($1::int[]) AND product_id = $2',
              [toDisable, id]
            );
          }
        }

        // Log
        await client.query(`
          INSERT INTO admin_operation_logs (admin_id, action, entity_type, entity_id, old_data, new_data)
          VALUES ($1, 'update', 'product', $2, $3, $4)
        `, [req.user.id, id, JSON.stringify(oldData), JSON.stringify(req.body)]);

        await client.query('COMMIT');

        res.json({ success: true });
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

  // Soft delete (move to recycle bin)
  app.delete('/api/admin/products/:id', requirePermission('catalog:write'), async (req, res) => {
    try {
      const { id } = req.params;
      await pool.query(`
        UPDATE products SET deleted_at = NOW(), status = 'archived', updated_at = NOW() WHERE id = $1
      `, [id]);
      await pool.query(`
        INSERT INTO admin_operation_logs (admin_id, action, entity_type, entity_id)
        VALUES ($1, 'delete', 'product', $2)
      `, [req.user.id, id]);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // ===========================================
  // Product Reviews
  // ===========================================

  // User submit review
  app.post('/api/products/:id/reviews', async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: '需要登入' });
      }
      const { id } = req.params;
      const { rating, title, content, images } = req.body;

      // Check if product exists
      const productCheck = await pool.query('SELECT id FROM products WHERE id = $1', [id]);
      if (productCheck.rows.length === 0) {
        return res.status(404).json({ error: '產品不存在' });
      }

      await pool.query(`
        INSERT INTO product_reviews (product_id, user_id, rating, title, content, images, status)
        VALUES ($1, $2, $3, $4, $5, $6, 'pending')
      `, [id, req.user.id, rating, title || null, content || null, images ? JSON.stringify(images) : null]);

      res.json({ success: true, message: '評價已提交，等待審核' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // Admin: get all pending reviews
  app.get('/api/admin/reviews/pending', requirePermission('catalog:write'), async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT r.*, p.name as product_name, u.username
        FROM product_reviews r
        JOIN products p ON r.product_id = p.id
        JOIN users u ON r.user_id = u.id
        WHERE r.status = 'pending'
        ORDER BY r.created_at DESC
      `);
      res.json({ reviews: result.rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // Admin: approve/reject review
  app.put('/api/admin/reviews/:id/status', requirePermission('catalog:write'), async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      await pool.query(`
        UPDATE product_reviews SET status = $1 WHERE id = $2
      `, [status, id]);

      // Recalculate average rating for product
      if (status === 'approved') {
        const result = await pool.query(`
          SELECT AVG(rating) as avg, COUNT(*) as count
          FROM product_reviews
          WHERE product_id = (SELECT product_id FROM product_reviews WHERE id = $1) AND status = 'approved'
        `, [id]);
        const avg = parseFloat(result.rows[0].avg) || 0;
        const count = parseInt(result.rows[0].count);
        await pool.query(`
          UPDATE products SET average_rating = $1, review_count = $2 WHERE id = (SELECT product_id FROM product_reviews WHERE id = $3)
        `, [avg.toFixed(1), count, id]);
      }

      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // ===========================================
  // Inventory
  // ===========================================

  app.get('/api/admin/inventory/transactions', requirePermission('inventory:read'), async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const pageSize = parseInt(req.query.page_size) || 50;
      const offset = (page - 1) * pageSize;
      const productId = req.query.product_id;
      const skuId = req.query.sku_id;
      const warehouseId = req.query.warehouse_id;
      const type = req.query.type;
      const from = req.query.from;
      const to = req.query.to;

      let where = '1=1';
      let params = [];
      if (productId) {
        const pid = Number(productId);
        if (Number.isInteger(pid) && pid > 0) {
          where += ` AND it.product_id = $${params.length + 1}`;
          params.push(pid);
        }
      }
      if (skuId) {
        const sid = Number(skuId);
        if (Number.isInteger(sid) && sid > 0) {
          where += ` AND it.sku_id = $${params.length + 1}`;
          params.push(sid);
        }
      }
      if (warehouseId) {
        const wid = Number(warehouseId);
        if (Number.isInteger(wid) && wid > 0) {
          where += ` AND it.warehouse_id = $${params.length + 1}`;
          params.push(wid);
        }
      }
      if (type) {
        where += ` AND it.type = $${params.length + 1}`;
        params.push(String(type));
      }
      if (from) {
        const d = new Date(String(from));
        if (!Number.isNaN(d.getTime())) {
          where += ` AND it.created_at >= $${params.length + 1}`;
          params.push(d.toISOString());
        }
      }
      if (to) {
        const d = new Date(String(to));
        if (!Number.isNaN(d.getTime())) {
          d.setUTCDate(d.getUTCDate() + 1);
          where += ` AND it.created_at < $${params.length + 1}`;
          params.push(d.toISOString());
        }
      }

      const countResult = await pool.query(`SELECT COUNT(*) FROM inventory_transactions it WHERE ${where}`, params);
      const total = parseInt(countResult.rows[0].count);

      const result = await pool.query(`
        SELECT it.*, p.name as product_name, w.name as warehouse_name
        FROM inventory_transactions it
        LEFT JOIN products p ON it.product_id = p.id
        LEFT JOIN inventory_warehouses w ON it.warehouse_id = w.id
        WHERE ${where}
        ORDER BY it.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, [...params, pageSize, offset]);

      res.json({
        transactions: result.rows,
        pagination: { page, page_size: pageSize, total }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  app.get('/api/admin/inventory/skus', requirePermission('inventory:read'), async (req, res) => {
    try {
      const q = String(req.query.q || '').trim();
      const limitRaw = parseInt(req.query.limit) || 20;
      const limit = Math.max(1, Math.min(50, limitRaw));
      if (!q) return res.status(400).json({ error: 'q 必填' });

      const like = `%${q.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')}%`;
      const result = await pool.query(
        `SELECT ps.id, ps.sku, ps.barcode, ps.stock, ps.cost_price, ps.product_id,
                COALESCE(p.name_zh_hk, p.name) as product_name
         FROM product_skus ps
         JOIN products p ON ps.product_id = p.id
         WHERE ps.is_active = true
           AND (
             ps.sku ILIKE $1 ESCAPE '\\'
             OR ps.barcode ILIKE $1 ESCAPE '\\'
             OR COALESCE(p.name_zh_hk,'') ILIKE $1 ESCAPE '\\'
             OR COALESCE(p.name,'') ILIKE $1 ESCAPE '\\'
           )
         ORDER BY ps.id DESC
         LIMIT $2`,
        [like, limit]
      );

      return res.json({ skus: result.rows });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: '服務器錯誤' });
    }
  });

  app.get('/api/admin/inventory/levels', requirePermission('inventory:read'), async (req, res) => {
    try {
      const skuId = Number(req.query.sku_id);
      const includeInactive = String(req.query.include_inactive || '') === '1';
      if (!Number.isInteger(skuId) || skuId <= 0) return res.status(400).json({ error: 'sku_id 不正確' });

      const skuRow = await pool.query(
        `SELECT id, sku, barcode, stock, product_id
         FROM product_skus
         WHERE id = $1`,
        [skuId]
      );
      if (skuRow.rows.length === 0) return res.status(404).json({ error: 'SKU 不存在' });

      const where = includeInactive ? '1=1' : 'w.is_active = true';
      const levels = await pool.query(
        `SELECT w.id AS warehouse_id,
                w.name AS warehouse_name,
                w.is_default,
                w.is_active,
                COALESCE(il.stock, 0) AS stock
         FROM inventory_warehouses w
         LEFT JOIN inventory_levels il
           ON il.warehouse_id = w.id AND il.sku_id = $1
         WHERE ${where}
         ORDER BY w.is_default DESC, w.is_active DESC, w.name`,
        [skuId]
      );

      return res.json({ sku: skuRow.rows[0], levels: levels.rows });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: '服務器錯誤' });
    }
  });

  app.post('/api/admin/inventory/adjust', requirePermission('inventory:write'), async (req, res) => {
    try {
      const skuId = Number(req.body.sku_id);
      const delta = Number(req.body.delta);
      const note = req.body.note ? String(req.body.note) : null;
      let warehouseId = req.body.warehouse_id ? Number(req.body.warehouse_id) : null;

      if (!Number.isInteger(skuId) || skuId <= 0) return res.status(400).json({ error: 'sku_id 不正確' });
      if (!Number.isInteger(delta) || delta === 0) return res.status(400).json({ error: 'delta 不正確' });

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

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

        await client.query(
          `INSERT INTO inventory_levels (warehouse_id, sku_id, stock)
           VALUES ($1, $2, 0)
           ON CONFLICT (warehouse_id, sku_id) DO NOTHING`,
          [warehouseId, skuId]
        );

        const skuRow = await client.query(
          `SELECT ps.id, ps.product_id, ps.stock AS total_stock, il.stock AS warehouse_stock
           FROM product_skus ps
           JOIN inventory_levels il
             ON il.sku_id = ps.id AND il.warehouse_id = $2
           WHERE ps.id = $1
           FOR UPDATE OF ps, il`,
          [skuId, warehouseId]
        );
        if (skuRow.rows.length === 0) return res.status(404).json({ error: 'SKU 不存在' });

        const { previousStock: warehousePreviousStock, newStock: warehouseNewStock } = computeNewStock({
          previousStock: skuRow.rows[0].warehouse_stock,
          delta
        });

        const { previousStock: totalPreviousStock, newStock: totalNewStock } = computeNewStock({
          previousStock: skuRow.rows[0].total_stock,
          delta
        });

        await client.query(
          'UPDATE inventory_levels SET stock = $1, updated_at = NOW() WHERE warehouse_id = $2 AND sku_id = $3',
          [warehouseNewStock, warehouseId, skuId]
        );

        await client.query(
          'UPDATE product_skus SET stock = $1, updated_at = NOW() WHERE id = $2',
          [totalNewStock, skuId]
        );

        const tx = await client.query(
          `INSERT INTO inventory_transactions
            (product_id, sku_id, warehouse_id, type, quantity, previous_stock, new_stock, reference_id, note)
           VALUES ($1,$2,$3,'adjustment',$4,$5,$6,NULL,$7)
           RETURNING *`,
          [
            skuRow.rows[0].product_id,
            skuId,
            warehouseId,
            delta,
            warehousePreviousStock,
            warehouseNewStock,
            note
          ]
        );

        await client.query('COMMIT');
        return res.json({
          success: true,
          transaction: tx.rows[0],
          sku: {
            id: skuId,
            stock: totalNewStock,
            warehouse_id: warehouseId,
            warehouse_stock: warehouseNewStock
          }
        });
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    } catch (e) {
      return res.status(500).json({ error: e && e.message ? e.message : '服務器錯誤' });
    }
  });

  // Get warehouses
  app.get('/api/admin/warehouses', requirePermission('inventory:read'), async (req, res) => {
    try {
      const includeInactive = String(req.query.include_inactive || '') === '1';
      const where = includeInactive ? '1=1' : 'is_active = true';
      const result = await pool.query(
        `SELECT *
         FROM inventory_warehouses
         WHERE ${where}
         ORDER BY is_default DESC, is_active DESC, name`
      );
      res.json({ warehouses: result.rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // Create warehouse
  app.post('/api/admin/warehouses', requirePermission('inventory:write'), async (req, res) => {
    try {
      const name = String(req.body.name || '').trim();
      const address = req.body.address ? String(req.body.address) : null;
      const contactName = req.body.contact_name ? String(req.body.contact_name) : null;
      const contactPhone = req.body.contact_phone ? String(req.body.contact_phone) : null;
      const isDefault = Boolean(req.body.is_default);
      if (!name) return res.status(400).json({ error: '倉庫名必填' });

      if (!isDefault) {
        const result = await pool.query(
          `INSERT INTO inventory_warehouses (name, address, contact_name, contact_phone)
           VALUES ($1, $2, $3, $4)
           RETURNING *`,
          [name, address, contactName, contactPhone]
        );
        return res.json({ success: true, warehouse: result.rows[0] });
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('UPDATE inventory_warehouses SET is_default = false WHERE is_default = true');
        const result = await client.query(
          `INSERT INTO inventory_warehouses (name, address, contact_name, contact_phone, is_default)
           VALUES ($1, $2, $3, $4, true)
           RETURNING *`,
          [name, address, contactName, contactPhone]
        );
        await client.query('COMMIT');
        return res.json({ success: true, warehouse: result.rows[0] });
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  app.put('/api/admin/warehouses/:id', requirePermission('inventory:write'), async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'id 不正確' });

      const fields = [];
      const params = [];
      if (typeof req.body.name !== 'undefined') {
        const name = String(req.body.name || '').trim();
        if (!name) return res.status(400).json({ error: '倉庫名必填' });
        fields.push(`name = $${params.length + 1}`);
        params.push(name);
      }
      if (typeof req.body.address !== 'undefined') {
        fields.push(`address = $${params.length + 1}`);
        params.push(req.body.address ? String(req.body.address) : null);
      }
      if (typeof req.body.contact_name !== 'undefined') {
        fields.push(`contact_name = $${params.length + 1}`);
        params.push(req.body.contact_name ? String(req.body.contact_name) : null);
      }
      if (typeof req.body.contact_phone !== 'undefined') {
        fields.push(`contact_phone = $${params.length + 1}`);
        params.push(req.body.contact_phone ? String(req.body.contact_phone) : null);
      }
      if (typeof req.body.is_active !== 'undefined') {
        fields.push(`is_active = $${params.length + 1}`);
        params.push(Boolean(req.body.is_active));
      }
      if (fields.length === 0) return res.status(400).json({ error: '沒有可更新欄位' });

      const r = await pool.query(
        `UPDATE inventory_warehouses
         SET ${fields.join(', ')}
         WHERE id = $${params.length + 1}
         RETURNING *`,
        [...params, id]
      );
      if (r.rows.length === 0) return res.status(404).json({ error: '倉庫不存在' });
      return res.json({ success: true, warehouse: r.rows[0] });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: '服務器錯誤' });
    }
  });

  app.post('/api/admin/warehouses/:id/make-default', requirePermission('inventory:write'), async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'id 不正確' });

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const check = await client.query('SELECT id, is_active FROM inventory_warehouses WHERE id = $1 FOR UPDATE', [id]);
        if (check.rows.length === 0) return res.status(404).json({ error: '倉庫不存在' });
        if (check.rows[0].is_active === false) return res.status(400).json({ error: '不能將停用倉庫設為預設' });

        await client.query('UPDATE inventory_warehouses SET is_default = false WHERE is_default = true');
        const out = await client.query('UPDATE inventory_warehouses SET is_default = true WHERE id = $1 RETURNING *', [id]);
        await client.query('COMMIT');
        return res.json({ success: true, warehouse: out.rows[0] });
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // ===========================================
  // Categories (already in basic api, extended)
  // ===========================================

  // Get category tree (public)
  app.get('/api/categories/tree', async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT * FROM categories WHERE status = 'active' ORDER BY parent_id, sort_order
      `);

      // Build tree
      const categories = result.rows;
      const map = {};
      const roots = [];

      categories.forEach(cat => {
        map[cat.id] = { ...cat, children: [] };
      });

      categories.forEach(cat => {
        if (cat.parent_id && map[cat.parent_id]) {
          map[cat.parent_id].children.push(map[cat.id]);
        } else if (!cat.parent_id) {
          roots.push(map[cat.id]);
        }
      });

      res.json({ tree: roots, all: categories });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // ===== JAN 比對待覆核佇列（Japan wholesale） =====
  // match_status='unverified'：相似度 0.50–0.70，要人手確認。
  app.get('/api/admin/wholesale-match/unverified', requirePermission('catalog:read'), async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const pageSize = Math.min(100, parseInt(req.query.page_size) || 50);
      const offset = (page - 1) * pageSize;
      const search = (req.query.search || '').trim();

      let where = "ps.match_status = 'unverified'";
      const params = [];
      if (search) {
        params.push('%' + search + '%');
        where += ` AND (COALESCE(p.name_zh_hk, p.name) ILIKE $${params.length}
                     OR ps.match_source_jan ILIKE $${params.length}
                     OR ps.sku ILIKE $${params.length})`;
      }

      const countRes = await pool.query(
        `SELECT COUNT(*)::int AS total FROM product_skus ps
         JOIN products p ON p.id = ps.product_id WHERE ${where}`,
        params
      );
      const total = countRes.rows[0].total;

      const rowsRes = await pool.query(
        `SELECT ps.id AS sku_id, ps.product_id, ps.sku, ps.barcode,
                ps.match_source_jan, ps.match_sim, ps.match_matched_at,
                ps.cost_price_jpy, ps.wholesale_price_hkd,
                COALESCE(p.name_zh_hk, p.name) AS product_name,
                p.slug AS product_slug, p.image_url
         FROM product_skus ps
         JOIN products p ON p.id = ps.product_id
         WHERE ${where}
         ORDER BY ps.match_sim DESC, ps.id
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, pageSize, offset]
      );

      res.json({
        items: rowsRes.rows,
        pagination: { page, page_size: pageSize, total, total_pages: Math.ceil(total / pageSize) },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // 確認：比對正確 → match_status='auto'（視作已驗）
  app.post('/api/admin/wholesale-match/:skuId/confirm', requirePermission('catalog:write'), async (req, res) => {
    try {
      const skuId = parseInt(req.params.skuId);
      if (!Number.isFinite(skuId)) return res.status(400).json({ error: '無效 SKU id' });
      const r = await pool.query(
        `UPDATE product_skus SET match_status = 'auto', updated_at = NOW()
         WHERE id = $1 AND match_status = 'unverified' RETURNING id`,
        [skuId]
      );
      if (r.rows.length === 0) return res.status(404).json({ error: '找不到該待覆核項目' });
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // 駁回：比對錯誤 → match_status='rejected'，清走入貨/批發價（避免錯價流出）
  app.post('/api/admin/wholesale-match/:skuId/reject', requirePermission('catalog:write'), async (req, res) => {
    try {
      const skuId = parseInt(req.params.skuId);
      if (!Number.isFinite(skuId)) return res.status(400).json({ error: '無效 SKU id' });
      const r = await pool.query(
        `UPDATE product_skus
            SET match_status = 'rejected',
                cost_price_jpy = NULL, wholesale_price_hkd = NULL,
                updated_at = NOW()
         WHERE id = $1 AND match_status = 'unverified' RETURNING id`,
        [skuId]
      );
      if (r.rows.length === 0) return res.status(404).json({ error: '找不到該待覆核項目' });
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // 批量：{ sku_ids: number[], action: 'confirm' | 'reject' }
  app.post('/api/admin/wholesale-match/bulk', requirePermission('catalog:write'), async (req, res) => {
    try {
      const ids = Array.isArray(req.body.sku_ids) ? req.body.sku_ids : [];
      const action = req.body.action === 'reject' ? 'reject' : 'confirm';
      const cleanIds = [...new Set(ids.map(Number).filter((n) => Number.isInteger(n) && n > 0))];
      if (cleanIds.length === 0) return res.status(400).json({ error: '未選擇任何項目' });
      if (cleanIds.length > 500) return res.status(400).json({ error: '每次最多 500 項' });

      let updated;
      if (action === 'confirm') {
        const r = await pool.query(
          `UPDATE product_skus SET match_status = 'auto', updated_at = NOW()
           WHERE id = ANY($1::int[]) AND match_status = 'unverified' RETURNING id`,
          [cleanIds]
        );
        updated = r.rows.length;
      } else {
        const r = await pool.query(
          `UPDATE product_skus SET match_status = 'rejected',
               cost_price_jpy = NULL, wholesale_price_hkd = NULL, updated_at = NOW()
           WHERE id = ANY($1::int[]) AND match_status = 'unverified' RETURNING id`,
          [cleanIds]
        );
        updated = r.rows.length;
      }
      res.json({ success: true, updated });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

};