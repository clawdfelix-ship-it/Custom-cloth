const { sql } = require('@vercel/postgres');
const { getBearerToken } = require('../../../src/lib/auth');

const STATUS = ['received', 'follow_up', 'confirmed', 'production', 'shipping', 'done', 'cancelled'];

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });

  const token = getBearerToken(req.headers.authorization);
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) return sendJson(res, 401, { ok: false, error: 'unauthorized' });

  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', async () => {
    try {
      const body = raw ? JSON.parse(raw) : {};
      const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : '';
      const status = typeof body.status === 'string' ? body.status.trim() : '';
      if (!orderId) return sendJson(res, 400, { ok: false, error: 'orderId_required' });
      if (!STATUS.includes(status)) return sendJson(res, 400, { ok: false, error: 'status_invalid' });

      const updated = await sql`
        update orders
        set status = ${status}, updated_at = now()
        where id = ${orderId}::uuid
        returning id, status
      `;

      const row = updated.rows[0];
      if (!row) return sendJson(res, 404, { ok: false, error: 'not_found' });
      return sendJson(res, 200, { ok: true, orderId: row.id, status: row.status });
    } catch (e) {
      return sendJson(res, 400, { ok: false, error: 'bad_request' });
    }
  });
};

