# Admin 訂單出貨工作流（ShipAny）+ Orders 權限對齊（V1）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 令 `/admin/orders` 成為可用嘅出貨工作台：生成面單、顯示面單/物流資料、可手動刷新 tracking；同時把 Orders 核心 admin API 權限對齊 RBAC（orders:read/write）。

**Architecture:** 後端把 `/api/admin/orders*` 從 `requireAdmin` 改為 `requirePermission('orders:read|write')`；前端喺訂單詳情加入 ShipAny 出貨區塊，新增「刷新 tracking」按鈕，並以容錯方式 render tracking events。

**Tech Stack:** Node.js + Express、EJS、原生 DOM + fetch（adminApiRequest）、PostgreSQL、node:test

---

## 檔案結構（會改動嘅檔案）
**Modify**
- `routes/orders.js`：Orders 核心 admin API 改用 `requirePermission`（RBAC 對齊）
- `public/js/admin/orders.js`：訂單詳情加入 tracking refresh + events render

**Create**
- `test/admin-orders-rbac-permissions.test.js`：防回歸（orders API 必須用 requirePermission）
- `test/admin-orders-tracking-ui.test.js`：防回歸（orders.js 前端必須 wire tracking endpoint）

---

### Task 1: 加測試（先 fail）

**Files:**
- Create: `test/admin-orders-rbac-permissions.test.js`
- Create: `test/admin-orders-tracking-ui.test.js`

- [ ] **Step 1: 建立 orders API 權限測試（fail）**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('admin orders API uses requirePermission (rbac-aligned)', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', 'routes', 'orders.js'), 'utf8');
  assert.match(s, /\/api\/admin\/orders'\s*,\s*requirePermission\('orders:read'\)/);
  assert.match(s, /\/api\/admin\/orders\/:id'\s*,\s*requirePermission\('orders:read'\)/);
  assert.match(s, /\/api\/admin\/orders\/:id\/status'\s*,\s*requirePermission\('orders:write'\)/);
  assert.doesNotMatch(s, /\/api\/admin\/orders'[\s\S]*requireAdmin/);
});
```

- [ ] **Step 2: 建立 orders 前端 tracking wiring 測試（fail）**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('admin orders UI wires tracking refresh endpoint', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'admin', 'orders.js'), 'utf8');
  assert.match(s, /\/api\/admin\/orders\/.*\/tracking/);
});
```

- [ ] **Step 3: 跑測試確認會 fail**

Run:
```bash
npm test
```

Expected: FAIL（因為 `routes/orders.js` 仲係 `requireAdmin`，而 `orders.js` 前端未包含 tracking endpoint wiring）

---

### Task 2: 後端 Orders 核心 API 權限對齊（requirePermission）

**Files:**
- Modify: `routes/orders.js`
- Test: `test/admin-orders-rbac-permissions.test.js`

- [ ] **Step 1: 在 routes/orders.js 引入 requirePermission**

將以下加到 `module.exports = function(...) {` 之後（同 repo 內 `routes/reports.js` 用法一致）：

```js
const { requirePermission } = require('./middleware/auth');
```

- [ ] **Step 2: 將 3 個 admin endpoints 改用 requirePermission**

把：
- `GET /api/admin/orders` 改為：

```js
app.get('/api/admin/orders', requirePermission('orders:read'), async (req, res) => {
  // 保持原本 handler 內容
});
```

- `GET /api/admin/orders/:id` 改為：

```js
app.get('/api/admin/orders/:id', requirePermission('orders:read'), async (req, res) => {
  // 保持原本 handler 內容
});
```

- `PUT /api/admin/orders/:id/status` 改為：

```js
app.put('/api/admin/orders/:id/status', requirePermission('orders:write'), async (req, res) => {
  // 保持原本 handler 內容
});
```

- [ ] **Step 3: 跑測試確認 Task 1 第 1 個測試 pass**

Run:
```bash
npm test
```

Expected: `admin orders API uses requirePermission (rbac-aligned)` PASS

- [ ] **Step 4: Commit**

```bash
git add routes/orders.js test/admin-orders-rbac-permissions.test.js
git commit -m "fix(rbac): align admin orders API with orders:read/write permissions"
```

---

### Task 3: 後台訂單詳情加入 tracking refresh + events render

**Files:**
- Modify: `public/js/admin/orders.js`
- Test: `test/admin-orders-tracking-ui.test.js`

- [ ] **Step 1: 加入 tracking 相關 state 與 UI elements**

在 `openOrder(id)` 內建立：
- `trackingBox`（顯示 tracking meta + events table）
- `refreshTrackingBtn`（按一下會打 `/api/admin/orders/:id/tracking`）

UI 需包含：
- tracking number / status / updated_at（如果 tracking endpoint 回傳到）
- events 表（如有）：時間 / 地點 / 狀態 / 備註（容錯）

- [ ] **Step 2: 加容錯 parser**

新增兩個 helper function（置於 `openOrder` 上方即可）：

```js
function pickFirstArray(obj, paths) {
  for (const p of paths) {
    const parts = String(p).split('.');
    let cur = obj;
    for (const k of parts) {
      if (!cur || typeof cur !== 'object') { cur = null; break; }
      cur = cur[k];
    }
    if (Array.isArray(cur)) return cur;
  }
  return null;
}

function toText(v) {
  if (v === null || v === undefined) return '';
  return typeof v === 'string' ? v : JSON.stringify(v);
}
```

- [ ] **Step 3: 實作 refreshTracking()**

`refreshTracking()` 行為：
- `adminApiRequest('/api/admin/orders/' + id + '/tracking')`
- 解析：
  - `events` / `tracking.events` / `data.events` 任一係 array → render table
  - 否則 render 一行「狀態」+（若有）`message` / `status` / `raw` 摘要

- [ ] **Step 4: 將 tracking UI 放入訂單詳情（ShipAny 區塊附近）**

確保「生成面單」後重新載入訂單時，tracking 仍可刷新。

- [ ] **Step 5: 跑測試確認 pass**

Run:
```bash
npm test
```

Expected: `admin orders UI wires tracking refresh endpoint` PASS + 全套 PASS

- [ ] **Step 6: Commit**

```bash
git add public/js/admin/orders.js test/admin-orders-tracking-ui.test.js
git commit -m "feat(admin): add tracking refresh and events view to orders shipping section"
```

---

## Plan 自檢（完成後）
- 覆蓋 spec：
  - Orders 核心 admin API 權限改為 orders:read/write（Task 2）
  - `/admin/orders` ShipAny 出貨區塊增加 tracking refresh + events render（Task 3）
  - node:test 防回歸（Task 1）
- 無 placeholder（無 TBD/TODO）

