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
    if (createdFrom !== '') requiredYmd(createdFrom, 'createdFrom');
    if (createdTo !== '') requiredYmd(createdTo, 'createdTo');
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
        and (${createdFrom} = '' or o.create_time >= (coalesce(nullif(${createdFrom},''), '1900-01-01')::date))
        and (${createdTo} = '' or o.create_time < (coalesce(nullif(${createdTo},''), '2099-12-31')::date + interval '1 day'))
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
    return sendJson(res, 500, { ok: false, error: 'server_error', message: String(e && e.message ? e.message : e) });
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
    if (createdFrom !== '') requiredYmd(createdFrom, 'createdFrom');
    if (createdTo !== '') requiredYmd(createdTo, 'createdTo');
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
        and (${createdFrom} = '' or o.create_time >= (coalesce(nullif(${createdFrom},''), '1900-01-01')::date))
        and (${createdTo} = '' or o.create_time < (coalesce(nullif(${createdTo},''), '2099-12-31')::date + interval '1 day'))
      order by o.create_time desc
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
    return sendJson(res, 500, { ok: false, error: 'server_error', message: String(e && e.message ? e.message : e) });
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
    return sendJson(res, 500, { ok: false, error: 'server_error', message: String(e && e.message ? e.message : e) });
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

// ============================================================
// 10. Admin 確認收款
// ============================================================
async function markPaidHandler(req, res) {
  const session = await requireAdmin(req, res);
  if (!session) return;
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  try {
    const raw = await readBody(req);
    const body = raw ? JSON.parse(raw) : {};
    const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : '';
    const paidMethod = typeof body.paidMethod === 'string' ? body.paidMethod.trim() : '銀行轉帳';

    if (!orderId) return sendJson(res, 400, { ok: false, error: 'orderId_required' });

    const existing = await sql`SELECT id, paid, status FROM orders WHERE id = ${orderId}::uuid LIMIT 1`;
    if (!existing.rows[0]) return sendJson(res, 404, { ok: false, error: 'not_found' });
    if (existing.rows[0].paid === 1) {
      return sendJson(res, 409, { ok: false, error: 'already_paid', message: '訂單已確認收款' });
    }

    const updated = await sql`
      UPDATE orders
      SET paid = 1, paid_at = NOW(), paid_method = ${paidMethod}
      WHERE id = ${orderId}::uuid
      RETURNING id, paid, paid_at, paid_method
    `;
    const row = updated.rows[0];

    await audit(session.userId, 'admin_mark_paid', 'order', orderId, {
      paidMethod: row.paid_method,
      paidAt: row.paid_at
    });

    return sendJson(res, 200, {
      ok: true,
      orderId: row.id,
      paid: row.paid,
      paidAt: row.paid_at,
      paidMethod: row.paid_method
    });
  } catch (e) {
    return sendJson(res, 400, { ok: false, error: 'bad_request' });
  }
}

