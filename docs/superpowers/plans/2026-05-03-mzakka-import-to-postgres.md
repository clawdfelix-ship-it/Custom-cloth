# MZAKKA 全量資料匯入 Postgres Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 將 `mzakka-clone/products-metadata.jsonl` 全量商品資料匯入現有 Postgres（categories/products/product_skus），並令 `/api/products` 立即可用。

**Architecture:** 建立一個純函數 mapping 模組（可用 `node --test` 測），再建立一個可重跑的匯入腳本（支援 dry-run / limit / batch），用 upsert 寫入 Postgres。zh-HK 欄位先用原文暫代，以滿足現有 API filter 條件。

**Tech Stack:** Node.js（CommonJS）+ pg + node:test

---

## File Structure（會改/新增）

**Create**
- `utils/mzakkaImport.js`：純函數 mapping（category root、slug、product row、sku row）
- `scripts/import-mzakka-to-postgres.js`：匯入腳本（stream 讀 JSONL + pg upsert）
- `test/mzakkaImport.test.js`：mapping 單元測試

**Modify**
- `package.json`：加 `import:mzakka` script（可選，但方便本地跑）

---

### Task 1: 先寫 mapping tests（RED）

**Files:**
- Create: `test/mzakkaImport.test.js`

- [ ] **Step 1: 寫 failing tests（node:test）**

建立以下測試（先會 FAIL，因為 module 未存在）：

```js
const test = require('node:test');
const assert = require('node:assert/strict');

test('mzakkaImport: extracts root category name', () => {
  const { getRootCategoryName } = require('../utils/mzakkaImport');
  assert.equal(getRootCategoryName('新商品・新規取扱商品 > M-ZAKKAオリジナル'), '新商品・新規取扱商品');
  assert.equal(getRootCategoryName('  A  > B  '), 'A');
  assert.equal(getRootCategoryName(''), '未分類');
  assert.equal(getRootCategoryName(null), '未分類');
});

test('mzakkaImport: builds stable category slug', () => {
  const { makeCategorySlug } = require('../utils/mzakkaImport');
  const a = makeCategorySlug('新商品・新規取扱商品');
  const b = makeCategorySlug('新商品・新規取扱商品');
  assert.equal(a, b);
  assert.match(a, /^mzakka-cat-[a-f0-9]{16}$/);
});

test('mzakkaImport: builds product slug from mzakka id', () => {
  const { makeProductSlug } = require('../utils/mzakkaImport');
  assert.equal(makeProductSlug('00T096'), 'mzakka-00t096');
});

test('mzakkaImport: maps product row and guarantees description_zh_hk non-empty', () => {
  const { toProductUpsertInput } = require('../utils/mzakkaImport');
  const input = {
    id: '00T096',
    name: 'テスト商品',
    priceYen: 2980,
    originalPriceYen: 3980,
    description: '',
    category: '新商品・新規取扱商品 > M-ZAKKAオリジナル',
    images: ['https://i.mzakka.com/imgs/abc.jpg'],
  };
  const out = toProductUpsertInput(input, 123);
  assert.equal(out.slug, 'mzakka-00t096');
  assert.equal(out.category_id, 123);
  assert.equal(out.name_zh_hk, 'テスト商品');
  assert.equal(out.description_zh_hk, 'テスト商品');
  assert.equal(out.image_url, 'https://i.mzakka.com/imgs/abc.jpg');
  assert.deepEqual(out.gallery_images, ['https://i.mzakka.com/imgs/abc.jpg']);
});

test('mzakkaImport: maps sku row', () => {
  const { toSkuUpsertInput } = require('../utils/mzakkaImport');
  const out = toSkuUpsertInput({ id: '00T096' }, 77);
  assert.equal(out.sku, '00T096');
  assert.equal(out.product_id, 77);
  assert.deepEqual(out.attributes, {});
});
```

- [ ] **Step 2: Run test to verify RED**

Run:
```bash
npm test
```
Expected: FAIL（提示找不到 `../utils/mzakkaImport` 或對應 export）

---

### Task 2: 寫最小 mapping 實作（GREEN）

**Files:**
- Create: `utils/mzakkaImport.js`

- [ ] **Step 1: 寫最小 implementation**

建立模組（CommonJS）：

