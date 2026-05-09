const { sql } = require('../../src/lib/db');
const { sendJson, readBody } = require('../../src/lib/http');
const { hkTodayYmd, addBusinessDays } = require('../../src/lib/hk-date');
const { requiredString, requiredEnum, requiredYmd, requiredQtyJson } = require('../../src/lib/validation');
const { generateOrderSn } = require('../../src/lib/order-sn');

const CATE1 = ['現貨款式加工', '熱昇華訂製', '開板訂製'];

function computeLeadBusinessDays(mode, cate1) {
  if (mode === 'repeat') return 17;
  return cate1 === '開板訂製' ? 31 : 17;
}

function computeOrderType(mode, cate1) {
  if (mode === 'repeat') return '客戶翻單';
  return cate1 === '開板訂製' ? '開板新單' : '現貨/熱昇華新單';
}

module.exports = async function handler(req, res) {
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
};

