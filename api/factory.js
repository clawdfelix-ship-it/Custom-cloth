const { sql } = require('../src/lib/db');
const { sendJson, readBody } = require('../src/lib/http');
const { requireSession } = require('../src/lib/auth');
const { ORDER_STATUS_ADMIN } = require('../src/lib/schema');
const { ensureMigrations } = require('../src/lib/migrate');
const { audit } = require('../src/lib/audit');
const { uploadDataUrl } = require('../src/lib/blob');
const { normalizeQtyToSizeRatio } = require('../src/lib/qty');

/** 工廠允許自行更新的狀態 */
const FACTORY_ALLOWED_STATUS = ['工廠已接單', '生產中', '已出貨', '已完成'];

/** 需要快遞信息的狀態 */
const SHIPPING_STATUS = '已出貨';

/** 工廠可拒絕的狀態 */
const REJECTABLE_STATUSES = ['客戶已提交', '待確認報價', '待確認樣板'];

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

/**
 * 校驗訂單是否屬於當前工廠
 */
async function validateFactoryOrder(orderId, session) {
  const r = await sql`
    SELECT id, status, factory_user_id, factory_name, factory_accepted_at, factory_rejected_at
    FROM orders
    WHERE id = ${orderId}::uuid
      AND (factory_user_id = ${session.userId}::uuid OR factory_name = ${session.name})
    LIMIT 1
  `;
  return r.rows[0] || null;
}

async function requireFactory(req, res) {
  const session = await requireSession(req);
  if (!session || session.role !== 'factory') {
    sendJson(res, 401, { ok: false, error: 'unauthorized' });
    return null;
  }
  return session;
}

// ============================================================
// 1. 工廠接單
// ============================================================
async function factoryAcceptHandler(req, res, session) {
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  try {
    const raw = await readBody(req);
    const body = raw ? JSON.parse(raw) : {};
    const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : '';
    if (!orderId) return sendJson(res, 400, { ok: false, error: 'orderId_required' });

    const order = await validateFactoryOrder(orderId, session);
    if (!order) return sendJson(res, 404, { ok: false, error: 'not_found' });

    // 已被接單或已拒絕
    if (order.factory_accepted_at) {
      return sendJson(res, 409, { ok: false, error: 'already_accepted', message: '工廠已接單' });
    }
    if (order.factory_rejected_at) {
      return sendJson(res, 409, { ok: false, error: 'already_rejected', message: '工廠已拒絕此訂單' });
    }

    // 執行接單：更新狀態為「工廠已接單」+ 記錄時間
    const updated = await sql`
      UPDATE orders
      SET status = '工廠已接單',
          factory_accepted_at = NOW(),
          factory_user_id = ${session.userId}::uuid,
          factory_name = ${session.name}
      WHERE id = ${orderId}::uuid
      RETURNING id, status, factory_accepted_at
    `;
    const row = updated.rows[0];

    await audit(session.userId, 'factory_accept_order', 'order', orderId, {
      status: row.status,
      factoryName: session.name
    });

    return sendJson(res, 200, {
      ok: true,
      orderId: row.id,
      status: row.status,
      acceptedAt: row.factory_accepted_at
    });
  } catch (e) {
    return sendJson(res, 400, { ok: false, error: 'bad_request', message: String(e && e.message ? e.message : e) });
  }
}

// ============================================================
// 2. 工廠拒單
// ============================================================
async function factoryRejectHandler(req, res, session) {
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  try {
    const raw = await readBody(req);
    const body = raw ? JSON.parse(raw) : {};
    const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : '';
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';

    if (!orderId) return sendJson(res, 400, { ok: false, error: 'orderId_required' });
    if (!reason) return sendJson(res, 400, { ok: false, error: 'reason_required', message: '請填寫拒單原因' });

    const order = await validateFactoryOrder(orderId, session);
    if (!order) return sendJson(res, 404, { ok: false, error: 'not_found' });

    if (order.factory_accepted_at) {
      return sendJson(res, 409, { ok: false, error: 'already_accepted', message: '工廠已接單，無法拒單' });
    }
    if (order.factory_rejected_at) {
      return sendJson(res, 409, { ok: false, error: 'already_rejected', message: '此訂單已被拒絕' });
    }

    // 執行拒單
    const updated = await sql`
      UPDATE orders
      SET status = '已取消',
          factory_rejected_at = NOW(),
          factory_reject_reason = ${reason},
          factory_user_id = NULL,
          factory_name = NULL
      WHERE id = ${orderId}::uuid
      RETURNING id, status
    `;
    const row = updated.rows[0];

    await audit(session.userId, 'factory_reject_order', 'order', orderId, {
      reason,
      previousStatus: order.status
    });

    return sendJson(res, 200, {
      ok: true,
      orderId: row.id,
      status: row.status,
      rejectedAt: new Date().toISOString(),
      reason
    });
  } catch (e) {
    return sendJson(res, 400, { ok: false, error: 'bad_request', message: String(e && e.message ? e.message : e) });
  }
}

