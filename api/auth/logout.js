const { sql } = require('../../src/lib/db');
const { sendJson } = require('../../src/lib/http');
const { getBearerToken } = require('../../src/lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  const token = getBearerToken(req.headers.authorization);
  if (token) await sql`delete from sessions where token = ${token}`;
  return sendJson(res, 200, { ok: true });
};

