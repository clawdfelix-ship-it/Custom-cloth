const { sql } = require('../../../src/lib/db');
const { sendJson } = require('../../../src/lib/http');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });

  const url = new URL(req.url, 'http://localhost');
  const companyName = (url.searchParams.get('companyName') || '').trim();
  const phone = (url.searchParams.get('phone') || '').trim();
  if (!companyName || !phone) return sendJson(res, 400, { ok: false, error: 'bad_request' });

  try {
    const r = await sql`
      select
        o.id,
        o.order_sn,
        o.create_time,
        o.cate1,
        o.cate2,
        o.order_type,
        o.status,
        o.requested_delivery_date,
        o.suggested_delivery_date,
        o.source_order_id,
        coalesce(
          jsonb_agg(
            jsonb_build_object(
              'styleId', oi.style_id,
              'styleCode', s.code,
              'styleName', s.name,
              'qty', oi.qty
            )
          ) filter (where oi.id is not null),
          '[]'::jsonb
        ) as items
      from orders o
      left join order_items oi on oi.order_id = o.id
      left join styles s on s.id = oi.style_id
      where o.cust_name = ${companyName} and o.cust_phone = ${phone}
      group by o.id
      order by o.create_time desc
      limit 50
    `;

    const orders = r.rows.map((x) => ({
      id: x.id,
      orderSn: x.order_sn,
      createdAt: x.create_time,
      cate1: x.cate1,
      cate2: x.cate2,
      orderType: x.order_type,
      status: x.status,
      requestedDeliveryDate: x.requested_delivery_date ? String(x.requested_delivery_date) : '',
      suggestedDeliveryDate: x.suggested_delivery_date ? String(x.suggested_delivery_date) : '',
      sourceOrderId: x.source_order_id,
      items: x.items || []
    }));

    return sendJson(res, 200, { ok: true, orders });
  } catch (e) {
    return sendJson(res, 500, { ok: false, error: 'server_error' });
  }
};

