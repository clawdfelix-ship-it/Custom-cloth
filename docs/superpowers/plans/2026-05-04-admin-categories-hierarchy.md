# 後台分類管理分層（大分類＞子分類）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 後台 `/admin/categories` 支援兩級樹狀分類（大分類＞子分類），可展開/收合；右側表單可設定上級分類（parent_id）；後端阻止三層/循環/自指等不合法層級。

**Architecture:** 後端 `GET /api/admin/categories` 維持回傳平面 list（含 `parent_id`），前端用 `parent_id` 組樹並計算「大分類合計商品數」。新增/更新分類時，API 端做層級校驗（parent 必須係 root；禁止自指；root 有子分類時不可改成子分類；刪除 root 前需先清空其子分類）。

**Tech Stack:** Node.js（node:test）、Express、Postgres(pg)、EJS、原生 DOM + fetch

---

## Files Overview（會改動/新增嘅檔案）

**Backend**
- Modify: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/routes/categories.js`

**Admin UI**
- Modify: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/views/admin/categories.ejs`
- Modify: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/public/js/admin/categories.js`

**Tests**
- Create: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/test/admin-categories-hierarchy-ui.test.js`
- Create: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/test/admin-categories-hierarchy-api-validation.test.js`

---

### Task 1: 先用測試鎖定「分層 UI + API 防呆」會出現（TDD）

**Files:**
- Create: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/test/admin-categories-hierarchy-ui.test.js`
- Create: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/test/admin-categories-hierarchy-api-validation.test.js`

- [ ] **Step 1: 寫 failing test（categories.ejs 必須有上級分類 select + JS 必須做 tree render）**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('admin categories UI has parent selector and tree rendering hooks', () => {
  const ejs = fs.readFileSync(
    path.join(__dirname, '..', 'views', 'admin', 'categories.ejs'),
    'utf8'
  );
  assert.match(ejs, /category-parent/i);
  assert.match(ejs, /上級分類|大分類|子分類/i);

  const js = fs.readFileSync(
    path.join(__dirname, '..', 'public', 'js', 'admin', 'categories.js'),
    'utf8'
  );
  assert.match(js, /parent_id/i);
  assert.match(js, /childrenByParentId|roots|render/i);
  assert.match(js, /toggle/i);
});
```

- [ ] **Step 2: 寫 failing test（routes/categories.js 必須有層級防呆：parent 必須係 root / 禁止自指 / 禁止三層 / 刪除前檢查 children）**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('admin categories API validates hierarchy constraints', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', 'routes', 'categories.js'), 'utf8');
  assert.match(s, /parent_id/i);
  assert.match(s, /parent_id\s+IS\s+NULL/i);
  assert.match(s, /cannot|不可|禁止|invalid/i);
  assert.match(s, /DELETE/i);
});
```

- [ ] **Step 3: 跑測試確認 fail**

Run:

```bash
npm test
```

Expected: FAIL（因為 UI/後端未加入新欄位/防呆字串）。

- [ ] **Step 4: Commit（只提交測試）**

```bash
git add test/admin-categories-hierarchy-ui.test.js test/admin-categories-hierarchy-api-validation.test.js
git commit -m "test: add coverage for admin categories hierarchy UI and API validation"
```

---

### Task 2: 後端層級防呆（routes/categories.js）

**Files:**
- Modify: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/routes/categories.js`
- Test: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/test/admin-categories-hierarchy-api-validation.test.js`

- [ ] **Step 1: 在 admin create/update 解析 parent_id**

在 `POST /api/admin/categories`、`PUT /api/admin/categories/:id` 讀取 body 後加入：

```js
const parentIdRaw = req.body.parent_id;
const parentId = parentIdRaw === null || parentIdRaw === undefined || parentIdRaw === '' ? null : Number(parentIdRaw);
if (parentId !== null && (!Number.isInteger(parentId) || parentId <= 0)) {
  return res.status(400).json({ error: '上級分類不正確' });
}
```

- [ ] **Step 2: 實作校驗：parent 必須存在且係 root（parent.parent_id IS NULL）**

在 create/update，如果 `parentId !== null`，加入：

```js
const parentRow = await pool.query(
  'SELECT id, parent_id FROM categories WHERE id = $1 LIMIT 1',
  [parentId]
);
if (parentRow.rows.length === 0 || parentRow.rows[0].parent_id !== null) {
  return res.status(400).json({ error: '上級分類必須係大分類' });
}
```

- [ ] **Step 3: 實作校驗：更新時禁止自指 + 禁止 root（已經有 children）改成子分類**

在 update handler 取得 `id` 後，加入：

```js
if (parentId !== null && parentId === Number(req.params.id)) {
  return res.status(400).json({ error: '上級分類不可指向自己' });
}

