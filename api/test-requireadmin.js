const { sql } = require('../src/lib/db');
const { sendJson } = require('../src/lib/http');
const { requireSession } = require('../src/lib/auth');

module.exports = async function(req, res, url) {
  if (req.method !== 'GET') return sendJson(res, 405, { ok: false });
  const session = await requireSession(req, res);
  if (!session) return;
  try {
    const r = await sql`select id, order_sn from orders limit 5`;
    return sendJson(res, 200, { ok: true, count: r.rows.length });
  } catch (e) {
    return sendJson(res, 500, { ok: false, error: String(e && e.message ? e.message : e) });
  }
};