```js
const crypto = require('node:crypto');

function getRootCategoryName(category) {
  if (typeof category !== 'string') return '未分類';
  const trimmed = category.trim();
  if (!trimmed) return '未分類';
  const parts = trimmed.split(' > ').map(s => s.trim()).filter(Boolean);
  return parts[0] || '未分類';
}

function makeCategorySlug(name) {
  const h = crypto.createHash('sha1').update(String(name || ''), 'utf8').digest('hex').slice(0, 16);
  return `mzakka-cat-${h}`;
}

function makeProductSlug(mzakkaId) {
  return `mzakka-${String(mzakkaId || '').toLowerCase()}`;
}

function normalizeTextOrNull(value) {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return t ? t : null;
}

function toProductUpsertInput(item, categoryId) {
  const name = String(item.name || '').trim();
  const description = normalizeTextOrNull(item.description);
  const images = Array.isArray(item.images) ? item.images.filter(Boolean) : [];
  const image_url = images[0] || null;
  const gallery_images = images;

  const name_zh_hk = name || '未命名商品';
  const description_zh_hk = description || name_zh_hk;

  return {
    name: name_zh_hk,
    name_zh_hk,
    slug: makeProductSlug(item.id),
    description,
    description_zh_hk,
    short_description_zh_hk: null,
    price: Number.isFinite(item.priceYen) ? Number(item.priceYen) : 0,
    original_price: Number.isFinite(item.originalPriceYen) ? Number(item.originalPriceYen) : null,
    category_id: categoryId,
    image_url,
    gallery_images,
    status: 'active',
  };
}

function toSkuUpsertInput(item, productId) {
  return {
    product_id: productId,
    sku: String(item.id || ''),
    attributes: {},
    stock: 0,
    is_active: true,
  };
}

module.exports = {
  getRootCategoryName,
  makeCategorySlug,
  makeProductSlug,
  toProductUpsertInput,
  toSkuUpsertInput,
};
```

- [ ] **Step 2: Run test to verify GREEN**

Run:
```bash
npm test
```
Expected: PASS

---

### Task 3: 新增匯入腳本（dry-run + 真匯入）

**Files:**
- Create: `scripts/import-mzakka-to-postgres.js`

- [ ] **Step 1: 先寫一個 failing test（針對 CLI 參數解析 / dry-run 不需要 DB）**

新增到 `test/mzakkaImport.test.js`（追加一個 test，先 FAIL）：

```js
test('import script: can dry-run parse first line without DATABASE_URL', async () => {
  const { dryRunParse } = require('../scripts/import-mzakka-to-postgres');
  const result = await dryRunParse({
    file: require('node:path').join(__dirname, '..', '..', 'mzakka-clone', 'products-metadata.jsonl'),
    limit: 1,
  });
  assert.equal(result.linesRead, 1);
  assert.ok(result.sample);
});
```

- [ ] **Step 2: Run test to verify RED**

Run:
```bash
npm test
```
Expected: FAIL（找不到 `../scripts/import-mzakka-to-postgres` 或 `dryRunParse`）

- [ ] **Step 3: 寫最小腳本實作令 test pass（同時保留 main 匯入入口）**

建立 `scripts/import-mzakka-to-postgres.js`：

