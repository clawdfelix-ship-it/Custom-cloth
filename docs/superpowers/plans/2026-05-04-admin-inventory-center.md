# Admin Inventory Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增 `/admin/inventory` 庫存中心頁，支援查看庫存流水（可篩選/翻頁）同「調整庫存」入口（搜索 SKU → 輸入 delta/note → 寫入流水）。

**Architecture:** 後台頁面用 EJS + 原生 JS（`AdminCommon.adminApiRequest`）。庫存 API 依附現有 `routes/products-full.js` inventory 區塊，新增 filter 與 SKU 搜索 endpoint，全部用 parameterized query。

**Tech Stack:** Node.js / Express / EJS / PostgreSQL / node:test

---

## File Map（會改/加嘅檔案）

**Create**
- `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/views/admin/inventory.ejs`
- `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/public/js/admin/inventory.js`
- `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/test/admin-inventory-page.test.js`
- `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/test/admin-inventory-api-wiring.test.js`

**Modify**
- `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/routes/adminPages.js`
- `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/views/admin/layout.ejs`
- `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/routes/products-full.js`

---

### Task 1: 新增 `/admin/inventory` 後台頁入口 + 左側選單

**Files:**
- Modify: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/routes/adminPages.js`
- Modify: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/views/admin/layout.ejs`
- Create: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/views/admin/inventory.ejs`
- Test: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/test/admin-inventory-page.test.js`

- [ ] **Step 1: 寫 failing test（inventory page 存在 + script 掛載 + nav link）**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('admin inventory page exists and loads inventory.js', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', 'views', 'admin', 'inventory.ejs'), 'utf8');
  assert.match(s, /admin-inventory/);
  assert.match(s, /\/js\/admin\/inventory\.js/);
});

test('admin layout contains inventory nav link', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', 'views', 'admin', 'layout.ejs'), 'utf8');
  assert.match(s, /href="\/admin\/inventory"/);
});
```

- [ ] **Step 2: 實作最小頁面（EJS）**

```ejs
<div id="admin-inventory" class="space-y-3">
  <div class="flex flex-wrap gap-2 items-end">
    <label class="text-sm">
      <div class="mb-1">倉庫</div>
      <select id="inv-warehouse" class="admin-input"></select>
    </label>
    <label class="text-sm">
      <div class="mb-1">商品 ID（可選）</div>
      <input id="inv-product-id" class="admin-input" placeholder="例如：123" />
    </label>
    <label class="text-sm">
      <div class="mb-1">SKU ID（可選）</div>
      <input id="inv-sku-id" class="admin-input" placeholder="例如：456" />
    </label>
    <label class="text-sm">
      <div class="mb-1">由</div>
      <input id="inv-from" class="admin-input" type="date" />
    </label>
    <label class="text-sm">
      <div class="mb-1">至</div>
      <input id="inv-to" class="admin-input" type="date" />
    </label>
    <button id="inv-refresh" class="admin-btn">刷新</button>
    <button id="inv-adjust-open" class="admin-btn-secondary" type="button">調整庫存</button>
  </div>

  <div id="inv-error" class="admin-error hidden"></div>

  <div class="admin-card">
    <table class="admin-table">
      <thead>
        <tr>
          <th>時間</th>
          <th>商品</th>
          <th>SKU</th>
          <th>倉庫</th>
          <th>類型</th>
          <th>變動</th>
          <th>調整前</th>
          <th>調整後</th>
          <th>備註</th>
        </tr>
      </thead>
      <tbody id="inv-tbody"></tbody>
    </table>
  </div>

  <div class="flex items-center gap-2 text-sm">
    <button id="inv-prev" class="admin-btn-secondary" type="button">上一頁</button>
    <div id="inv-page" class="text-gray-700"></div>
    <button id="inv-next" class="admin-btn-secondary" type="button">下一頁</button>
  </div>

  <div id="inv-adjust-modal" class="hidden space-y-2 p-3 border border-gray-200 rounded">
    <div class="font-bold">調整庫存</div>
    <label class="text-sm block">
      <div class="mb-1">搜尋（SKU/條碼/商品名）</div>
      <input id="inv-sku-q" class="admin-input w-full" placeholder="例如：ABC / 490xxxx / 商品名" />
    </label>
    <div class="text-sm">
      <div class="mb-1">SKU</div>
      <select id="inv-sku-select" class="admin-input w-full"></select>
    </div>
    <div class="grid grid-cols-2 gap-2">
      <label class="text-sm block">
        <div class="mb-1">調整數量</div>
        <input id="inv-delta" class="admin-input w-full" type="number" step="1" />
      </label>
      <label class="text-sm block">
        <div class="mb-1">倉庫（可選）</div>
        <select id="inv-warehouse-modal" class="admin-input w-full"></select>
      </label>
    </div>
    <label class="text-sm block">
      <div class="mb-1">備註（可選）</div>
      <textarea id="inv-note" class="admin-input w-full" rows="2"></textarea>
    </label>
    <div class="flex gap-2">
      <button id="inv-confirm" class="admin-btn" type="button">確認</button>
      <button id="inv-cancel" class="admin-btn-secondary" type="button">取消</button>
    </div>
  </div>

  <script src="/js/admin/common.js"></script>
  <script src="/js/admin/inventory.js"></script>
