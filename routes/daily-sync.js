'use strict';

/**
 * routes/daily-sync.js
 *
 * 每日自動同步嘅內部 cron endpoints（同 mzakka-sync 共用 CRON_SECRET 認證）：
 *   GET /api/internal/jobs/daily-sync/refresh  → phase 1：爬 1789 全頁＋更新待匯佇列
 *   GET /api/internal/jobs/daily-sync/process  → phase 2：匯入新品＋重建排行榜
 */

module.exports = function registerDailySyncRoutes(app, pool) {
  const { refreshArrivalOrder, processPendingAndRebuild } = require('../utils/dailySync');

  function getConfiguredSecrets() {
    return Array.from(
      new Set(
        [process.env.MZAKKA_SYNC_SECRET, process.env.CRON_SECRET]
          .map((v) => (typeof v === 'string' ? v.trim() : ''))
          .filter(Boolean)
      )
    );
  }

  function getProvidedSecret(req) {
    const headerSecret = req.get('x-sync-secret');
    if (headerSecret) return String(headerSecret);
    const auth = req.get('authorization') || '';
    const m = auth.match(/^Bearer\s+(.+)$/i);
    return m ? String(m[1]) : '';
  }

  function ensureAuthorized(req, res) {
    if (!pool) {
      res.status(500).json({ error: 'DATABASE_URL not configured' });
      return false;
    }
    const expected = getConfiguredSecrets();
    if (expected.length === 0) {
      res.status(503).json({ error: 'MZAKKA_SYNC_SECRET or CRON_SECRET not configured' });
      return false;
    }
    const provided = getProvidedSecret(req);
    if (!provided || !expected.includes(provided)) {
      res.status(401).json({ error: 'Invalid sync secret' });
      return false;
    }
    return true;
  }

  async function run(req, res, phase) {
    if (!ensureAuthorized(req, res)) return;
    try {
      const result = phase === 'refresh'
        ? await refreshArrivalOrder(pool)
        : await processPendingAndRebuild(pool);
      res.json({ ok: true, phase, result });
    } catch (err) {
      console.error(`Daily sync ${phase} failed:`, err);
      res.status(500).json({ ok: false, phase, error: String((err && err.message) || err) });
    }
  }

  app.get('/api/internal/jobs/daily-sync/refresh', (req, res) => run(req, res, 'refresh'));
  app.post('/api/internal/jobs/daily-sync/refresh', (req, res) => run(req, res, 'refresh'));
  app.get('/api/internal/jobs/daily-sync/process', (req, res) => run(req, res, 'process'));
  app.post('/api/internal/jobs/daily-sync/process', (req, res) => run(req, res, 'process'));
};
