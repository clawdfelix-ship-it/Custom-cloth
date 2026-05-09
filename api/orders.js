const { sql } = require('@vercel/postgres');
const { hkTodayYmd, addBusinessDays } = require('../src/lib/hk-date');
const { requiredString, requiredEnum, requiredYmd, requiredSizeRatio } = require('../src/lib/validation');

const ORDER_TYPES = ['new', 'reorder'];
const STATUS = ['received', 'follow_up', 'confirmed', 'production', 'shipping', 'done', 'cancelled'];

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });

  try {
    const raw = await readBody(req);
    const body = raw ? JSON.parse(raw) : {};

    const orderType = requiredEnum(body.orderType, ORDER_TYPES, 'orderType');
    const companyName = requiredString(body.companyName, 'companyName');
    const contactName = requiredString(body.contactName, 'contactName');
    const phone = requiredString(body.phone, 'phone');
    const address = requiredString(body.address, 'address');
    const styleName = requiredString(body.styleName, 'styleName');
    const sizeChart = typeof body.sizeChart === 'string' ? body.sizeChart.trim() : '';
    const sizeRatio = requiredSizeRatio(body.sizeRatio);
    const requestedDeliveryDate = requiredYmd(body.requestedDeliveryDate, 'requestedDeliveryDate');
    const sourceOrderId = typeof body.sourceOrderId === 'string' && body.sourceOrderId.trim() ? body.sourceOrderId.trim() : null;

    const lead = orderType === 'new' ? 31 : 17;
    const suggestedDeliveryDate = addBusinessDays(hkTodayYmd(new Date()), lead);

    if (requestedDeliveryDate < suggestedDeliveryDate) {
      return sendJson(res, 400, { ok: false, error: 'delivery_date_too_early', suggestedDeliveryDate });
    }

    const status = 'received';
    if (!STATUS.includes(status)) throw new Error('status invalid');

    const inserted = await sql`
      insert into orders
        (order_type, status, company_name, contact_name, phone, address, style_name, size_chart, size_ratio, suggested_delivery_date, requested_delivery_date, source_order_id)
      values
        (${orderType}, ${status}, ${companyName}, ${contactName}, ${phone}, ${address}, ${styleName}, ${sizeChart || null}, ${JSON.stringify(sizeRatio)}::jsonb, ${suggestedDeliveryDate}, ${requestedDeliveryDate}, ${sourceOrderId}::uuid)
      returning id, created_at
    `;

    const row = inserted.rows[0];
    return sendJson(res, 200, { ok: true, orderId: row.id, suggestedDeliveryDate, createdAt: row.created_at });
  } catch (e) {
    return sendJson(res, 400, { ok: false, error: 'bad_request', message: String(e && e.message ? e.message : e) });
  }
};