</div>
```

- [ ] **Step 3: 加 adminPages route + layout nav link**

在 `routes/adminPages.js` 加：
- `GET /admin/inventory` render `views/admin/layout.ejs`，`active: 'inventory'`，`title: '庫存'`，`content: 'admin/inventory'`

在 `views/admin/layout.ejs` sidebar 加：
- `<a ... href="/admin/inventory">庫存</a>`

- [ ] **Step 4: 跑 test**

Run: `npm test`  
Expected: FAIL → PASS（inventory page + nav link test 轉綠）

---

### Task 2: Inventory API filters（transactions）+ SKU 搜索 endpoint

**Files:**
- Modify: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/routes/products-full.js`
- Test: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/test/admin-inventory-api-wiring.test.js`

- [ ] **Step 1: 寫 failing test（endpoint 存在、支援 filters、用 bind params）**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('inventory transactions endpoint supports filters with bound params', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', 'routes', 'products-full.js'), 'utf8');
  assert.match(s, /\/api\/admin\/inventory\/transactions/);
  assert.match(s, /req\.query\.sku_id/);
  assert.match(s, /req\.query\.warehouse_id/);
  assert.match(s, /req\.query\.type/);
  assert.match(s, /req\.query\.from/);
  assert.match(s, /req\.query\.to/);
  assert.match(s, /params\.push/);
  assert.match(s, /\$\$\{params\.length \+ 1\}/);
});

test('inventory skus search endpoint exists', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', 'routes', 'products-full.js'), 'utf8');
  assert.match(s, /\/api\/admin\/inventory\/skus/);
  assert.match(s, /ILIKE/);
});
```

- [ ] **Step 2: 實作 transactions filters（parameterized query）**

目標：在原本 `where`/`params` 架構上，加上：
- `sku_id` → `AND it.sku_id = $n`
- `warehouse_id` → `AND it.warehouse_id = $n`
- `type` → `AND it.type = $n`
- `from` / `to`（ISO/date）→ `AND it.created_at >= $n` / `AND it.created_at < $n`（to 建議做 end-exclusive：to + 1 day）

Implementation notes：
- 只用 `params.push(...)` + `$${params.length + 1}`，唔拼 SQL 值
- 所有 filter 都寫喺 `it.` prefix（同 JOIN aliases 一致）

- [ ] **Step 3: 新增 `GET /api/admin/inventory/skus`**

SQL 方向（用 bind params）：
- `q` 轉成 `%q%`
- `WHERE ps.sku ILIKE $1 OR ps.barcode ILIKE $1 OR p.name ILIKE $1 OR p.name_zh_hk ILIKE $1`
- `LIMIT $2`

回傳：
- `skus: [{ id, sku, barcode, stock, product_id, product_name }]`

- [ ] **Step 4: 跑 test**

Run: `npm test`  
Expected: FAIL → PASS（api wiring test 轉綠）

---

### Task 3: 前端 `/admin/inventory` JS（列表 + 篩選 + 翻頁 + 調整庫存）

**Files:**
- Create: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/public/js/admin/inventory.js`
- Test: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/test/admin-inventory-page.test.js`（加一個 JS sanity test）

- [ ] **Step 1: 寫 failing test（inventory.js 不用 prompt、會呼叫 endpoints）**

```js
test('inventory.js wires transactions + sku search + adjust endpoints', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'admin', 'inventory.js'), 'utf8');
  assert.doesNotMatch(s, /\bprompt\s*\(/);
  assert.match(s, /\/api\/admin\/inventory\/transactions/);
  assert.match(s, /\/api\/admin\/inventory\/skus/);
  assert.match(s, /\/api\/admin\/inventory\/adjust/);
});
```

- [ ] **Step 2: 實作 inventory.js**

核心行為：
- 初始：loadWarehouses() + loadTransactions(page=1)
- buildQuery：讀取 warehouse/product/sku/from/to → query string
- pagination：prev/next 只改 page 再 load
- open modal：顯示 modal + 清空狀態 + 同步倉庫下拉（reuse 倉庫 list）
- sku search：oninput debounce（簡單版可用 setTimeout）→ `GET /api/admin/inventory/skus?q=...`
- confirm adjust：`POST /api/admin/inventory/adjust` 成功 → 關 modal → 重新拉第 1 頁 transactions

- [ ] **Step 3: 跑 test**

Run: `npm test`  
Expected: PASS

---

## Plan Self-Review
- 覆蓋 spec：page + filters + sku search + adjust + tests 都有 task
- Placeholder scan：無 TBD/TODO
- 命名一致：inv-* ids、endpoints 路徑一致

## Execution
Plan saved to:
- `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/docs/superpowers/plans/2026-05-04-admin-inventory-center.md`

