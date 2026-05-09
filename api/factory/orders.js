const { sql } = require('../../src/lib/db');
const { sendJson } = require('../../src/lib/http');
const { requireSession } = require('../../src/lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });

  const session = await requireSession(req);
  if (!session || session.role !== 'factory') return sendJson(res, 401, { ok: false, error: 'unauthorized' });

  try {
    const r = await sql`
      select id, order_sn, create_time, cust_name, cust_phone, cate1, cate2, factory_name, order_type, status,
        requested_delivery_date, suggested_delivery_date
      from orders
      where factory_name = ${session.name}
      order by create_time desc
      limit 300
    `;
    const orders = r.rows.map((x) => ({
      id: x.id,
      orderSn: x.order_sn,
      createdAt: x.create_time,
      companyName: x.cust_name,
      phone: x.cust_phone,
      cate1: x.cate1,
      cate2: x.cate2,
      factoryName: x.factory_name || '',
      orderType: x.order_type,
      status: x.status,
      requestedDeliveryDate: x.requested_delivery_date ? String(x.requested_delivery_date) : '',
      suggestedDeliveryDate: x.suggested_delivery_date ? String(x.suggested_delivery_date) : ''
    }));
    return sendJson(res, 200, { ok: true, orders });
  } catch (e) {
    return sendJson(res, 500, { ok: false, error: 'server_error' });
  }
};

