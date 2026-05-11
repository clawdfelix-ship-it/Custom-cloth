const { sql } = require('../src/lib/db');
const { sendJson, readBody } = require('../src/lib/http');
const { hkTodayYmd, addBusinessDays } = require('../src/lib/hk-date');
const { requiredString, requiredEnum, requiredYmd } = require('../src/lib/validation');
const { generateOrderSn } = require('../src/lib/order-sn');
const { ensureMigrations } = require('../src/lib/migrate');
const { generateLookupCode } = require('../src/lib/lookup-code');
const { normalizeQtyToSizeRatio } = require('../src/lib/qty');
const { uploadDataUrl } = require('../src/lib/blob');

function normalizeItemsQty(items) {
  return (Array.isArray(items) ? items : []).map((it) => {
    const qtyRaw = it && it.qty;
    try {
      return { ...it, qty: normalizeQtyToSizeRatio(qtyRaw) };
    } catch (e) {
      return { ...it, qty: [] };
    }
  });
}

const CATE1 = ['現貨款式加工', '熱昇華訂製', '開板訂製'];
const DEFAULT_CATE2 = ['球衣', 'POLO', '風衣外套', '其他'];
const CUSTOMER_STYLE_CODE = 'CUSTOMER_PROVIDED';

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
      select s.id, s.code, s.name, s.cate1, s.cate2, s.size_table_id, s.img_url, s.img_base64, s.remark, st.name as size_table_name
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
      imgUrl: x.img_url || '',
      imgBase64: x.img_base64 || '',
      remark: x.remark || ''
    }));

    const hasCustomerProvided = styles.some((s) => s && s.code === CUSTOMER_STYLE_CODE);
    if (!hasCustomerProvided) {
      const cr = await sql`
        select s.id, s.code, s.name, s.cate1, s.cate2, s.size_table_id, s.img_url, s.img_base64, s.remark, st.name as size_table_name
        from styles s
        join size_tables st on st.id = s.size_table_id
        where s.code = ${CUSTOMER_STYLE_CODE}
        order by s.created_at asc
        limit 1
      `;
      const x = cr.rows[0];
      if (x) {
        styles.push({
          id: x.id,
          code: x.code,
          name: x.name,
          cate1: x.cate1,
          cate2: x.cate2,
          sizeTableId: x.size_table_id,
          sizeTableName: x.size_table_name,
          imgUrl: x.img_url || '',
          imgBase64: x.img_base64 || '',
          remark: x.remark || ''
        });
      }
    }
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