if (parentId !== null) {
  const hasChildren = await pool.query(
    'SELECT 1 FROM categories WHERE parent_id = $1 LIMIT 1',
    [Number(req.params.id)]
  );
  if (hasChildren.rows.length > 0) {
    return res.status(400).json({ error: '已有子分類的大分類不可變成子分類' });
  }
}
```

- [ ] **Step 4: Delete 防呆：如仍有子分類不可刪**

在 `DELETE /api/admin/categories/:id` 執行刪除前加入：

```js
const hasChildren = await pool.query(
  'SELECT 1 FROM categories WHERE parent_id = $1 LIMIT 1',
  [Number(req.params.id)]
);
if (hasChildren.rows.length > 0) {
  return res.status(400).json({ error: '請先刪除子分類' });
}
```

- [ ] **Step 5: 跑測試確認 pass**

Run:

```bash
npm test
```

Expected: PASS（API validation test 會由 FAIL 轉 PASS）。

- [ ] **Step 6: Commit**

```bash
git add routes/categories.js
git commit -m "feat(admin): validate category hierarchy (two-level only)"
```

---

### Task 3: Admin Categories UI（EJS：加入上級分類欄位）

**Files:**
- Modify: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/views/admin/categories.ejs`
- Test: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/test/admin-categories-hierarchy-ui.test.js`

- [ ] **Step 1: 在右側表單加入上級分類 select**

在分類編輯表單欄位加入（保持現有樣式 class）：

```html
<div class="form-group">
  <label for="category-parent">上級分類</label>
  <select id="category-parent" class="form-control">
    <option value="">（無，上級＝大分類）</option>
  </select>
</div>
```

- [ ] **Step 2: 跑測試確認 UI test pass**

Run:

```bash
npm test
```

Expected: PASS（UI test 會 match 到 `category-parent`）。

- [ ] **Step 3: Commit**

```bash
git add views/admin/categories.ejs
git commit -m "feat(admin): add parent category selector to categories form"
```

---

### Task 4: Admin Categories JS（樹狀列表 + 展開/收合 + 新增子分類快捷）

**Files:**
- Modify: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/public/js/admin/categories.js`
- Test: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/test/admin-categories-hierarchy-ui.test.js`

- [ ] **Step 1: 在 JS 加入 tree 組裝（roots / childrenByParentId）**

加入 utilities（放喺 fetch 完 categories 後）：

```js
function buildTreeIndex(categories) {
  const roots = [];
  const childrenByParentId = {};
  const byId = {};

  for (const c of categories) byId[c.id] = c;
  for (const c of categories) {
    if (c.parent_id == null) roots.push(c);
    else {
      if (!childrenByParentId[c.parent_id]) childrenByParentId[c.parent_id] = [];
      childrenByParentId[c.parent_id].push(c);
    }
  }

  const nameOf = (c) => (c.name_zh_hk || c.name || '').toString();
  const sortFn = (a, b) => {
    const sa = Number.isFinite(a.sort_order) ? a.sort_order : 0;
    const sb = Number.isFinite(b.sort_order) ? b.sort_order : 0;
    if (sa !== sb) return sa - sb;
    return nameOf(a).localeCompare(nameOf(b));
  };

  roots.sort(sortFn);
  for (const k of Object.keys(childrenByParentId)) childrenByParentId[k].sort(sortFn);

  return { roots, childrenByParentId, byId };
}
```

- [ ] **Step 2: 大分類商品數顯示合計**

在 render 時，計算：

```js
function sumCounts(root, childrenByParentId) {
  const selfCount = Number(root.product_count || 0);
  const children = childrenByParentId[root.id] || [];
  const childrenCount = children.reduce((acc, c) => acc + Number(c.product_count || 0), 0);
  return selfCount + childrenCount;
}
```

- [ ] **Step 3: 樹狀 render（含展開/收合）**

維持使用現有 table/tbody 節點，將渲染切成兩層：

```js
const collapsedRoot = new Set();

