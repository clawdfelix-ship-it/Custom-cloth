const fs = require('node:fs');
const path = require('node:path');

const { crawlMzakkaNewItems } = require('../scripts/crawl-mzakka-new-items');
const { fetchHtml } = require('../scripts/fetch-mzakka-description');
const { importMzakkaRecords } = require('../scripts/import-mzakka-to-postgres');
const { parseMzakkaHomePage } = require('./mzakkaNewItems');

function toPositiveInt(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function toNonNegativeInt(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.floor(n);
}

function toBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  const s = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(s)) return true;
  if (['0', 'false', 'no', 'off'].includes(s)) return false;
  return fallback;
}

function normalizeSyncOptions(input = {}) {
  return {
    categoryId: toPositiveInt(input.categoryId || input.category_id, 1894),
    startPage: toPositiveInt(input.startPage || input.start_page, 1),
    pages: toPositiveInt(input.pages, 1),
    limit: toNonNegativeInt(input.limit, 0),
    delayMs: toNonNegativeInt(input.delayMs || input.delay_ms, 150),
    includeEnded: toBoolean(input.includeEnded || input.include_ended, false),
    batchSize: toPositiveInt(input.batchSize || input.batch_size, 100),
    syncHomeModules: toBoolean(input.syncHomeModules || input.sync_home_modules, true),
    homeUrl: typeof input.homeUrl === 'string' && input.homeUrl.trim()
      ? input.homeUrl.trim()
      : 'https://mzakka.com/',
    debugJsonlPath: typeof input.debugJsonlPath === 'string' && input.debugJsonlPath.trim()
      ? input.debugJsonlPath.trim()
      : '',
  };
}

function writeJsonlFile(records, filePath) {
  const resolved = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  const body = records.map((record) => JSON.stringify(record)).join('\n');
  fs.writeFileSync(resolved, body ? `${body}\n` : '', 'utf8');
  return resolved;
}

function createMzakkaSyncService(deps = {}) {
  const crawl = deps.crawlMzakkaNewItems || crawlMzakkaNewItems;
  const importRecords = deps.importMzakkaRecords || importMzakkaRecords;
  const fetchHomeHtml = deps.fetchHtml || fetchHtml;
  const parseHome = deps.parseMzakkaHomePage || parseMzakkaHomePage;

  async function replaceHomeModules(pool, homeUrl) {
    if (!pool) {
      throw new Error('DATABASE_URL not configured');
    }

    const html = await fetchHomeHtml(homeUrl);
    const parsed = parseHome(html, { baseUrl: homeUrl });
    const modules = Array.isArray(parsed.modules) ? parsed.modules : [];
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM mzakka_home_modules');
      for (const module of modules) {
        await client.query(
          `INSERT INTO mzakka_home_modules
            (module_key, module_type, title, subtitle, image_url, target_url, payload_json, sort_order, is_active, source_url, last_synced_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7::json, $8, true, $9, NOW(), NOW())`,
          [
            module.moduleKey,
            module.moduleType,
            module.title || null,
            module.subtitle || null,
            module.imageUrl || null,
            module.targetUrl || null,
            JSON.stringify(module.payload || {}),
            Number(module.sortOrder || 0),
            homeUrl,
          ]
        );
      }
      await client.query(
        `INSERT INTO mzakka_sync_snapshots
          (snapshot_type, source_key, source_url, raw_html, parsed_json, error_text)
         VALUES ($1, $2, $3, $4, $5::json, NULL)`,
        ['home', 'mzakka-home', homeUrl, html, JSON.stringify({ modules })]
      );
      await client.query('COMMIT');
      return {
        sourceUrl: homeUrl,
        modulesUpserted: modules.length,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async function syncMzakkaNewItemsToDb(options = {}) {
    const normalized = normalizeSyncOptions(options);
    const crawlResult = await crawl({
      categoryId: normalized.categoryId,
      startPage: normalized.startPage,
      pages: normalized.pages,
      limit: normalized.limit,
      delayMs: normalized.delayMs,
      includeEnded: normalized.includeEnded,
    });

    const records = Array.isArray(crawlResult.records) ? crawlResult.records : [];
    const debugJsonlPath = normalized.debugJsonlPath
      ? writeJsonlFile(records, normalized.debugJsonlPath)
      : null;

    let importResult = {
      mode: 'import',
      linesRead: 0,
      categoriesUpserted: 0,
      productsUpserted: 0,
      skusUpserted: 0,
    };

    if (records.length > 0) {
      importResult = await importRecords({
        records,
        batchSize: normalized.batchSize,
        pool: options.pool,
      });
    }

    const homeModules = normalized.syncHomeModules
      ? await replaceHomeModules(options.pool, normalized.homeUrl)
      : { skipped: true, sourceUrl: normalized.homeUrl, modulesUpserted: 0 };

    return {
      categoryId: normalized.categoryId,
      startPage: normalized.startPage,
      pagesRequested: normalized.pages,
      pagesFetched: crawlResult.pagesFetched || 0,
      pageNumbers: crawlResult.pageNumbers || [],
      totalPages: crawlResult.totalPages || 0,
      listItemsSeen: crawlResult.listItemsSeen || 0,
      recordsFetched: records.length,
      includeEnded: normalized.includeEnded,
      batchSize: normalized.batchSize,
      debugJsonlPath,
      syncHomeModules: normalized.syncHomeModules,
      homeModules,
      import: importResult,
    };
  }

  return {
    replaceHomeModules,
    syncMzakkaNewItemsToDb,
  };
}

const defaultService = createMzakkaSyncService();

module.exports = {
  createMzakkaSyncService,
  normalizeSyncOptions,
  syncMzakkaNewItemsToDb: defaultService.syncMzakkaNewItemsToDb,
  writeJsonlFile,
};