```js
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const { Pool } = require('pg');
const {
  getRootCategoryName,
  makeCategorySlug,
  toProductUpsertInput,
  toSkuUpsertInput,
} = require('../utils/mzakkaImport');

async function dryRunParse({ file, limit = 1 }) {
  const linesReadLimit = Math.max(1, Number(limit) || 1);
  const input = fs.createReadStream(file);
  const rl = readline.createInterface({ input, crlfDelay: Infinity });
  let linesRead = 0;
  let sample = null;
  for await (const line of rl) {
    if (!line.trim()) continue;
    sample = JSON.parse(line);
    linesRead++;
    break;
  }
  rl.close();
  return { linesRead, sample };
}

async function importMzakka({ file, limit = 0, batchSize = 200, dryRun = false }) {
  if (dryRun) {
    const r = await dryRunParse({ file, limit: limit || 1 });
    return { mode: 'dry-run', linesRead: r.linesRead, sample: r.sample };
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  const pool = new Pool({ connectionString });
  const categoryCache = new Map();

  const input = fs.createReadStream(file);
  const rl = readline.createInterface({ input, crlfDelay: Infinity });

  let linesRead = 0;
  let productsUpserted = 0;
  let skusUpserted = 0;
  let categoriesUpserted = 0;

  async function upsertCategory(client, rootName) {
    const cached = categoryCache.get(rootName);
    if (cached) return cached;
    const slug = makeCategorySlug(rootName);
    const r = await client.query(
      `INSERT INTO categories (name, name_zh_hk, slug, status)
       VALUES ($1, $2, $3, 'active')
       ON CONFLICT (slug) DO UPDATE SET
         name = EXCLUDED.name,
         name_zh_hk = EXCLUDED.name_zh_hk,
         status = 'active'
       RETURNING id`,
      [rootName, rootName, slug]
    );
    categoriesUpserted++;
    const id = r.rows[0].id;
    categoryCache.set(rootName, id);
    return id;
  }

  let batch = [];

  async function flushBatch() {
    if (batch.length === 0) return;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const item of batch) {
        const root = getRootCategoryName(item.category);
        const categoryId = await upsertCategory(client, root);
        const p = toProductUpsertInput(item, categoryId);
        const pr = await client.query(
          `INSERT INTO products
            (name, name_zh_hk, slug, description, description_zh_hk, short_description_zh_hk,
             price, original_price, category_id, image_url, gallery_images, status)
           VALUES
            ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::json,$12)
           ON CONFLICT (slug) DO UPDATE SET
             name = EXCLUDED.name,
             name_zh_hk = EXCLUDED.name_zh_hk,
             description = EXCLUDED.description,
             description_zh_hk = EXCLUDED.description_zh_hk,
             short_description_zh_hk = EXCLUDED.short_description_zh_hk,
             price = EXCLUDED.price,
             original_price = EXCLUDED.original_price,
             category_id = EXCLUDED.category_id,
             image_url = EXCLUDED.image_url,
             gallery_images = EXCLUDED.gallery_images,
             status = 'active'
           RETURNING id`,
          [
            p.name,
            p.name_zh_hk,
            p.slug,
            p.description,
            p.description_zh_hk,
            p.short_description_zh_hk,
            p.price,
            p.original_price,
            p.category_id,
            p.image_url,
            JSON.stringify(p.gallery_images || []),
            p.status,
          ]
        );
        productsUpserted++;
        const productId = pr.rows[0].id;

        const s = toSkuUpsertInput(item, productId);
        await client.query(
          `INSERT INTO product_skus (product_id, sku, attributes, stock, is_active)
           VALUES ($1, $2, $3::json, $4, $5)
           ON CONFLICT (sku) DO UPDATE SET
             product_id = EXCLUDED.product_id,
             attributes = EXCLUDED.attributes,
             stock = EXCLUDED.stock,
             is_active = EXCLUDED.is_active
           RETURNING id`,
          [s.product_id, s.sku, JSON.stringify(s.attributes), s.stock, s.is_active]
        );
        skusUpserted++;
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
      batch = [];
    }
  }

  for await (const line of rl) {
    if (!line.trim()) continue;
    const item = JSON.parse(line);
    linesRead++;
    batch.push(item);
    if (batch.length >= batchSize) await flushBatch();
    if (limit && linesRead >= limit) break;
  }

  await flushBatch();
  rl.close();
  await pool.end();

  return { mode: 'import', linesRead, categoriesUpserted, productsUpserted, skusUpserted };
}

function parseArgs(argv) {
  const args = { file: null, limit: 0, batchSize: 200, dryRun: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--file') args.file = argv[++i];
    else if (a === '--limit') args.limit = Number(argv[++i] || 0);
    else if (a === '--batch') args.batchSize = Number(argv[++i] || 200);
    else if (a === '--dry-run') args.dryRun = true;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  const file = args.file || path.join(__dirname, '..', '..', 'mzakka-clone', 'products-metadata.jsonl');
  const result = await importMzakka({ file, limit: args.limit, batchSize: args.batchSize, dryRun: args.dryRun });
  console.log(JSON.stringify({ ok: true, ...result }, null, 2));
}

if (require.main === module) {
  main().catch(err => {
    console.error(String(err && err.message ? err.message : err));
    process.exitCode = 1;
  });
}

module.exports = { dryRunParse, importMzakka };
```

- [ ] **Step 4: Run test to verify GREEN**

Run:
```bash
npm test
```
Expected: PASS

---

### Task 4: 加 npm script + 最小可驗證執行（dry-run）

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 新增 script**

將以下加入 `scripts`：

```json
{
  "import:mzakka": "node scripts/import-mzakka-to-postgres.js --dry-run --limit 1"
}
```

- [ ] **Step 2: Run dry-run command**

Run:
```bash
npm run import:mzakka
```
Expected: 印出 JSON（`mode: dry-run`、`linesRead: 1`、`sample` 有 keys）

- [ ] **Step 3:（可選）真匯入**

前提：`.env` 已設定 `DATABASE_URL` 指向可連線 Postgres，且 schema 已建立。

Run:
```bash
node scripts/import-mzakka-to-postgres.js --file ../mzakka-clone/products-metadata.jsonl --batch 200
```
Expected: 印出 JSON 統計（`productsUpserted` / `skusUpserted` 大於 0）

