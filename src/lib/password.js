const bcrypt = require('bcryptjs');

async function hashPassword(plain) {
  const s = String(plain || '');
  if (!s) throw new Error('password required');
  return bcrypt.hash(s, 10);
}

async function verifyPassword(plain, hash) {
  const p = String(plain || '');
  const h = String(hash || '');
  if (!p || !h) return false;
  return bcrypt.compare(p, h);
}

module.exports = { hashPassword, verifyPassword };

