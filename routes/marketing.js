// ===========================================
// Marketing & Promotions API
// Includes: coupons, flash sales, affiliates, abandoned cart recovery
// Hong Kong E-commerce Full Feature
// ===========================================

module.exports = function(app, pool) {

  const requireAuth = require('./middleware/auth').requireAuth;
  const requireAdmin = require('./middleware/auth').requireAdmin;
  const requirePermission = require('./middleware/auth').requirePermission;

  // ===========================================
  // Coupons / Promotion Codes
  // ===========================================

  // Validate coupon (public - frontend checks before checkout)
  app.post('/api/coupons/validate', requireAuth, async (req, res) => {
    try {
      const { code, order_total } = req.body;

      const result = await pool.query(`
        SELECT * FROM coupons WHERE code = UPPER($1) AND is_active = true
      `, [code]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: '優惠碼不存在' });
      }

      const coupon = result.rows[0];

      // Check usage limit
      if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) {
        return res.status(400).json({ error: '優惠碼已用完' });
      }

      // Check date
      const now = new Date();
      if (coupon.starts_at && new Date(coupon.starts_at) > now) {
        return res.status(400).json({ error: '優惠碼未生效' });
      }
      if (coupon.expires_at && new Date(coupon.expires_at) < now) {
        return res.status(400).json({ error: '優惠碼已過期' });
      }

      // Check min order amount
      if (coupon.min_order_amount && order_total < coupon.min_order_amount) {
        return res.status(400).json({
          error: `訂單金額需滿 HK$${coupon.min_order_amount} 先可以使用`
        });
      }

      // Check user usage limit
      if (coupon.usage_limit_per_user) {
        const usageResult = await pool.query(`
          SELECT COUNT(*) FROM coupon_usages WHERE coupon_id = $1 AND user_id = $2
        `, [coupon.id, req.user.id]);
        const usedCount = parseInt(usageResult.rows[0].count);
        if (usedCount >= coupon.usage_limit_per_user) {
          return res.status(400).json({ error: '你已用過呢個優惠碼' });
        }
      }

      // Calculate discount
      let discountAmount = 0;
      if (coupon.type === 'percentage') {
        discountAmount = order_total * (coupon.value / 100);
        if (coupon.max_discount_amount && discountAmount > coupon.max_discount_amount) {
          discountAmount = coupon.max_discount_amount;
        }
      } else if (coupon.type === 'fixed') {
        discountAmount = coupon.value;
      } else if (coupon.type === 'free_shipping') {
        // Free shipping handled separately
        discountAmount = 0;
      }

      res.json({
        success: true,
        coupon,
        discount_amount: parseFloat(discountAmount.toFixed(2))
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // Admin: list coupons
  app.get('/api/admin/coupons', requireAdmin, async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const pageSize = parseInt(req.query.page_size) || 50;
      const offset = (page - 1) * pageSize;
      const is_active = req.query.is_active;

      let where = '1=1';
      let params = [];
      if (is_active !== undefined) {
        where += ` AND is_active = $${params.length + 1}`;
        params.push(is_active === 'true');
      }

      const countResult = await pool.query(`SELECT COUNT(*) FROM coupons WHERE ${where}`, params);
      const total = parseInt(countResult.rows[0].count);

      const result = await pool.query(`
        SELECT * FROM coupons WHERE ${where} ORDER BY created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, [...params, pageSize, offset]);

      res.json({
        coupons: result.rows,
        pagination: { page, page_size: pageSize, total }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // Admin: create coupon
  app.post('/api/admin/coupons', requirePermission('*'), async (req, res) => {
    try {
      const {
        code, type, value, min_order_amount, max_discount_amount,
        usage_limit, usage_limit_per_user,
        allowed_categories, allowed_products, allowed_member_levels,
        starts_at, expires_at, is_active
      } = req.body;

      const result = await pool.query(`
        INSERT INTO coupons (
          code, type, value, min_order_amount, max_discount_amount,
          usage_limit, usage_limit_per_user,
          allowed_categories, allowed_products, allowed_member_levels,
          starts_at, expires_at, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `, [
        code.toUpperCase(), type, value, min_order_amount, max_discount_amount,
        usage_limit, usage_limit_per_user,
        allowed_categories ? JSON.stringify(allowed_categories) : null,
        allowed_products ? JSON.stringify(allowed_products) : null,
        allowed_member_levels ? JSON.stringify(allowed_member_levels) : null,
        starts_at, expires_at, is_active !== false
      ]);

      res.json({ success: true, coupon: result.rows[0] });
    } catch (err) {
      console.error(err);
      if (err.code === '23505') {
        return res.status(400).json({ error: 'Coupon code 已存在' });
      }
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  app.put('/api/admin/coupons/:id', requirePermission('*'), async (req, res) => {
    try {
      const { id } = req.params;
      const {
        code, type, value, min_order_amount, max_discount_amount,
        usage_limit, usage_limit_per_user,
        starts_at, expires_at, is_active
      } = req.body;

      const result = await pool.query(`
        UPDATE coupons SET
          code = $1, type = $2, value = $3, min_order_amount = $4, max_discount_amount = $5,
          usage_limit = $6, usage_limit_per_user = $7,
          starts_at = $8, expires_at = $9, is_active = $10,
          updated_at = NOW()
        WHERE id = $11
        RETURNING *
      `, [
        code.toUpperCase(), type, value, min_order_amount, max_discount_amount,
        usage_limit, usage_limit_per_user,
        starts_at, expires_at, is_active, id
      ]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: '優惠券不存在' });
      }

      res.json({ success: true, coupon: result.rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  app.delete('/api/admin/coupons/:id', requirePermission('*'), async (req, res) => {
    try {
      const { id } = req.params;
      await pool.query('DELETE FROM coupons WHERE id = $1', [id]);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // ===========================================
  // Flash Sales
  // ===========================================

  // Get active flash sales (public)
  app.get('/api/flash-sales/active', async (req, res) => {
    try {
      const now = new Date();
      const result = await pool.query(`
        SELECT fs.*
        FROM flash_sales fs
        WHERE fs.is_active = true AND fs.starts_at <= $1 AND (fs.ends_at >= $1 OR fs.ends_at IS NULL)
        ORDER BY fs.starts_at DESC
      `, [now]);

      const flashSales = await Promise.all(result.rows.map(async (fs) => {
        const productsResult = await pool.query(`
          SELECT fsp.*, p.name, p.slug, p.image_url, p.price
          FROM flash_sale_products fsp
          JOIN products p ON fsp.product_id = p.id
          WHERE fsp.flash_sale_id = $1
          ORDER BY fsp.sort_order
        `, [fs.id]);
        return {
          ...fs,
          products: productsResult.rows
        };
      }));

      res.json({ flash_sales: flashSales });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  app.get('/api/admin/flash-sales', requireAdmin, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT * FROM flash_sales ORDER BY created_at DESC
      `);
      res.json({ flash_sales: result.rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  app.post('/api/admin/flash-sales', requirePermission('*'), async (req, res) => {
    try {
      const { name, description, starts_at, ends_at, products } = req.body;
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const fsResult = await client.query(`
          INSERT INTO flash_sales (name, description, starts_at, ends_at)
          VALUES ($1, $2, $3, $4)
          RETURNING id
        `, [name, description, starts_at, ends_at]);

        const fsId = fsResult.rows[0].id;

        for (const product of products) {
          await client.query(`
            INSERT INTO flash_sale_products (flash_sale_id, product_id, sale_price, original_price, stock_limit, sort_order)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [fsId, product.product_id, product.sale_price, product.original_price, product.stock_limit, product.sort_order || 0]);
        }

        await client.query('COMMIT');
        res.json({ success: true, flash_sale_id: fsId });
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

  // ===========================================
  // Affiliates / KOL Marketing
  // ===========================================

  app.get('/api/admin/affiliates', requireAdmin, async (req, res) => {
    try {
      const status = req.query.status;
      let where = '1=1';
      let params = [];
      if (status) {
        where += ` AND status = $1`;
        params.push(status);
      }

      const result = await pool.query(`
        SELECT a.*, u.username, u.email
        FROM affiliates a
        JOIN users u ON a.user_id = u.id
        WHERE ${where}
        ORDER BY created_at DESC
      `, params);

      // Add conversion stats
      const affiliatesWithStats = await Promise.all(result.rows.map(async (aff) => {
        const convResult = await pool.query(`
          SELECT COUNT(*) as total_conversions, COALESCE(SUM(commission_amount), 0) as total_commission
          FROM affiliate_conversions WHERE affiliate_id = $1
        `, [aff.id]);
        return {
          ...aff,
          total_conversions: parseInt(convResult.rows[0].total_conversions),
          total_commission: parseFloat(convResult.rows[0].total_commission)
        };
      }));

      res.json({ affiliates: affiliatesWithStats });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  app.post('/api/admin/affiliates', requirePermission('*'), async (req, res) => {
    try {
      const { user_id, code, commission_rate, status } = req.body;

      const result = await pool.query(`
        INSERT INTO affiliates (user_id, code, commission_rate, status)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [user_id, code, commission_rate, status || 'pending']);

      res.json({ success: true, affiliate: result.rows[0] });
    } catch (err) {
      console.error(err);
      if (err.code === '23505') {
        return res.status(400).json({ error: 'Affiliate code 已存在' });
      }
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // ===========================================
  // Abandoned Cart Recovery
  // ===========================================

  // Create abandoned cart (when user adds to cart but not checkout)
  app.post('/abandoned-carts', async (req, res) => {
    try {
      const { token, cart_data, email, phone, whatsapp } = req.body;
      const userId = req.user ? req.user.id : null;

      // Check if already exists
      const existing = await pool.query('SELECT id FROM abandoned_carts WHERE token = $1', [token]);
      if (existing.rows.length > 0) {
        await pool.query(`
          UPDATE abandoned_carts SET cart_data = $1, updated_at = NOW() WHERE token = $2
        `, [JSON.stringify(cart_data), token]);
      } else {
        await pool.query(`
          INSERT INTO abandoned_carts (user_id, token, cart_data, email, phone, whatsapp)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [userId, token, JSON.stringify(cart_data), email, phone, whatsapp]);
      }

      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // Admin: list abandoned carts that need reminder
  app.get('/api/admin/abandoned-carts', requireAdmin, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT ac.*, u.email, u.phone, u.whatsapp
        FROM abandoned_carts ac
        LEFT JOIN users u ON ac.user_id = u.id
        WHERE ac.recovered = false
        ORDER BY ac.created_at DESC
      `);
      res.json({ abandoned_carts: result.rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // Mark as recovered when user completes order
  app.post('/abandoned-carts/:token/recover', async (req, res) => {
    try {
      const { token } = req.params;
      const { order_id } = req.body;
      await pool.query(`
        UPDATE abandoned_carts SET recovered = true, recovered_order_id = $1, updated_at = NOW() WHERE token = $2
      `, [order_id, token]);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // ===========================================
  // Blog Posts (Content Marketing / SEO)
  // ===========================================

  // Public: published blog posts
  app.get('/api/blog/posts', async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const pageSize = parseInt(req.query.page_size) || 12;
      const offset = (page - 1) * pageSize;
      const search = req.query.search;

      let where = "status = 'published'";
      let params = [];

      if (search) {
        where += ` AND (title ILIKE $${params.length + 1} OR content ILIKE $${params.length + 1})`;
        params.push(`%${search}%`);
      }

      const countResult = await pool.query(`SELECT COUNT(*) FROM blog_posts WHERE ${where}`, params);
      const total = parseInt(countResult.rows[0].count);
      const totalPages = Math.ceil(total / pageSize);

      const result = await pool.query(`
        SELECT id, title, slug, excerpt, featured_image, publish_at, created_at
        FROM blog_posts
        WHERE ${where}
        ORDER BY publish_at DESC NULLS LAST, created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, [...params, pageSize, offset]);

      res.json({
        posts: result.rows,
        pagination: { page, page_size: pageSize, total, total_pages: totalPages }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // Public: single blog post
  app.get('/api/blog/posts/:slug', async (req, res) => {
    try {
      const { slug } = req.params;
      const result = await pool.query(`
        SELECT * FROM blog_posts WHERE slug = $1 AND status = 'published'
      `, [slug]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: '文章不存在' });
      }

      res.json({ post: result.rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // Admin: blog posts
  app.get('/api/admin/blog/posts', requireAdmin, async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const pageSize = parseInt(req.query.page_size) || 20;
      const offset = (page - 1) * pageSize;
      const status = req.query.status;

      let where = '1=1';
      let params = [];
      if (status) {
        where += ` AND status = $1`;
        params.push(status);
      }

      const countResult = await pool.query(`SELECT COUNT(*) FROM blog_posts WHERE ${where}`, params);
      const total = parseInt(countResult.rows[0].count);

      const result = await pool.query(`
        SELECT id, title, slug, status, publish_at, featured_image, created_at, updated_at
        FROM blog_posts
        WHERE ${where}
        ORDER BY created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, [...params, pageSize, offset]);

      res.json({
        posts: result.rows,
        pagination: { page, page_size: pageSize, total }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  app.post('/api/admin/blog/posts', requirePermission('*'), async (req, res) => {
    try {
      const { title, slug, content, excerpt, featured_image, status, publish_at, meta_title, meta_description } = req.body;

      const result = await pool.query(`
        INSERT INTO blog_posts (title, slug, content, excerpt, featured_image, status, publish_at, meta_title, meta_description)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [title, slug, content, excerpt, featured_image, status || 'draft', publish_at, meta_title, meta_description]);

      res.json({ success: true, post: result.rows[0] });
    } catch (err) {
      console.error(err);
      if (err.code === '23505') {
        return res.status(400).json({ error: 'Slug 已存在' });
      }
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  app.put('/api/admin/blog/posts/:id', requirePermission('*'), async (req, res) => {
    try {
      const { id } = req.params;
      const { title, slug, content, excerpt, featured_image, status, publish_at, meta_title, meta_description } = req.body;

      const result = await pool.query(`
        UPDATE blog_posts SET
          title = $1, slug = $2, content = $3, excerpt = $4, featured_image = $5,
          status = $6, publish_at = $7, meta_title = $8, meta_description = $9,
          updated_at = NOW()
        WHERE id = $10
        RETURNING *
      `, [title, slug, content, excerpt, featured_image, status, publish_at, meta_title, meta_description, id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: '文章不存在' });
      }

      res.json({ success: true, post: result.rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  app.delete('/api/admin/blog/posts/:id', requirePermission('*'), async (req, res) => {
    try {
      const { id } = req.params;
      await pool.query('DELETE FROM blog_posts WHERE id = $1', [id]);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

};
