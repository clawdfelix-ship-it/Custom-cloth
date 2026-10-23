// Internal cron endpoint that flushes the email outbox via Zoho SMTP.
// Registered in vercel.json crons. Auth via CRON_SECRET (header/bearer) or
// Vercel's automatic `x-vercel-cron` header on its own scheduled calls.
'use strict';

module.exports = function registerOutboxRoutes(app, pool) {
  const { flushOutbox } = require('../utils/outboxWorker');

  function getExpectedSecrets() {
    return Array.from(new Set(
      [process.env.MZAKKA_SYNC_SECRET, process.env.CRON_SECRET]
        .map((v) => (typeof v === 'string' ? v.trim() : ''))
        .filter(Boolean)
    ));
  }

  function isAuthorized(req) {
    // Vercel-invoked cron requests carry this header.
    if (String(req.get('x-vercel-cron') || '') === '1') return true;

    const secrets = getExpectedSecrets();
    if (secrets.length === 0) return false;

    const headerSecret = req.get('x-sync-secret');
    if (headerSecret && secrets.includes(String(headerSecret))) return true;

    const auth = req.get('authorization') || '';
    const match = auth.match(/^Bearer\s+(.+)$/i);
    return Boolean(match && secrets.includes(String(match[1])));
  }

  async function handle(req, res) {
    if (!isAuthorized(req)) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    if (!pool) {
      return res.status(503).json({ error: 'DATABASE_URL not configured' });
    }
    try {
      const summary = await flushOutbox(pool, {
        limit: parseInt(req.query.limit || '20', 10),
        maxRuntimeMs: parseInt(req.query.maxMs || '50000', 10),
      });
      res.json({ ok: true, summary });
    } catch (err) {
      console.error('outbox flush failed:', err);
      res.status(500).json({ ok: false, error: String((err && err.message) || err) });
    }
  }

  app.get('/api/internal/jobs/email-outbox', handle);
  app.post('/api/internal/jobs/email-outbox', handle);
};
