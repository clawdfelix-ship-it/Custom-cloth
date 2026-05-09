const { sql } = require('../../../src/lib/db');
const { sendJson } = require('../../../src/lib/http');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });

  const url = new URL(req.url, 'http://localhost');
  const orderSn = (url.searchParams.get('orderSn') || '').trim();
  const phone = (url.searchParams.get('phone') || '').trim();
  if (!orderSn || !phone) return sendJson(res, 400, { ok: false, error: 'bad_request' });

  try {
    const r = await sql`
      select id, order_sn, create_time, cust_name, cust_phone, cate1, cate2, order_type, status,
        requested_delivery_date, suggested_delivery_date, factory_name
      from orders
      where order_sn = ${orderSn} and cust_phone = ${phone}
      limit 1
    `;
    const o = r.rows[0];
    if (!o) return sendJson(res, 404, { ok: false, error: 'not_found' });

    return sendJson(res, 200, {
      ok: true,
      order: {
        id: o.id,
        orderSn: o.order_sn,
        createdAt: o.create_time,
        companyName: o.cust_name,
        phone: o.cust_phone,
        cate1: o.cate1,
        cate2: o.cate2,
        orderType: o.order_type,
        status: o.status,
        requestedDeliveryDate: o.requested_delivery_date ? String(o.requested_delivery_date) : '',
        suggestedDeliveryDate: o.suggested_delivery_date ? String(o.suggested_delivery_date) : '',
        factoryName: o.factory_name || ''
      }
    });
  } catch (e) {
    return sendJson(res, 500, { ok: false, error: 'server_error' });
  }
};

