'use strict';

/**
 * dailySync.js
 *
 * 每日自動同步（Vercel cron 兩個 phase，遷就 Hobby 60s 函數上限）：
 *
 * phase 1 — refreshArrivalOrder(pool)
 *   並行爬 mzakka「新商品」1789 全部頁（文檔次序），全量替換 new_arrival_order；
 *   再同店內 products 比對：缺嘅塞入 sync_pending_items，已返貨嘅移出佇列。
 *
 * phase 2 — processPendingAndRebuild(pool)
 *   喺時間預算內並行爬 pending item 詳情＋upsert 落店（同 lean-import 同一套），
 *   成功移出佇列、失敗記 attempts；最後由 new_arrival_order 重建 new_arrival_rank。
 *   一個 item 重試 3 次仍失敗就唔會再揀（死信），避免壞 item 阻塞每日同步。
 */

const https = require('node:https');
const {
  toProductUpsertInput,
  toProductMediaRows,
  toProductSectionRows,
  toSkuUpsertInput,
} = require('../utils/mzakkaImport');
const { resolveItemNode, loadDbNodeMap } = require('../utils/mzakkaCategoryResolver');
const { parseMzakkaDetailPage } = require('../utils/mzakkaNewItems');
const { extractDescriptionFromDetailHtml } = require('../scripts/fetch-mzakka-description');
const { extractItemLinks, extractPaging } = require('../scripts/lib/mzakka-taxonomy');

const NEW_NODE = 1789;
const PAGE_CONCURRENCY = 8;
const ITEM_CONCURRENCY = 5;
const PHASE2_DEADLINE_MS = 46 * 1000; // 函數 60s，留返尾位做 rank 重建＋回應
const MAX_ATTEMPTS = 3;
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function httpGet(url, { timeoutMs = 20000 } = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        timeout: timeoutMs,
        headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'ja-JP,ja;q=0.9' },
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        let body = '';
        res.on('data', (d) => (body += d));
        res.on('end', () => resolve(body));
      }
    );
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

async function withRetries(fn, retries, label) {
  let lastErr;
  for (let a = 0; a <= retries; a++) {
    try {
      return await fn(a);
    } catch (err) {
      lastErr = err;
      await sleep(400 * (a + 1));
    }
  }
  throw lastErr && lastErr.message ? lastErr : new Error(`${label}: failed`);
}

async function poolMap(items, limit, worker) {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      await worker(items[idx], idx);
    }
  });
  await Promise.all(runners);
}

async function fetchCategoryPages() {
  const firstHtml = await withRetries(() => httpGet(categoryUrl(0)), 3, 'page 0');
  const paging = extractPaging(firstHtml);
  const pages = paging.pages || 1;
  const htmlByPage = new Map();
  htmlByPage.set(0, firstHtml);

  const rest = Array.from({ length: pages - 1 }, (_, i) => i + 1);
  let failures = 0;
  await poolMap(rest, PAGE_CONCURRENCY, async (p1) => {
    try {
      const html = await withRetries(() => httpGet(categoryUrl(p1)), 2, `page ${p1}`);
      htmlByPage.set(p1, html);
    } catch (err) {
      failures++;
      console.warn(`page ${p1} gave up: ${err.message || err}`);
    }
  });

  const coverage = htmlByPage.size / pages;
  return { pages, htmlByPage, coverage };
}

function categoryUrl(p1) {
  return `https://mzakka.com/pc/detail/category.php?category=${NEW_NODE}&p1=${p1}`;
}

function documentOrder(htmlByPage, pages) {
  const items = [];
  const seen = new Set();
  for (let p1 = 0; p1 < pages; p1++) {
    const html = htmlByPage.get(p1);
    if (!html) continue; // 缺頁：保持已有次序，唔補位
    for (const lk of extractItemLinks(html)) {
      if (!seen.has(lk.itemId)) {
        seen.add(lk.itemId);
        items.push(lk.itemId);
      }
    }
  }
  return items;
}

