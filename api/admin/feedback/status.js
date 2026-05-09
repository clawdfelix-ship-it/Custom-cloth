const { sql } = require('../../../src/lib/db');
const { sendJson, readBody } = require('../../../src/lib/http');
const { requireSession } = require('../../../src/lib/auth');
const { FEEDBACK_STATUS } = require('../../../src/lib/schema');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });

  const session = await requireSession(req);
  if (!session || session.role !== 'admin') return sendJson(res, 401, { ok: false, error: 'unauthorized' });

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
    return sendJson(res, 200, { ok: true, feedbackId: row.id, status: row.status });
  } catch (e) {
    return sendJson(res, 400, { ok: false, error: 'bad_request' });
  }
};

