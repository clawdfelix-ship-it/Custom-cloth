const crypto = require('node:crypto');
const { sql } = require('../src/lib/db');
const { sendJson, readBody } = require('../src/lib/http');
const { ensureMigrations } = require('../src/lib/migrate');
const { hashPassword, verifyPassword } = require('../src/lib/password');
const { getBearerToken } = require('../src/lib/auth');
const { newCustomerToken, requireCustomerSession } = require('../src/lib/customer-auth');
const { requiredString } = require('../src/lib/validation');
const { sendMail } = require('../src/lib/email');

function buildResetUrl(token) {
  const base = String(process.env.PUBLIC_BASE_URL || '').trim();
  if (!base) return '';
  try {
    const u = new URL('/login', base);
    u.searchParams.set('mode', 'reset');
    u.searchParams.set('token', token);
    return u.toString();
  } catch (e) {
    return '';
  }
}

async function readJsonBody(req) {
  const raw = await readBody(req);
  return raw ? JSON.parse(raw) : {};
}

async function registerHandler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  try {
    const body = await readJsonBody(req);
    const email = requiredString(body.email, 'email').toLowerCase();
    const password = requiredString(body.password, 'password');
    const companyName = requiredString(body.companyName, 'companyName');
    const contactName = requiredString(body.contactName, 'contactName');
    const phone = requiredString(body.phone, 'phone');
    const address = requiredString(body.address, 'address');

    const existingEmail = await sql`select id, is_registered from customers where email = ${email} limit 1`;
    if (existingEmail.rows[0] && existingEmail.rows[0].is_registered) {
      return sendJson(res, 409, { ok: false, error: 'email_exists' });
    }

    const pwdHash = await hashPassword(password);
    let customerRow = null;

    if (existingEmail.rows[0]) {
      const id = String(existingEmail.rows[0].id);
      const updated = await sql`
        update customers
        set company_name = ${companyName},
            contact_name = ${contactName},
            phone = ${phone},
            address = ${address},
            pwd_hash = ${pwdHash},
            is_registered = true
        where id = ${id}::uuid
        returning id, email, company_name, contact_name, phone, address
      `;
      customerRow = updated.rows[0] || null;
    } else {
      const byCompanyPhone = await sql`
        select id, is_registered, email
        from customers
        where company_name = ${companyName} and phone = ${phone}
        limit 1
      `;
      if (byCompanyPhone.rows[0] && byCompanyPhone.rows[0].is_registered) {
        return sendJson(res, 409, { ok: false, error: 'company_phone_exists' });
      }

      if (byCompanyPhone.rows[0]) {
        const id = String(byCompanyPhone.rows[0].id);
        const updated = await sql`
          update customers
          set email = ${email},
              contact_name = ${contactName},
              address = ${address},
              pwd_hash = ${pwdHash},
              is_registered = true
          where id = ${id}::uuid
          returning id, email, company_name, contact_name, phone, address
        `;
        customerRow = updated.rows[0] || null;
      } else {
        const inserted = await sql`
          insert into customers (company_name, contact_name, phone, email, pwd_hash, address, is_registered)
          values (${companyName}, ${contactName}, ${phone}, ${email}, ${pwdHash}, ${address}, true)
          returning id, email, company_name, contact_name, phone, address
        `;
        customerRow = inserted.rows[0] || null;
      }
    }

    if (!customerRow) return sendJson(res, 500, { ok: false, error: 'server_error' });

    const token = newCustomerToken();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 12).toISOString();
    await sql`insert into customer_sessions (token, customer_id, expires_at) values (${token}, ${customerRow.id}::uuid, ${expiresAt})`;

    return sendJson(res, 200, {
      ok: true,
      token,
      customer: {
        email: customerRow.email || '',
        companyName: customerRow.company_name,
        contactName: customerRow.contact_name || '',
        phone: customerRow.phone,
        address: customerRow.address || ''
      }
    });
  } catch (e) {
    return sendJson(res, 400, { ok: false, error: 'bad_request' });
  }
}

