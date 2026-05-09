const { sql } = require('../../src/lib/db');
const { sendJson, readBody } = require('../../src/lib/http');
const { requireSession } = require('../../src/lib/auth');

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
    const r = await sql`select id, name, data, created_at from size_tables order by created_at desc limit 200`;
    const sizeTables = r.rows.map((x) => ({ id: x.id, name: x.name, data: x.data, createdAt: x.created_at }));
    return sendJson(res, 200, { ok: true, sizeTables });
  }

  if (req.method === 'POST') {
    try {
      const raw = await readBody(req);
      const body = raw ? JSON.parse(raw) : {};
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const data = body.data;
      if (!name || !data) return sendJson(res, 400, { ok: false, error: 'bad_request' });
      const inserted = await sql`
        insert into size_tables (name, data)
        values (${name}, ${JSON.stringify(data)}::jsonb)
        returning id, name, data, created_at
      `;
      const x = inserted.rows[0];
      return sendJson(res, 200, { ok: true, sizeTable: { id: x.id, name: x.name, data: x.data, createdAt: x.created_at } });
    } catch (e) {
      return sendJson(res, 400, { ok: false, error: 'bad_request' });
    }
  }

  if (req.method === 'DELETE') {
    const id = (url.searchParams.get('id') || '').trim();
    if (!id) return sendJson(res, 400, { ok: false, error: 'id_required' });
    await sql`delete from size_tables where id = ${id}::uuid`;
    return sendJson(res, 200, { ok: true });
  }

  return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
};

