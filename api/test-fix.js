const { sql } = require('../src/lib/db');
const { sendJson } = require('../src/lib/http');

module.exports = async function testFixHandler(req, res, url) {
  if (req.method !== 'GET') return sendJson(res, 405, { ok: false });
  try {
    const r = await sql`select now() as t`;
    return sendJson(res, 200, { ok: true, time: r.rows[0].t });
  } catch (e) {
    return sendJson(res, 500, { ok: false, error: String(e && e.message ? e.message : e) });
  }
};
