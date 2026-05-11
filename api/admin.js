const { sql } = require('../src/lib/db');
const { sendJson, readBody } = require('../src/lib/http');
const { requireSession } = require('../src/lib/auth');
const { hashPassword } = require('../src/lib/password');
const { ORDER_STATUS_ADMIN, FEEDBACK_STATUS } = require('../src/lib/schema');
const { hkTodayYmd, addBusinessDays } = require('../src/lib/hk-date');
const { generateOrderSn } = require('../src/lib/order-sn');
const { generateLookupCode } = require('../src/lib/lookup-code');
const { requiredYmd } = require('../src/lib/validation');
const { ensureMigrations } = require('../src/lib/migrate');
const { audit } = require('../src/lib/audit');
const { uploadDataUrl } = require('../src/lib/blob');
const { normalizeQtyToSizeRatio } = require('../src/lib/qty');
const { toCsv } = require('../src/lib/csv');

const JERSEY_CATE2 = '球衣';
const JERSEY_CATE3 = ['足球', '籃球', '排球', '其他'];
const JERSEY_CATE4 = ['上衣', '褲子', '整套'];

function requiredJerseyEnum(v, allowed, field) {
  const s = typeof v === 'string' ? v.trim() : '';
  if (!s) throw new Error(`${field}_required`);
  if (!allowed.includes(s)) throw new Error(`${field}_invalid`);
  return s;
}

async function requireAdmin(req, res) {
  const session = await requireSession(req);
  if (!session || session.role !== 'admin') {
    sendJson(res, 401, { ok: false, error: 'unauthorized' });
    return null;
  }
  return session;
}

async function usersHandler(req, res, url) {
  const session = await requireAdmin(req, res);
  if (!session) return;

  if (req.method === 'GET') {
    const r = await sql`select id, acc, role, name, created_at from users order by created_at desc limit 200`;
    const users = r.rows.map((u) => ({ id: u.id, acc: u.acc, role: u.role, name: u.name, createdAt: u.created_at }));
    return sendJson(res, 200, { ok: true, users });
  }

  if (req.method === 'POST') {
    try {
      const raw = await readBody(req);
      const body = raw ? JSON.parse(raw) : {};
      const acc = typeof body.acc === 'string' ? body.acc.trim() : '';
      const pwd = typeof body.pwd === 'string' ? body.pwd : '';
      const role = typeof body.role === 'string' ? body.role.trim() : '';
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!acc || !pwd || !role || !name) return sendJson(res, 400, { ok: false, error: 'bad_request' });
      if (!['admin', 'factory'].includes(role)) return sendJson(res, 400, { ok: false, error: 'role_invalid' });

      const pwdHash = await hashPassword(pwd);
      const inserted = await sql`
        insert into users (acc, pwd_hash, role, name)
        values (${acc}, ${pwdHash}, ${role}, ${name})
        returning id, acc, role, name, created_at
      `;
      const u = inserted.rows[0];
      await audit(session.userId, 'admin_create_user', 'user', String(u.id), { acc: u.acc, role: u.role, name: u.name });
      return sendJson(res, 200, { ok: true, user: { id: u.id, acc: u.acc, role: u.role, name: u.name, createdAt: u.created_at } });
    } catch (e) {
      return sendJson(res, 400, { ok: false, error: 'bad_request' });
    }
  }

  if (req.method === 'DELETE') {
    const id = (url.searchParams.get('id') || '').trim();
    if (!id) return sendJson(res, 400, { ok: false, error: 'id_required' });
    await sql`delete from users where id = ${id}::uuid`;
    await audit(session.userId, 'admin_delete_user', 'user', id, null);
    return sendJson(res, 200, { ok: true });
  }

  return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
}

