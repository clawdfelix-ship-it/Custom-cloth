const { sql } = require('../../src/lib/db');
const { sendJson, readBody } = require('../../src/lib/http');
const { requireSession } = require('../../src/lib/auth');
const { hashPassword } = require('../../src/lib/password');

async function requireAdmin(req, res) {
  const session = await requireSession(req);
  if (!session || session.role !== 'admin') {
    sendJson(res, 401, { ok: false, error: 'unauthorized' });
    return null;
  }
  return session;
}

module.exports = async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const session = await requireAdmin(req, res);
  if (!session) return;

  if (req.method === 'GET') {
    const r = await sql`select id, acc, role, name, created_at from users order by created_at desc limit 200`;
    const users = r.rows.map((u) => ({
      id: u.id,
      acc: u.acc,
      role: u.role,
      name: u.name,
      createdAt: u.created_at
    }));
    return sendJson(res, 200, { ok: true, users });
  }

  if (req.method === 'POST') {
    try {
      const raw = await readBody(req);
      const body = raw ? JSON.parse(raw) : {};
      const acc = typeof body.acc === 'string' ? body.acc.trim() : '';
      const pwd = typeof body.pwd === 'string' ? body.pwd : '';
      const role = typeof body.role === 'string' ? body.role.trim() : '';
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!acc || !pwd || !role || !name) return sendJson(res, 400, { ok: false, error: 'bad_request' });
      if (!['admin', 'factory'].includes(role)) return sendJson(res, 400, { ok: false, error: 'role_invalid' });

      const pwdHash = await hashPassword(pwd);
      const inserted = await sql`
        insert into users (acc, pwd_hash, role, name)
        values (${acc}, ${pwdHash}, ${role}, ${name})
        returning id, acc, role, name, created_at
      `;
      const u = inserted.rows[0];
      return sendJson(res, 200, { ok: true, user: { id: u.id, acc: u.acc, role: u.role, name: u.name, createdAt: u.created_at } });
    } catch (e) {
      return sendJson(res, 400, { ok: false, error: 'bad_request' });
    }
  }

  if (req.method === 'DELETE') {
    const id = (url.searchParams.get('id') || '').trim();
    if (!id) return sendJson(res, 400, { ok: false, error: 'id_required' });
    await sql`delete from users where id = ${id}::uuid`;
    return sendJson(res, 200, { ok: true });
  }

  return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
};

