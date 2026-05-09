const { sql } = require('../src/lib/db');
const { sendJson, readBody } = require('../src/lib/http');
const { verifyPassword } = require('../src/lib/password');
const { newToken, getBearerToken } = require('../src/lib/auth');
const { ensureMigrations } = require('../src/lib/migrate');
const { audit } = require('../src/lib/audit');
const { shouldBlockLogin, getClientIp } = require('../src/lib/rate-limit');

module.exports = async function handler(req, res) {
  await ensureMigrations();
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

      const ip = getClientIp(req);
      const attempts = await sql`
        select count(*)::int as c
        from login_attempts
        where ip = ${ip} and acc = ${acc} and created_at > now() - interval '10 minutes'
      `;
      const failCount = attempts.rows[0] ? attempts.rows[0].c : 0;
      if (shouldBlockLogin(failCount)) return sendJson(res, 429, { ok: false, error: 'too_many_attempts' });

      const r = await sql`select id, acc, pwd_hash, role, name from users where acc = ${acc}`;
      const u = r.rows[0];
      if (!u) {
        await sql`insert into login_attempts (ip, acc) values (${ip}, ${acc})`;
        return sendJson(res, 401, { ok: false, error: 'invalid_credentials' });
      }
      const ok = await verifyPassword(pwd, u.pwd_hash);
      if (!ok) {
        await sql`insert into login_attempts (ip, acc) values (${ip}, ${acc})`;
        return sendJson(res, 401, { ok: false, error: 'invalid_credentials' });
      }

      const token = newToken();
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 12).toISOString();
      await sql`insert into sessions (token, user_id, expires_at) values (${token}, ${u.id}, ${expiresAt})`;
      await sql`delete from login_attempts where ip = ${ip} and acc = ${acc}`;
      await audit(u.id, 'auth_login', 'user', String(u.id), { acc: u.acc, role: u.role });
      return sendJson(res, 200, { ok: true, token, role: u.role, name: u.name });
    } catch (e) {
      return sendJson(res, 400, { ok: false, error: 'bad_request' });
    }
  }

  if (action === 'logout') {
    if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
    const token = getBearerToken(req.headers.authorization);
    if (token) {
      const r = await sql`select user_id from sessions where token = ${token}`;
      const row = r.rows[0];
      await sql`delete from sessions where token = ${token}`;
      await audit(row ? row.user_id : null, 'auth_logout', 'session', token.slice(0, 12), null);
    }
    return sendJson(res, 200, { ok: true });
  }

  return sendJson(res, 404, { ok: false, error: 'not_found' });
};
