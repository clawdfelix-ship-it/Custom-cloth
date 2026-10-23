# Admin 採購 → 收貨 → 入庫（V1）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增後台採購工作台（suppliers + purchase orders + 收貨入庫），並修正現有 suppliers/PO API 與 DB schema 欄位不一致問題；收貨會寫入 `inventory_transactions` 並同步更新 `inventory_levels` + `product_skus.stock`。

**Architecture:** 在 `routes/logistics.js` 修正並補齊 suppliers/PO endpoints（全部用 `requirePermission('inventory:read|write')`）；在 `routes/adminPages.js` 加入 `/admin/suppliers`、`/admin/purchase-orders` pages；新增對應 EJS + admin JS，用 `AdminCommon.adminApiRequest` 連接 endpoints；收貨入庫使用 DB transaction + row lock，確保 `inventory_levels` 與 `product_skus.stock` 一致，並寫流水。

**Tech Stack:** Node.js + Express、EJS、原生 DOM + fetch（adminApiRequest）、PostgreSQL、node:test

---

## 檔案結構（會改動嘅檔案）
**Modify**
- `routes/logistics.js`：修正 suppliers/PO 欄位；新增 PO detail/status/receive endpoints；入庫寫 inventory_levels/transactions
- `routes/adminPages.js`：新增 suppliers/PO admin pages routes
- `views/admin/layout.ejs`：新增 sidebar 入口（受 `inventory:write` 控制）

**Create**
- `views/admin/suppliers.ejs`
- `public/js/admin/suppliers.js`
- `views/admin/purchase-orders.ejs`
- `public/js/admin/purchase-orders.js`
- `test/admin-suppliers-page.test.js`
- `test/admin-purchase-orders-page.test.js`
- `test/admin-purchasing-api-wiring.test.js`

---

### Task 1: 測試先行（先 fail）

**Files:**
- Create: `test/admin-suppliers-page.test.js`
- Create: `test/admin-purchase-orders-page.test.js`
- Create: `test/admin-purchasing-api-wiring.test.js`

- [ ] **Step 1: 新增 suppliers page 測試（fail）**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('admin suppliers page exists and loads suppliers.js', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', 'views', 'admin', 'suppliers.ejs'), 'utf8');
  assert.match(s, /js\/admin\/common\.js/);
  assert.match(s, /js\/admin\/suppliers\.js/);
});
```

- [ ] **Step 2: 新增 purchase-orders page 測試（fail）**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('admin purchase-orders page exists and loads purchase-orders.js', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', 'views', 'admin', 'purchase-orders.ejs'), 'utf8');
  assert.match(s, /js\/admin\/common\.js/);
  assert.match(s, /js\/admin\/purchase-orders\.js/);
});
```

- [ ] **Step 3: 新增 API wiring 測試（fail）**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('purchasing endpoints exist and use inventory permissions', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', 'routes', 'logistics.js'), 'utf8');
  assert.match(s, /\/api\/admin\/suppliers/);
  assert.match(s, /requirePermission\('inventory:read'\)/);
  assert.match(s, /requirePermission\('inventory:write'\)/);
  assert.match(s, /\/api\/admin\/purchase-orders\/:id\/receive/);
});
```

- [ ] **Step 4: 跑測試確認 fail**

Run:
```bash
npm test
```

Expected: FAIL（因為 pages/js 未存在、logistics.js 未有 receive endpoint + 未改用 requirePermission）

---

### Task 2: 新增後台 pages + sidebar 入口

**Files:**
- Modify: `routes/adminPages.js`
- Modify: `views/admin/layout.ejs`
- Create: `views/admin/suppliers.ejs`
- Create: `views/admin/purchase-orders.ejs`
- Test: `test/admin-suppliers-page.test.js`
- Test: `test/admin-purchase-orders-page.test.js`

- [ ] **Step 1: adminPages.js 加入 routes**

```js
app.get('/admin/suppliers', requireAdminPage('inventory:write'), (req, res) => {
  res.render('admin/layout', { title: '供應商', active: 'suppliers', content: 'suppliers' });
});

