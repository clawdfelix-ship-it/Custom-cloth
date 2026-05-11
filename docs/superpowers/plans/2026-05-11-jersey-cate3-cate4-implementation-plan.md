# 球衣 3-4 層分類（cate3/cate4）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 當 `cate2=球衣` 時，新增 `cate3/cate4` 兩層分類（前台落單頁 + 後台款式庫），並在後端 enforce 規則；同時訂單 orders 存入 cate3/cate4 方便後台篩選/統計。

**Architecture:** DB 追加 `styles.cate3/cate4`、`orders.cate3/cate4`。public styles endpoint 在球衣時要求 query 帶 cate3/cate4；createOrder 在球衣時要求 body 帶 cate3/cate4。admin 新增款式同樣 enforce。前端僅在 `cate2=球衣` 顯示兩個下拉，並把 cate3/cate4 帶到載入款式 query 及落單 payload。

**Tech Stack:** Node.js Vercel functions（`api/*.js`）；Postgres（migrations）；Vanilla JS（`index.html` / `admin.html`）；node:test。

---

## Files Impact

**Create**
- `db/migrations/202605111200_styles_orders_cate3_cate4.sql`
- `tests/jersey-cate3-cate4.test.js`（validation smoke）

**Modify**
- `api/public.js`（styles query + createOrder 記錄）
- `api/admin.js`（新增款式驗證 + insert）
- `index.html`（UI + query/payload）
- `admin.html`（UI + payload）

---

## Shared Constants（一致性）

在 server-side 檔案內新增常量（先內嵌，之後如需要再抽出共用 lib）：

```js
const JERSEY_CATE2 = '球衣';
const JERSEY_CATE3 = ['足球', '籃球', '排球', '其他'];
const JERSEY_CATE4 = ['上衣', '褲子', '整套'];
```

Validation helper：

```js
function requireOptionalEnum(value, allowed, field) {
  const v = typeof value === 'string' ? value.trim() : '';
  if (!v) return '';
  if (!allowed.includes(v)) throw new Error(`${field}_invalid`);
  return v;
}
```

---

### Task 1: DB migration（styles/orders 加 cate3/cate4）

**Files:**
- Create: `db/migrations/202605111200_styles_orders_cate3_cate4.sql`
- Test: `tests/jersey-cate3-cate4.test.js`

- [ ] **Step 1: 寫 failing test（migration 存在且包含 alter）**

```js
const test = require('node:test');
const assert = require('node:assert/strict');

test('migration adds cate3/cate4 to styles and orders', async () => {
  const fs = require('node:fs/promises');
  const sql = await fs.readFile('db/migrations/202605111200_styles_orders_cate3_cate4.sql', 'utf8');
  assert.match(sql, /alter table styles add column if not exists cate3/i);
  assert.match(sql, /alter table styles add column if not exists cate4/i);
  assert.match(sql, /alter table orders add column if not exists cate3/i);
  assert.match(sql, /alter table orders add column if not exists cate4/i);
});
```

- [ ] **Step 2: Run test to verify RED**

```bash
node --test tests/jersey-cate3-cate4.test.js
```

Expected: FAIL（migration file 未存在）

- [ ] **Step 3: 加 migration file**

```sql
alter table styles add column if not exists cate3 text;
alter table styles add column if not exists cate4 text;
alter table orders add column if not exists cate3 text;
alter table orders add column if not exists cate4 text;
```

- [ ] **Step 4: Run tests to verify GREEN**

```bash
npm test
```

Expected: PASS

---

### Task 2: public styles 支援 cate3/cate4（球衣必填）

**Files:**
- Modify: `api/public.js`
- Test: `tests/jersey-cate3-cate4.test.js`

- [ ] **Step 1: 寫 failing test（球衣時必須帶 query cate3/cate4）**

以 string match smoke（避免引入 DB mock）：

```js
test('public styles requires cate3/cate4 for jersey', async () => {
  const fs = require('node:fs/promises');
  const js = await fs.readFile('api/public.js', 'utf8');
  assert.match(js, /cate3/);
  assert.match(js, /cate4/);
  assert.match(js, /球衣/);
});
```

