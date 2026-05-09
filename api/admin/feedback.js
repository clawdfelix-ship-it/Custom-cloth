const { sql } = require('../../src/lib/db');
const { sendJson } = require('../../src/lib/http');
const { requireSession } = require('../../src/lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });

  const session = await requireSession(req);
  if (!session || session.role !== 'admin') return sendJson(res, 401, { ok: false, error: 'unauthorized' });

  const url = new URL(req.url, 'http://localhost');
  const factoryName = (url.searchParams.get('factoryName') || '').trim();
  const status = (url.searchParams.get('status') || '').trim();

  try {
    const r = await sql`
      select id, order_id, order_sn, factory_name, content, status, create_time
      from feedback
      where
        (${factoryName} = '' or factory_name = ${factoryName})
        and (${status} = '' or status = ${status})
      order by create_time desc
      limit 300
    `;

    const feedback = r.rows.map((x) => ({
      id: x.id,
      orderId: x.order_id,
      orderSn: x.order_sn,
      factoryName: x.factory_name,
      content: x.content,
      status: x.status,
      createdAt: x.create_time
    }));

    return sendJson(res, 200, { ok: true, feedback });
  } catch (e) {
    return sendJson(res, 500, { ok: false, error: 'server_error' });
  }
};

