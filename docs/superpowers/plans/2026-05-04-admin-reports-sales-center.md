# Admin 報表中心（銷售 V1）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增 `/admin/reports`（銷售報表中心）頁面，接上現有 reports API，提供 overview、銷售趨勢（含簡單 SVG 圖）、熱賣產品、匯出訂單 CSV。

**Architecture:** 後台新增一個 page route（requireAdminPage('reports:read')）+ 一個 EJS view + 一個前端 JS；前端用 `adminApiRequest` 並行呼叫 `dashboard/overview`、`sales-by-date`、`top-products`，以原生 SVG 渲染趨勢；匯出用 location href 直接下載。

**Tech Stack:** Node.js + Express、EJS、原生 DOM + fetch（adminApiRequest）、node:test

---

## 檔案結構（會改動嘅檔案）
**Modify**
- `routes/adminPages.js`：新增 `GET /admin/reports` page route + 權限 guard
- `views/admin/layout.ejs`：sidebar 加「報表」入口（reports:read 才顯示）

**Create**
- `views/admin/reports.ejs`：報表頁 UI 容器
- `public/js/admin/reports.js`：報表頁前端（filters + render + svg）
- `test/admin-reports-page.test.js`：頁面存在且載入 reports.js
- `test/admin-reports-nav-link.test.js`：layout 有 reports nav link marker
- `test/admin-reports-js-wiring.test.js`：reports.js 有 endpoints 字串

---

### Task 1: 加測試（先 fail）

**Files:**
- Create: `test/admin-reports-page.test.js`
- Create: `test/admin-reports-nav-link.test.js`
- Create: `test/admin-reports-js-wiring.test.js`

- [ ] **Step 1: reports page 存在 + scripts test（fail）**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('admin reports page exists and loads reports.js', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', 'views', 'admin', 'reports.ejs'), 'utf8');
  assert.match(s, /js\\/admin\\/common\\.js/);
  assert.match(s, /js\\/admin\\/reports\\.js/);
});
```

- [ ] **Step 2: admin layout 有 reports nav link（fail）**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('admin layout contains reports nav link', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', 'views', 'admin', 'layout.ejs'), 'utf8');
  assert.match(s, /\\/admin\\/reports/);
  assert.match(s, /reports:read/);
});
```

- [ ] **Step 3: reports.js wires endpoints（fail）**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('admin reports js wires reports endpoints', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'admin', 'reports.js'), 'utf8');
  assert.match(s, /\\/api\\/admin\\/dashboard\\/overview/);
  assert.match(s, /\\/api\\/admin\\/reports\\/sales-by-date/);
  assert.match(s, /\\/api\\/admin\\/reports\\/top-products/);
  assert.match(s, /\\/api\\/admin\\/reports\\/export-orders\\/csv/);
});
```

- [ ] **Step 4: 跑測試確認會 fail**

Run:
```bash
npm test
```

Expected: FAIL（因為 reports.ejs/reports.js 未存在、layout 未有 link）

---

### Task 2: 新增 /admin/reports page route + menu 入口

**Files:**
- Modify: `routes/adminPages.js`
- Modify: `views/admin/layout.ejs`
- Test: `test/admin-reports-nav-link.test.js`

- [ ] **Step 1: 新增 page route**

在 `routes/adminPages.js` 內新增：

```js
app.get('/admin/reports', requireAdminPage('reports:read'), (req, res) => {
  res.render('admin/layout', { title: '報表', active: 'reports', content: 'reports' });
});
```

- [ ] **Step 2: sidebar 加 reports link（依 permissions 顯示）**

在 `views/admin/layout.ejs` 內新增一個 nav item（pattern 跟現有 inventory/returns 等一致）：

```ejs
<% if (hasPerm('reports:read')) { %>
  <a class="admin-nav-link <%= active === 'reports' ? 'active' : '' %>" href="/admin/reports">報表</a>
<% } %>
```

- [ ] **Step 3: 跑測試確認 nav link test pass**

Run:
```bash
node --test ./test/admin-reports-nav-link.test.js
```

Expected: PASS

---

### Task 3: 新增 reports.ejs + reports.js（銷售 V1）

**Files:**
- Create: `views/admin/reports.ejs`
- Create: `public/js/admin/reports.js`
- Test: `test/admin-reports-page.test.js`
- Test: `test/admin-reports-js-wiring.test.js`

- [ ] **Step 1: 新增 reports.ejs（容器 + markers）**

頁面結構參考 `views/admin/low-stock.ejs`：
- filters row：start/end、group_by、quick range buttons、refresh、export
- 三個 admin-card：overview、sales-by-date（含 svg 容器 + table）、top-products table
- include scripts：
  - `/js/admin/common.js`
  - `/js/admin/reports.js`

- [ ] **Step 2: 新增 public/js/admin/reports.js（wire + render）**

必備功能：
- 預設期間：最近 30 日；group_by=day
- 快捷鍵：7/30/90 日（button）
- 並行載入：
  - `/api/admin/dashboard/overview`
  - `/api/admin/reports/sales-by-date?start_date=...&end_date=...&group_by=...`
  - `/api/admin/reports/top-products?start_date=...&end_date=...&limit=20`
- 匯出：`/api/admin/reports/export-orders/csv?start_date=...&end_date=...`
- SVG 圖：用 `sales-by-date` rows 的 `total_sales` 畫簡單折線（原生 `<svg><polyline/></svg>`），無第三方依賴

- [ ] **Step 3: 跑 tests 確認 page + wiring tests pass**

Run:
```bash
node --test ./test/admin-reports-page.test.js
node --test ./test/admin-reports-js-wiring.test.js
```

Expected: PASS

---

### Task 4: 全套測試

**Files:**
- Test: `test/*.test.js`

- [ ] **Step 1: 跑全套**

Run:
```bash
npm test
```

Expected: 全綠

