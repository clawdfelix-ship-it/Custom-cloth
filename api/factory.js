const { sql } = require('../src/lib/db');
const { sendJson, readBody } = require('../src/lib/http');
const { requireSession } = require('../src/lib/auth');
const { ORDER_STATUS_ADMIN } = require('../src/lib/schema');
const { ensureMigrations } = require('../src/lib/migrate');

async function requireFactory(req, res) {
  const session = await requireSession(req);
  if (!session || session.role !== 'factory') {
    sendJson(res, 401, { ok: false, error: 'unauthorized' });
    return null;
  }
  return session;
}

async function ordersHandler(req, res, session) {
  if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
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
}

async function orderDetailHandler(req, res, session, url) {
  if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  const id = (url.searchParams.get('id') || '').trim();
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
}

async function orderStatusHandler(req, res, session) {
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
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
}

async function feedbackHandler(req, res, session) {
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
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
}

module.exports = async function handler(req, res) {
  await ensureMigrations();
  const url = new URL(req.url, 'http://localhost');
  const action = (url.searchParams.get('action') || '').trim();

  const session = await requireFactory(req, res);
  if (!session) return;

  if (action === 'orders') return ordersHandler(req, res, session);
  if (action === 'orderDetail') return orderDetailHandler(req, res, session, url);
  if (action === 'orderStatus') return orderStatusHandler(req, res, session);
  if (action === 'feedback') return feedbackHandler(req, res, session);

  return sendJson(res, 404, { ok: false, error: 'not_found' });
};