async function sizeTablesHandler(req, res, url) {
  const session = await requireAdmin(req, res);
  if (!session) return;

  if (req.method === 'GET') {
    const r = await sql`select id, name, data, created_at from size_tables order by created_at desc limit 200`;
    const sizeTables = r.rows.map((x) => ({ id: x.id, name: x.name, data: x.data, createdAt: x.created_at }));
    return sendJson(res, 200, { ok: true, sizeTables });
  }

  if (req.method === 'POST') {
    try {
      const raw = await readBody(req);
      const body = raw ? JSON.parse(raw) : {};
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const data = body.data;
      if (!name || !data) return sendJson(res, 400, { ok: false, error: 'bad_request' });
      const inserted = await sql`
        insert into size_tables (name, data)
        values (${name}, ${JSON.stringify(data)}::jsonb)
        returning id, name, data, created_at
      `;
      const x = inserted.rows[0];
      await audit(session.userId, 'admin_create_size_table', 'size_table', String(x.id), { name: x.name });
      return sendJson(res, 200, { ok: true, sizeTable: { id: x.id, name: x.name, data: x.data, createdAt: x.created_at } });
    } catch (e) {
      return sendJson(res, 400, { ok: false, error: 'bad_request' });
    }
  }

  if (req.method === 'DELETE') {
    const id = (url.searchParams.get('id') || '').trim();
    if (!id) return sendJson(res, 400, { ok: false, error: 'id_required' });
    await sql`delete from size_tables where id = ${id}::uuid`;
    await audit(session.userId, 'admin_delete_size_table', 'size_table', id, null);
    return sendJson(res, 200, { ok: true });
  }

  return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
}

async function stylesHandler(req, res, url) {
  const session = await requireAdmin(req, res);
  if (!session) return;

  if (req.method === 'GET') {
    const cate1 = (url.searchParams.get('cate1') || '').trim();
    const cate2 = (url.searchParams.get('cate2') || '').trim();
    const r = await sql`
      select id, code, name, cate1, cate2, cate3, cate4, size_table_id, img_url, img_base64, remark, created_at
      from styles
      where (${cate1} = '' or cate1 = ${cate1})
        and (${cate2} = '' or cate2 = ${cate2})
      order by created_at desc
      limit 500
    `;
    const styles = r.rows.map((x) => ({
      id: x.id,
      code: x.code,
      name: x.name,
      cate1: x.cate1,
      cate2: x.cate2,
      cate3: x.cate3 || '',
      cate4: x.cate4 || '',
      sizeTableId: x.size_table_id,
      imgUrl: x.img_url || '',
      imgBase64: x.img_base64 || '',
      remark: x.remark || '',
      createdAt: x.created_at
    }));
    return sendJson(res, 200, { ok: true, styles });
  }

  if (req.method === 'POST') {
    try {
      const raw = await readBody(req);
      const body = raw ? JSON.parse(raw) : {};
      const code = typeof body.code === 'string' ? body.code.trim() : '';
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const cate1 = typeof body.cate1 === 'string' ? body.cate1.trim() : '';
      const cate2 = typeof body.cate2 === 'string' ? body.cate2.trim() : '';
      let cate3 = typeof body.cate3 === 'string' ? body.cate3.trim() : '';
      let cate4 = typeof body.cate4 === 'string' ? body.cate4.trim() : '';
      const sizeTableId = typeof body.sizeTableId === 'string' ? body.sizeTableId.trim() : '';
      const remark = typeof body.remark === 'string' ? body.remark.trim() : '';
      const imgUrl = typeof body.imgUrl === 'string' ? body.imgUrl.trim() : '';
      const imgBase64 = typeof body.imgBase64 === 'string' ? body.imgBase64.trim() : '';
      if (!code || !name || !cate1 || !cate2 || !sizeTableId) return sendJson(res, 400, { ok: false, error: 'bad_request' });
      if (imgBase64 && imgBase64.length > 700000) return sendJson(res, 400, { ok: false, error: 'image_too_large' });

      if (cate2 === JERSEY_CATE2) {
        cate3 = requiredJerseyEnum(cate3, JERSEY_CATE3, 'cate3');
        cate4 = requiredJerseyEnum(cate4, JERSEY_CATE4, 'cate4');
      } else {
        if (cate3 || cate4) throw new Error('cate3_cate4_not_allowed');
        cate3 = '';
        cate4 = '';
      }

      const inserted = await sql`
        insert into styles (code, name, cate1, cate2, cate3, cate4, size_table_id, img_url, img_base64, remark)
        values (${code}, ${name}, ${cate1}, ${cate2}, ${cate3 || null}, ${cate4 || null}, ${sizeTableId}::uuid, ${imgUrl || null}, ${imgBase64 || null}, ${remark || null})
        returning id, code, name, cate1, cate2, cate3, cate4, size_table_id, img_url, img_base64, remark, created_at
      `;
      const x = inserted.rows[0];
      await audit(session.userId, 'admin_create_style', 'style', String(x.id), { code: x.code, name: x.name });
      return sendJson(res, 200, {
        ok: true,
        style: {
          id: x.id,
          code: x.code,
          name: x.name,
          cate1: x.cate1,
          cate2: x.cate2,
          cate3: x.cate3 || '',
          cate4: x.cate4 || '',
          sizeTableId: x.size_table_id,
          imgUrl: x.img_url || '',
          imgBase64: x.img_base64 || '',
          remark: x.remark || '',
          createdAt: x.created_at
        }
      });
    } catch (e) {
      return sendJson(res, 400, { ok: false, error: 'bad_request' });
    }
  }

  if (req.method === 'DELETE') {
    const id = (url.searchParams.get('id') || '').trim();
    if (!id) return sendJson(res, 400, { ok: false, error: 'id_required' });
    await sql`delete from styles where id = ${id}::uuid`;
    await audit(session.userId, 'admin_delete_style', 'style', id, null);
    return sendJson(res, 200, { ok: true });
  }

  return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
}

