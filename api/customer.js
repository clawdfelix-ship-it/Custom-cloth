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
    const u = new URL('/', base);
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

  return sendJson(res, 404, { ok: false, error: 'not_found' });
};