// ============================================================
// 3. 待處理訂單（工廠待接單列表）
// ============================================================
async function pendingOrdersHandler(req, res, session) {
  if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  try {
    // 工廠已分配但尚未接單或拒單的訂單
    const r = await sql`
      SELECT
        o.id, o.order_sn, o.create_time, o.cust_name, o.cust_phone,
        o.cate1, o.cate2, o.factory_name, o.order_type, o.status,
        o.requested_delivery_date, o.suggested_delivery_date, o.amount,
        o.factory_accepted_at, o.factory_rejected_at,
        CASE
          WHEN o.factory_accepted_at IS NOT NULL THEN 'accepted'
          WHEN o.factory_rejected_at IS NOT NULL THEN 'rejected'
          ELSE 'pending'
        END as accept_status
      FROM orders o
      WHERE o.factory_user_id = ${session.userId}::uuid
        AND o.status NOT IN ('已完成', '已取消', '已退款')
        AND o.factory_accepted_at IS NULL
        AND o.factory_rejected_at IS NULL
      ORDER BY o.create_time DESC
      LIMIT 300
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
      amount: x.amount || '',
      requestedDeliveryDate: x.requested_delivery_date ? String(x.requested_delivery_date) : '',
      suggestedDeliveryDate: x.suggested_delivery_date ? String(x.suggested_delivery_date) : '',
      acceptStatus: x.accept_status
    }));

    return sendJson(res, 200, { ok: true, orders });
  } catch (e) {
    return sendJson(res, 500, { ok: false, error: 'server_error', message: String(e && e.message ? e.message : e) });
  }
}

// ============================================================
// 4. 訂單列表（工廠歷史訂單）
// ============================================================
async function ordersHandler(req, res, session) {
  if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  try {
    const r = await sql`
      SELECT
        o.id, o.order_sn, o.create_time, o.cust_name, o.cust_phone,
        o.cate1, o.cate2, o.factory_name, o.order_type, o.status,
        o.requested_delivery_date, o.suggested_delivery_date,
        o.factory_accepted_at, o.shipped_at,
        o.express_company, o.tracking_number
      FROM orders o
      WHERE o.factory_user_id = ${session.userId}::uuid
      ORDER BY o.create_time DESC
      LIMIT 300
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
      suggestedDeliveryDate: x.suggested_delivery_date ? String(x.suggested_delivery_date) : '',
      acceptedAt: x.factory_accepted_at,
      shippedAt: x.shipped_at,
      expressCompany: x.express_company || '',
      trackingNumber: x.tracking_number || ''
    }));
    return sendJson(res, 200, { ok: true, orders });
  } catch (e) {
    return sendJson(res, 500, { ok: false, error: 'server_error', message: String(e && e.message ? e.message : e) });
  }
}

