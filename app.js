const crypto = require('crypto');
const path = require('path');

const cors = require('cors');
const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);

require('dotenv').config();

const { getConnectionString, getPool } = require('./utils/getPool');

const app = express();
const port = process.env.PORT || 3000;
const connectionString = getConnectionString();
const pool = getPool();

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.tailwindcss.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
    },
  },
}));

app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

if (connectionString && pool) {
  const sessionSecret = process.env.SESSION_SECRET || (
    process.env.NODE_ENV === 'production'
      ? crypto.randomBytes(32).toString('hex')
      : 'dev-secret-change-me'
  );

  app.use(session({
    store: new pgSession({
      pool,
      tableName: 'session',
      createTableIfMissing: true,
    }),
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'lax' : undefined,
    },
  }));
} else {
  console.warn('Custom Cloth booting without DATABASE_URL; page shell will render, APIs that need DB will return 500.');
}

app.use((req, res, next) => {
  res.locals.siteName = 'Custom Cloth';
  res.locals.currentPath = req.path || '';
  res.locals.user = req.session && req.session.userId
    ? { id: req.session.userId, isAdmin: !!req.session.isAdmin }
    : null;
  next();
});

app.get('/', (req, res) => {
  res.redirect('/customizer');
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'custom-cloth',
    dbConfigured: !!connectionString,
  });
});

require('./routes/customizerPages')(app, pool);
require('./routes/customizerApi')(app, pool);

app.use((req, res) => {
  if (String(req.path || '').startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  return res.redirect('/customizer');
});

app.use((error, req, res, next) => {
  console.error('Unhandled app error:', error);
  if (res.headersSent) return next(error);
  if (String(req.path || '').startsWith('/api/')) {
    return res.status(500).json({ error: 'Internal server error' });
  }
  return res.status(500).render('customizer/quote-success', {
    title: 'Custom Cloth 暫時發生錯誤',
    quoteId: null,
    currentPath: req.path || '',
  });
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Custom Cloth running on port ${port}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

module.exports = app;
