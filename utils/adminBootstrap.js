const bcrypt = require('bcryptjs');

async function hasAdmin(pool) {
  const r = await pool.query(`SELECT EXISTS(SELECT 1 FROM users WHERE is_admin = true) AS exists`);
  return Boolean(r.rows && r.rows[0] && r.rows[0].exists);
}

async function createFirstAdmin(pool, { username, password, contact }) {
  const passwordHash = await bcrypt.hash(String(password), 10);
  const result = await pool.query(
    'INSERT INTO users (username, password_hash, contact, is_admin) VALUES ($1, $2, $3, true) RETURNING id, username, is_admin',
    [String(username), passwordHash, contact || null]
  );
  return result.rows[0];
}

module.exports = { hasAdmin, createFirstAdmin };

