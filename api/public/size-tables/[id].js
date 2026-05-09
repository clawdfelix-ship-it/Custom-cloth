const { sql } = require('../../../src/lib/db');
const { sendJson } = require('../../../src/lib/http');

function extractId(req) {
  if (req.query && req.query.id) return String(req.query.id);
  const url = new URL(req.url, 'http://localhost');
  const parts = url.pathname.split('/').filter(Boolean);
  return parts[parts.length - 1] || '';
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });

  const id = extractId(req);
  if (!id) return sendJson(res, 400, { ok: false, error: 'id_required' });

  try {
    const r = await sql`select id, name, data from size_tables where id = ${id}::uuid`;
    const row = r.rows[0];
    if (!row) return sendJson(res, 404, { ok: false, error: 'not_found' });
    return sendJson(res, 200, { ok: true, sizeTable: { id: row.id, name: row.name, data: row.data } });
  } catch (e) {
    return sendJson(res, 500, { ok: false, error: 'server_error' });
  }
};

