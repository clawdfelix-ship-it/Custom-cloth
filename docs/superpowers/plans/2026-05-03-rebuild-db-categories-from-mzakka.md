# DB Categories Rebuild (MZAKKA Breadcrumb) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 由 MZAKKA 商品頁的 breadcrumb 重建「大分類」到 Postgres `categories`，並批量更新 `products.category_id`，令左邊【商品分類】顯示多個分類且可篩選。

**Architecture:** 新增一個純函數 HTML 解析器（由 HTML 擷取 breadcrumb 內 categories、取第一個作大分類），用 node:test 覆蓋。再新增一個 DB rebuild 腳本：從 DB 取 SKU → fetch 商品頁 → upsert category → update product.category_id，支援 `--limit/--concurrency/--delay-ms/--rebuild-all` 及可重跑 resume。

**Tech Stack:** Node.js（CommonJS）+ pg + node:test

---

## File Structure（會改/新增）

**Create**
- `utils/mzakkaBreadcrumb.js`：breadcrumb HTML parsing（純函數）
- `scripts/rebuild-categories-from-mzakka.js`：重建分類腳本（fetch + pg upsert/update）
- `test/mzakkaBreadcrumb.test.js`：解析器測試
- `test/rebuildCategoriesFromMzakkaArgs.test.js`：CLI args 解析 + dry-run 測試（無 DB 也可跑）

**Modify**
- `package.json`：加 `rebuild:categories` script（方便本地跑）
- `app.js`：可選，將 categories cache TTL 調低（令 rebuild 後更快見到變化）

---

### Task 1: 寫 breadcrumb 解析器 tests（RED）

**Files:**
- Create: `test/mzakkaBreadcrumb.test.js`

- [ ] **Step 1: 寫 failing tests**

```js
const test = require('node:test');
const assert = require('node:assert/strict');

test('mzakkaBreadcrumb: extracts categories from breadcrumb div', () => {
  const { extractBreadcrumbCategoryNames } = require('../utils/mzakkaBreadcrumb');
  const html = `
    <html><body>
      <div id="breadcrumb">
        <a href="category.php?category=1">アダルトグッズ実演販売</a>
        &gt;
        <a href="category.php?category=2">オナホール・おっぱい</a>
      </div>
    </body></html>
  `;
  assert.deepEqual(extractBreadcrumbCategoryNames(html), ['アダルトグッズ実演販売', 'オナホール・おっぱい']);
});

test('mzakkaBreadcrumb: picks root category for sidebar', () => {
  const { getRootCategoryNameFromHtml } = require('../utils/mzakkaBreadcrumb');
  const html = `<div id="breadcrumb"><a href="category.php?category=1">コンドーム</a></div>`;
  assert.equal(getRootCategoryNameFromHtml(html), 'コンドーム');
});

test('mzakkaBreadcrumb: falls back to 未分類 when missing', () => {
  const { getRootCategoryNameFromHtml } = require('../utils/mzakkaBreadcrumb');
  assert.equal(getRootCategoryNameFromHtml('<html></html>'), '未分類');
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:
```bash
npm test
```
Expected: FAIL（module not found）

---

### Task 2: 寫最小 breadcrumb 解析器（GREEN）

**Files:**
- Create: `utils/mzakkaBreadcrumb.js`

- [ ] **Step 1: 寫最小 implementation**

```js
function extractBreadcrumbCategoryNames(html) {
  if (typeof html !== 'string' || !html) return [];
  const m = html.match(/<div[^>]*id=\"breadcrumb\"[^>]*>([\\s\\S]*?)<\\/div>/i);
  if (!m) return [];
  const block = m[1];
  const cats = [...block.matchAll(/category\\.php\\?category=\\d+[^>]*>([^<]+)</ig)]
    .map(x => String(x[1] || '').trim())
    .filter(Boolean);
  return cats;
}

function getRootCategoryNameFromHtml(html) {
  const cats = extractBreadcrumbCategoryNames(html);
  return cats[0] || '未分類';
}

module.exports = { extractBreadcrumbCategoryNames, getRootCategoryNameFromHtml };
```

- [ ] **Step 2: Run tests to verify GREEN**

Run:
```bash
npm test
```
Expected: PASS

---

### Task 3: CLI args / dry-run tests（RED）

**Files:**
- Create: `test/rebuildCategoriesFromMzakkaArgs.test.js`

- [ ] **Step 1: 寫 failing tests**

```js
const test = require('node:test');
const assert = require('node:assert/strict');

test('rebuild categories script: parses args', () => {
  const { parseArgs } = require('../scripts/rebuild-categories-from-mzakka');
  const a = parseArgs(['node', 'x', '--limit', '10', '--concurrency', '3', '--delay-ms', '150', '--rebuild-all']);
  assert.deepEqual(a, { limit: 10, concurrency: 3, delayMs: 150, rebuildAll: true, dryRun: false });
});

test('rebuild categories script: supports dry-run without DATABASE_URL', async () => {
  const { dryRunSample } = require('../scripts/rebuild-categories-from-mzakka');
  const out = await dryRunSample({ sku: '00T096' });
  assert.ok(out.rootCategoryName);
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:
```bash
npm test
```
Expected: FAIL（module not found）

---

### Task 4: 寫重建分類腳本（GREEN）

**Files:**
- Create: `scripts/rebuild-categories-from-mzakka.js`

- [ ] **Step 1: 寫最小 implementation 令 tests pass（parseArgs + dryRunSample）**

包含：
- `parseArgs(argv)`：回傳 `{ limit, concurrency, delayMs, rebuildAll, dryRun }`
- `fetchHtmlBySku(sku)`：GET `https://mzakka.com/pc/detail/item.php?item_id=${sku}`
- `dryRunSample({ sku })`：fetch → parse breadcrumb → return rootCategoryName
- `rebuildCategories()`：真 DB rebuild（本 task 先放 main 骨架，不需要被 tests 覆蓋）

- [ ] **Step 2: Run tests to verify GREEN**

Run:
```bash
npm test
```
Expected: PASS

---

### Task 5: 真 DB rebuild（本地驗證）

**Files:**
- Modify: `package.json`
- (Optional) Modify: `app.js`

- [ ] **Step 1: 加 npm script**

在 `package.json` 加：
```json
{
  "rebuild:categories": "node scripts/rebuild-categories-from-mzakka.js --limit 200 --concurrency 6 --delay-ms 150"
}
```

- [ ] **Step 2: 先跑 dry-run 確認抓到 breadcrumb root**

Run:
```bash
node scripts/rebuild-categories-from-mzakka.js --dry-run --sku 00T096
```
Expected: 輸出 rootCategoryName（例如 `アダルトグッズ実演販売`）

- [ ] **Step 3: 跑小批量 rebuild（200 件）**

Run:
```bash
npm run rebuild:categories
```
Expected: DB `categories` 出現多個分類（> 2），`products` 有部份被更新 category_id

- [ ] **Step 4: 驗證左邊側欄**

Open:
- `http://localhost:3000/products?page=1`
Expected: 左邊【商品分類】顯示多個分類

- [ ] **Step 5:（選做）調低 categories cache TTL**

若想 rebuild 後更快即時反映，將 `app.js` category cache TTL 由 5 分鐘調到 30 秒。