function renderCategoryRows(state) {
  const { roots, childrenByParentId } = state;
  const tbody = document.querySelector('#categories-table tbody');
  tbody.innerHTML = '';

  for (const root of roots) {
    const children = childrenByParentId[root.id] || [];
    const isCollapsed = collapsedRoot.has(root.id);

    tbody.appendChild(renderRow(root, {
      isRoot: true,
      hasChildren: children.length > 0,
      isCollapsed,
      displayCount: sumCounts(root, childrenByParentId),
    }));

    if (!isCollapsed) {
      for (const child of children) {
        tbody.appendChild(renderRow(child, {
          isRoot: false,
          hasChildren: false,
          isCollapsed: false,
          displayCount: Number(child.product_count || 0),
        }));
      }
    }
  }
}
```

`renderRow(category, opts)` 需要做到：
- root：名用粗體；前面有 toggle（▾/▸）；有「新增子分類」按鈕
- child：名縮排（padding-left）；無 toggle；無新增子分類按鈕

- [ ] **Step 4: 新增子分類快捷**

在 root row 的「新增子分類」按鈕 click：
- 清空表單 id/name/slug/sort/status
- `#category-parent` 設為 root.id
- scroll 到表單位置（如果現有 JS 有類似行為就沿用）

- [ ] **Step 5: 表單 submit 時送出 parent_id**

提交 payload 前加入：

```js
const parentSel = document.getElementById('category-parent');
const parentId = parentSel && parentSel.value ? Number(parentSel.value) : null;
payload.parent_id = parentId;
```

- [ ] **Step 6: `#category-parent` options 只列 root（大分類）**

載入 categories 後：
- 先用 `buildTreeIndex` 拿 roots
- 以 roots 生成 `<option value="id">name</option>`

- [ ] **Step 7: 跑測試確認 pass**

Run:

```bash
npm test
```

Expected: PASS（UI test 會 match 到 tree/parent_id/toggle 字串）。

- [ ] **Step 8: 手動驗收**

Run:

```bash
npm run dev
```

Manual checks:
- 打開 `/admin/categories`：大分類行可展開/收合
- 點「新增子分類」：右側表單上級分類已自動選中該大分類
- 新增子分類後：列表縮排顯示於正確大分類底下
- 嘗試把「已有子分類」嘅大分類改成子分類：API 返回 400 並顯示錯誤
- 嘗試刪除仍有子分類嘅大分類：API 返回 400 並顯示錯誤

- [ ] **Step 9: Commit**

```bash
git add public/js/admin/categories.js
git commit -m "feat(admin): render categories as two-level tree with quick add child"
```

---

### Task 5: 最終回歸（全測試 + 目標行為確認）

**Files:**
- Modify (if needed): `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/routes/categories.js`
- Modify (if needed): `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/views/admin/categories.ejs`
- Modify (if needed): `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/public/js/admin/categories.js`

- [ ] **Step 1: 跑全測試**

Run:

```bash
npm test
```

Expected: PASS。

- [ ] **Step 2: Commit（如有零碎修正）**

```bash
git add -A
git commit -m "fix(admin): polish category hierarchy UX and validation"
```