// ============================================================
// 11. Admin 工廠結算管理
// ============================================================
async function factorySettlementsHandler(req, res, url) {
  const session = await requireAdmin(req, res);
  if (!session) return;

  // GET: 列表
  if (req.method === 'GET') {
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
    const offset = (page - 1) * limit;
    const status = url.searchParams.get('status') || '';

    let whereClause = sql``;
    if (status) {
      whereClause = sql`WHERE fs.status = ${status}`;
    }

    let countQuery, countVals;
    let listQuery, listVals;
    if (status) {
      countQuery = `SELECT COUNT(*) as total FROM factory_settlements fs WHERE fs.status = $1`;
      countVals = [status];
      listQuery = `SELECT fs.*, u.name as factory_name FROM factory_settlements fs JOIN users u ON u.id = fs.factory_user_id::uuid WHERE fs.status = $1 ORDER BY fs.created_at DESC LIMIT $2 OFFSET $3`;
      listVals = [status, limit, offset];
    } else {
      countQuery = `SELECT COUNT(*) as total FROM factory_settlements fs`;
      countVals = [];
      listQuery = `SELECT fs.*, u.name as factory_name FROM factory_settlements fs JOIN users u ON u.id = fs.factory_user_id::uuid ORDER BY fs.created_at DESC LIMIT $1 OFFSET $2`;
      listVals = [limit, offset];
    }

    const countR = await sql.query(countQuery, countVals);
    const total = Number(countR.rows[0].total);

    const records = await sql.query(listQuery, listVals);

    return sendJson(res, 200, {
      ok: true,
      records: records.rows.map(r => ({
        id: r.id,
        factoryUserId: r.factory_user_id,
        factoryName: r.factory_name,
        periodStart: r.period_start,
        periodEnd: r.period_end,
        orderCount: r.order_count,
        totalAmount: Number(r.total_amount),
        commissionRate: Number(r.commission_rate),
        commission: Number(r.commission),
        status: r.status,
        settledAt: r.settled_at,
        paidAt: r.paid_at,
        createdAt: r.created_at
      })),
      total,
      page,
      limit
    });
  }

  // POST: 建立結算單
  if (req.method === 'POST') {
    try {
      const raw = await readBody(req);
      const body = raw ? JSON.parse(raw) : {};
      const factoryUserId = typeof body.factoryUserId === 'string' ? body.factoryUserId.trim() : '';
      const periodStart = typeof body.periodStart === 'string' ? body.periodStart.trim() : '';
      const periodEnd = typeof body.periodEnd === 'string' ? body.periodEnd.trim() : '';

      if (!factoryUserId || !periodStart || !periodEnd) {
        return sendJson(res, 400, { ok: false, error: 'bad_request' });
      }

      // 查詢周期內工廠完成的訂單
      const ordersInPeriod = await sql`
        SELECT
          COUNT(*) as order_count,
          COALESCE(SUM(COALESCE(amount::numeric, 0)), 0) as total_amount
        FROM orders
        WHERE factory_user_id = ${factoryUserId}::uuid
          AND status = '已完成'
          AND shipped_at >= ${periodStart}::date
          AND shipped_at < ${periodEnd}::date + interval '1 day'
      `;

      const orderCount = Number(ordersInPeriod.rows[0]?.order_count || 0);
      const totalAmount = Number(ordersInPeriod.rows[0]?.total_amount || 0);

      // 查詢工廠傭金比例
      const ba = await sql`
        SELECT commission_rate FROM brokerage_accounts
        WHERE account_id = ${factoryUserId}::uuid AND account_type = 'factory'
      `;
      const commissionRate = Number(ba.rows[0]?.commission_rate || 0.03);
      const commission = Number((totalAmount * commissionRate).toFixed(2));

      const inserted = await sql`
        INSERT INTO factory_settlements
          (factory_user_id, period_start, period_end, order_count, total_amount, commission_rate, commission, status)
        VALUES
          (${factoryUserId}::uuid, ${periodStart}, ${periodEnd}, ${orderCount}, ${totalAmount}, ${commissionRate}, ${commission}, 'pending')
        RETURNING id, created_at
      `;

      await audit(session.userId, 'admin_create_settlement', 'factory_settlement', String(inserted.rows[0].id), {
        factoryUserId,
        periodStart,
        periodEnd,
        commission
      });

      return sendJson(res, 200, {
        ok: true,
        settlementId: inserted.rows[0].id,
        orderCount,
        totalAmount,
        commissionRate,
        commission
      });
    } catch (e) {
      return sendJson(res, 400, { ok: false, error: 'bad_request', message: String(e && e.message ? e.message : e) });
    }
  }

  return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
}

// PATCH: 更新結算狀態（確認付款）
async function factorySettlementPayHandler(req, res) {
  const session = await requireAdmin(req, res);
  if (!session) return;
  if (req.method !== 'PATCH') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });

  try {
    const raw = await readBody(req);
    const body = raw ? JSON.parse(raw) : {};
    const settlementId = typeof body.settlementId === 'string' ? body.settlementId.trim() : '';
    const action = typeof body.action === 'string' ? body.action.trim() : ''; // 'pay' | 'cancel'

    if (!settlementId) return sendJson(res, 400, { ok: false, error: 'settlementId_required' });

    const existing = await sql`SELECT * FROM factory_settlements WHERE id = ${parseInt(settlementId, 10)} LIMIT 1`;
    if (!existing.rows[0]) return sendJson(res, 404, { ok: false, error: 'not_found' });
    const s = existing.rows[0];

    let newStatus;
    if (action === 'pay') {
      newStatus = 'paid';
      await sql`
        UPDATE factory_settlements
        SET status = 'paid', paid_at = NOW()
        WHERE id = ${parseInt(settlementId, 10)}
      `;
    } else if (action === 'cancel') {
      newStatus = 'cancelled';
      await sql`
        UPDATE factory_settlements
        SET status = 'cancelled'
        WHERE id = ${parseInt(settlementId, 10)}
      `;
    } else {
      return sendJson(res, 400, { ok: false, error: 'invalid_action' });
    }

    await audit(session.userId, 'admin_settlement_pay', 'factory_settlement', settlementId, {
      action,
      previousStatus: s.status,
      newStatus
    });

    return sendJson(res, 200, { ok: true, settlementId, newStatus });
  } catch (e) {
    return sendJson(res, 400, { ok: false, error: 'bad_request' });
  }
}

