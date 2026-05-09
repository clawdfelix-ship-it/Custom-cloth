const crypto = require('node:crypto');
const { sql } = require('./db');

function getBearerToken(authorizationHeader) {
  const h = typeof authorizationHeader === 'string' ? authorizationHeader : '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : '';
}

function newToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function requireSession(req) {
  const token = getBearerToken(req.headers.authorization);
  if (!token) return null;
  const r = await sql`
    select s.token, s.expires_at, u.id as user_id, u.acc, u.role, u.name
    from sessions s
    join users u on u.id = s.user_id
    where s.token = ${token}
  `;
  const row = r.rows[0];
  if (!row) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) return null;
  return { token: row.token, userId: row.user_id, acc: row.acc, role: row.role, name: row.name };
}

module.exports = { getBearerToken, newToken, requireSession };