app.get('/admin/purchase-orders', requireAdminPage('inventory:write'), (req, res) => {
  res.render('admin/layout', { title: '採購單', active: 'purchase-orders', content: 'purchase-orders' });
});
```

- [ ] **Step 2: layout.ejs 新增 nav links（放喺 inventory 區塊附近）**

```ejs
<% if (hasPerm('inventory:write')) { %>
  <a class="admin-link <%= active==='suppliers' ? 'active' : '' %>" href="/admin/suppliers">供應商</a>
  <a class="admin-link <%= active==='purchase-orders' ? 'active' : '' %>" href="/admin/purchase-orders">採購單</a>
<% } %>
```

- [ ] **Step 3: 新增 suppliers.ejs / purchase-orders.ejs（只放容器 + scripts）**

`views/admin/suppliers.ejs`：
```ejs
<div id="admin-suppliers" class="space-y-3">
  <div id="sup-error" class="admin-error hidden"></div>
  <div class="admin-card space-y-2">
    <div class="font-bold">新增 / 編輯供應商</div>
    <div class="grid grid-cols-2 gap-2">
      <input id="sup-name" class="admin-input" placeholder="供應商名稱" />
      <input id="sup-contact-name" class="admin-input" placeholder="聯絡人" />
      <input id="sup-contact-phone" class="admin-input" placeholder="電話" />
      <input id="sup-email" class="admin-input" placeholder="Email" />
      <input id="sup-address" class="admin-input col-span-2" placeholder="地址" />
      <input id="sup-payment-terms" class="admin-input col-span-2" placeholder="付款條款" />
      <textarea id="sup-notes" class="admin-input col-span-2" rows="2" placeholder="備註"></textarea>
    </div>
    <div class="flex gap-2">
      <button id="sup-save" class="admin-btn" type="button">儲存</button>
      <button id="sup-reset" class="admin-btn-secondary" type="button">清空</button>
    </div>
  </div>
  <div class="admin-card">
    <table class="admin-table">
      <thead><tr><th>名稱</th><th>聯絡</th><th>Email</th><th>狀態</th><th></th></tr></thead>
      <tbody id="sup-tbody"></tbody>
    </table>
  </div>
  <script src="/js/admin/common.js"></script>
  <script src="/js/admin/suppliers.js"></script>
</div>
```

`views/admin/purchase-orders.ejs`：
```ejs
<div id="admin-purchase-orders" class="space-y-3">
  <div id="po-error" class="admin-error hidden"></div>
  <div class="admin-card space-y-2">
    <div class="font-bold">建立採購單</div>
    <div class="flex flex-wrap gap-2 items-end">
      <label class="text-sm">
        <div class="mb-1">供應商</div>
        <select id="po-supplier" class="admin-input"></select>
      </label>
      <label class="text-sm">
        <div class="mb-1">預計到貨</div>
        <input id="po-eta" class="admin-input" type="date" />
      </label>
      <label class="text-sm grow">
        <div class="mb-1">備註</div>
        <input id="po-notes" class="admin-input w-full" />
      </label>
      <button id="po-create" class="admin-btn" type="button">建立</button>
    </div>
    <div class="text-sm text-gray-700">Items（每行：sku_id,quantity,cost_price）</div>
    <textarea id="po-items" class="admin-input w-full" rows="4" placeholder="例如：\n123,10,25\n456,5,18"></textarea>
  </div>
  <div class="admin-card">
    <table class="admin-table">
      <thead><tr><th>採購單號</th><th>供應商</th><th>狀態</th><th>金額</th><th>到貨</th><th></th></tr></thead>
      <tbody id="po-tbody"></tbody>
    </table>
  </div>
  <div class="admin-card space-y-2">
    <div class="font-bold">採購單詳情 / 收貨入庫</div>
    <div id="po-detail" class="text-sm text-gray-700">請先喺上面揀一張採購單</div>
  </div>
  <script src="/js/admin/common.js"></script>
  <script src="/js/admin/purchase-orders.js"></script>
