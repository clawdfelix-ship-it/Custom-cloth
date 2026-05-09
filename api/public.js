const { sql } = require('../src/lib/db');
const { sendJson, readBody } = require('../src/lib/http');
const { hkTodayYmd, addBusinessDays } = require('../src/lib/hk-date');
const { requiredString, requiredEnum, requiredYmd, requiredQtyJson } = require('../src/lib/validation');
const { generateOrderSn } = require('../src/lib/order-sn');
const { ensureMigrations } = require('../src/lib/migrate');

const CATE1 = ['現貨款式加工', '熱昇華訂製', '開板訂製'];

function computeLeadBusinessDays(mode, cate1) {
  if (mode === 'repeat') return 17;
  return cate1 === '開板訂製' ? 31 : 17;
}

function computeOrderType(mode, cate1) {
  if (mode === 'repeat') return '客戶翻單';
  return cate1 === '開板訂製' ? '開板新單' : '現貨/熱昇華新單';
}

async function handleStyles(req, res, url) {
  if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  const cate1 = (url.searchParams.get('cate1') || '').trim();
  const cate2 = (url.searchParams.get('cate2') || '').trim();
  try {
    const r = await sql`
      select s.id, s.code, s.name, s.cate1, s.cate2, s.size_table_id, s.img_base64, s.remark, st.name as size_table_name
      from styles s
      join size_tables st on st.id = s.size_table_id
      where (${cate1} = '' or s.cate1 = ${cate1})
        and (${cate2} = '' or s.cate2 = ${cate2})
      order by s.created_at desc
      limit 200
    `;
    const styles = r.rows.map((x) => ({
      id: x.id,
      code: x.code,
      name: x.name,
      cate1: x.cate1,
      cate2: x.cate2,
      sizeTableId: x.size_table_id,
      sizeTableName: x.size_table_name,
      imgBase64: x.img_base64 || '',
      remark: x.remark || ''
    }));
    return sendJson(res, 200, { ok: true, styles });
  } catch (e) {
    return sendJson(res, 500, { ok: false, error: 'server_error' });
  }
}

async function handleSizeTable(req, res, url) {
  if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  const id = (url.searchParams.get('id') || '').trim();
  if (!id) return sendJson(res, 400, { ok: false, error: 'id_required' });
  try {
    const r = await sql`select id, name, data from size_tables where id = ${id}::uuid`;
    const row = r.rows[0];
    if (!row) return sendJson(res, 404, { ok: false, error: 'not_found' });
    return sendJson(res, 200, { ok: true, sizeTable: { id: row.id, name: row.name, data: row.data } });
  } catch (e) {
    return sendJson(res, 500, { ok: false, error: 'server_error' });
  }
}

async function handleCreateOrder(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  try {
    const raw = await readBody(req);
    const body = raw ? JSON.parse(raw) : {};

    const mode = requiredEnum(body.mode, ['new', 'repeat'], 'mode');
    const cate1 = requiredEnum(body.cate1, CATE1, 'cate1');
    const cate2 = requiredString(body.cate2, 'cate2');

    const companyName = requiredString(body.companyName, 'companyName');
    const contactName = typeof body.contactName === 'string' ? body.contactName.trim() : '';
    const phone = requiredString(body.phone, 'phone');
    const address = requiredString(body.address, 'address');

    const requestedDeliveryDate = requiredYmd(body.requestedDeliveryDate, 'requestedDeliveryDate');
    const sourceOrderId = typeof body.sourceOrderId === 'string' && body.sourceOrderId.trim() ? body.sourceOrderId.trim() : null;

    const itemsRaw = Array.isArray(body.items) ? body.items : [];
    if (!itemsRaw.length) return sendJson(res, 400, { ok: false, error: 'items_required' });
    const items = itemsRaw.map((it) => {
      const styleId = requiredString(it && it.styleId, 'styleId');
      const qty = requiredQtyJson(it && it.qty);
      return { styleId, qty };
    });

    const lead = computeLeadBusinessDays(mode, cate1);
    const suggestedDeliveryDate = addBusinessDays(hkTodayYmd(new Date()), lead);
    if (requestedDeliveryDate < suggestedDeliveryDate) {
      return sendJson(res, 400, { ok: false, error: 'delivery_date_too_early', suggestedDeliveryDate });
    }

    const orderSn = generateOrderSn(new Date());
    const status = '客戶已提交';
    const orderType = computeOrderType(mode, cate1);

    const customerUpsert = await sql`
      insert into customers (company_name, contact_name, phone)
      values (${companyName}, ${contactName || null}, ${phone})
      on conflict (company_name, phone)
      do update set contact_name = excluded.contact_name
      returning id
    `;
    const customerId = customerUpsert.rows[0].id;

    const inserted = await sql`
      insert into orders
        (order_sn, customer_id, cust_name, cust_contact, cust_phone, cate1, cate2, factory_name, order_type, status, amount, remark, requested_delivery_date, suggested_delivery_date, source_order_id)
      values
        (${orderSn}, ${customerId}::uuid, ${companyName}, ${contactName || null}, ${phone}, ${cate1}, ${cate2}, ${null}, ${orderType}, ${status}, ${null}, ${address}, ${requestedDeliveryDate}, ${suggestedDeliveryDate}, ${sourceOrderId}::uuid)
      returning id, create_time
    `;
    const orderId = inserted.rows[0].id;

    for (const it of items) {
      await sql`
        insert into order_items (order_id, style_id, qty)
        values (${orderId}::uuid, ${it.styleId}::uuid, ${JSON.stringify(it.qty)}::jsonb)
      `;
    }

    return sendJson(res, 200, {
      ok: true,
      orderId,
      orderSn,
      status,
      suggestedDeliveryDate,
      createdAt: inserted.rows[0].create_time
    });
  } catch (e) {
    return sendJson(res, 400, { ok: false, error: 'bad_request', message: String(e && e.message ? e.message : e) });
  }
}

async function handleHistory(req, res, url) {
  if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
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
}

async function handleStatus(req, res, url) {
  if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
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
}

module.exports = async function handler(req, res) {
  await ensureMigrations();
  const url = new URL(req.url, 'http://localhost');
  const action = (url.searchParams.get('action') || '').trim();

  if (action === 'styles') return handleStyles(req, res, url);
  if (action === 'sizeTable') return handleSizeTable(req, res, url);
  if (action === 'createOrder') return handleCreateOrder(req, res);
  if (action === 'history') return handleHistory(req, res, url);
  if (action === 'status') return handleStatus(req, res, url);

  return sendJson(res, 404, { ok: false, error: 'not_found' });
};
