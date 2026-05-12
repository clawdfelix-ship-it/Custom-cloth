const { sql } = require('../src/lib/db');
const { sendJson } = require('../src/lib/http');
const { requireAdmin } = require('../src/lib/auth');

module.exports = async function(req, res, url) {
  const session = await requireAdmin(req, res);
  if (!session) return;
  return sendJson(res, 200, { ok: true, userId: session.userId });
};