async function handleCategories(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  try {
    const r = await sql`
      select distinct cate1, cate2
      from styles
      where cate1 is not null and cate1 <> ''
        and cate2 is not null and cate2 <> ''
      limit 500
    `;

    const cate1Set = new Set(CATE1);
    const cate2ByCate1 = {};

    function ensureCate1(c1) {
      if (!c1) return;
      cate1Set.add(c1);
      if (!cate2ByCate1[c1]) cate2ByCate1[c1] = [...DEFAULT_CATE2];
    }

    r.rows.forEach((x) => {
      const c1 = String(x.cate1 || '').trim();
      const c2 = String(x.cate2 || '').trim();
      if (!c1 || !c2) return;
      ensureCate1(c1);
      if (!cate2ByCate1[c1].includes(c2)) cate2ByCate1[c1].push(c2);
    });

    Array.from(cate1Set).forEach((c1) => ensureCate1(c1));
    const cate1 = Array.from(cate1Set);

    return sendJson(res, 200, { ok: true, cate1, cate2ByCate1 });
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
      const qty = normalizeQtyToSizeRatio(it && it.qty);
      const customText = typeof (it && it.customText) === 'string' ? it.customText.trim() : '';
      const customImages = Array.isArray(it && it.customImages) ? it.customImages : [];
      const customAttachments = Array.isArray(it && it.customAttachments) ? it.customAttachments : [];
      return { styleId, qty, customText, customImages, customAttachments };
    });

    const customerStyleR = await sql`select id from styles where code = ${CUSTOMER_STYLE_CODE} limit 1`;
    const customerStyleId = customerStyleR.rows[0] ? String(customerStyleR.rows[0].id) : '';
    const hasCustomerPayload = items.some(
      (it) =>
        (it.customText && it.customText.trim()) ||
        (Array.isArray(it.customImages) && it.customImages.length) ||
        (Array.isArray(it.customAttachments) && it.customAttachments.length)
    );
    if (hasCustomerPayload && !customerStyleId) return sendJson(res, 400, { ok: false, error: 'customer_style_missing' });

    const lead = computeLeadBusinessDays(mode, cate1);
    const suggestedDeliveryDate = addBusinessDays(hkTodayYmd(new Date()), lead);
    if (requestedDeliveryDate < suggestedDeliveryDate) {
      return sendJson(res, 400, { ok: false, error: 'delivery_date_too_early', suggestedDeliveryDate });
    }

    const orderSn = generateOrderSn(new Date());
    const lookupCode = generateLookupCode();
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
        (order_sn, lookup_code, customer_id, cust_name, cust_contact, cust_phone, cate1, cate2, factory_name, order_type, status, amount, remark, requested_delivery_date, suggested_delivery_date, source_order_id)
      values
        (${orderSn}, ${lookupCode}, ${customerId}::uuid, ${companyName}, ${contactName || null}, ${phone}, ${cate1}, ${cate2}, ${null}, ${orderType}, ${status}, ${null}, ${address}, ${requestedDeliveryDate}, ${suggestedDeliveryDate}, ${sourceOrderId}::uuid)
      returning id, create_time
    `;
    const orderId = inserted.rows[0].id;

    for (const it of items) {
      const isCustomer = customerStyleId && String(it.styleId) === customerStyleId;
      let customAttachments = null;
      let customText = null;
      if (isCustomer) {
        customText = it.customText || '';
        const imgs = (Array.isArray(it.customImages) ? it.customImages : []).slice(0, 3);
        const uploaded = [];
        for (let i = 0; i < imgs.length; i++) {
          const dataUrl = typeof imgs[i] === 'string' ? imgs[i] : '';
          const m = dataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,(.*)$/);
          if (!m) continue;
          const buf = Buffer.from(m[2], 'base64');
          if (buf.length > 500 * 1024) continue;
          const ext = m[1] === 'image/png' ? '.png' : m[1] === 'image/webp' ? '.webp' : '.jpg';
          const up = await uploadDataUrl(`orders/${orderSn}/customer_provided`, `img_${i + 1}${ext}`, dataUrl);
          if (up && up.url) uploaded.push({ url: up.url, name: `img_${i + 1}${ext}`, contentType: up.contentType || m[1], size: buf.length });
        }
        const existing = (Array.isArray(it.customAttachments) ? it.customAttachments : []).slice(0, 3);
        const cleanExisting = existing
          .map((a) => ({
            url: a && typeof a.url === 'string' ? a.url : '',
            name: a && typeof a.name === 'string' ? a.name : '',
            contentType: a && typeof a.contentType === 'string' ? a.contentType : '',
            size: Number(a && a.size) || 0
          }))
          .filter((a) => a.url);
        customAttachments = uploaded.length || cleanExisting.length ? [...cleanExisting, ...uploaded].slice(0, 3) : [];
      }
      await sql`
        insert into order_items (order_id, style_id, qty, custom_text, custom_attachments)
        values (${orderId}::uuid, ${it.styleId}::uuid, ${JSON.stringify(it.qty)}::jsonb, ${customText}, ${customAttachments ? JSON.stringify(customAttachments) : null}::jsonb)
      `;
    }

    return sendJson(res, 200, {
      ok: true,
      orderId,
      orderSn,
      lookupCode,
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
              'qty', oi.qty,
              'customText', oi.custom_text,
              'customAttachments', oi.custom_attachments
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
      items: normalizeItemsQty(x.items || [])
    }));

    return sendJson(res, 200, { ok: true, orders });
  } catch (e) {
    return sendJson(res, 500, { ok: false, error: 'server_error' });
  }
}

async function handleStatus(req, res, url) {
  if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  const orderSn = (url.searchParams.get('orderSn') || '').trim();
  const lookupCode = (url.searchParams.get('lookupCode') || '').trim();
  const phone = (url.searchParams.get('phone') || '').trim();
  if (!orderSn || (!lookupCode && !phone)) return sendJson(res, 400, { ok: false, error: 'bad_request' });

  try {
    const r = lookupCode
      ? await sql`
          select id, order_sn, create_time, cust_name, cust_phone, cate1, cate2, order_type, status,
            requested_delivery_date, suggested_delivery_date, factory_name
          from orders
          where order_sn = ${orderSn} and lookup_code = ${lookupCode}
          limit 1
        `
      : await sql`
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
  if (action === 'categories') return handleCategories(req, res);
  if (action === 'sizeTable') return handleSizeTable(req, res, url);
  if (action === 'createOrder') return handleCreateOrder(req, res);
  if (action === 'history') return handleHistory(req, res, url);
  if (action === 'status') return handleStatus(req, res, url);

  return sendJson(res, 404, { ok: false, error: 'not_found' });
};