// ============================================================
// 5. 訂單詳情
// ============================================================
async function orderDetailHandler(req, res, session, url) {
  if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  const id = (url.searchParams.get('id') || '').trim();
  if (!id) return sendJson(res, 400, { ok: false, error: 'id_required' });

  try {
    const r = await sql`
      SELECT
        o.*,
        c.company_name, c.contact_name, c.phone as cust_phone
      FROM orders o
      LEFT JOIN customers c ON c.id = o.customer_id
      WHERE o.id = ${id}::uuid
        AND (o.factory_user_id = ${session.userId}::uuid OR o.factory_name = ${session.name})
      LIMIT 1
    `;
    const o = r.rows[0];
    if (!o) return sendJson(res, 404, { ok: false, error: 'not_found' });

    // 查詢 QC 記錄
    const qcRows = await sql`
      SELECT * FROM qc_records WHERE order_id = ${id}::uuid ORDER BY created_at ASC
    `;

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
        orderType: o.order_type,
        status: o.status,
        amount: o.amount || '',
        remark: o.remark || '',
        requestedDeliveryDate: o.requested_delivery_date ? String(o.requested_delivery_date) : '',
        suggestedDeliveryDate: o.suggested_delivery_date ? String(o.suggested_delivery_date) : '',
        acceptedAt: o.factory_accepted_at,
        shippedAt: o.shipped_at,
        expressCompany: o.express_company || '',
        trackingNumber: o.tracking_number || '',
        paid: o.paid,
        paidAt: o.paid_at,
        qcRecords: qcRows.rows.map(q => ({
          id: q.id,
          stage: q.qc_stage,
          result: q.qc_result,
          note: q.qc_note || '',
          photos: q.qc_photos || [],
          inspector: q.inspector || '',
          createdAt: q.created_at
        }))
      }
    });
  } catch (e) {
    return sendJson(res, 500, { ok: false, error: 'server_error', message: String(e && e.message ? e.message : e) });
  }
}

// ============================================================
// 6. 工廠更新訂單狀態（含快遞信息）
// ============================================================
async function orderStatusHandler(req, res, session) {
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  try {
    const raw = await readBody(req);
    const body = raw ? JSON.parse(raw) : {};
    const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : '';
    const status = typeof body.status === 'string' ? body.status.trim() : '';
    const expressCompany = typeof body.expressCompany === 'string' ? body.expressCompany.trim() : '';
    const trackingNumber = typeof body.trackingNumber === 'string' ? body.trackingNumber.trim() : '';

    if (!orderId) return sendJson(res, 400, { ok: false, error: 'orderId_required' });

    // 必須先接單才能更新狀態
    const order = await validateFactoryOrder(orderId, session);
    if (!order) return sendJson(res, 404, { ok: false, error: 'not_found' });
    if (!order.factory_accepted_at) {
      return sendJson(res, 403, { ok: false, error: 'must_accept_first', message: '請先接單才能更新狀態' });
    }

    if (!ORDER_STATUS_ADMIN.includes(status)) {
      return sendJson(res, 400, { ok: false, error: 'status_invalid' });
    }
    if (!FACTORY_ALLOWED_STATUS.includes(status)) {
      return sendJson(res, 403, { ok: false, error: 'forbidden_status', message: `工廠無法直接更新為「${status}」` });
    }

    // 如果是「已出貨」，快遞信息必填
    if (status === SHIPPING_STATUS && (!expressCompany || !trackingNumber)) {
      return sendJson(res, 400, { ok: false, error: 'express_required', message: '填寫快遞公司和運單號' });
    }

    // 構造更新字段
    let updateFields = { status };
    let shippedAt = null;
    if (status === SHIPPING_STATUS) {
      updateFields.express_company = expressCompany;
      updateFields.tracking_number = trackingNumber;
      shippedAt = new Date().toISOString();
      updateFields.shipped_at = shippedAt;
    }

    const updated = await sql`
      UPDATE orders
      SET
        status = ${updateFields.status},
        express_company = ${updateFields.express_company || null},
        tracking_number = ${updateFields.tracking_number || null},
        shipped_at = ${updateFields.shipped_at || null}
      WHERE id = ${orderId}::uuid
      RETURNING id, status, express_company, tracking_number, shipped_at
    `;
    const row = updated.rows[0];

    await audit(session.userId, 'factory_order_status', 'order', orderId, {
      status: row.status,
      expressCompany: row.express_company,
      trackingNumber: row.tracking_number
    });

    return sendJson(res, 200, {
      ok: true,
      orderId: row.id,
      status: row.status,
      expressCompany: row.express_company || '',
      trackingNumber: row.tracking_number || '',
      shippedAt: row.shipped_at
    });
  } catch (e) {
    return sendJson(res, 400, { ok: false, error: 'bad_request', message: String(e && e.message ? e.message : e) });
  }
}

