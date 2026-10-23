# Admin 採購單（PO）收貨體驗優化（V2-1）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `/admin/purchase-orders` 把收貨入庫由「手打 sku_id 多行」升級為「按 PO items 逐行收貨」，支援一鍵填滿未收、每行備註、跳庫存中心，並保留舊 textarea 作 fallback。

**Architecture:** 只改前端與 view：`views/admin/purchase-orders.ejs` 加 marker/toggle；`public/js/admin/purchase-orders.js` 改 `renderPoDetail()` 生成收貨表格與提交邏輯（仍 call `POST /api/admin/purchase-orders/:id/receive`）；後端接口保持不變。新增 1-2 個 node:test 防回歸。

**Tech Stack:** EJS、原生 DOM + fetch（adminApiRequest）、node:test

---

## 檔案結構（會改動嘅檔案）
**Modify**
- `views/admin/purchase-orders.ejs`
- `public/js/admin/purchase-orders.js`

**Create**
- `test/admin-po-receiving-ui.test.js`

---

### Task 1: 測試先行（先 fail）

**Files:**
- Create: `test/admin-po-receiving-ui.test.js`

- [ ] **Step 1: 新增收貨 UI marker + wiring test（fail）**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('purchase-orders page contains item-receiving marker', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', 'views', 'admin', 'purchase-orders.ejs'), 'utf8');
  assert.match(s, /按 item 收貨|提交收貨入庫/);
});

test('purchase-orders.js still wires receive endpoint', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'admin', 'purchase-orders.js'), 'utf8');
  assert.match(s, /\/api\/admin\/purchase-orders\/.*\/receive/);
});
```

- [ ] **Step 2: 跑測試確認 fail**

Run:
```bash
node --test ./test/admin-po-receiving-ui.test.js
```

Expected: FAIL（因為 purchase-orders.ejs 未有 marker）

---

### Task 2: View 加 marker + fallback toggle 區塊

**Files:**
- Modify: `views/admin/purchase-orders.ejs`
- Test: `test/admin-po-receiving-ui.test.js`

- [ ] **Step 1: 在 PO 詳情 card 內加入 marker + 容器**

在「採購單詳情 / 收貨入庫」card 內保留 `#po-detail`，但加一行固定 marker（例如 `按 item 收貨`）：

```ejs
<div class="text-sm text-gray-700">按 item 收貨</div>
```

- [ ] **Step 2: 加 fallback 手動輸入容器（預設 hidden）**

加入一個按鈕 `#po-manual-toggle`，以及容器 `#po-manual-box`（內含原本 textarea UI 由 JS render 亦可，呢度只放容器）：

```ejs
<button id="po-manual-toggle" class="admin-btn-secondary" type="button">手動輸入（進階）</button>
<div id="po-manual-box" class="hidden"></div>
```

- [ ] **Step 3: 跑 marker test**

Run:
```bash
node --test ./test/admin-po-receiving-ui.test.js
```

Expected: PASS

---

### Task 3: purchase-orders.js 改為按 item 收貨（主流程）

**Files:**
- Modify: `public/js/admin/purchase-orders.js`

- [ ] **Step 1: 在 renderPoDetail 生成收貨輸入**

對每個 item 生成：
- 本次收貨 input（type=number，min=0，max=remaining）
- 備註 input（可選）
- SKU link：`/admin/inventory?sku_id=...`

並提供兩個操作：
- 「填滿未收」：把每行 input 設為 remaining（>0）
- 「提交收貨入庫」：收集 quantity>0 行，呼叫 receive endpoint

- [ ] **Step 2: Fallback 手動輸入 toggle**

保留現有 textarea 方式，但移入 `#po-manual-box`（預設 hidden）：
- toggle click 會 `classList.toggle('hidden')`

- [ ] **Step 3: 全收齊提示 + 一鍵設為 received**

如果 items 全部 remaining=0：
- 顯示提示文字
- 顯示按鈕「設為 received」→ call status endpoint

---

### Task 4: 全套測試

- [ ] **Step 1: 跑全套**

Run:
```bash
npm test
```

Expected: 全綠