async function ordersHandler(req, res, url) {
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

  try {
    if (createdFrom) requiredYmd(createdFrom, 'createdFrom');
    if (createdTo) requiredYmd(createdTo, 'createdTo');
  } catch (e) {
    return sendJson(res, 400, { ok: false, error: 'bad_request' });
  }

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
        o.cate3,
        o.cate4,
        o.factory_user_id,
        o.factory_name,
        o.order_type,
        o.status,
        o.amount,
        o.remark,
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
      where
        (${orderSn} = '' or o.order_sn = ${orderSn})
        and (${companyName} = '' or o.cust_name ilike ${'%' + companyName + '%'})
        and (${phone} = '' or o.cust_phone = ${phone})
        and (${status} = '' or o.status = ${status})
        and (${cate1} = '' or o.cate1 = ${cate1})
        and (${cate2} = '' or o.cate2 = ${cate2})
        and (${cate3} = '' or o.cate3 = ${cate3})
        and (${cate4} = '' or o.cate4 = ${cate4})
        and (${createdFrom} = '' or o.create_time >= (${createdFrom}::date))
        and (${createdTo} = '' or o.create_time < (${createdTo}::date + interval '1 day'))
        and (${factoryName} = '' or o.factory_name = ${factoryName})
      group by o.id
      order by o.create_time desc
      limit 300
    `;

    const orders = r.rows.map((x) => ({
      id: x.id,
      orderSn: x.order_sn,
      createdAt: x.create_time,
      companyName: x.cust_name,
      contactName: x.cust_contact || '',
      phone: x.cust_phone,
      cate1: x.cate1,
      cate2: x.cate2,
      cate3: x.cate3 || '',
      cate4: x.cate4 || '',
      factoryUserId: x.factory_user_id,
      factoryName: x.factory_name || '',
      orderType: x.order_type,
      status: x.status,
      amount: x.amount || '',
      remark: x.remark || '',
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

async function ordersCsvHandler(req, res, url) {
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

  try {
    if (createdFrom) requiredYmd(createdFrom, 'createdFrom');
    if (createdTo) requiredYmd(createdTo, 'createdTo');
  } catch (e) {
    return sendJson(res, 400, { ok: false, error: 'bad_request' });
  }

  try {
    const r = await sql`
      select
        o.id,
        o.order_sn,
        o.create_time,
        o.cust_name,
        o.cust_phone,
        o.cate1,
        o.cate2,
        o.cate3,
        o.cate4,
        o.factory_name,
        o.order_type,
        o.status,
        o.remark,
        o.requested_delivery_date,
        o.suggested_delivery_date,
        oi.style_id,
        s.code as style_code,
        s.name as style_name,
        oi.qty,
        oi.custom_text,
        oi.custom_attachments
      from orders o
      left join order_items oi on oi.order_id = o.id
      left join styles s on s.id = oi.style_id
      where
        (${orderSn} = '' or o.order_sn = ${orderSn})
        and (${companyName} = '' or o.cust_name ilike ${'%' + companyName + '%'})
        and (${phone} = '' or o.cust_phone = ${phone})
        and (${status} = '' or o.status = ${status})
        and (${cate1} = '' or o.cate1 = ${cate1})
        and (${cate2} = '' or o.cate2 = ${cate2})
        and (${cate3} = '' or o.cate3 = ${cate3})
        and (${cate4} = '' or o.cate4 = ${cate4})
        and (${createdFrom} = '' or o.create_time >= (${createdFrom}::date))
        and (${createdTo} = '' or o.create_time < (${createdTo}::date + interval '1 day'))
      order by o.create_time desc, oi.create_time asc
      limit 2000
    `;

    const rows = r.rows.map((x) => {
      let qtyList = [];
      try {
        qtyList = normalizeQtyToSizeRatio(x.qty);
      } catch (e) {
        qtyList = [];
      }
      const qtyTotal = Array.isArray(qtyList) ? qtyList.reduce((a, b) => a + Number(b && b.qty ? b.qty : 0), 0) : 0;
      const att = Array.isArray(x.custom_attachments) ? x.custom_attachments : [];
      const attUrls = att.map((a) => (a && typeof a.url === 'string' ? a.url : '')).filter(Boolean).join(' ');
      return {
        createdAt: x.create_time ? new Date(x.create_time).toISOString() : '',
        orderSn: x.order_sn || '',
        status: x.status || '',
        orderType: x.order_type || '',
        cate1: x.cate1 || '',
        cate2: x.cate2 || '',
        cate3: x.cate3 || '',
        cate4: x.cate4 || '',
        companyName: x.cust_name || '',
        phone: x.cust_phone || '',
        factoryName: x.factory_name || '',
        requestedDeliveryDate: x.requested_delivery_date ? String(x.requested_delivery_date) : '',
        suggestedDeliveryDate: x.suggested_delivery_date ? String(x.suggested_delivery_date) : '',
        addressRemark: x.remark || '',
        styleCode: x.style_code || '',
        styleName: x.style_name || '',
        qtyTotal: qtyTotal ? String(qtyTotal) : '',
        customText: x.custom_text || '',
        customImageUrls: attUrls
      };
    });

    const csv = toCsv(rows, [
      { key: 'createdAt', header: 'createdAt' },
      { key: 'orderSn', header: 'orderSn' },
      { key: 'status', header: 'status' },
      { key: 'orderType', header: 'orderType' },
      { key: 'cate1', header: 'cate1' },
      { key: 'cate2', header: 'cate2' },
      { key: 'cate3', header: 'cate3' },
      { key: 'cate4', header: 'cate4' },
      { key: 'companyName', header: 'companyName' },
      { key: 'phone', header: 'phone' },
      { key: 'factoryName', header: 'factoryName' },
      { key: 'requestedDeliveryDate', header: 'requestedDeliveryDate' },
      { key: 'suggestedDeliveryDate', header: 'suggestedDeliveryDate' },
      { key: 'addressRemark', header: 'addressRemark' },
      { key: 'styleCode', header: 'styleCode' },
      { key: 'styleName', header: 'styleName' },
      { key: 'qtyTotal', header: 'qtyTotal' },
      { key: 'customText', header: 'customText' },
      { key: 'customImageUrls', header: 'customImageUrls' }
    ]);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="orders_${Date.now()}.csv"`);
    res.end(csv);
  } catch (e) {
    return sendJson(res, 500, { ok: false, error: 'server_error' });
  }
}