</div>
```

- [ ] **Step 4: 跑兩個 page tests**

Run:
```bash
node --test ./test/admin-suppliers-page.test.js
node --test ./test/admin-purchase-orders-page.test.js
```

Expected: PASS

---

### Task 3: 修正 suppliers API + 加 purchase orders endpoints（schema 對齊）

**Files:**
- Modify: `routes/logistics.js`
- Test: `test/admin-purchasing-api-wiring.test.js`

- [ ] **Step 1: suppliers endpoints 改用 requirePermission + 欄位對齊 schema**

行為：
- `GET /api/admin/suppliers`：回 `suppliers`
- `POST /api/admin/suppliers`：insert into `suppliers(name, contact_name, contact_phone, email, address, payment_terms, notes, is_active)`
- `PUT /api/admin/suppliers/:id`：update 同上（允許 `is_active`）
- 輸入兼容：
  - `contact_email` → `email`
  - `note` → `notes`

- [ ] **Step 2: purchase orders list/create 改用 schema 欄位**

`GET /api/admin/purchase-orders`：
- join suppliers name
- 支援 `status` filter（可選）

`POST /api/admin/purchase-orders`：
- 讀 `expected_arrival_date || expected_arrival`，`notes || note`
- 生成 `po_number`
- insert into `purchase_orders(supplier_id, po_number, status, total_amount, expected_arrival_date, notes, created_by)`
- items：由輸入 `sku_id` derive `product_id`（query `product_skus`），insert into `purchase_order_items(po_id, product_id, sku_id, quantity, cost_price, received_quantity=0)`

- [ ] **Step 3: 新增 purchase order detail/status/receive endpoints**

新增：
- `GET /api/admin/purchase-orders/:id`（含 supplier + items）
- `PUT /api/admin/purchase-orders/:id/status`
- `POST /api/admin/purchase-orders/:id/receive`
  - transaction：
    - validate PO exists
    - 每行：
      - lock `purchase_order_items` row
      - update received_quantity
      - 依 warehouse（缺省選 default）：
        - ensure `inventory_levels` row exists
        - lock `product_skus` + `inventory_levels`
        - update `inventory_levels.stock += qty`
        - update `product_skus.stock += qty`
        - insert `inventory_transactions`（type='purchase_receive'，quantity=+qty，previous_stock/new_stock 用倉庫庫存）

- [ ] **Step 4: 跑 API wiring test**

Run:
```bash
node --test ./test/admin-purchasing-api-wiring.test.js
```

Expected: PASS

---

### Task 4: 新增 suppliers.js / purchase-orders.js（最小可用 UI）

**Files:**
- Create: `public/js/admin/suppliers.js`
- Create: `public/js/admin/purchase-orders.js`

- [ ] **Step 1: suppliers.js**
- 讀 suppliers list：`GET /api/admin/suppliers`
- 渲染表格 + 「編輯」帶入表單
- save：若有 id → `PUT /api/admin/suppliers/:id`，否則 `POST /api/admin/suppliers`

- [ ] **Step 2: purchase-orders.js**
- 讀 suppliers list（供建立 PO 選擇）
- 讀 PO list：`GET /api/admin/purchase-orders`
- 建立 PO：`POST /api/admin/purchase-orders`（items 由 textarea parse）
- open PO detail：`GET /api/admin/purchase-orders/:id`，render items + received qty
- 變更 status：`PUT /api/admin/purchase-orders/:id/status`
- 收貨入庫：輸入 sku_id/qty（可多行）→ `POST /api/admin/purchase-orders/:id/receive`；成功後 reload detail

- [ ] **Step 3: 跑全套測試**

Run:
```bash
npm test
```

Expected: 全綠

