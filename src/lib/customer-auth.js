const crypto = require('node:crypto');
const { sql } = require('./db');
const { getBearerToken } = require('./auth');

function newCustomerToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function requireCustomerSession(req) {
  const token = getBearerToken(req.headers.authorization);
  if (!token) return null;
  const r = await sql`
    select s.token, s.expires_at, c.id as customer_id, c.email, c.company_name, c.contact_name, c.phone, c.address
    from customer_sessions s
    join customers c on c.id = s.customer_id
    where s.token = ${token}
  `;
  const row = r.rows[0];
  if (!row) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) return null;
  return {
    token: row.token,
    customerId: row.customer_id,
    email: row.email || '',
    companyName: row.company_name,
    contactName: row.contact_name || '',
    phone: row.phone,
    address: row.address || ''
  };
}

module.exports = { newCustomerToken, requireCustomerSession };