async function assignFactoryHandler(req, res) {
  const session = await requireAdmin(req, res);
  if (!session) return;
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });

  try {
    const raw = await readBody(req);
    const body = raw ? JSON.parse(raw) : {};
    const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : '';
    const factoryUserId = typeof body.factoryUserId === 'string' ? body.factoryUserId.trim() : '';
    if (!orderId) return sendJson(res, 400, { ok: false, error: 'orderId_required' });

    if (factoryUserId) {
      const updated = await sql`
        update orders
        set
          factory_user_id = ${factoryUserId}::uuid,
          factory_name = (select name from users where id = ${factoryUserId}::uuid)
        where id = ${orderId}::uuid
        returning id, factory_user_id, factory_name
      `;
      const row = updated.rows[0];
      if (!row) return sendJson(res, 404, { ok: false, error: 'not_found' });
      await audit(session.userId, 'admin_assign_factory', 'order', String(row.id), { factoryUserId: row.factory_user_id, factoryName: row.factory_name || '' });
      return sendJson(res, 200, { ok: true, orderId: row.id, factoryUserId: row.factory_user_id, factoryName: row.factory_name || '' });
    }

    const cleared = await sql`
      update orders
      set factory_user_id = null, factory_name = null
      where id = ${orderId}::uuid
      returning id
    `;
    const row = cleared.rows[0];
    if (!row) return sendJson(res, 404, { ok: false, error: 'not_found' });
    await audit(session.userId, 'admin_assign_factory', 'order', String(row.id), { factoryUserId: null, factoryName: '' });
    return sendJson(res, 200, { ok: true, orderId: row.id, factoryUserId: null, factoryName: '' });
  } catch (e) {
    return sendJson(res, 400, { ok: false, error: 'bad_request' });
  }
}

