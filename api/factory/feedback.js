const { sql } = require('../../src/lib/db');
const { sendJson, readBody } = require('../../src/lib/http');
const { requireSession } = require('../../src/lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });

  const session = await requireSession(req);
  if (!session || session.role !== 'factory') return sendJson(res, 401, { ok: false, error: 'unauthorized' });

  try {
    const raw = await readBody(req);
    const body = raw ? JSON.parse(raw) : {};
    const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : '';
    const content = typeof body.content === 'string' ? body.content.trim() : '';
    if (!orderId || !content) return sendJson(res, 400, { ok: false, error: 'bad_request' });

    const r = await sql`select order_sn from orders where id = ${orderId}::uuid and factory_name = ${session.name} limit 1`;
    const o = r.rows[0];
    if (!o) return sendJson(res, 404, { ok: false, error: 'not_found' });

    const inserted = await sql`
      insert into feedback (order_id, order_sn, factory_name, content, status)
      values (${orderId}::uuid, ${o.order_sn}, ${session.name}, ${content}, ${'待處理'})
      returning id, create_time
    `;
    return sendJson(res, 200, { ok: true, feedbackId: inserted.rows[0].id, createdAt: inserted.rows[0].create_time });
  } catch (e) {
    return sendJson(res, 400, { ok: false, error: 'bad_request' });
  }
};

