# 款式庫大類/子類下拉選項（前後台同步）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 後台新增款式的 cate1/cate2 改為下拉選項（帶自訂），客戶端 cate1/cate2 亦改為由 API 取得並與後台同步。

**Architecture:** 新增 `GET /api/public/categories`，合併「預設分類」+「styles 表 distinct 分類」。後台 admin.html 與客戶端 index.html 都改為從該 endpoint 載入並聯動 cate1 → cate2。提交時若選自訂則採用 input 值。

**Tech Stack:** Node.js serverless handler（現有 public.js）；Vanilla JS（admin.html / index.html）；node:test。

---

## Files Impact

**Modify**
- `api/public.js`（新增 categories handler）
- `index.html`（cate1/cate2 options 改為 API 填充）
- `admin.html`（styleCate1/styleCate2 改為 select + 自訂）
- `tests/public-api-modules.test.js`（或相應測試檔，確保 handler 存在）
- `tests/index-html.test.js`（如有，或新增簡單 smoke）

---

### Task 1: 新增 `/api/public/categories`（TDD）

**Files:**
- Modify: `api/public.js`
- Test: `tests/public-api-modules.test.js`（或新增 `tests/public-categories.test.js`）

- [ ] **Step 1: 寫 failing test（public handler 支援 categories）**

如 repo 用「export handler functions」模式，可新增一個 test 確保 `public.js` 會路由到 `categories`：

```js
const test = require('node:test');
const assert = require('node:assert/strict');

test('public api supports categories endpoint', async () => {
  const mod = require('../api/public');
  assert.equal(typeof mod.handler, 'function');
});
```

（若現有測試已覆蓋 export，改為新增一個更精準的 string match smoke：`/api/public/categories` 路由字串存在）

- [ ] **Step 2: Run tests to verify RED**

```bash
npm test
```

Expected: FAIL（未有 categories route）

- [ ] **Step 3: 寫最小實作（public.js 增加 handler）**
  - 增加 `handleCategories(req,res)`：
    - 只接受 GET
    - `DEFAULT_CATE1 = [...]`
    - `DEFAULT_CATE2 = [...]`
    - query DB：`select distinct cate1, cate2 from styles where cate1 <> '' and cate2 <> ''`
    - union 進結果，並按 cate1 分組
  - 在 public handler 路由：`/api/public/categories`

- [ ] **Step 4: Run tests to verify GREEN**

```bash
npm test
```

Expected: PASS

---

### Task 2: 客戶端 `/` cate1/cate2 改為 API 填充（含聯動）

**Files:**
- Modify: `index.html`

- [ ] **Step 1: 加 smoke test（或更新現有 index-html test）**
  - 確保 index.html 包含 `fetch('/api/public/categories'` 字串

- [ ] **Step 2: 改 `index.html`**
  - 新增全域：`categoriesCache = { cate1:[], cate2ByCate1:{} }`
  - `init()` 時 `await loadCategories()`：
    - 填充 `#cate1` options
    - 綁 `cate1` change 時刷新 `cate2` options（並 reset）
  - `filterStyle()` 保持不變（仍用 `/api/public/styles?cate1&cate2`）

- [ ] **Step 3: Run tests**

```bash
npm test
```

Expected: PASS

---

### Task 3: 後台 `/admin` 新增款式 cate1/cate2 改為 select + 自訂

**Files:**
- Modify: `admin.html`
- Modify: `tests/admin-html.test.js`（加元素存在 smoke）

- [ ] **Step 1: 先寫 failing test（新元素 id）**
  - `styleCate1Sel` / `styleCate1Custom`
  - `styleCate2Sel` / `styleCate2Custom`

- [ ] **Step 2: 改 UI**
  - 原本 `styleCate1/styleCate2` input 改為 select + input（自訂時顯示）
  - 初始載入時呼叫 `loadCategories()` 填 options
  - `cate1` change → 更新 `cate2` options

- [ ] **Step 3: 改 createStyleBtn 提交取值**
  - 取 select 值；若係 `__custom__` 就讀 input
  - 仍然送 `{ cate1, cate2 }` 到 `/api/admin/styles`

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: PASS

---

### Task 4: Commit & Push（分段）

- [ ] **Commit 1: categories endpoint + client changes**

```bash
git add api/public.js index.html tests/*.test.js
git commit -m "feat: load categories dynamically for styles"
git push
```

- [ ] **Commit 2: admin style cate select + custom**

```bash
git add admin.html tests/admin-html.test.js
git commit -m "feat: use cate selects when creating styles in admin"
git push
```

- [ ] **Commit 3: docs**

```bash
git add docs/superpowers/specs/2026-05-11-style-categories-options-design.md docs/superpowers/plans/2026-05-11-style-categories-options-implementation-plan.md
git commit -m "docs: add style categories options design and plan"
git push
```