async function orderStatusHandler(req, res) {
  const session = await requireAdmin(req, res);
  if (!session) return;
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
      where id = ${orderId}::uuid
      returning id, status
    `;
    const row = updated.rows[0];
    if (!row) return sendJson(res, 404, { ok: false, error: 'not_found' });
    await audit(session.userId, 'admin_order_status', 'order', String(row.id), { status: row.status });
    return sendJson(res, 200, { ok: true, orderId: row.id, status: row.status });
  } catch (e) {
    return sendJson(res, 400, { ok: false, error: 'bad_request' });
  }
}

async function orderCopyHandler(req, res) {
  const session = await requireAdmin(req, res);
  if (!session) return;
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });

  try {
    const raw = await readBody(req);
    const body = raw ? JSON.parse(raw) : {};
    const sourceOrderId = typeof body.sourceOrderId === 'string' ? body.sourceOrderId.trim() : '';
    const requestedDeliveryDate = requiredYmd(body.requestedDeliveryDate, 'requestedDeliveryDate');
    if (!sourceOrderId) return sendJson(res, 400, { ok: false, error: 'sourceOrderId_required' });

    const srcOrderR = await sql`select * from orders where id = ${sourceOrderId}::uuid limit 1`;
    const src = srcOrderR.rows[0];
    if (!src) return sendJson(res, 404, { ok: false, error: 'not_found' });

    const itemsR = await sql`select style_id, qty, custom_text, custom_attachments from order_items where order_id = ${sourceOrderId}::uuid`;
    const items = itemsR.rows;
    if (!items.length) return sendJson(res, 400, { ok: false, error: 'source_items_missing' });

    const suggestedDeliveryDate = addBusinessDays(hkTodayYmd(new Date()), 17);
    if (requestedDeliveryDate < suggestedDeliveryDate) {
      return sendJson(res, 400, { ok: false, error: 'delivery_date_too_early', suggestedDeliveryDate });
    }

    const orderSn = generateOrderSn(new Date());
    const lookupCode = generateLookupCode();
    const orderType = '客戶翻單';
    const status = '客戶已提交';

    const inserted = await sql`
      insert into orders
        (order_sn, lookup_code, customer_id, cust_name, cust_contact, cust_phone, cate1, cate2, factory_name, order_type, status, amount, remark, requested_delivery_date, suggested_delivery_date, source_order_id)
      values
        (${orderSn}, ${lookupCode}, ${src.customer_id}::uuid, ${src.cust_name}, ${src.cust_contact}, ${src.cust_phone}, ${src.cate1}, ${src.cate2}, ${src.factory_name}, ${orderType}, ${status}, ${src.amount}, ${src.remark}, ${requestedDeliveryDate}, ${suggestedDeliveryDate}, ${sourceOrderId}::uuid)
      returning id, create_time
    `;
    const newOrderId = inserted.rows[0].id;

    for (const it of items) {
      const qty = normalizeQtyToSizeRatio(it.qty);
      await sql`
        insert into order_items (order_id, style_id, qty, custom_text, custom_attachments)
        values (${newOrderId}::uuid, ${it.style_id}::uuid, ${JSON.stringify(qty)}::jsonb, ${it.custom_text}, ${it.custom_attachments}::jsonb)
      `;
    }

    await audit(session.userId, 'admin_order_copy', 'order', String(newOrderId), { sourceOrderId });
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
}

async function feedbackHandler(req, res, url) {
  const session = await requireAdmin(req, res);
  if (!session) return;
  if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });

  const factoryName = (url.searchParams.get('factoryName') || '').trim();
  const status = (url.searchParams.get('status') || '').trim();

  try {
    const r = await sql`
      select id, order_id, order_sn, factory_name, content, status, attachments, create_time
      from feedback
      where
        (${factoryName} = '' or factory_name = ${factoryName})
        and (${status} = '' or status = ${status})
      order by create_time desc
      limit 300
    `;

    const feedback = r.rows.map((x) => ({
      id: x.id,
      orderId: x.order_id,
      orderSn: x.order_sn,
      factoryName: x.factory_name,
      content: x.content,
      status: x.status,
      attachments: x.attachments || [],
      createdAt: x.create_time
    }));
    return sendJson(res, 200, { ok: true, feedback });
  } catch (e) {
    return sendJson(res, 500, { ok: false, error: 'server_error' });
  }
}

async function uploadHandler(req, res) {
  const session = await requireAdmin(req, res);
  if (!session) return;
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });

  try {
    const raw = await readBody(req);
    const body = raw ? JSON.parse(raw) : {};
    const dataUrl = typeof body.dataUrl === 'string' ? body.dataUrl.trim() : '';
    const filename = typeof body.filename === 'string' ? body.filename.trim() : '';
    const prefix = typeof body.prefix === 'string' ? body.prefix.trim() : 'styles';
    if (!dataUrl) return sendJson(res, 400, { ok: false, error: 'bad_request' });

    const r = await uploadDataUrl(prefix, filename, dataUrl);
    if (!r) return sendJson(res, 400, { ok: false, error: 'bad_request' });
    await audit(session.userId, 'admin_upload', 'blob', r.pathname, { prefix });
    return sendJson(res, 200, { ok: true, url: r.url, pathname: r.pathname, contentType: r.contentType });
  } catch (e) {
    return sendJson(res, 500, { ok: false, error: 'server_error', message: String(e && e.message ? e.message : e) });
  }
}

async function feedbackStatusHandler(req, res) {
  const session = await requireAdmin(req, res);
  if (!session) return;
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });

  try {
    const raw = await readBody(req);
    const body = raw ? JSON.parse(raw) : {};
    const feedbackId = typeof body.feedbackId === 'string' ? body.feedbackId.trim() : '';
    const status = typeof body.status === 'string' ? body.status.trim() : '';
    if (!feedbackId) return sendJson(res, 400, { ok: false, error: 'feedbackId_required' });
    if (!FEEDBACK_STATUS.includes(status)) return sendJson(res, 400, { ok: false, error: 'status_invalid' });

    const updated = await sql`
      update feedback
      set status = ${status}
      where id = ${feedbackId}::uuid
      returning id, status
    `;
    const row = updated.rows[0];
    if (!row) return sendJson(res, 404, { ok: false, error: 'not_found' });
    await audit(session.userId, 'admin_feedback_status', 'feedback', String(row.id), { status: row.status });
    return sendJson(res, 200, { ok: true, feedbackId: row.id, status: row.status });
  } catch (e) {
    return sendJson(res, 400, { ok: false, error: 'bad_request' });
  }
}

module.exports = async function handler(req, res) {
  await ensureMigrations();
  const url = new URL(req.url, 'http://localhost');
  const action = (url.searchParams.get('action') || '').trim();

  if (action === 'users') return usersHandler(req, res, url);
  if (action === 'sizeTables') return sizeTablesHandler(req, res, url);
  if (action === 'styles') return stylesHandler(req, res, url);
  if (action === 'orders') return ordersHandler(req, res, url);
  if (action === 'ordersCsv') return ordersCsvHandler(req, res, url);
  if (action === 'assignFactory') return assignFactoryHandler(req, res);
  if (action === 'orderStatus') return orderStatusHandler(req, res);
  if (action === 'orderCopy') return orderCopyHandler(req, res);
  if (action === 'upload') return uploadHandler(req, res);
  if (action === 'feedback') return feedbackHandler(req, res, url);
  if (action === 'feedbackStatus') return feedbackStatusHandler(req, res);

  return sendJson(res, 404, { ok: false, error: 'not_found' });
};
