function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

async function regenerateSession(req) {
  if (!req || !req.session || typeof req.session.regenerate !== 'function') return;
  await new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

function setSessionUser(req, user) {
  req.session.userId = user.id;
  req.session.username = user.username;
  req.session.isAdmin = user.is_admin;
  req.session.isB2b = user.is_b2b || false;
  req.session.isBackoffice = false;
  delete req.session.adminPermissions;
  req.session.contact = user.contact || null;
  req.session.email = user.email || null;
}

function serializeUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email || null,
    isAdmin: user.is_admin,
    isB2b: user.is_b2b || false,
    contact: user.contact || null,
  };
}

async function registerUser(pool, bcrypt, payload) {
  const username = normalizeText(payload.username);
  const email = normalizeText(payload.email).toLowerCase();
  const password = typeof payload.password === 'string' ? payload.password : '';
  const contact = normalizeText(payload.contact) || email || null;

  if (!username || username.length < 3 || !password || password.length < 6) {
    return { ok: false, status: 400, error: '用戶名至少 3 位，密碼至少 6 位' };
  }

  if (!email) {
    return { ok: false, status: 400, error: '請輸入有效電郵地址' };
  }

  const usernameExisting = await pool.query(
    'SELECT id FROM users WHERE username = $1 LIMIT 1',
    [username]
  );
  if (usernameExisting.rows.length > 0) {
    return { ok: false, status: 400, error: '用戶名已存在' };
  }

  const emailExisting = await pool.query(
    'SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
    [email]
  );
  if (emailExisting.rows.length > 0) {
    return { ok: false, status: 400, error: '電郵地址已被使用' };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const result = await pool.query(
    `INSERT INTO users (username, email, contact, password_hash, is_admin)
     VALUES ($1, $2, $3, $4, false)
     RETURNING id, username, email, contact, is_admin`,
    [username, email, contact, passwordHash]
  );

  return { ok: true, user: result.rows[0] };
}

async function loginUser(pool, bcrypt, payload) {
  const identifier = normalizeText(payload.username || payload.email);
  const password = typeof payload.password === 'string' ? payload.password : '';

  if (!identifier || !password) {
    return { ok: false, status: 400, error: '請輸入電郵地址或用戶名，以及密碼' };
  }

  const result = await pool.query(
    `SELECT id, username, email, password_hash, is_admin, is_b2b, contact
     FROM users
     WHERE username = $1 OR LOWER(email) = LOWER($1)
     LIMIT 1`,
    [identifier]
  );

  if (result.rows.length === 0) {
    return { ok: false, status: 400, error: '電郵地址、用戶名或密碼錯誤' };
  }

  const user = result.rows[0];
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    return { ok: false, status: 400, error: '電郵地址、用戶名或密碼錯誤' };
  }

  return { ok: true, user };
}

module.exports = function(app, pool, requireAdmin, requireAuth, bcrypt) {
  async function handleRegister(req, res, { api = false } = {}) {
    try {
      const result = await registerUser(pool, bcrypt, req.body || {});
      if (!result.ok) {
        if (api) {
          return res.status(result.status).json({ error: result.error });
        }
        return res.status(result.status).render('register', {
          title: '新會員註冊 - OHYA2.0',
          error: result.error,
          formData: {
            username: normalizeText(req.body && req.body.username),
            email: normalizeText(req.body && req.body.email),
          },
          user: req.session && req.session.userId ? { id: req.session.userId, isAdmin: req.session.isAdmin } : null,
        });
      }

      if (api) {
        return res.json({ success: true, userId: result.user.id, user: serializeUser(result.user) });
      }

      res.redirect('/login');
    } catch (err) {
      console.error(err);
      if (api) {
        return res.status(500).json({ error: '服務器錯誤' });
      }
      res.status(500).render('register', {
        title: '新會員註冊 - OHYA2.0',
        error: '服務器錯誤',
        formData: {
          username: normalizeText(req.body && req.body.username),
          email: normalizeText(req.body && req.body.email),
        },
        user: req.session && req.session.userId ? { id: req.session.userId, isAdmin: req.session.isAdmin } : null,
      });
    }
  }

  async function handleLogin(req, res, { api = false } = {}) {
    try {
      const result = await loginUser(pool, bcrypt, req.body || {});
      if (!result.ok) {
        if (api) {
          return res.status(result.status).json({ error: result.error });
        }
        return res.status(result.status).render('login', {
          title: '登入 - OHYA2.0',
          error: result.error,
          formData: {
            email: normalizeText((req.body && req.body.email) || (req.body && req.body.username)),
          },
          user: req.session && req.session.userId ? { id: req.session.userId, isAdmin: req.session.isAdmin } : null,
        });
      }

      await regenerateSession(req);
      setSessionUser(req, result.user);

      if (api) {
        return res.json({ success: true, user: serializeUser(result.user) });
      }

      // 安全跳轉：只接受站內相對路徑（單一 / 開頭，拒 // 同絕對 URL，防 open redirect）
      const want = typeof req.body.redirect === 'string' ? req.body.redirect : '';
      const safe = /^\/[a-zA-Z0-9_\-\/.?=&%]*$/.test(want) && !want.startsWith('//') ? want : '/';
      res.redirect(safe);
    } catch (err) {
      console.error(err);
      if (api) {
        return res.status(500).json({ error: '服務器錯誤' });
      }
      res.status(500).render('login', {
        title: '登入 - OHYA2.0',
        error: '服務器錯誤',
        formData: {
          email: normalizeText((req.body && req.body.email) || (req.body && req.body.username)),
        },
        user: req.session && req.session.userId ? { id: req.session.userId, isAdmin: req.session.isAdmin } : null,
      });
    }
  }

  // Storefront forms
  app.post('/register', (req, res) => handleRegister(req, res, { api: false }));
  app.post('/login', (req, res) => handleLogin(req, res, { api: false }));

  // API auth
  app.post('/api/auth/register', (req, res) => handleRegister(req, res, { api: true }));
  app.post('/api/auth/login', (req, res) => handleLogin(req, res, { api: true }));

  // Logout
  app.post('/api/auth/logout', (req, res) => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });

  // Get current user
  app.get('/api/auth/me', (req, res) => {
    if (!req.session.userId) {
      return res.json({ user: null });
    }
    res.json({
      user: {
        id: req.session.userId,
        username: req.session.username,
        email: req.session.email || null,
        isAdmin: req.session.isAdmin,
        contact: req.session.contact
      }
    });
  });
};

module.exports.registerUser = registerUser;
module.exports.loginUser = loginUser;
module.exports.serializeUser = serializeUser;
module.exports.regenerateSession = regenerateSession;
