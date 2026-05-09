const { sql } = require('../../../src/lib/db');
const { sendJson, readBody } = require('../../../src/lib/http');
const { requireSession } = require('../../../src/lib/auth');
const { hkTodayYmd, addBusinessDays } = require('../../../src/lib/hk-date');
const { generateOrderSn } = require('../../../src/lib/order-sn');
const { requiredYmd } = require('../../../src/lib/validation');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });

  const session = await requireSession(req);
  if (!session || session.role !== 'admin') return sendJson(res, 401, { ok: false, error: 'unauthorized' });

  try {
    const raw = await readBody(req);
    const body = raw ? JSON.parse(raw) : {};
    const sourceOrderId = typeof body.sourceOrderId === 'string' ? body.sourceOrderId.trim() : '';
    const requestedDeliveryDate = requiredYmd(body.requestedDeliveryDate, 'requestedDeliveryDate');
    if (!sourceOrderId) return sendJson(res, 400, { ok: false, error: 'sourceOrderId_required' });

    const srcOrderR = await sql`
      select *
      from orders
      where id = ${sourceOrderId}::uuid
      limit 1
    `;
    const src = srcOrderR.rows[0];
    if (!src) return sendJson(res, 404, { ok: false, error: 'not_found' });

    const itemsR = await sql`select style_id, qty from order_items where order_id = ${sourceOrderId}::uuid`;
    const items = itemsR.rows;
    if (!items.length) return sendJson(res, 400, { ok: false, error: 'source_items_missing' });

    const suggestedDeliveryDate = addBusinessDays(hkTodayYmd(new Date()), 17);
    if (requestedDeliveryDate < suggestedDeliveryDate) {
      return sendJson(res, 400, { ok: false, error: 'delivery_date_too_early', suggestedDeliveryDate });
    }

    const orderSn = generateOrderSn(new Date());
    const orderType = '客戶翻單';
    const status = '客戶已提交';

    const inserted = await sql`
      insert into orders
        (order_sn, customer_id, cust_name, cust_contact, cust_phone, cate1, cate2, factory_name, order_type, status, amount, remark, requested_delivery_date, suggested_delivery_date, source_order_id)
      values
        (${orderSn}, ${src.customer_id}::uuid, ${src.cust_name}, ${src.cust_contact}, ${src.cust_phone}, ${src.cate1}, ${src.cate2}, ${src.factory_name}, ${orderType}, ${status}, ${src.amount}, ${src.remark}, ${requestedDeliveryDate}, ${suggestedDeliveryDate}, ${sourceOrderId}::uuid)
      returning id, create_time
    `;
    const newOrderId = inserted.rows[0].id;

    for (const it of items) {
      await sql`
        insert into order_items (order_id, style_id, qty)
        values (${newOrderId}::uuid, ${it.style_id}::uuid, ${JSON.stringify(it.qty)}::jsonb)
      `;
    }

    return sendJson(res, 200, {
      ok: true,
      orderId: newOrderId,
      orderSn,
      status,
      suggestedDeliveryDate,
      createdAt: inserted.rows[0].create_time
    });
  } catch (e) {
    return sendJson(res, 400, { ok: false, error: 'bad_request' });
  }
};