async function loginHandler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  try {
    const body = await readJsonBody(req);
    const email = requiredString(body.email, 'email').toLowerCase();
    const password = requiredString(body.password, 'password');

    const r = await sql`
      select id, email, pwd_hash, company_name, contact_name, phone, address, is_registered
      from customers
      where email = ${email}
      limit 1
    `;
    const c = r.rows[0];
    if (!c || !c.is_registered) return sendJson(res, 401, { ok: false, error: 'invalid_credentials' });
    const ok = await verifyPassword(password, c.pwd_hash || '');
    if (!ok) return sendJson(res, 401, { ok: false, error: 'invalid_credentials' });

    const token = newCustomerToken();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 12).toISOString();
    await sql`insert into customer_sessions (token, customer_id, expires_at) values (${token}, ${c.id}::uuid, ${expiresAt})`;

    return sendJson(res, 200, {
      ok: true,
      token,
      customer: {
        email: c.email || '',
        companyName: c.company_name,
        contactName: c.contact_name || '',
        phone: c.phone,
        address: c.address || ''
      }
    });
  } catch (e) {
    return sendJson(res, 400, { ok: false, error: 'bad_request' });
  }
}

async function logoutHandler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  const token = getBearerToken(req.headers.authorization);
  if (token) await sql`delete from customer_sessions where token = ${token}`;
  return sendJson(res, 200, { ok: true });
}

async function meHandler(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  const session = await requireCustomerSession(req);
  if (!session) return sendJson(res, 401, { ok: false, error: 'not_authenticated' });
  return sendJson(res, 200, {
    ok: true,
    customer: {
      email: session.email || '',
      companyName: session.companyName,
      contactName: session.contactName || '',
      phone: session.phone,
      address: session.address || ''
    }
  });
}

async function requestPasswordResetHandler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  try {
    const body = await readJsonBody(req);
    const email = requiredString(body.email, 'email').toLowerCase();

    const r = await sql`
      select id, email, is_registered
      from customers
      where email = ${email}
      limit 1
    `;
    const c = r.rows[0];
    if (!c || !c.is_registered) return sendJson(res, 200, { ok: true });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30).toISOString();
    await sql`
      insert into customer_password_resets (token, customer_id, expires_at)
      values (${token}, ${c.id}::uuid, ${expiresAt})
      on conflict (token) do nothing
    `;

    const resetUrl = buildResetUrl(token);
    if (!resetUrl) return sendJson(res, 500, { ok: false, error: 'base_url_not_configured' });

    const mailR = await sendMail({
      to: email,
      subject: '重設密碼連結',
      text: `請打開以下連結重設密碼：\n${resetUrl}\n\n如你冇要求重設密碼，請忽略此電郵。`,
      html: `<p>請打開以下連結重設密碼：</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>如你冇要求重設密碼，請忽略此電郵。</p>`
    });
    if (!mailR || !mailR.ok) return sendJson(res, 500, { ok: false, error: (mailR && mailR.error) || 'email_send_failed' });

    return sendJson(res, 200, { ok: true });
  } catch (e) {
    return sendJson(res, 400, { ok: false, error: 'bad_request' });
  }
}