// phase 1
async function refreshArrivalOrder(pool) {
  const t0 = Date.now();
  const { pages, htmlByPage, coverage } = await fetchCategoryPages();
  if (coverage < 0.98) {
    throw new Error(`coverage too low: ${htmlByPage.size}/${pages} — keep 舊排行榜，聽日再試`);
  }
  const items = documentOrder(htmlByPage, pages);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('TRUNCATE new_arrival_order');
    for (let i = 0; i < items.length; i += 2000) {
      const slice = items.slice(i, i + 2000);
      const ph = slice.map((_, j) => `($${j * 2 + 1}, $${j * 2 + 2})`).join(',');
      const vals = [];
      slice.forEach((id, j) => {
        vals.push(id, i + j + 1);
      });
      await client.query(
        `INSERT INTO new_arrival_order(item_id, rank) VALUES ${ph}`,
        vals
      );
    }

    // pending：排行榜有、店內冇 → 入佇列；pending 但已返貨 → 移出
    await client.query(
      `INSERT INTO sync_pending_items(item_id, rank)
       SELECT o.item_id, o.rank
       FROM new_arrival_order o
       LEFT JOIN products p ON p.slug = 'mzakka-' || lower(o.item_id)
       WHERE p.id IS NULL
       ON CONFLICT (item_id) DO UPDATE SET rank = EXCLUDED.rank, updated_at = NOW()`
    );
    await client.query(
      `DELETE FROM sync_pending_items sp
       USING products p
       WHERE p.slug = 'mzakka-' || lower(sp.item_id)`
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  const { rows } = await pool.query(
    `SELECT count(*)::int AS n,
            count(*) FILTER (WHERE attempts < $1)::int AS live
     FROM sync_pending_items`,
    [MAX_ATTEMPTS]
  );
  return {
    pages,
    items: items.length,
    coverage,
    pendingTotal: rows[0].n,
    pendingLive: rows[0].live,
    elapsedMs: Date.now() - t0,
  };
}

async function importItem(dbClient, item, categoryId, dbNodeMap) {
  const { nodeId } = resolveItemNode(item);
  const resolvedCategoryId = categoryId != null ? categoryId : (nodeId != null ? dbNodeMap.get(nodeId) || null : null);
  const p = toProductUpsertInput(item, resolvedCategoryId);
  const productStatus = item.isEnded ? 'inactive' : 'active';

  await dbClient.query(
    `INSERT INTO products
     (name,name_zh_hk,slug,description,description_zh_hk,short_description_zh_hk,
      price,original_price,category_id,image_url,gallery_images,status,
      source,source_key,source_url,sync_status,raw_payload)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::json,$12,$13,$14,$15,$16,$17::json)
     ON CONFLICT (slug) DO UPDATE SET
       name=EXCLUDED.name,name_zh_hk=EXCLUDED.name_zh_hk,
       description=EXCLUDED.description,description_zh_hk=EXCLUDED.description_zh_hk,
       price=EXCLUDED.price,original_price=EXCLUDED.original_price,
       category_id=COALESCE(EXCLUDED.category_id, products.category_id),
       image_url=EXCLUDED.image_url,gallery_images=EXCLUDED.gallery_images,
       source_url=EXCLUDED.source_url,raw_payload=EXCLUDED.raw_payload,
       status=CASE WHEN EXCLUDED.raw_payload->>'isEnded'='true' THEN 'inactive' ELSE 'active' END,
       updated_at=NOW()
     RETURNING id`,
    [
      p.name, p.name_zh_hk, p.slug, p.description, p.description_zh_hk, p.short_description_zh_hk,
      p.price, p.original_price, resolvedCategoryId, p.image_url,
      JSON.stringify(p.gallery_images || []), productStatus, p.source, p.source_key,
      p.source_url, p.sync_status, JSON.stringify(p.raw_payload || {}),
    ]
  );
  const pr = await dbClient.query('SELECT id FROM products WHERE slug=$1', [p.slug]);
  const pid = pr.rows[0].id;

  const s = toSkuUpsertInput(item, pid);
  await dbClient.query(
    `INSERT INTO product_skus(product_id,sku,attributes,stock,is_active)
     VALUES($1,$2,$3::json,$4,$5)
     ON CONFLICT(sku) DO UPDATE SET product_id=EXCLUDED.product_id,
       attributes=EXCLUDED.attributes,stock=EXCLUDED.stock,is_active=EXCLUDED.is_active,
       updated_at=NOW()`,
    [s.product_id, s.sku, JSON.stringify(s.attributes), s.stock, s.is_active]
  );

  const media = toProductMediaRows(item, pid);
  await dbClient.query('DELETE FROM mzakka_product_media WHERE product_id=$1', [pid]);
  if (media.length) {
    const ph = media
      .map((_, j) => `($${j * 6 + 1},$${j * 6 + 2},$${j * 6 + 3},$${j * 6 + 4},$${j * 6 + 5},$${j * 6 + 6})`)
      .join(',');
    const ap = [];
    media.forEach((m) => ap.push(m.product_id, m.media_url, m.media_type, m.alt_text, m.sort_order, m.source_key));
    await dbClient.query(
      `INSERT INTO mzakka_product_media(product_id,media_url,media_type,alt_text,sort_order,source_key) VALUES ${ph}`,
      ap
    );
  }

  const secs = toProductSectionRows(item, pid);
  await dbClient.query('DELETE FROM mzakka_product_sections WHERE product_id=$1', [pid]);
  if (secs.length) {
    const ph = secs
      .map(
        (_, j) =>
          `($${j * 8 + 1},$${j * 8 + 2},$${j * 8 + 3},$${j * 8 + 4},$${j * 8 + 5},$${j * 8 + 6},$${j * 8 + 7}::json,$${j * 8 + 8})`
      )
      .join(',');
    const ap = [];
    secs.forEach((x) =>
      ap.push(x.product_id, x.section_type, x.title, x.sort_order, x.content_html, x.content_text, x.content_json, x.source_anchor)
    );
    await dbClient.query(
      `INSERT INTO mzakka_product_sections(product_id,section_type,title,sort_order,content_html,content_text,content_json,source_anchor) VALUES ${ph}`,
      ap
    );
  }
}

async function rebuildRanks(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('TRUNCATE new_arrival_rank');
    await client.query(
      `INSERT INTO new_arrival_rank(product_id, rank)
       SELECT p.id, o.rank
       FROM new_arrival_order o
       JOIN products p ON p.slug = 'mzakka-' || lower(o.item_id)`
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// phase 2
async function processPendingAndRebuild(pool) {
  const t0 = Date.now();
  const { rows: pending } = await pool.query(
    `SELECT item_id, rank, attempts
     FROM sync_pending_items
     WHERE attempts < $1
     ORDER BY rank
     LIMIT 100`,
    [MAX_ATTEMPTS]
  );
  const dbNodeMap = await loadDbNodeMap(pool);

  let imported = 0;
  let failed = 0;
  let skippedDeadline = 0;

  // 逐件順序：crawl HTML → 用主 pool（max:1）匯入。
  // 唔並行搶 DB client——serverless 下 pool 得一條連線，並發會 connect timeout。
  // 每晚有三輪 process cron（23:34/42/50），呢輪做唔晒會由下一輪續。
  for (const entry of pending) {
    if (Date.now() - t0 > PHASE2_DEADLINE_MS) {
      skippedDeadline++;
      continue;
    }
    const url = `https://mzakka.com/pc/detail/item.php?item_id=${encodeURIComponent(entry.item_id)}`;
    try {
      const html = await withRetries(() => httpGet(url, { timeoutMs: 18000 }), 2, entry.item_id);
      const item = parseMzakkaDetailPage(html, {
        productUrl: url,
        extractDescription: extractDescriptionFromDetailHtml,
      });
      if (!item || !item.id) throw new Error('parse returned empty item');
      const dbClient = await pool.connect();
      try {
        await importItem(dbClient, item, entry.categoryId != null ? entry.categoryId : null, dbNodeMap);
      } finally {
        dbClient.release();
      }
      await pool.query('DELETE FROM sync_pending_items WHERE item_id=$1', [entry.item_id]);
      imported++;
    } catch (err) {
      failed++;
      const msg = String((err && err.message) || err).slice(0, 200);
      await pool.query(
        `UPDATE sync_pending_items
         SET attempts = attempts + 1, last_error = $2, updated_at = NOW()
         WHERE item_id = $1`,
        [entry.item_id, msg]
      );
      console.warn(`import ${entry.item_id} failed: ${msg}`);
    }
  }

  await rebuildRanks(pool);
  const { rows } = await pool.query(
    `SELECT (SELECT count(*) FROM new_arrival_rank)::int AS ranks,
            (SELECT count(*) FROM sync_pending_items WHERE attempts < $1)::int AS live_pending`,
    [MAX_ATTEMPTS]
  );

  return {
    queued: pending.length,
    imported,
    failed,
    skippedDeadline,
    ranks: rows[0].ranks,
    livePending: rows[0].live_pending,
    elapsedMs: Date.now() - t0,
  };
}

module.exports = {
  refreshArrivalOrder,
  processPendingAndRebuild,
};
