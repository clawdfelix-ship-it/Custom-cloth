const { sql } = require('../src/lib/db');
const { sendJson, readBody } = require('../src/lib/http');
const { verifyPassword } = require('../src/lib/password');
const { newToken, getBearerToken } = require('../src/lib/auth');

module.exports = async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const action = (url.searchParams.get('action') || '').trim();

  if (action === 'login') {
    if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
    try {
      const raw = await readBody(req);
      const body = raw ? JSON.parse(raw) : {};
      const acc = typeof body.acc === 'string' ? body.acc.trim() : '';
      const pwd = typeof body.pwd === 'string' ? body.pwd : '';
      if (!acc || !pwd) return sendJson(res, 400, { ok: false, error: 'bad_request' });

      const r = await sql`select id, acc, pwd_hash, role, name from users where acc = ${acc}`;
      const u = r.rows[0];
      if (!u) return sendJson(res, 401, { ok: false, error: 'invalid_credentials' });
      const ok = await verifyPassword(pwd, u.pwd_hash);
      if (!ok) return sendJson(res, 401, { ok: false, error: 'invalid_credentials' });

      const token = newToken();
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 12).toISOString();
      await sql`insert into sessions (token, user_id, expires_at) values (${token}, ${u.id}, ${expiresAt})`;
      return sendJson(res, 200, { ok: true, token, role: u.role, name: u.name });
    } catch (e) {
      return sendJson(res, 400, { ok: false, error: 'bad_request' });
    }
  }

  if (action === 'logout') {
    if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
    const token = getBearerToken(req.headers.authorization);
    if (token) await sql`delete from sessions where token = ${token}`;
    return sendJson(res, 200, { ok: true });
  }

  return sendJson(res, 404, { ok: false, error: 'not_found' });
};

