# Admin 建 PO：SKU 搜尋 + 自動帶出成本價（V2-2）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `/admin/purchase-orders` 建立採購單時提供 SKU 搜尋/選取加入 items，並用 `product_skus.cost_price` 自動預填 item 成本價（可手改）。

**Architecture:** 擴展 `GET /api/admin/inventory/skus` 回傳 `cost_price`；前端在建 PO card 加 `#po-sku-search` + results list，選中後更新一個 in-memory items model，再由 JS render 成 items table，最後維持原有 `POST /api/admin/purchase-orders` payload 格式。

**Tech Stack:** Node/Express、Postgres、EJS、原生 DOM + fetch、node:test

---

## 檔案結構（會改動嘅檔案）
**Modify**
- `routes/products-full.js`（inventory/skus endpoint 加 cost_price）
- `views/admin/purchase-orders.ejs`（新增「搜尋 SKU」UI 容器 + items table 容器 + fallback textarea toggle）
- `public/js/admin/purchase-orders.js`（SKU 搜尋 + items model + create payload）

**Create**
- `test/admin-po-create-sku-search-ui.test.js`
- `test/inventory-skus-includes-cost-price.test.js`

---

### Task 1: 先寫會 fail 嘅測試

**Files:**
- Create: `test/inventory-skus-includes-cost-price.test.js`
- Create: `test/admin-po-create-sku-search-ui.test.js`

- [ ] **Step 1: 測試 inventory/skus 會回 cost_price（fail）**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('inventory skus endpoint includes cost_price in select/response', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', 'routes', 'products-full.js'), 'utf8');
  assert.match(s, /\/api\/admin\/inventory\/skus/);
  assert.match(s, /cost_price/);
});
```

- [ ] **Step 2: 測試 purchase-orders create UI 有「搜尋 SKU」同 endpoint wiring（fail）**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('purchase-orders page contains sku search marker', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', 'views', 'admin', 'purchase-orders.ejs'), 'utf8');
  assert.match(s, /搜尋 SKU/);
});

test('purchase-orders.js wires sku search endpoint', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'admin', 'purchase-orders.js'), 'utf8');
  assert.match(s, /\/api\/admin\/inventory\/skus/);
});
```

- [ ] **Step 3: 跑新增測試確認 fail**

Run:
```bash
node --test ./test/inventory-skus-includes-cost-price.test.js
node --test ./test/admin-po-create-sku-search-ui.test.js
```

Expected: FAIL（未加 marker / cost_price）

---

### Task 2: 擴展 inventory SKUs endpoint 回傳 cost_price

**Files:**
- Modify: `routes/products-full.js`
- Test: `test/inventory-skus-includes-cost-price.test.js`

- [ ] **Step 1: 在 inventory/skus SELECT 加 `ps.cost_price`**

把回傳 rows 增加 `cost_price` 欄位（保持舊欄位不變）。

- [ ] **Step 2: 跑 endpoint 測試**

Run:
```bash
node --test ./test/inventory-skus-includes-cost-price.test.js
```
Expected: PASS

---

### Task 3: 更新 purchase-orders 建立區 UI（EJS）

**Files:**
- Modify: `views/admin/purchase-orders.ejs`
- Test: `test/admin-po-create-sku-search-ui.test.js`

- [ ] **Step 1: 新增 SKU 搜尋容器 + 結果列表**

加入：
- `#po-sku-search`（input）
- `#po-sku-results`（results 容器）

- [ ] **Step 2: 新增 items table 容器**

加入：
- `#po-create-items`（table 容器）

- [ ] **Step 3: 把原本 textarea 移到進階 toggle（fallback）**

加入：
- `#po-items-toggle` button
- `#po-items-box` 容器（內含原 textarea）

- [ ] **Step 4: 跑 UI marker 測試**

Run:
```bash
node --test ./test/admin-po-create-sku-search-ui.test.js
```
Expected: PASS

---

### Task 4: purchase-orders.js 實作 SKU 搜尋 + items model + create payload

**Files:**
- Modify: `public/js/admin/purchase-orders.js`

- [ ] **Step 1: 加入 create items model**

```js
let createItems = []; // [{ sku_id, product_name, quantity, cost_price }]
```

- [ ] **Step 2: 實作 SKU 搜尋**
- debounce 250–400ms 後 call：
  - `GET /api/admin/inventory/skus?q=...&limit=20`
- render 結果到 `#po-sku-results`
- click 結果：
  - 若已存在 sku_id：quantity += 1
  - 否則 push 新 item（quantity=1、cost_price=sku.cost_price）
- 更新 items table render

- [ ] **Step 3: items table 支援編輯/刪除**
- quantity input（min=1）
- cost_price input（min=0）
- remove button

- [ ] **Step 4: createPurchaseOrder 改用 model**
- 如 model 有 items：用 model 組 payload
- 如 model 無 items：fallback 使用 textarea parse（維持兼容）

---

### Task 5: 全套測試

- [ ] **Step 1: 跑全套**

Run:
```bash
npm test
```
Expected: 全綠