async function resetPasswordHandler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  try {
    const body = await readJsonBody(req);
    const token = requiredString(body.token, 'token');
    const newPassword = requiredString(body.newPassword, 'newPassword');

    const r = await sql`
      select token, customer_id, expires_at, used_at
      from customer_password_resets
      where token = ${token}
      limit 1
    `;
    const row = r.rows[0];
    if (!row) return sendJson(res, 400, { ok: false, error: 'invalid_token' });
    if (row.used_at) return sendJson(res, 400, { ok: false, error: 'token_used' });
    if (new Date(row.expires_at).getTime() <= Date.now()) return sendJson(res, 400, { ok: false, error: 'token_expired' });

    const pwdHash = await hashPassword(newPassword);
    await sql`update customers set pwd_hash = ${pwdHash}, is_registered = true where id = ${row.customer_id}::uuid`;
    await sql`update customer_password_resets set used_at = now() where token = ${token} and used_at is null`;
    await sql`delete from customer_sessions where customer_id = ${row.customer_id}::uuid`;

    return sendJson(res, 200, { ok: true });
  } catch (e) {
    return sendJson(res, 400, { ok: false, error: 'bad_request' });
  }
}

// ============================================================
// 8. 會員中心（增強版）
// ============================================================
async function meHandler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  const session = await requireCustomerSession(req, res);
  if (!session) return;

  try {
    const customer = await sql`
      SELECT
        c.id, c.company_name, c.contact_name, c.phone, c.email,
        c.total_amount, c.total_points, c.is_promoter, c.promoter_time,
        c.spread_uid, c.level_id,
        cl.display_name as level_name,
        cl.discount_rate as level_discount
      FROM customers c
      LEFT JOIN customer_levels cl ON cl.id = c.level_id
      WHERE c.id = ${session.customerId}::uuid
    `;

    const c = customer.rows[0];
    if (!c) return sendJson(res, 404, { ok: false, error: 'not_found' });

    // 傭金帳戶（如有）
    let brokerage = null;
    if (c.is_promoter) {
      const ba = await sql`
        SELECT available_amount, frozen_amount, total_earned, total_withdrawn
        FROM brokerage_accounts
        WHERE account_id = ${session.customerId}::uuid AND account_type = 'customer'
      `;
      if (ba.rows[0]) {
        brokerage = {
          availableAmount: Number(ba.rows[0].available_amount),
          frozenAmount: Number(ba.rows[0].frozen_amount),
          totalEarned: Number(ba.rows[0].total_earned),
          totalWithdrawn: Number(ba.rows[0].total_withdrawn)
        };
      }
    }

    // 上級推廣人
    let spreadName = null;
    if (c.spread_uid) {
      const spread = await sql`SELECT company_name FROM customers WHERE id = ${c.spread_uid}::uuid`;
      spreadName = spread.rows[0]?.company_name || null;
    }

    // 推廣員資格狀態
    let promoterStatus = null;
    if (!c.is_promoter) {
      const { checkPromoterQualification } = require('../src/services/brokerage');
      promoterStatus = await checkPromoterQualification(session.customerId);
    }

    return sendJson(res, 200, {
      ok: true,
      customer: {
        id: c.id,
        companyName: c.company_name,
        contactName: c.contact_name,
        phone: c.phone,
        email: c.email,
        totalAmount: Number(c.total_amount),
        totalPoints: Number(c.total_points || 0),
        isPromoter: c.is_promoter,
        promoterTime: c.promoter_time,
        levelName: c.level_name || '普通會員',
        levelDiscount: Number(c.level_discount || 1.0),
        spreadName,
        promoterStatus
      },
      brokerage
    });
  } catch (e) {
    return sendJson(res, 500, { ok: false, error: 'server_error', message: String(e && e.message ? e.message : e) });
  }
}

