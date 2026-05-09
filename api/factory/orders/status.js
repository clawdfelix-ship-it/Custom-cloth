const { sql } = require('../../../src/lib/db');
const { sendJson, readBody } = require('../../../src/lib/http');
const { requireSession } = require('../../../src/lib/auth');
const { ORDER_STATUS_ADMIN } = require('../../../src/lib/schema');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });

  const session = await requireSession(req);
  if (!session || session.role !== 'factory') return sendJson(res, 401, { ok: false, error: 'unauthorized' });

  try {
    const raw = await readBody(req);
    const body = raw ? JSON.parse(raw) : {};
    const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : '';
    const status = typeof body.status === 'string' ? body.status.trim() : '';
    if (!orderId) return sendJson(res, 400, { ok: false, error: 'orderId_required' });
    if (!ORDER_STATUS_ADMIN.includes(status)) return sendJson(res, 400, { ok: false, error: 'status_invalid' });

    const updated = await sql`
      update orders
      set status = ${status}
      where id = ${orderId}::uuid and factory_name = ${session.name}
      returning id, status
    `;
    const row = updated.rows[0];
    if (!row) return sendJson(res, 404, { ok: false, error: 'not_found' });
    return sendJson(res, 200, { ok: true, orderId: row.id, status: row.status });
  } catch (e) {
    return sendJson(res, 400, { ok: false, error: 'bad_request' });
  }
};

