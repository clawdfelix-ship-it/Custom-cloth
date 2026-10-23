# Admin Orders：批量生成 ShipAny 面單（前端逐張生成）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `/admin/orders` 列表加入 checkbox 選取 + 「批量生成 ShipAny 面單」按鈕；前端逐張呼叫既有 `POST /api/admin/shipany/generate-label`，顯示進度與成功/跳過/失敗結果。

**Architecture:** 只改 UI（EJS + admin/orders.js），不新增後端 bulk endpoint。`loadOrders()` 同步建立 `orderCacheById` 及當頁 `currentOrderIds`，用 `selectedIds:Set` 管理選取。bulk 按鈕 click 後依序處理，寫入 `bulkResults` 並 render。

**Tech Stack:** EJS、原生 DOM + fetch（adminApiRequest）、node:test

---

## 檔案結構（會改動嘅檔案）
**Modify**
- `views/admin/orders.ejs`
- `public/js/admin/orders.js`

**Create**
- `test/admin-orders-bulk-shipany-ui.test.js`

---

### Task 1: 先寫會 fail 嘅回歸測試（marker + wiring）

**Files:**
- Create: `test/admin-orders-bulk-shipany-ui.test.js`

- [ ] **Step 1: 新增測試（fail）**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('admin orders page contains bulk shipany marker', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', 'views', 'admin', 'orders.ejs'), 'utf8');
  assert.match(s, /批量生成 ShipAny 面單/);
  assert.match(s, /orders-select-all/);
});

test('admin orders js wires bulk shipany behavior', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'admin', 'orders.js'), 'utf8');
  assert.match(s, /bulkGenerateShipanyLabels/);
  assert.match(s, /\/api\/admin\/shipany\/generate-label/);
});
```

- [ ] **Step 2: 跑測試確認 fail**

Run:
```bash
node --test ./test/admin-orders-bulk-shipany-ui.test.js
```

Expected: FAIL（未加 marker）

---

### Task 2: orders.ejs 加 checkbox + bulk 按鈕 + results 容器

**Files:**
- Modify: `views/admin/orders.ejs`
- Test: `test/admin-orders-bulk-shipany-ui.test.js`

- [ ] **Step 1: 工具列加 bulk button**

在 `#orders-refresh` 旁加：
- `#orders-bulk-shipany` button（預設 disabled）

- [ ] **Step 2: 表格加 checkbox 欄**

在 table header 加：
- `#orders-select-all` checkbox

每行由 JS render checkbox 放第一列（EJS 只需加 `<th>`）。

- [ ] **Step 3: 加結果容器**

加：
- `#orders-bulk-result`（預設 hidden）

- [ ] **Step 4: 跑 test**

Run:
```bash
node --test ./test/admin-orders-bulk-shipany-ui.test.js
```
Expected: 仍 FAIL（因為 JS 未有 bulkGenerateShipanyLabels）

---

### Task 3: orders.js 實作選取 + bulk 逐張生成 + 進度/結果 render

**Files:**
- Modify: `public/js/admin/orders.js`
- Test: `test/admin-orders-bulk-shipany-ui.test.js`

- [ ] **Step 1: 新增 elements**

新增：
- `bulkBtn: $('#orders-bulk-shipany')`
- `selectAll: $('#orders-select-all')`
- `bulkResult: $('#orders-bulk-result')`

- [ ] **Step 2: 加 state**

```js
let selectedIds = new Set();
let currentOrders = [];
let orderCacheById = new Map();
```

- [ ] **Step 3: 擴展 loadOrders**
- refresh/filters 變更時：清空 `selectedIds`
- render 每行：
  - checkbox（checked=selectedIds.has(id)）
  - onchange 更新 selectedIds
- 同步填 `currentOrders` + `orderCacheById`
- 更新 bulk 按鈕 disabled 狀態
- select-all checkbox：
  - checked = (selectedIds.size === currentOrders.length && currentOrders.length>0)

- [ ] **Step 4: 實作 bulkGenerateShipanyLabels**
- click 後：
  - 禁用 bulkBtn
  - render 進度：已完成 x/y
  - 逐張處理：
    - 若已有 `tracking_number` 或 `shipany_label_url` → 記錄 skip
    - 否則 call `POST /api/admin/shipany/generate-label`，payload 以 list row 欄位組：
      - `order_id`
      - `recipient_*` 由 `recipient_*` fallback `username/phone/address`
      - `district` fallback ''
      - `service_type` fallback 'sf_express'
      - `weight` fallback 1
    - 成功/失敗都 push result（包含 order id + message）
  - 完成後：
    - 重新 loadOrders
    - 保留結果區塊（可按清除）

- [ ] **Step 5: 跑 bulk ui test**

Run:
```bash
node --test ./test/admin-orders-bulk-shipany-ui.test.js
```
Expected: PASS

---

### Task 4: 全套測試

- [ ] **Step 1: 跑全套**

Run:
```bash
npm test
```
Expected: 全綠

