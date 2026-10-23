# Admin Low Stock Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增 `/admin/low-stock` 低庫存報表（以 SKU 為單位），支援 threshold（預設 5）+ 列表 + 一鍵跳庫存中心 + CSV 匯出。

**Architecture:** 後台頁面用 EJS + 原生 JS（`AdminCommon.adminApiRequest`）。API 依附現有 `routes/products-full.js`（同 products/inventory 同一文件模式），新增兩個 admin endpoints：JSON 列表同 CSV 匯出。

**Tech Stack:** Node.js / Express / EJS / PostgreSQL / node:test

---

## File Map（會改/加嘅檔案）

**Create**
- `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/views/admin/low-stock.ejs`
- `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/public/js/admin/low-stock.js`
- `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/test/admin-low-stock-page.test.js`
- `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/test/admin-low-stock-api-wiring.test.js`

**Modify**
- `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/routes/adminPages.js`
- `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/views/admin/layout.ejs`
- `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/routes/products-full.js`

---

### Task 1: 新增 `/admin/low-stock` page + 左側選單入口

**Files:**
- Modify: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/routes/adminPages.js`
- Modify: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/views/admin/layout.ejs`
- Create: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/views/admin/low-stock.ejs`
- Test: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/test/admin-low-stock-page.test.js`

- [ ] **Step 1: 寫 failing tests（page + nav link）**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('admin low-stock page exists and loads low-stock.js', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', 'views', 'admin', 'low-stock.ejs'), 'utf8');
  assert.match(s, /admin-low-stock/);
  assert.match(s, /\/js\/admin\/low-stock\.js/);
});

test('admin layout contains low-stock nav link', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', 'views', 'admin', 'layout.ejs'), 'utf8');
  assert.match(s, /href="\/admin\/low-stock"/);
});
```

- [ ] **Step 2: 新增 EJS page**

```ejs
<div id="admin-low-stock" class="space-y-3">
  <div class="flex flex-wrap gap-2 items-end">
    <label class="text-sm">
      <div class="mb-1">低庫存門檻</div>
      <input id="ls-threshold" class="admin-input" type="number" step="1" min="0" value="5" />
    </label>
    <button id="ls-refresh" class="admin-btn">刷新</button>
    <button id="ls-export" class="admin-btn-secondary" type="button">匯出 CSV</button>
  </div>

  <div id="ls-error" class="admin-error hidden"></div>

  <div class="admin-card">
    <table class="admin-table">
      <thead>
        <tr>
          <th>商品</th>
          <th>SKU</th>
          <th>條碼</th>
          <th>庫存</th>
          <th>更新時間</th>
          <th></th>
        </tr>
      </thead>
      <tbody id="ls-tbody"></tbody>
    </table>
  </div>

  <script src="/js/admin/common.js"></script>
  <script src="/js/admin/low-stock.js"></script>
</div>
```

- [ ] **Step 3: 註冊 adminPages route + layout nav link**
- `routes/adminPages.js`：新增 `GET /admin/low-stock`（active: 'low-stock'）
- `views/admin/layout.ejs`：sidebar 加「低庫存」

- [ ] **Step 4: 跑 test**

Run: `npm test`  
Expected: FAIL → PASS（page/nav link tests 轉綠）

---

### Task 2: 新增低庫存 API（JSON + CSV）

**Files:**
- Modify: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/routes/products-full.js`
- Test: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/test/admin-low-stock-api-wiring.test.js`

- [ ] **Step 1: 寫 failing test（wiring + csv headers）**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('low-stock sku endpoints exist', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', 'routes', 'products-full.js'), 'utf8');
  assert.match(s, /\/api\/admin\/low-stock\/skus/);
  assert.match(s, /\/api\/admin\/low-stock\/skus\/export\.csv/);
});

test('low-stock csv sets attachment filename', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', 'routes', 'products-full.js'), 'utf8');
  assert.match(s, /Content-Disposition/);
  assert.match(s, /low-stock-skus/);
});
```

- [ ] **Step 2: 實作 `GET /api/admin/low-stock/skus`**

Implementation details：
- threshold：`parseInt(req.query.threshold) || 5`，再 clamp：`>= 0`
- SQL（parameterized）：
  - `FROM product_skus ps JOIN products p ON ps.product_id=p.id`
  - `WHERE ps.is_active = true AND ps.stock <= $1`
  - `SELECT ps.id as sku_id, ps.sku, ps.barcode, ps.stock, ps.product_id, COALESCE(p.name_zh_hk, p.name) as product_name, p.slug as product_slug, ps.updated_at`
  - `ORDER BY ps.stock ASC, ps.id ASC`
- 回傳 `{ threshold, skus: rows }`

- [ ] **Step 3: 實作 `GET /api/admin/low-stock/skus/export.csv`**

Implementation details：
- 共享同一段 SQL（同排序/同 threshold）
- CSV 頭：
  - `Product ID,Product Name,Product Slug,SKU ID,SKU,Barcode,Stock,Updated At`
- `Content-Type: text/csv`
- `Content-Disposition: attachment; filename="low-stock-skus-YYYY-MM-DD.csv"`

- [ ] **Step 4: 跑 test**

Run: `npm test`  
Expected: FAIL → PASS

---

### Task 3: 前端 low-stock.js（列表 + 匯出 + 跳庫存中心）

**Files:**
- Create: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/public/js/admin/low-stock.js`
- Modify: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/test/admin-low-stock-page.test.js`（加 JS wiring test）

- [ ] **Step 1: 寫 failing test（JS 不用 prompt + endpoints）**

```js
test('low-stock.js wires endpoints and avoids prompt', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'admin', 'low-stock.js'), 'utf8');
  assert.doesNotMatch(s, /\bprompt\s*\(/);
  assert.match(s, /\/api\/admin\/low-stock\/skus/);
  assert.match(s, /\/api\/admin\/low-stock\/skus\/export\.csv/);
  assert.match(s, /\/admin\/inventory\\?sku_id=/);
});
```

- [ ] **Step 2: 實作 low-stock.js**

核心行為：
- load：讀 threshold（空/非法→ 5）→ GET JSON → render table
- refresh：重新 load
- export：`window.location = /api/admin/low-stock/skus/export.csv?threshold=...`
- 每行「去庫存中心」連結：`/admin/inventory?sku_id=<sku_id>`

- [ ] **Step 3: 跑 test**

Run: `npm test`  
Expected: PASS

---

## Plan Self-Review
- 覆蓋 spec：page/nav、API JSON+CSV、JS 列表+匯出+跳頁、tests 皆有
- Placeholder scan：無 TBD/TODO
- 命名一致：active='low-stock'、ids 以 ls- 前綴