// ============================================================
// 7. 工廠反饋
// ============================================================
async function feedbackHandler(req, res, session) {
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  try {
    const raw = await readBody(req);
    const body = raw ? JSON.parse(raw) : {};
    const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : '';
    const content = typeof body.content === 'string' ? body.content.trim() : '';
    const attachments = Array.isArray(body.attachments) ? body.attachments : [];
    if (!orderId || !content) return sendJson(res, 400, { ok: false, error: 'bad_request' });

    const o = await validateFactoryOrder(orderId, session);
    if (!o) return sendJson(res, 404, { ok: false, error: 'not_found' });

    const inserted = await sql`
      insert into feedback (order_id, order_sn, factory_name, content, status, attachments)
      values (${orderId}::uuid, ${o.order_sn || ''}, ${session.name}, ${content}, ${'待處理'}, ${JSON.stringify(attachments)}::jsonb)
      returning id, create_time
    `;
    await audit(session.userId, 'factory_feedback_create', 'feedback', String(inserted.rows[0].id), { orderId });
    return sendJson(res, 200, { ok: true, feedbackId: inserted.rows[0].id, createdAt: inserted.rows[0].create_time });
  } catch (e) {
    return sendJson(res, 400, { ok: false, error: 'bad_request' });
  }
}

// ============================================================
// 8. 工廠上傳
// ============================================================
async function uploadHandler(req, res, session) {
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  try {
    const raw = await readBody(req);
    const body = raw ? JSON.parse(raw) : {};
    const dataUrl = typeof body.dataUrl === 'string' ? body.dataUrl.trim() : '';
    const filename = typeof body.filename === 'string' ? body.filename.trim() : '';
    if (!dataUrl) return sendJson(res, 400, { ok: false, error: 'bad_request' });

    const r = await uploadDataUrl('factory', filename, dataUrl);
    if (!r) return sendJson(res, 400, { ok: false, error: 'bad_request' });
    await audit(session.userId, 'factory_upload', 'blob', r.pathname, null);
    return sendJson(res, 200, { ok: true, url: r.url, pathname: r.pathname, contentType: r.contentType });
  } catch (e) {
    return sendJson(res, 500, { ok: false, error: 'server_error', message: String(e && e.message ? e.message : e) });
  }
}

// ============================================================
// 9. 工廠結算中心（查看帳戶 + 流水 + 結算記錄）
// ============================================================
async function settlementHandler(req, res, session) {
  if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });

  const page = Math.max(1, parseInt(new URL(req.url, 'http://localhost').searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(new URL(req.url, 'http://localhost').searchParams.get('limit') || '20', 10)));
  const offset = (page - 1) * limit;

  try {
    // 1. 傭金帳戶
    const account = await sql`
      SELECT available_amount, frozen_amount, total_earned, total_withdrawn,
             commission_rate, second_rate, is_active, created_at
      FROM brokerage_accounts
      WHERE account_id = ${session.userId}::uuid AND account_type = 'factory'
    `;

    // 2. 傭金流水（分頁）
    const ledgerCount = await sql`
      SELECT COUNT(*) as total FROM brokerage_ledger WHERE account_id = ${session.userId}::uuid
    `;
    const total = Number(ledgerCount.rows[0].total);

    const ledger = await sql`
      SELECT id, ledger_type, pm, amount, balance_after, frozen_after,
             title, order_sn, mark, created_at
      FROM brokerage_ledger
      WHERE account_id = ${session.userId}::uuid
      ORDER BY created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    // 3. 結算單（老闆結算記錄）
    const settlementCount = await sql`
      SELECT COUNT(*) as total FROM factory_settlements WHERE factory_user_id = ${session.userId}::uuid
    `;
    const settlementsTotal = Number(settlementCount.rows[0].total);

    const settlements = await sql`
      SELECT id, period_start, period_end, order_count, total_amount,
             commission_rate, commission, status, settled_at, paid_at, created_at
      FROM factory_settlements
      WHERE factory_user_id = ${session.userId}::uuid
      ORDER BY created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    const acc = account.rows[0] || {
      available_amount: 0,
      frozen_amount: 0,
      total_earned: 0,
      total_withdrawn: 0,
      commission_rate: 0.03,
      second_rate: 0,
      is_active: false
    };

    return sendJson(res, 200, {
      ok: true,
      account: {
        availableAmount: Number(acc.available_amount),
        frozenAmount: Number(acc.frozen_amount),
        totalEarned: Number(acc.total_earned),
        totalWithdrawn: Number(acc.total_withdrawn),
        commissionRate: Number(acc.commission_rate),
        isActive: acc.is_active
      },
      ledger: {
        entries: ledger.rows.map(l => ({
          id: l.id,
          type: l.ledger_type,
          pm: l.pm,
          amount: Number(l.amount),
          balanceAfter: Number(l.balance_after),
          frozenAfter: Number(l.frozen_after),
          title: l.title,
          orderSn: l.order_sn || '',
          mark: l.mark || '',
          createdAt: l.created_at
        })),
        total,
        page,
        limit
      },
      settlements: {
        records: settlements.rows.map(s => ({
          id: s.id,
          periodStart: s.period_start,
          periodEnd: s.period_end,
          orderCount: s.order_count,
          totalAmount: Number(s.total_amount),
          commissionRate: Number(s.commission_rate),
          commission: Number(s.commission),
          status: s.status,
          settledAt: s.settled_at,
          paidAt: s.paid_at,
          createdAt: s.created_at
        })),
        total: settlementsTotal
      }
    });
  } catch (e) {
    return sendJson(res, 500, { ok: false, error: 'server_error', message: String(e && e.message ? e.message : e) });
  }
}

