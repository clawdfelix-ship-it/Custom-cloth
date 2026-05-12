// Separate fixed handler for admin orders - Vercel will pick this up as new file
const { sql } = require('../src/lib/db');
const { sendJson } = require('../src/lib/http');
const { requireAdmin } = require('../src/lib/auth');
const { requiredYmd } = require('../src/lib/validation');
const { normalizeQtyToSizeRatio } = require('../src/lib/qty');

module.exports = async function adminOrdersFixHandler(req, res, url) {
  const session = await requireAdmin(req, res);
  if (!session) return;
  if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });

  const orderSn = (url.searchParams.get('orderSn') || '').trim();
  const companyName = (url.searchParams.get('companyName') || '').trim();
  const phone = (url.searchParams.get('phone') || '').trim();
  const status = (url.searchParams.get('status') || '').trim();
  const cate1 = (url.searchParams.get('cate1') || '').trim();
  const cate2 = (url.searchParams.get('cate2') || '').trim();
  const cate3 = (url.searchParams.get('cate3') || '').trim();
  const cate4 = (url.searchParams.get('cate4') || '').trim();
  const createdFrom = (url.searchParams.get('createdFrom') || '').trim();
  const createdTo = (url.searchParams.get('createdTo') || '').trim();
  const factoryName = (url.searchParams.get('factoryName') || '').trim();

  // Validate date params
  if (createdFrom && createdTo) {
    try { requiredYmd(createdFrom, 'createdFrom'); requiredYmd(createdTo, 'createdTo'); }
    catch (e) { return sendJson(res, 400, { ok: false, error: 'bad_request' }); }
  }

  // Build where with conditional inclusion of date filters (safest approach)
  const conditions = [];
  if (orderSn) conditions.push(`o.order_sn = '${orderSn}'`);
  if (companyName) conditions.push(`o.cust_name ilike '${companyName}'`);
  if (phone) conditions.push(`o.cust_phone = '${phone}'`);
  if (status) conditions.push(`o.status = '${status}'`);
  if (cate1) conditions.push(`o.cate1 = '${cate1}'`);
  if (cate2) conditions.push(`o.cate2 = '${cate2}'`);
  if (cate3) conditions.push(`o.cate3 = '${cate3}'`);
  if (cate4) conditions.push(`o.cate4 = '${cate4}'`);
  if (factoryName) conditions.push(`o.factory_name = '${factoryName}'`);
  if (createdFrom) conditions.push(`o.create_time >= '${createdFrom}'`);
  if (createdTo) conditions.push(`o.create_time < ('${createdTo}' + interval '1 day')`);

  const whereClause = conditions.length ? 'where ' + conditions.join(' and ') : 'where 1=1';

  const query = `select o.id, o.order_sn, o.create_time, o.cust_name, o.cust_contact, o.cust_phone, o.cate1, o.cate2, o.cate3, o.cate4, o.factory_user_id, o.factory_name, o.order_type, o.status, o.amount, o.remark, o.requested_delivery_date, o.suggested_delivery_date, o.source_order_id, coalesce(jsonb_agg(jsonb_build_object('styleId', oi.style_id, 'styleCode', s.code, 'styleName', s.name, 'qty', oi.qty, 'customText', oi.custom_text, 'customAttachments', oi.custom_attachments) filter (where oi.id is not null), '[]'::jsonb) as items from orders o left join order_items oi on oi.order_id = o.id left join styles s on s.id = oi.style_id ${whereClause} group by o.id order by o.create_time desc limit 300`;

  try {
    const r = await sql.query(query);
    const orders = r.rows.map((x) => ({
      id: x.id, orderSn: x.order_sn, createdAt: x.create_time,
      companyName: x.cust_name, contactName: x.cust_contact || '',
      phone: x.cust_phone, cate1: x.cate1, cate2: x.cate2,
      cate3: x.cate3 || '', cate4: x.cate4 || '',
      factoryUserId: x.factory_user_id, factoryName: x.factory_name || '',
      orderType: x.order_type, status: x.status,
      amount: x.amount || '', remark: x.remark || '',
      requestedDeliveryDate: x.requested_delivery_date ? String(x.requested_delivery_date) : '',
      suggestedDeliveryDate: x.suggested_delivery_date ? String(x.suggested_delivery_date) : '',
      sourceOrderId: x.source_order_id, items: x.items || []
    }));
    return sendJson(res, 200, { ok: true, orders });
  } catch (e) {
    return sendJson(res, 500, { ok: false, error: 'server_error', message: String(e && e.message ? e.message : e) });
  }
};
