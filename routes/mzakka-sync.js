module.exports = function registerMzakkaSyncRoutes(app, pool) {
  const { requirePermission } = require('./middleware/auth');
  const { bootstrapCoreSchema } = require('../utils/dbBootstrap');
  const { normalizeSyncOptions, syncMzakkaNewItemsToDb } = require('../utils/mzakkaSync');

  function getConfiguredSyncSecrets() {
    return Array.from(new Set(
      [process.env.MZAKKA_SYNC_SECRET, process.env.CRON_SECRET]
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter(Boolean)
    ));
  }

  function getSyncSecretFromRequest(req) {
    const headerSecret = req.get('x-sync-secret');
    if (headerSecret) return String(headerSecret);
    const auth = req.get('authorization') || '';
    const match = auth.match(/^Bearer\s+(.+)$/i);
    return match ? String(match[1]) : '';
  }

  function ensurePool(res) {
    if (pool) return true;
    res.status(500).json({ error: 'DATABASE_URL not configured' });
    return false;
  }

  async function handleSync(req, res, source) {
    if (!ensurePool(res)) return;
    try {
      const options = normalizeSyncOptions({
        ...(req.query || {}),
        ...(req.body || {}),
      });
      const result = await syncMzakkaNewItemsToDb({
        pool,
        ...options,
      });
      res.json({ ok: true, source, result });
    } catch (err) {
      console.error('Mzakka sync failed:', err);
      res.status(500).json({
        ok: false,
        error: String((err && err.message) || err),
      });
    }
  }

  function ensureInternalSyncAuthorized(req, res) {
    const expectedSecrets = getConfiguredSyncSecrets();
    if (expectedSecrets.length === 0) {
      res.status(503).json({ error: 'MZAKKA_SYNC_SECRET or CRON_SECRET not configured' });
      return false;
    }
    const provided = getSyncSecretFromRequest(req);
    if (!provided || !expectedSecrets.includes(provided)) {
      res.status(401).json({ error: 'Invalid sync secret' });
      return false;
    }
    return true;
  }

  app.post('/api/admin/catalog/mzakka-sync', requirePermission('catalog:write'), async (req, res) => {
    await handleSync(req, res, 'admin');
  });

  async function handleInternalSync(req, res) {
    if (!ensureInternalSyncAuthorized(req, res)) return;
    await handleSync(req, res, 'internal');
  }

  async function handleInternalBootstrap(req, res) {
    if (!ensurePool(res)) return;
    if (!ensureInternalSyncAuthorized(req, res)) return;
    try {
      const result = await bootstrapCoreSchema(pool);
      res.json({ ok: true, source: 'internal', result });
    } catch (err) {
      console.error('DB bootstrap failed:', err);
      res.status(500).json({
        ok: false,
        error: String((err && err.message) || err),
      });
    }
  }

  // 純匯入端點：只做 upsert、唔爬網。畀本機長時間爬好嘅細批上傳，
  // 避開 serverless 爬網 timeout。需要有效 sync secret。
  async function handleInternalImport(req, res) {
    if (!ensureInternalSyncAuthorized(req, res)) return;
    if (!ensurePool(res)) return;
    try {
      const body = req.body || {};
      const records = Array.isArray(body.records) ? body.records.filter(Boolean) : [];
      const batchSize = Number(body.batchSize) > 0 ? Number(body.batchSize) : 100;
      if (records.length === 0) {
        return res.status(400).json({ ok: false, error: 'records array is required' });
      }
      const { importMzakkaRecords } = require('../scripts/import-mzakka-to-postgres');
      const result = await importMzakkaRecords({ records, batchSize, pool });
      return res.json({ ok: true, source: 'internal-import', received: records.length, result });
    } catch (err) {
      console.error('Mzakka import failed:', err);
      return res.status(500).json({ ok: false, error: String((err && err.message) || err) });
    }
  }

  app.get('/api/internal/jobs/mzakka-sync', handleInternalSync);
  app.post('/api/internal/jobs/mzakka-sync', handleInternalSync);
  app.post('/api/internal/jobs/mzakka-import', handleInternalImport);
  app.get('/api/internal/jobs/db-bootstrap', handleInternalBootstrap);
  app.post('/api/internal/jobs/db-bootstrap', handleInternalBootstrap);
};
