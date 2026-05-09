const { sql } = require('../../../src/lib/db');
const { sendJson } = require('../../../src/lib/http');
const { requireSession } = require('../../../src/lib/auth');

function extractId(req) {
  if (req.query && req.query.id) return String(req.query.id);
  const url = new URL(req.url, 'http://localhost');
  const parts = url.pathname.split('/').filter(Boolean);
  return parts[parts.length - 1] || '';
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });

  const session = await requireSession(req);
  if (!session || session.role !== 'factory') return sendJson(res, 401, { ok: false, error: 'unauthorized' });

  const id = extractId(req);
  if (!id) return sendJson(res, 400, { ok: false, error: 'id_required' });

  try {
    const r = await sql`
      select
        o.id,
        o.order_sn,
        o.create_time,
        o.cust_name,
        o.cust_contact,
        o.cust_phone,
        o.cate1,
        o.cate2,
        o.factory_name,
        o.order_type,
        o.status,
        o.amount,
        o.remark,
        o.requested_delivery_date,
        o.suggested_delivery_date,
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
      where o.id = ${id}::uuid and o.factory_name = ${session.name}
      group by o.id
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
        contactName: o.cust_contact || '',
        phone: o.cust_phone,
        cate1: o.cate1,
        cate2: o.cate2,
        factoryName: o.factory_name || '',
        orderType: o.order_type,
        status: o.status,
        amount: o.amount || '',
        remark: o.remark || '',
        requestedDeliveryDate: o.requested_delivery_date ? String(o.requested_delivery_date) : '',
        suggestedDeliveryDate: o.suggested_delivery_date ? String(o.suggested_delivery_date) : '',
        items: o.items || []
      }
    });
  } catch (e) {
    return sendJson(res, 500, { ok: false, error: 'server_error' });
  }
};

