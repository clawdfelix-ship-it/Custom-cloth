const bcrypt = require('bcryptjs');
const { hasAdmin, createFirstAdmin } = require('../utils/adminBootstrap');

async function regenerateSession(req) {
  if (!req || !req.session || typeof req.session.regenerate !== 'function') return;
  await new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

function hasBackofficeAccess(session) {
  if (!session || !session.userId) return false;
  if (session.isAdmin) return true;
  return Boolean(session.isBackoffice && Array.isArray(session.adminPermissions) && session.adminPermissions.length > 0);
}

function isAdminSession(session) {
  return hasBackofficeAccess(session);
}

function hasPermissionList(permissions, required) {
  if (!required) return true;
  const reqs = Array.isArray(required) ? required : [required];
  const perms = Array.isArray(permissions) ? permissions : [];
  if (perms.includes('*')) return true;
  return reqs.every((r) => {
    if (perms.includes(r)) return true;
    const idx = String(r).indexOf(':');
    if (idx > 0) {
      const prefix = String(r).slice(0, idx);
      if (perms.includes(prefix + ':*')) return true;
    }
    return false;
  });
}

async function loadUserPermissions(pool, userId) {
  const r = await pool.query(
    `SELECT ar.permissions
     FROM admin_permissions ap
     JOIN admin_roles ar ON ar.id = ap.role_id
     WHERE ap.user_id = $1`,
    [userId]
  );
  const out = [];
  for (const row of r.rows) {
    const list = row && row.permissions ? row.permissions : [];
    if (Array.isArray(list)) out.push(...list);
  }
  return Array.from(new Set(out));
}

function requireAdminPage(requiredPermission) {
  return function(req, res, next) {
    if (!isAdminSession(req.session)) return res.redirect('/admin/login');
    if (requiredPermission && req.session && !req.session.isAdmin) {
      if (!hasPermissionList(req.session.adminPermissions, requiredPermission)) {
        return res.status(403).send('沒有權限');
      }
    }
    return next();
  };
}

async function setupEnabled({ hasAdmin: hasAdminFn }) {
  const exists = await hasAdminFn();
  return !exists;
}

function register(app, pool) {
  app.get('/admin/setup', async (req, res) => {
    if (!pool) return res.status(500).send('Database not configured');
    if (await hasAdmin(pool)) return res.status(404).send('Not Found');
    res.render('admin/setup', { title: '後台初始化' });
  });

  app.post('/admin/setup', async (req, res) => {
    if (!pool) return res.status(500).send('Database not configured');
    if (await hasAdmin(pool)) return res.status(404).send('Not Found');
    const { username, password, contact } = req.body || {};
    if (!username || !password || String(password).length < 6) {
      return res.status(400).send('用戶名及密碼至少 6 位');
    }
    const user = await createFirstAdmin(pool, { username, password, contact });
    await regenerateSession(req);
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.isAdmin = true;
    req.session.isBackoffice = true;
    req.session.adminPermissions = ['*'];
    res.redirect('/admin');
  });

  app.get('/admin/login', async (req, res) => {
    res.render('admin/login', { title: '後台登入', error: null });
  });

  app.post('/admin/login', async (req, res) => {
    if (!pool) return res.status(500).send('Database not configured');
    const { username, password } = req.body || {};
    const result = await pool.query(
      'SELECT id, username, password_hash, is_admin, contact FROM users WHERE username = $1',
      [username]
    );
    if (result.rows.length === 0) {
      return res.status(400).render('admin/login', { title: '後台登入', error: '用戶名或密碼錯誤' });
    }
    const user = result.rows[0];
    const ok = await bcrypt.compare(String(password || ''), user.password_hash);
    if (!ok) {
      return res.status(400).render('admin/login', { title: '後台登入', error: '用戶名或密碼錯誤' });
    }
    let adminPermissions = ['*'];
    if (user.is_admin) {
      adminPermissions = ['*'];
    } else {
      const perms = await loadUserPermissions(pool, user.id);
      if (!perms || perms.length === 0) {
        return res.status(403).render('admin/login', { title: '後台登入', error: '需要管理員權限' });
      }
      adminPermissions = perms;
    }
    await regenerateSession(req);
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.isAdmin = !!user.is_admin;
    req.session.isBackoffice = true;
    req.session.contact = user.contact;
    req.session.adminPermissions = adminPermissions;
    res.redirect('/admin');
  });

  app.post('/admin/logout', (req, res) => {
    if (!req.session) return res.redirect('/admin/login');
    req.session.destroy(() => {
      res.redirect('/admin/login');
    });
  });

  app.get('/admin', requireAdminPage(), (req, res) => {
    res.render('admin/layout', { title: '後台總覽', active: 'dashboard', content: 'dashboard' });
  });

  app.get('/admin/orders', requireAdminPage('orders:read'), (req, res) => {
    res.render('admin/layout', { title: '訂單管理', active: 'orders', content: 'orders' });
  });

  app.get('/admin/products', requireAdminPage('catalog:read'), (req, res) => {
    res.render('admin/layout', { title: '商品管理', active: 'products', content: 'products' });
  });

  app.get('/admin/inventory', requireAdminPage('inventory:read'), (req, res) => {
    res.render('admin/layout', { title: '庫存', active: 'inventory', content: 'inventory' });
  });

  app.get('/admin/low-stock', requireAdminPage('inventory:read'), (req, res) => {
    res.render('admin/layout', { title: '低庫存', active: 'low-stock', content: 'low-stock' });
  });

  app.get('/admin/wholesale-match', requireAdminPage('catalog:read'), (req, res) => {
    res.render('admin/layout', { title: '批發比對覆核', active: 'wholesale-match', content: 'wholesale-match' });
  });

  app.get('/admin/warehouses', requireAdminPage('inventory:write'), (req, res) => {
    res.render('admin/layout', { title: '倉庫', active: 'warehouses', content: 'warehouses' });
  });

  app.get('/admin/suppliers', requireAdminPage('inventory:write'), (req, res) => {
    res.render('admin/layout', { title: '供應商', active: 'suppliers', content: 'suppliers' });
  });

  app.get('/admin/purchase-orders', requireAdminPage('inventory:write'), (req, res) => {
    res.render('admin/layout', { title: '採購單', active: 'purchase-orders', content: 'purchase-orders' });
  });

  app.get('/admin/bulk-skus', requireAdminPage('inventory:bulk'), (req, res) => {
    res.render('admin/layout', { title: '批量更新 SKU', active: 'bulk-skus', content: 'bulk-skus' });
  });

  app.get('/admin/categories', requireAdminPage('catalog:read'), (req, res) => {
    res.render('admin/layout', { title: '分類管理', active: 'categories', content: 'categories' });
  });

  app.get('/admin/users', requireAdminPage('users:manage'), (req, res) => {
    res.render('admin/layout', { title: '用戶管理', active: 'users', content: 'users' });
  });

  app.get('/admin/returns', requireAdminPage('returns:read'), (req, res) => {
    res.render('admin/layout', { title: '售後管理', active: 'returns', content: 'returns' });
  });

  app.get('/admin/refunds', requireAdminPage('refunds:read'), (req, res) => {
    res.render('admin/layout', { title: '退款管理', active: 'refunds', content: 'refunds' });
  });

  app.get('/admin/reconciliation', requireAdminPage('reconciliation:read'), (req, res) => {
    res.render('admin/layout', { title: '對賬', active: 'reconciliation', content: 'reconciliation' });
  });

  app.get('/admin/reports', requireAdminPage('reports:read'), (req, res) => {
    res.render('admin/layout', { title: '報表', active: 'reports', content: 'reports' });
  });

  // 系統設定（匯率一鍵更新）— 超管先見到入口
  app.get('/admin/settings', requireAdminPage(), (req, res) => {
    if (!req.session.isAdmin) return res.status(403).send('沒有權限');
    res.render('admin/layout', { title: '系統設定', active: 'settings', content: 'settings' });
  });

  // ---- 補接：有 API 有表、之前冇頁面入口 ----
  // 商品線
  app.get('/admin/brands', requireAdminPage('catalog:read'), (req, res) => {
    res.render('admin/layout', { title: '品牌管理', active: 'brands', content: 'brands' });
  });
  app.get('/admin/reviews', requireAdminPage('catalog:write'), (req, res) => {
    res.render('admin/layout', { title: '評論審核', active: 'reviews', content: 'reviews' });
  });
  // 營銷線（寫入 API 要超管 '*'，頁面讀取任何後台可見，寫入由 API 把關）
  app.get('/admin/coupons', requireAdminPage(), (req, res) => {
    res.render('admin/layout', { title: '優惠券', active: 'coupons', content: 'coupons' });
  });
  app.get('/admin/flash-sales', requireAdminPage(), (req, res) => {
    res.render('admin/layout', { title: '閃購', active: 'flash-sales', content: 'flash-sales' });
  });
  app.get('/admin/affiliates', requireAdminPage(), (req, res) => {
    res.render('admin/layout', { title: '聯盟營銷', active: 'affiliates', content: 'affiliates' });
  });
  app.get('/admin/abandoned-carts', requireAdminPage(), (req, res) => {
    res.render('admin/layout', { title: '遺棄購物車', active: 'abandoned-carts', content: 'abandoned-carts' });
  });
  app.get('/admin/blog', requireAdminPage(), (req, res) => {
    res.render('admin/layout', { title: '網誌', active: 'blog', content: 'blog' });
  });
  // 配置線
  app.get('/admin/shipping-methods', requireAdminPage(), (req, res) => {
    res.render('admin/layout', { title: '運送方式', active: 'shipping-methods', content: 'shipping-methods' });
  });
  app.get('/admin/pickup-points', requireAdminPage(), (req, res) => {
    res.render('admin/layout', { title: '提貨點', active: 'pickup-points', content: 'pickup-points' });
  });
  app.get('/admin/payment-methods', requireAdminPage(), (req, res) => {
    res.render('admin/layout', { title: '支付方式', active: 'payment-methods', content: 'payment-methods' });
  });
  // 客戶線（operation-logs API 要超管）
  app.get('/admin/user-tags', requireAdminPage(), (req, res) => {
    res.render('admin/layout', { title: '用戶標籤', active: 'user-tags', content: 'user-tags' });
  });
  app.get('/admin/operation-logs', requireAdminPage(), (req, res) => {
    if (!req.session.isAdmin) return res.status(403).send('沒有權限');
    res.render('admin/layout', { title: '操作日誌', active: 'operation-logs', content: 'operation-logs' });
  });
}

register.isAdminSession = isAdminSession;
register.requireAdminPage = requireAdminPage;
register.setupEnabled = setupEnabled;
register.hasBackofficeAccess = hasBackofficeAccess;
register.regenerateSession = regenerateSession;

module.exports = register;
