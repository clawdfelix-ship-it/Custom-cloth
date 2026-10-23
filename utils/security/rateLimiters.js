const rateLimit = require('express-rate-limit');

function loginLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: '請稍後再試' },
  });
}

function adminWriteLimiter() {
  return rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: '請稍後再試' },
  });
}

function webhookLimiter() {
  return rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'too many requests' },
  });
}

function cspReportLimiter() {
  return rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'too many requests' },
  });
}

module.exports = { loginLimiter, adminWriteLimiter, webhookLimiter, cspReportLimiter };
