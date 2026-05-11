# 動態尺寸落單（足球服 KID/ADULT）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 客戶落單改為按尺碼表動態生成尺寸數量輸入，後端支援動態 qty（sizeRatio array）並兼容舊單；新增足球服 KID/ADULT 尺碼表並支援顯示 SEAT。

**Architecture:** 以 `src/lib/qty.js` 作為唯一 qty normalize 層（兼容舊 `{S,M,...}` 與新 `[{size,qty}]`）；後端建立訂單與查詢回傳全部使用 normalize 後格式；前端落單頁面由 sizeTable rows 的 `eu` 動態渲染數量輸入；尺碼表預覽表頭動態（seat/china/height 視乎是否存在）。

**Tech Stack:** Node.js (CommonJS) + `node:test`；Vercel Functions（4 個入口）；Postgres jsonb。

---

## Files Impact

**Create**
- `src/lib/qty.js`
- `tests/qty.test.js`

**Modify**
- `src/lib/validation.js`
- `api/public.js`
- `api/factory.js`
- `api/admin.js`（如需後台訂單詳情/回傳一致化）
- `index.html`
- `admin.html`（尺碼表預覽支援 seat；以及貼表格 parser 表頭映射擴展 seat）

---

### Task 1: qty normalize 層（TDD）

**Files:**
- Create: `src/lib/qty.js`
- Test: `tests/qty.test.js`
- Modify: `src/lib/validation.js`（如需新增允許 0 qty 的 validator）

- [ ] **Step 1: 寫 failing tests（新 array / 舊 object / 兼容輸出）**

```js
const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizeQtyToSizeRatio } = require('../src/lib/qty');

test('normalizeQtyToSizeRatio accepts sizeRatio array', () => {
  const r = normalizeQtyToSizeRatio([{ size: '100', qty: 2 }, { size: '110', qty: 0 }]);
  assert.deepEqual(r, [{ size: '100', qty: 2 }, { size: '110', qty: 0 }]);
});

test('normalizeQtyToSizeRatio accepts legacy fixed qty object', () => {
  const r = normalizeQtyToSizeRatio({ S: 1, M: 0, L: 2, XL: 0, '2XL': 0, '3XL': 0 });
  assert.deepEqual(r, [{ size: 'S', qty: 1 }, { size: 'L', qty: 2 }]);
});

test('normalizeQtyToSizeRatio rejects empty total qty', () => {
  assert.throws(() => normalizeQtyToSizeRatio([{ size: 'S', qty: 0 }]), /qty empty/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test tests/qty.test.js
```

Expected: FAIL（module not found）

- [ ] **Step 3: 寫最小實作（normalizeQtyToSizeRatio）**

```js
function normalizeQtyToSizeRatio(qty) {
  if (Array.isArray(qty)) {
    const out = qty.map((x) => {
      const size = typeof x && x ? String(x.size || '').trim() : '';
      const n = Number(x && x.qty);
      if (!size) throw new Error('size required');
      if (!Number.isFinite(n) || n < 0) throw new Error('qty invalid');
      return { size, qty: n };
    });
    if (out.reduce((a, b) => a + b.qty, 0) <= 0) throw new Error('qty empty');
    return out;
  }

  if (qty && typeof qty === 'object') {
    const keys = ['S', 'M', 'L', 'XL', '2XL', '3XL'];
    const out = [];
    for (const k of keys) {
      const n = Number(qty[k] || 0);
      if (!Number.isFinite(n) || n < 0) throw new Error('qty invalid');
      if (n > 0) out.push({ size: k, qty: n });
    }
    if (out.reduce((a, b) => a + b.qty, 0) <= 0) throw new Error('qty empty');
    return out;
  }

  throw new Error('qty required');
}

module.exports = { normalizeQtyToSizeRatio };
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
node --test tests/qty.test.js
```

Expected: PASS

- [ ] **Step 5: Run full test suite**

Run:

```bash
npm test
```

Expected: PASS

---

### Task 2: 後端 createOrder 接受動態 qty 並一律存 array