// ============================================================
// 9. 積分明細
// ============================================================
async function pointsHistoryHandler(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  const session = await requireCustomerSession(req, res);
  if (!session) return;

  const url = new URL(req.url, 'http://localhost');
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
  const offset = (page - 1) * limit;

  try {
    // 從 ledger 查詢積分流水
    const { LEDGER_TYPES } = require('../src/lib/ledger');
    const integralTypes = Object.values(LEDGER_TYPES.INTEGRAL || {});

    const countR = await sql`
      SELECT COUNT(*) as total FROM ledger
      WHERE account_id = ${session.customerId}::uuid
        AND account_type = 'customer'
        AND type LIKE 'integral_%'
    `;
    const total = Number(countR.rows[0].total);

    const entries = await sql`
      SELECT id, type, pm, amount, balance_after, title, order_id, created_at
      FROM ledger
      WHERE account_id = ${session.customerId}::uuid
        AND account_type = 'customer'
        AND type LIKE 'integral_%'
      ORDER BY created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    return sendJson(res, 200, {
      ok: true,
      entries: entries.rows.map(e => ({
        id: e.id,
        type: e.type,
        pm: e.pm,
        amount: Number(e.amount),
        balanceAfter: Number(e.balance_after),
        title: e.title,
        orderId: e.order_id,
        createdAt: e.created_at
      })),
      total,
      page,
      limit
    });
  } catch (e) {
    return sendJson(res, 500, { ok: false, error: 'server_error', message: String(e && e.message ? e.message : e) });
  }
}

// ============================================================
// 10. 確認收貨
// ============================================================
async function markReceivedHandler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  const session = await requireCustomerSession(req, res);
  if (!session) return;

  try {
    const raw = await readBody(req);
    const body = raw ? JSON.parse(raw) : {};
    const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : '';
    if (!orderId) return sendJson(res, 400, { ok: false, error: 'orderId_required' });

    const order = await sql`
      SELECT id, status, customer_id
      FROM orders
      WHERE id = ${orderId}::uuid AND customer_id = ${session.customerId}::uuid
      LIMIT 1
    `;
    if (!order.rows[0]) return sendJson(res, 404, { ok: false, error: 'not_found' });
    if (order.rows[0].status !== '已發貨') {
      return sendJson(res, 400, { ok: false, error: 'status_not_shipped', message: '只有已發貨的訂單才能確認收貨' });
    }

    const updated = await sql`
      UPDATE orders
      SET status = '已完成', received_at = NOW()
      WHERE id = ${orderId}::uuid
      RETURNING id, status, received_at
    `;
    const row = updated.rows[0];

    // 觸發後續流程：結算傭金、計算積分、升級會員
    const orderData = await sql`SELECT * FROM orders WHERE id = ${orderId}::uuid`;
    if (orderData.rows[0]) {
      const { settleOrderBrokerage } = require('../src/services/brokerage');
      const { addPoints, computeOrderPoints } = require('../src/services/points');
      const { upgradeCustomerLevel } = require('../src/services/member');

      const orderAmount = Number(orderData.rows[0].amount || 0);
      if (orderAmount > 0) {
        await settleOrderBrokerage(orderData.rows[0], orderAmount);
        const points = computeOrderPoints(orderAmount);
        if (points > 0) {
          await addPoints(session.customerId, points, 'order_pay', `訂單完成獎勵`, { orderId });
        }
        await upgradeCustomerLevel(session.customerId);
      }
    }

    const { emit, EVENTS } = require('../src/lib/events');
    emit(EVENTS.ORDER_COMPLETED, { orderId, customerId: session.customerId, receivedAt: row.received_at });

    return sendJson(res, 200, {
      ok: true,
      orderId: row.id,
      status: row.status,
      receivedAt: row.received_at
    });
  } catch (e) {
    return sendJson(res, 400, { ok: false, error: 'bad_request', message: String(e && e.message ? e.message : e) });
  }
}

// ============================================================
// 11. 取消訂單（限極早期）
// ============================================================
async function cancelOrderHandler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  const session = await requireCustomerSession(req, res);
  if (!session) return;

  try {
    const raw = await readBody(req);
    const body = raw ? JSON.parse(raw) : {};
    const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : '';
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';

    if (!orderId) return sendJson(res, 400, { ok: false, error: 'orderId_required' });

    const order = await sql`
      SELECT id, status, customer_id, paid
      FROM orders
      WHERE id = ${orderId}::uuid AND customer_id = ${session.customerId}::uuid
      LIMIT 1
    `;
    if (!order.rows[0]) return sendJson(res, 404, { ok: false, error: 'not_found' });

    const CANCELLABLE = ['客戶已提交', '待確認報價', '待確認樣板'];
    if (!CANCELLABLE.includes(order.rows[0].status)) {
      return sendJson(res, 400, { ok: false, error: 'cannot_cancel', message: `當前狀態「${order.rows[0].status}」無法取消` });
    }
    if (order.rows[0].paid === 1) {
      return sendJson(res, 400, { ok: false, error: 'paid_order_cannot_cancel', message: '已付款訂單請聯繫客服處理' });
    }

    const updated = await sql`
      UPDATE orders
      SET status = '已取消'
      WHERE id = ${orderId}::uuid
      RETURNING id, status
    `;
    const row = updated.rows[0];

    const { emit, EVENTS } = require('../src/lib/events');
    emit(EVENTS.ORDER_CANCELLED, { orderId, customerId: session.customerId, reason: reason || '客戶主動取消' });

    return sendJson(res, 200, {
      ok: true,
      orderId: row.id,
      status: row.status
    });
  } catch (e) {
    return sendJson(res, 400, { ok: false, error: 'bad_request', message: String(e && e.message ? e.message : e) });
  }
}

// ============================================================
// 12. 推廣員申請
// ============================================================
async function becomePromoterHandler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  const session = await requireCustomerSession(req, res);
  if (!session) return;

  try {
    const { becomePromoter } = require('../src/services/member');
    const result = await becomePromoter(session.customerId);
    return sendJson(res, 200, result);
  } catch (e) {
    return sendJson(res, 400, { ok: false, error: 'bad_request', message: String(e && e.message ? e.message : e) });
  }
}

// ============================================================
// 13. 傭金流水（推廣員）
// ============================================================
async function brokerageHistoryHandler(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  const session = await requireCustomerSession(req, res);
  if (!session) return;

  const url = new URL(req.url, 'http://localhost');
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
  const offset = (page - 1) * limit;

  try {
    const { getBrokerageLedger } = require('../src/services/brokerage');
    const result = await getBrokerageLedger(session.customerId, page, limit);
    return sendJson(res, 200, {
      ok: true,
      entries: result.entries.map(e => ({
        id: e.id,
        type: e.ledger_type,
        pm: e.pm,
        amount: Number(e.amount),
        balanceAfter: Number(e.balance_after),
        title: e.title,
        orderSn: e.order_sn || '',
        createdAt: e.created_at
      })),
      total: result.total,
      page,
      limit,
      account: result.available ? {
        availableAmount: Number(result.available.available_amount),
        frozenAmount: Number(result.available.frozen_amount),
        totalEarned: Number(result.available.total_earned)
      } : null
    });
  } catch (e) {
    return sendJson(res, 500, { ok: false, error: 'server_error', message: String(e && e.message ? e.message : e) });
  }
}

module.exports = async function handler(req, res) {
  await ensureMigrations();
  const url = new URL(req.url, 'http://localhost');
  const action = (url.searchParams.get('action') || '').trim();

  if (action === 'register') return registerHandler(req, res);
  if (action === 'login') return loginHandler(req, res);
  if (action === 'logout') return logoutHandler(req, res);
  if (action === 'me') return meHandler(req, res);
  if (action === 'requestPasswordReset') return requestPasswordResetHandler(req, res);
  if (action === 'resetPassword') return resetPasswordHandler(req, res);
  if (action === 'pointsHistory') return pointsHistoryHandler(req, res);
  if (action === 'markReceived') return markReceivedHandler(req, res);
  if (action === 'cancelOrder') return cancelOrderHandler(req, res);
  if (action === 'becomePromoter') return becomePromoterHandler(req, res);
  if (action === 'brokerageHistory') return brokerageHistoryHandler(req, res);

  return sendJson(res, 404, { ok: false, error: 'not_found' });
};