// ============================================================
// 12. 儀表板統計
// ============================================================
async function statsHandler(req, res) {
  const session = await requireAdmin(req, res);
  if (!session) return;
  if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });

  try {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const todayStart = todayStr + ' 00:00:00';
    const todayEnd = todayStr + ' 23:59:59';
    const last7Days = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const last30Days = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // --- 今日概覽 ---
    const todayOrders = await sql`
      SELECT
        COUNT(*) as total_count,
        COUNT(*) FILTER (WHERE status = '已完成') as completed_count,
        COALESCE(SUM(COALESCE(amount::numeric, 0)) FILTER (WHERE status = '已完成'), 0) as completed_amount
      FROM orders
      WHERE create_time >= ${todayStart}::timestamptz AND create_time <= ${todayEnd}::timestamptz
    `;

    const pendingOrders = await sql`
      SELECT COUNT(*) as count FROM orders WHERE status = '客戶已提交'
    `;

    const factoryAssignedOrders = await sql`
      SELECT COUNT(*) as count
      FROM orders
      WHERE factory_user_id IS NOT NULL
        AND status NOT IN ('已完成', '已取消', '已退款')
        AND factory_accepted_at IS NULL
        AND factory_rejected_at IS NULL
    `;

    // --- 總訂單/銷售統計 ---
    const totalStats = await sql`
      SELECT
        COUNT(*) as total_orders,
        COALESCE(SUM(COALESCE(amount::numeric, 0)) FILTER (WHERE paid = 1), 0) as total_sales_amount,
        COUNT(*) FILTER (WHERE paid = 1) as paid_orders,
        COUNT(*) FILTER (WHERE paid = 0 AND status != '已取消') as unpaid_orders
      FROM orders
      WHERE 1=1
    `;

    // --- 7天訂單趨勢（按日）---
    const trend7d = await sql`
      SELECT
        DATE(create_time) as date,
        COUNT(*) as order_count,
        COALESCE(SUM(COALESCE(amount::numeric, 0)) FILTER (WHERE status = '已完成'), 0) as sales_amount
      FROM orders
      WHERE create_time >= ${last7Days}::date
      GROUP BY DATE(create_time)
      ORDER BY date ASC
    `;

    // --- 30天銷售趨勢 ---
    const trend30d = await sql`
      SELECT
        DATE(create_time) as date,
        COUNT(*) as order_count,
        COALESCE(SUM(COALESCE(amount::numeric, 0)) FILTER (WHERE status = '已完成'), 0) as sales_amount
      FROM orders
      WHERE create_time >= ${last30Days}::date
      GROUP BY DATE(create_time)
      ORDER BY date ASC
    `;

    // --- 各狀態訂單分佈 ---
    const statusDist = await sql`
      SELECT status, COUNT(*) as count
      FROM orders
      WHERE 1=1
      GROUP BY status
      ORDER BY count DESC
    `;

    // --- 工廠產量排行（7天）---
    const factoryStats7d = await sql`
      SELECT
        factory_name,
        factory_user_id,
        COUNT(*) as order_count,
        COUNT(*) FILTER (WHERE status = '已完成') as completed_count,
        COUNT(*) FILTER (WHERE status = '已出貨') as shipped_count,
        COALESCE(SUM(COALESCE(amount::numeric, 0)) FILTER (WHERE status = '已完成'), 0) as completed_amount
      FROM orders
      WHERE factory_name IS NOT NULL
        AND create_time >= ${last7Days}::date
      GROUP BY factory_name, factory_user_id
      ORDER BY completed_amount DESC
      LIMIT 10
    `;

    // --- 款式暢銷排行（30天）---
    const productStats = await sql`
      SELECT
        s.name as style_name,
        s.code as style_code,
        COUNT(oi.id) as order_count,
        SUM(COALESCE((oi.qty->0->>'qty')::int, 0)) as total_qty
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN styles s ON s.id = oi.style_id
      WHERE o.create_time >= ${last30Days}::date
        AND o.status NOT IN ('已取消', '退款中')
      GROUP BY s.id, s.name, s.code
      ORDER BY total_qty DESC NULLS LAST
      LIMIT 10
    `;

    // --- 客戶消費排行（30天）---
    const customerStats = await sql`
      SELECT
        c.company_name,
        c.contact_name,
        COUNT(o.id) as order_count,
        COALESCE(SUM(COALESCE(o.amount::numeric, 0)), 0) as total_amount
      FROM customers c
      JOIN orders o ON o.customer_id = c.id
      WHERE o.create_time >= ${last30Days}::date
        AND o.status NOT IN ('已取消', '退款中')
      GROUP BY c.id, c.company_name, c.contact_name
      ORDER BY total_amount DESC
      LIMIT 10
    `;

    // --- 待處理反饋 ---
    const pendingFeedback = await sql`
      SELECT COUNT(*) as count FROM feedback WHERE status = '待處理'
    `;

    // --- 會員統計 ---
    const memberStats = await sql`
      SELECT
        COUNT(*) FILTER (WHERE is_registered = TRUE) as total_members,
        COUNT(*) FILTER (WHERE is_promoter = TRUE) as total_promoters,
        COALESCE(SUM(total_amount), 0) as total_sales,
        COALESCE(SUM(total_points), 0) as total_points
      FROM customers
    `;

    // --- 工廠結算統計 ---
    const settlementStats = await sql`
      SELECT
        COUNT(*) as total_settlements,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
        COUNT(*) FILTER (WHERE status = 'paid') as paid_count,
        COALESCE(SUM(commission) FILTER (WHERE status = 'paid'), 0) as total_paid_commission
      FROM factory_settlements
    `;

    const to = r => ({
      date: String(r.date),
      orderCount: Number(r.order_count),
      salesAmount: Number(r.sales_amount || 0)
    });

    return sendJson(res, 200, {
      ok: true,
      overview: {
        todayOrders: Number(todayOrders.rows[0]?.total_count || 0),
        todayCompleted: Number(todayOrders.rows[0]?.completed_count || 0),
        todaySales: Number(todayOrders.rows[0]?.completed_amount || 0),
        pendingOrders: Number(pendingOrders.rows[0]?.count || 0),
        factoryAssignedPending: Number(factoryAssignedOrders.rows[0]?.count || 0),
        pendingFeedback: Number(pendingFeedback.rows[0]?.count || 0)
      },
      totals: {
        orders: Number(totalStats.rows[0]?.total_orders || 0),
        salesAmount: Number(totalStats.rows[0]?.total_sales_amount || 0),
        paidOrders: Number(totalStats.rows[0]?.paid_orders || 0),
        unpaidOrders: Number(totalStats.rows[0]?.unpaid_orders || 0)
      },
      members: {
        total: Number(memberStats.rows[0]?.total_members || 0),
        promoters: Number(memberStats.rows[0]?.total_promoters || 0),
        totalSales: Number(memberStats.rows[0]?.total_sales || 0),
        totalPoints: Number(memberStats.rows[0]?.total_points || 0)
      },
      settlements: {
        total: Number(settlementStats.rows[0]?.total_settlements || 0),
        pending: Number(settlementStats.rows[0]?.pending_count || 0),
        paid: Number(settlementStats.rows[0]?.paid_count || 0),
        totalPaidCommission: Number(settlementStats.rows[0]?.total_paid_commission || 0)
      },
      trend7d: trend7d.rows.map(to),
      trend30d: trend30d.rows.map(to),
      statusDistribution: statusDist.rows.map(r => ({
        status: r.status,
        count: Number(r.count)
      })),
      factoryRanking: factoryStats7d.rows.map(r => ({
        factoryName: r.factory_name,
        factoryId: r.factory_user_id,
        orderCount: Number(r.order_count),
        completedCount: Number(r.completed_count),
        shippedCount: Number(r.shipped_count),
        completedAmount: Number(r.completed_amount)
      })),
      productRanking: productStats.rows.map(r => ({
        styleName: r.style_name,
        styleCode: r.style_code,
        orderCount: Number(r.order_count),
        totalQty: Number(r.total_qty || 0)
      })),
      customerRanking: customerStats.rows.map(r => ({
        companyName: r.company_name,
        contactName: r.contact_name || '',
        orderCount: Number(r.order_count),
        totalAmount: Number(r.total_amount)
      }))
    });
  } catch (e) {
    return sendJson(res, 500, { ok: false, error: 'server_error', message: String(e && e.message ? e.message : e) });
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
  if (action === 'stats') return statsHandler(req, res);
  if (action === 'markPaid') return markPaidHandler(req, res);
  if (action === 'factorySettlements') return factorySettlementsHandler(req, res, url);
  if (action === 'factorySettlementPay') return factorySettlementPayHandler(req, res);

  return sendJson(res, 404, { ok: false, error: 'not_found' });
};