**Files:**
- Modify: `api/public.js`
- Modify: `api/admin.js`（翻單 copy 若要 qty 一律 array）
- Modify: `api/factory.js`（orderDetail / orders list items qty）

- [ ] **Step 1: 寫 failing test（createOrder 接受 array qty）**
  - 新增 `tests/public-orders-qty.test.js`（如現有 tests pattern，建立新 test）
  - 用最小方式驗證：直接 require handler 並模擬 body（如 repo 既有測試慣例），或先做 unit test 對 `normalizeQtyToSizeRatio`（已覆蓋）+ API handler smoke

- [ ] **Step 2: 修改 `api/public.js`**
  - 用 `normalizeQtyToSizeRatio(it.qty)` 取代 `requiredQtyJson(it.qty)`
  - `order_items.qty` 寫入 array（`JSON.stringify(sizeRatio)`）
  - 回傳 payload 可保持原樣（不影響）

- [ ] **Step 3: 修改 history 回傳 qty 統一**
  - `handleHistory` 回傳 items.qty 時：如讀到 object（舊單）→ normalize 成 array 再回傳

- [ ] **Step 4: 修改 factory orderDetail 回傳 qty 統一**
  - `api/factory.js` 取 `oi.qty` 後 normalize

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: PASS

---

### Task 3: 客戶端落單 UI 改成動態尺寸輸入

**Files:**
- Modify: `index.html`

- [ ] **Step 1: 寫一個簡單 DOM 測試（如 repo 現有以字串 match 為主）**
  - 驗證 `index.html` 含動態尺寸容器（例如 `id="qtyWrap"`）

- [ ] **Step 2: 改 UI 結構**
  - 以一個 container 取代固定 6 個 input（或保留但隱藏）
  - 由 `loadSizeTable()` 取 `rows.map(r.eu)` 生成 inputs

- [ ] **Step 3: 改 submit payload**
  - `readQty()` 改成讀動態 inputs → `sizeRatio array`
  - 與 `items[].qty` 對齊新格式

- [ ] **Step 4: 改 repeat 翻單回填**
  - 翻單選單時，如果 order items qty 為 array → 動態生成 inputs 並回填
  - 若為 object（舊）→ 由後端已 normalize，前端只需處理 array

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: PASS

---

### Task 4: 尺碼表預覽支援 SEAT + 足球服兩張尺碼表（資料新增）

**Files:**
- Modify: `index.html`（size table preview table headers/rows 動態）
- Modify: `admin.html`（尺碼表貼表格 parser 表頭支持 seat；預覽表頭動態）

- [ ] **Step 1: 擴展 size table preview（客戶端）**
  - 偵測 rows 是否存在 `seat`，有就加欄
  - 同時保留 `china` / `height` 欄位（舊表）

- [ ] **Step 2: 擴展 admin 貼表格 parser 表頭映射支持 seat**
  - 新 key：`seat`
  - header alias：`SEAT`, `臀圍`, `臀圍(CM)`, `臀圍CM`
  - 預覽表格同樣可動態顯示 seat

- [ ] **Step 3: 新增兩張足球服尺碼表（Production DB）**
  - 透過 admin API `POST /api/admin/size-tables` 建立：
    - `足球服 KID (cm)`（7 行）
    - `足球服 ADULT (cm)`（7 行，含 seat）

- [ ] **Step 4: 手動驗收**
  - 落單頁揀足球服款式（綁到相應 size table）
  - 確認 qty inputs 生成正確（KID: 100-160；ADULT: S-4XL）
  - 尺碼表 preview 顯示 seat

---

### Task 5: Commit & Push（分段）

- [ ] **Commit 1: qty normalize + API 支援**

```bash
git add src/lib/qty.js tests/qty.test.js api/public.js api/factory.js
git commit -m "feat: support dynamic size qty format"
git push
```

- [ ] **Commit 2: 客戶端動態尺寸輸入 + preview 支援 seat**

```bash
git add index.html
git commit -m "feat: dynamic qty inputs based on size table"
git push
```

- [ ] **Commit 3: admin 貼表格支持 seat + 視圖更新**

```bash
git add admin.html tests/admin-html.test.js
git commit -m "feat: support seat column in size tables"
git push
```