- [ ] **Step 2: Run tests to verify RED**

```bash
node --test tests/jersey-cate3-cate4.test.js
```

- [ ] **Step 3: 實作 public styles**
  - 讀取 query `cate3/cate4`
  - 若 `cate2===球衣`：
    - `cate3/cate4` required + 必須在 allowlist
    - SQL where 增加 `and s.cate3 = $cate3 and s.cate4 = $cate4`
  - 否則：忽略 cate3/cate4（或強制空，擇一；建議忽略）

- [ ] **Step 4: Run tests**

```bash
npm test
```

---

### Task 3: public createOrder 記錄 cate3/cate4（球衣必填）

**Files:**
- Modify: `api/public.js`
- Test: `tests/jersey-cate3-cate4.test.js`

- [ ] **Step 1: 寫 failing test（createOrder 有插入 cate3/cate4）**

```js
test('public createOrder persists cate3/cate4', async () => {
  const fs = require('node:fs/promises');
  const js = await fs.readFile('api/public.js', 'utf8');
  assert.match(js, /insert into orders[\\s\\S]*cate3[\\s\\S]*cate4/i);
});
```

- [ ] **Step 2: Run tests to verify RED**

```bash
node --test tests/jersey-cate3-cate4.test.js
```

- [ ] **Step 3: 實作**
  - body 讀取 `cate3/cate4`（string）
  - enforce：
    - `cate2===球衣` → 兩者必填且在 allowlist
    - `cate2!==球衣` → 兩者必須空
  - orders insert columns + values 加上 `cate3/cate4`

- [ ] **Step 4: Run tests**

```bash
npm test
```

---

### Task 4: admin 新增款式支援 cate3/cate4（球衣必填）

**Files:**
- Modify: `api/admin.js`
- Modify: `admin.html`
- Test: `tests/admin-html.test.js`、`tests/jersey-cate3-cate4.test.js`

- [ ] **Step 1: 前端 admin.html 加元素 smoke（新增 select）**
  - `styleCate3Sel`、`styleCate4Sel`

- [ ] **Step 2: admin.html UI**
  - 當 `styleCate2Sel.value === '球衣'`：
    - 顯示 `cate3/cate4` 下拉並必填
  - 否則隱藏並清空
  - createStyle payload 加上 `cate3/cate4`

- [ ] **Step 3: api/admin.js 實作**
  - create style handler 讀取 `cate3/cate4`
  - enforce 規則（同 public）
  - insert into styles 加上 `cate3/cate4`

- [ ] **Step 4: Run tests**

```bash
npm test
```

---

### Task 5: 客戶端（/）加入 cate3/cate4 下拉及必填流程

**Files:**
- Modify: `index.html`
- Test: `tests/index-html.test.js`

- [ ] **Step 1: 加 smoke test（index.html 有 cate3/cate4 UI + query）**
  - `id="cate3"`、`id="cate4"`
  - fetch styles URL 包含 `cate3` `cate4`

- [ ] **Step 2: index.html UI**
  - 在 `cate2` 下方加入兩個 select（初始 hidden）
  - 當 `cate2 === 球衣`：顯示、必填、選好先 `filterStyle()`
  - `filterStyle()`：
    - 若球衣但未選齊 → 不 call API，提示「請選球衣子類/再子類」
    - 選齊 → call `/api/public/styles?cate1&cate2&cate3&cate4`
  - `submitOrder('new')` payload 加 `cate3/cate4`

- [ ] **Step 3: Run tests**

```bash
npm test
```

---

### Task 6: Commit & Push（建議分段）

（如你要每個 task 逐步上線，可分段 commit；否則最少 2 段：後端+DB、前端+admin）

```bash
git add db/migrations api/public.js api/admin.js tests/jersey-cate3-cate4.test.js
git commit -m \"feat: add cate3/cate4 for jersey\"\n\ngit add index.html admin.html tests/index-html.test.js tests/admin-html.test.js\ngit commit -m \"feat: add jersey cate3/cate4 selectors\"\n\ngit push\n```