// ============================================================
// 10. 工廠申請提現
// ============================================================
async function withdrawHandler(req, res, session) {
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  try {
    const raw = await readBody(req);
    const body = raw ? JSON.parse(raw) : {};
    const amount = parseFloat(body.amount);

    if (isNaN(amount) || amount <= 0) {
      return sendJson(res, 400, { ok: false, error: 'invalid_amount' });
    }

    const { applyWithdraw } = require('../src/services/brokerage');
    const result = await applyWithdraw(session.userId, amount);

    await audit(session.userId, 'factory_withdraw', 'brokerage', session.userId, { amount });

    return sendJson(res, 200, {
      ok: true,
      message: '提現申請已提交',
      amount,
      newAvailable: result.newAvailable
    });
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    return sendJson(res, 400, { ok: false, error: 'withdraw_failed', message: msg });
  }
}

// ============================================================
// 11. QC 記錄新增
// ============================================================
async function qcRecordHandler(req, res, session) {
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  try {
    const raw = await readBody(req);
    const body = raw ? JSON.parse(raw) : {};
    const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : '';
    const stage = typeof body.stage === 'string' ? body.stage.trim() : '';
    const result = typeof body.result === 'string' ? body.result.trim() : '';
    const note = typeof body.note === 'string' ? body.note.trim() : '';
    const photos = Array.isArray(body.photos) ? body.photos : [];

    if (!orderId || !stage || !result) {
      return sendJson(res, 400, { ok: false, error: 'bad_request' });
    }

    const VALID_STAGES = ['備料', '裁剪', '印刷', '車縫', 'QC', '包裝'];
    const VALID_RESULTS = ['合格', '不合格', '返工'];
    if (!VALID_STAGES.includes(stage)) return sendJson(res, 400, { ok: false, error: 'invalid_stage' });
    if (!VALID_RESULTS.includes(result)) return sendJson(res, 400, { ok: false, error: 'invalid_result' });

    const order = await validateFactoryOrder(orderId, session);
    if (!order) return sendJson(res, 404, { ok: false, error: 'not_found' });

    const inserted = await sql`
      INSERT INTO qc_records (order_id, qc_stage, qc_result, qc_note, qc_photos, inspector)
      VALUES (${orderId}::uuid, ${stage}, ${result}, ${note}, ${JSON.stringify(photos)}::jsonb, ${session.name})
      RETURNING id, created_at
    `;

    await audit(session.userId, 'factory_qc_create', 'qc_record', String(inserted.rows[0].id), { orderId, stage, result });

    return sendJson(res, 200, {
      ok: true,
      qcRecordId: inserted.rows[0].id,
      createdAt: inserted.rows[0].created_at
    });
  } catch (e) {
    return sendJson(res, 400, { ok: false, error: 'bad_request' });
  }
}

// ============================================================
// Router
// ============================================================
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
  if (action === 'upload') return uploadHandler(req, res, session);
  if (action === 'accept') return factoryAcceptHandler(req, res, session);
  if (action === 'reject') return factoryRejectHandler(req, res, session);
  if (action === 'pendingOrders') return pendingOrdersHandler(req, res, session);
  if (action === 'settlement') return settlementHandler(req, res, session);
  if (action === 'withdraw') return withdrawHandler(req, res, session);
  if (action === 'qcRecord') return qcRecordHandler(req, res, session);

  return sendJson(res, 404, { ok: false, error: 'not_found' });
};
