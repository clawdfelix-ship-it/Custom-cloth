// ===========================================
// Member System API
// Includes: member levels, points, user tags, addresses
// Hong Kong E-commerce Full Feature
// ===========================================

module.exports = function(app, pool) {

  const requireAuth = require('./middleware/auth').requireAuth;
  const requireAdmin = require('./middleware/auth').requireAdmin;
  const requireSuperAdmin = (req, res, next) => {
    if (req.session && req.session.userId && req.session.isAdmin) {
      req.user = { id: req.session.userId, isAdmin: true, permissions: req.session.adminPermissions || ['*'] };
      return next();
    }
    res.status(403).json({ error: '需要管理員權限' });
  };

  // ===========================================
  // Member Levels (public info)
  // ===========================================

  app.get('/api/member-levels', async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT id, name, min_spent, discount_percent, free_shipping_threshold, birthday_bonus_points, priority_shipping, sort_order
        FROM member_levels WHERE is_active = true ORDER BY sort_order
      `);
      res.json({ levels: result.rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // ===========================================
  // User Profile (authenticated user)
  // ===========================================

  app.get('/api/user/profile', requireAuth, async (req, res) => {
    try {
      const userId = req.user.id;
      const result = await pool.query(`
        SELECT
          u.id, u.username, u.email, u.phone, u.whatsapp,
          u.first_name, u.last_name, u.date_of_birth, u.avatar_url,
          u.points, u.is_b2b,
          (SELECT COUNT(*) FROM orders o
             WHERE o.user_id = u.id AND o.status != 'cancelled') AS total_orders,
          (SELECT COALESCE(SUM(o.total_amount), 0) FROM orders o
             WHERE o.user_id = u.id AND o.status != 'cancelled') AS total_spent
        FROM users u
        WHERE u.id = $1
      `, [userId]);

      res.json({ user: result.rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  app.put('/api/user/profile', requireAuth, async (req, res) => {
    try {
      const userId = req.user.id;
      const { first_name, last_name, email, phone, whatsapp, date_of_birth, marketing_consent, avatar_url } = req.body;

      await pool.query(`
        UPDATE users
        SET first_name = $1, last_name = $2, email = $3, phone = $4, whatsapp = $5,
            date_of_birth = $6, marketing_consent = $7, avatar_url = $8, updated_at = NOW()
        WHERE id = $9
      `, [first_name, last_name, email, phone, whatsapp, date_of_birth, marketing_consent, avatar_url, userId]);

      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // Change password
  app.post('/api/user/change-password', requireAuth, async (req, res) => {
    try {
      const userId = req.user.id;
      const { old_password, new_password } = req.body;

      // Verify old password
      const userResult = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
      const bcrypt = require('bcryptjs');
      const valid = await bcrypt.compare(old_password, userResult.rows[0].password_hash);

      if (!valid) {
        return res.status(400).json({ error: '舊密碼不正確' });
      }

      if (new_password.length < 6) {
        return res.status(400).json({ error: '新密碼至少 6 位' });
      }

      const passwordHash = await bcrypt.hash(new_password, 10);
      await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [passwordHash, userId]);

      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // ===========================================
  // User Saved Addresses
  // ===========================================

  app.get('/api/user/addresses', requireAuth, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT * FROM user_addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC
      `, [req.user.id]);
      res.json({ addresses: result.rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  app.post('/api/user/addresses', requireAuth, async (req, res) => {
    try {
      const { name, phone, address_line1, address_line2, district, area, postcode, type } = req.body;

      // If this is first address, make it default
      const countResult = await pool.query('SELECT COUNT(*) FROM user_addresses WHERE user_id = $1', [req.user.id]);
      const isFirst = parseInt(countResult.rows[0].count) === 0;

      const result = await pool.query(`
        INSERT INTO user_addresses (user_id, name, phone, address_line1, address_line2, district, area, postcode, type, is_default)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [req.user.id, name, phone, address_line1, address_line2, district, area, postcode, type || 'home', isFirst]);

      res.json({ success: true, address: result.rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  app.put('/api/user/addresses/:id', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { name, phone, address_line1, address_line2, district, area, postcode, type, is_default } = req.body;

      // Verify ownership
      const check = await pool.query('SELECT id FROM user_addresses WHERE id = $1 AND user_id = $2', [id, req.user.id]);
      if (check.rows.length === 0) {
        return res.status(404).json({ error: '地址不存在' });
      }

      if (is_default) {
        // Remove default from all others
        await pool.query('UPDATE user_addresses SET is_default = false WHERE user_id = $1', [req.user.id]);
      }

      await pool.query(`
        UPDATE user_addresses
        SET name = $1, phone = $2, address_line1 = $3, address_line2 = $4, district = $5, area = $6, postcode = $7, type = $8, is_default = $9, updated_at = NOW()
        WHERE id = $10 AND user_id = $11
      `, [name, phone, address_line1, address_line2, district, area, postcode, type, is_default, id, req.user.id]);

      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  app.delete('/api/user/addresses/:id', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      await pool.query('DELETE FROM user_addresses WHERE id = $1 AND user_id = $2', [id, req.user.id]);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  app.post('/api/user/addresses/:id/set-default', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      // Verify ownership
      const check = await pool.query('SELECT id FROM user_addresses WHERE id = $1 AND user_id = $2', [id, req.user.id]);
      if (check.rows.length === 0) {
        return res.status(404).json({ error: '地址不存在' });
      }

      await pool.query('UPDATE user_addresses SET is_default = false WHERE user_id = $1', [req.user.id]);
      await pool.query('UPDATE user_addresses SET is_default = true WHERE id = $2 AND user_id = $3', [null, id, req.user.id]);

      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // ===========================================
  // Points History
  // ===========================================

  app.get('/api/user/points', requireAuth, async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const pageSize = parseInt(req.query.page_size) || 20;
      const offset = (page - 1) * pageSize;

      const countResult = await pool.query('SELECT COUNT(*) FROM points_transactions WHERE user_id = $1', [req.user.id]);
      const total = parseInt(countResult.rows[0].count);

      const result = await pool.query(`
        SELECT * FROM points_transactions
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `, [req.user.id, pageSize, offset]);

      const userResult = await pool.query('SELECT points FROM users WHERE id = $1', [req.user.id]);
      const currentPoints = parseInt(userResult.rows[0].points);

      res.json({
        current_points: currentPoints,
        transactions: result.rows,
        pagination: { page, page_size: pageSize, total }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // Redeem points for discount
  app.post('/api/user/points/redeem', requireAuth, async (req, res) => {
    try {
      const { points, order_id } = req.body;
      const userId = req.user.id;

      const userResult = await pool.query('SELECT points FROM users WHERE id = $1', [userId]);
      const currentPoints = parseInt(userResult.rows[0].points);

      if (points > currentPoints) {
        return res.status(400).json({ error: '積分不足' });
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Deduct points
        await client.query(`
          UPDATE users SET points = points - $1 WHERE id = $2
        `, [points, userId]);

        // Log transaction
        await client.query(`
          INSERT INTO points_transactions (user_id, points, type, description, order_id)
          VALUES ($1, -$2, 'redeem', '積分兌換訂單折扣', $3)
        `, [userId, points, order_id]);

        await client.query('COMMIT');

        res.json({
          success: true,
          remaining_points: currentPoints - points
        });
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
  // User Tags (Admin for segmentation)
  // ===========================================

  app.get('/api/admin/user-tags', requireAdmin, async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM user_tags ORDER BY name');
      res.json({ tags: result.rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  app.post('/api/admin/user-tags', requireAdmin, async (req, res) => {
    try {
      const { name, description, color } = req.body;
      const result = await pool.query(`
        INSERT INTO user_tags (name, description, color) VALUES ($1, $2, $3) RETURNING *
      `, [name, description, color]);
      res.json({ success: true, tag: result.rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  app.get('/api/admin/users', requireSuperAdmin, async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const pageSize = parseInt(req.query.page_size) || 50;
      const offset = (page - 1) * pageSize;
      const search = req.query.search;
      const tagId = req.query.tag_id;
      const is_active = req.query.is_active;

      let where = '1=1';
      let params = [];

      if (search) {
        where += ` AND (username ILIKE $${params.length + 1} OR email ILIKE $${params.length + 1} OR phone ILIKE $${params.length + 1})`;
        params.push(`%${search}%`);
      }
      if (tagId) {
        where += ` AND EXISTS (SELECT 1 FROM user_tag_assignments WHERE user_id = u.id AND tag_id = $${params.length + 1})`;
        params.push(tagId);
      }
      if (is_active !== undefined) {
        where += ` AND u.is_active = $${params.length + 1}`;
        params.push(is_active === 'true');
      }

      const countResult = await pool.query(`SELECT COUNT(*) FROM users u WHERE ${where}`, params);
      const total = parseInt(countResult.rows[0].count);
      const totalPages = Math.ceil(total / pageSize);

      const result = await pool.query(`
        SELECT u.id, u.username, u.email, u.phone, u.whatsapp, u.first_name, u.last_name,
               u.is_active, u.is_blacklisted, u.is_admin, u.is_b2b, u.points,
               (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id AND o.status != 'cancelled') AS total_orders,
               (SELECT COALESCE(SUM(o.total_amount), 0) FROM orders o WHERE o.user_id = u.id AND o.status != 'cancelled') AS total_spent,
               u.created_at, u.last_login_at,
               (SELECT ap.role_id FROM admin_permissions ap WHERE ap.user_id = u.id ORDER BY ap.id DESC LIMIT 1) as role_id,
               (SELECT ar.name FROM admin_permissions ap JOIN admin_roles ar ON ar.id = ap.role_id WHERE ap.user_id = u.id ORDER BY ap.id DESC LIMIT 1) as role_name
        FROM users u
        WHERE ${where}
        ORDER BY u.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, [...params, pageSize, offset]);

      res.json({
        users: result.rows,
        pagination: { page, page_size: pageSize, total, total_pages: totalPages }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  app.get('/api/admin/users/:id', requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const userResult = await pool.query(`
        SELECT u.*,
               (SELECT ap.role_id FROM admin_permissions ap WHERE ap.user_id = u.id ORDER BY ap.id DESC LIMIT 1) as role_id,
               (SELECT ar.name FROM admin_permissions ap JOIN admin_roles ar ON ar.id = ap.role_id WHERE ap.user_id = u.id ORDER BY ap.id DESC LIMIT 1) as role_name
        FROM users u
        WHERE u.id = $1
      `, [id]);

      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: '用戶不存在' });
      }

      // Get assigned tags
      const tagsResult = await pool.query(`
        SELECT ut.* FROM user_tags ut
        JOIN user_tag_assignments uta ON ut.id = uta.tag_id
        WHERE uta.user_id = $1
      `, [id]);

      // Get order count and total
      const orderStats = await pool.query(`
        SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as total
        FROM orders WHERE user_id = $1 AND status != 'cancelled'
      `, [id]);

      res.json({
        user: userResult.rows[0],
        tags: tagsResult.rows,
        order_stats: {
          count: parseInt(orderStats.rows[0].count),
          total_spent: parseFloat(orderStats.rows[0].total)
        }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  app.post('/api/admin/users', requireSuperAdmin, async (req, res) => {
    try {
      const { username, email, phone, password, first_name, last_name, is_admin, is_active, role_id } = req.body;
      const bcrypt = require('bcryptjs');
      const passwordHash = await bcrypt.hash(password, 10);

      const result = await pool.query(`
        INSERT INTO users (username, email, phone, password_hash, first_name, last_name, is_admin, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, username, email, created_at
      `, [username, email, phone, passwordHash, first_name, last_name, is_admin || false, is_active !== false]);

      const newUser = result.rows[0];
      const roleIdNum = role_id ? Number(role_id) : null;
      if (roleIdNum && Number.isInteger(roleIdNum) && roleIdNum > 0) {
        await pool.query(
          'INSERT INTO admin_permissions (user_id, role_id) VALUES ($1, $2)',
          [newUser.id, roleIdNum]
        );
      }

      res.json({ success: true, user: newUser });
    } catch (err) {
      console.error(err);
      if (err.code === '23505') {
        return res.status(400).json({ error: '用戶名已存在' });
      }
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  app.put('/api/admin/users/:id', requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { email, phone, whatsapp, first_name, last_name, is_active, is_blacklisted, is_admin, is_b2b, role_id } = req.body;

      await pool.query(`
        UPDATE users
        SET email = $1, phone = $2, whatsapp = $3, first_name = $4, last_name = $5,
            is_active = $6, is_blacklisted = $7, is_admin = $8, is_b2b = $9, updated_at = NOW()
        WHERE id = $10
      `, [email, phone, whatsapp, first_name, last_name, is_active, is_blacklisted, is_admin, is_b2b || false, id]);

      if (role_id !== undefined) {
        const roleIdNum = role_id ? Number(role_id) : null;
        await pool.query('DELETE FROM admin_permissions WHERE user_id = $1', [id]);
        if (roleIdNum && Number.isInteger(roleIdNum) && roleIdNum > 0) {
          await pool.query(
            'INSERT INTO admin_permissions (user_id, role_id) VALUES ($1, $2)',
            [id, roleIdNum]
          );
        }
      }

      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // Admin change user password
  app.post('/api/admin/users/:id/password', requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { new_password } = req.body;

      if (new_password.length < 6) {
        return res.status(400).json({ error: '密碼至少 6 位' });
      }

      const bcrypt = require('bcryptjs');
      const passwordHash = await bcrypt.hash(new_password, 10);

      await pool.query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
        [passwordHash, id]
      );

      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  app.delete('/api/admin/users/:id', requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      // Soft delete by deactivating
      await pool.query('UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1', [id]);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // ===========================================
  // Admin Roles & Permissions
  // ===========================================

  app.get('/api/admin/roles', requireSuperAdmin, async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM admin_roles ORDER BY name');
      res.json({ roles: result.rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  app.get('/api/admin/operation-logs', requireSuperAdmin, async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const pageSize = parseInt(req.query.page_size) || 50;
      const offset = (page - 1) * pageSize;
      const adminId = req.query.admin_id;

      let where = '1=1';
      let params = [];
      if (adminId) {
        where += ` AND admin_id = $${params.length + 1}`;
        params.push(adminId);
      }

      const countResult = await pool.query(`SELECT COUNT(*) FROM admin_operation_logs WHERE ${where}`, params);
      const total = parseInt(countResult.rows[0].count);

      const result = await pool.query(`
        SELECT ol.*, u.username as admin_name
        FROM admin_operation_logs ol
        JOIN users u ON ol.admin_id = u.id
        WHERE ${where}
        ORDER BY ol.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, [...params, pageSize, offset]);

      res.json({
        logs: result.rows,
        pagination: { page, page_size: pageSize, total }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // ===========================================
  // Hong Kong Districts (for address autocomplete)
  // ===========================================

  app.get('/api/hong-kong/districts', async (req, res) => {
    try {
      // List of all Hong Kong districts for address selection
      const districts = [
        { zone: 'Hong Kong Island', districts: [
          'Central', 'Admiralty', 'Mid-Levels', 'Sheung Wan', 'Wan Chai', 'Causeway Bay',
          'North Point', 'Quarry Bay', 'Tai Koo', 'Shau Kei Wan', 'Chai Wan', 'Pok Fu Lam',
          'Aberdeen', 'Stanley', 'Repulse Bay'
        ]},
        { zone: 'Kowloon', districts: [
          'Tsim Sha Tsui', 'Jordan', 'Yau Ma Tei', 'Mong Kok', 'Prince Edward', 'Sham Shui Po',
          'Cheung Sha Wan', 'Kowloon City', 'Hung Hom', 'To Kwa Wan', 'Wong Tai Sin', 'Diamond Hill',
          'Kwun Tong', 'Kowloon Bay', 'Lam Tin', 'Yau Tong'
        ]},
        { zone: 'New Territories East', districts: [
          'Shatin', 'Ma On Shan', 'Tai Wai', 'Fo Tan', 'Tai Po', 'Fanling', 'Sheung Shui',
          'Sai Kung', 'Tseung Kwan O', 'Tiu Keng Leng'
        ]},
        { zone: 'New Territories West', districts: [
          'Tsuen Wan', 'Kwai Chung', 'Tsing Yi', 'Tuen Mun', 'Yuen Long', 'Tai Po',
          'Hung Shui Kiu', 'Tin Shui Wai', 'Kam Tin', 'Shek Kong'
        ]},
        { zone: 'Outlying Islands', districts: [
          'Lantau', 'Tung Chung', 'Discovery Bay', 'Cheung Chau', 'Lamma Island', 'Peng Chau'
        ]}
      ];
      res.json({ districts });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // =========================================================================
  // 後台積分管理
  //  GET  /api/admin/users/:id/points      — 結餘 + 流水
  //  POST /api/admin/users/:id/points      — 人手加/減分（要寫原因）
  // =========================================================================
  const pointsService = require('../lib/pointsService');

  app.get('/api/admin/users/:id/points', requireSuperAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id, 10);
      if (!Number.isInteger(userId)) return res.status(400).json({ error: '無效用戶 ID' });

      const u = await pool.query('SELECT points FROM users WHERE id = $1', [userId]);
      if (!u.rows.length) return res.status(404).json({ error: '用戶不存在' });

      const history = await pointsService.getHistory(pool, userId, {
        page: parseInt(req.query.page, 10) || 1,
        pageSize: parseInt(req.query.pageSize, 10) || 15,
      });
      res.json({ balance: parseInt(u.rows[0].points, 10), history });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '讀取積分資料失敗' });
    }
  });

  app.post('/api/admin/users/:id/points', requireSuperAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id, 10);
      if (!Number.isInteger(userId)) return res.status(400).json({ error: '無效用戶 ID' });

      const points = parseInt(req.body && req.body.points, 10);
      const reason = String((req.body && req.body.reason) || '').trim();
      if (!Number.isInteger(points) || points === 0) {
        return res.status(400).json({ error: '請輸入非零整數（減分用負數）' });
      }
      if (!reason) {
        return res.status(400).json({ error: '必須填寫調整原因，方便日後追溯' });
      }

      const out = await pointsService.adjustPoints(pool, {
        userId,
        points,
        reason,
        adminId: req.session.userId,
      });
      const history = await pointsService.getHistory(pool, userId, { page: 1, pageSize: 15 });
      res.json({ success: true, balance: out.balance, result: out.result, history });
    } catch (err) {
      if (err && err.code === 'POINTS_INSUFFICIENT') {
        return res.status(400).json({ error: '該用戶積分結餘不足，無法扣咁多分' });
      }
      console.error(err);
      res.status(500).json({ error: '調整積分失敗' });
    }
  });

};
