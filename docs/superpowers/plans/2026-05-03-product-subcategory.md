# 商品子分類（兩級分類）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 後台商品編輯支援「主分類/子分類」兩級選擇，並確保所有商品 `category_id` 必為子分類（葉子分類）；舊資料自動補齊。

**Architecture:** 沿用現有 `categories.parent_id` 作層級，不新增 `products.subcategory_id`。用 migration 先補「其他」子分類並把指向主分類嘅商品搬過去；API 端強制 `category_id` 必須係葉子分類；前端後台以兩級下拉操作但仍只提交子分類 id。

**Tech Stack:** Node.js（node:test）、Express、Postgres(pg)、EJS、原生 DOM + fetch

---

## Files Overview（會改動/新增嘅檔案）

**DB**
- Create: `migrations/2026-05-03-subcategory-backfill.sql`

**Backend**
- Modify: `routes/categories.js`（admin categories 回傳 parent_id）
- Modify: `routes/products.js`（admin create/update 驗證 category_id 必須為葉子分類；admin list 回傳主/子分類顯示名）

**Admin UI**
- Modify: `views/admin/products.ejs`（加入主分類/子分類兩個 select）
- Modify: `public/js/admin/products.js`（載入分類樹、兩級聯動、fillForm 自動選中主/子、提交只送子分類 id）

**Tests**
- Create: `test/subcategory-migration.test.js`
- Create: `test/products-category-leaf-validation.test.js`

---

### Task 1: Migration（建立「其他」子分類 + 搬商品）

**Files:**
- Create: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/migrations/2026-05-03-subcategory-backfill.sql`
- Test: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/test/subcategory-migration.test.js`

- [ ] **Step 1: 先寫 failing test（migration 檔案存在且包含核心語句）**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('subcategory migration exists and contains backfill logic', () => {
  const p = path.join(__dirname, '..', 'migrations', '2026-05-03-subcategory-backfill.sql');
  assert.ok(fs.existsSync(p), 'migration file must exist');
  const s = fs.readFileSync(p, 'utf8');
  assert.match(s, /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+categories/i);
  assert.match(s, /parent_id/i);
  assert.match(s, /-other/i);
  assert.match(s, /UPDATE\s+products/i);
});
```

- [ ] **Step 2: 跑測試確認 fail**

Run:

```bash
npm test
```

Expected: FAIL（migration file not exist）。

- [ ] **Step 3: 新增 migration SQL（可重覆執行，向後相容）**

```sql
-- Backfill subcategories (two-level categories) and ensure products.category_id points to a leaf subcategory.

-- Ensure categories table has parent_id (safe for existing schema)
ALTER TABLE categories ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL;

-- 1) For each root category, ensure an "其他" subcategory exists.
-- We create rows with slug "<parent-slug>-other" (or -other-2/-other-3 if taken)
DO $$
DECLARE
  parent RECORD;
  base_slug TEXT;
  candidate_slug TEXT;
  suffix INT;
  existing_id INT;
BEGIN
  FOR parent IN
    SELECT id, COALESCE(name_zh_hk, name) AS parent_name, slug
    FROM categories
    WHERE parent_id IS NULL
  LOOP
    base_slug := parent.slug || '-other';
    candidate_slug := base_slug;
    suffix := 2;

    LOOP
      SELECT id INTO existing_id FROM categories WHERE slug = candidate_slug LIMIT 1;
      EXIT WHEN existing_id IS NULL;
      candidate_slug := base_slug || '-' || suffix::text;
      suffix := suffix + 1;
    END LOOP;

    INSERT INTO categories (name, name_zh_hk, slug, parent_id, sort_order, status, created_at, updated_at)
    SELECT '其他', '其他', candidate_slug, parent.id, 9999, 'active', NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM categories c
      WHERE c.parent_id = parent.id AND c.slug LIKE (parent.slug || '-other%')
      LIMIT 1
    );
  END LOOP;
END $$;

-- 2) Move products whose category_id points to a root category into that root's "其他" subcategory.
WITH root_categories AS (
  SELECT id AS root_id, slug AS root_slug
  FROM categories
  WHERE parent_id IS NULL
),
other_subcategories AS (
  SELECT c.parent_id AS root_id, c.id AS other_id
  FROM categories c
  JOIN root_categories r ON r.root_id = c.parent_id
  WHERE c.slug LIKE (r.root_slug || '-other%')
),
products_to_move AS (
  SELECT p.id AS product_id, o.other_id
  FROM products p
  JOIN root_categories r ON r.root_id = p.category_id
  JOIN other_subcategories o ON o.root_id = r.root_id
)
UPDATE products p
SET category_id = m.other_id, updated_at = NOW()
FROM products_to_move m
WHERE p.id = m.product_id;
```

- [ ] **Step 4: 跑測試確認 pass**

Run:

```bash
npm test
```

Expected: PASS（migration 檔案/測試通過）。

- [ ] **Step 5: 手動執行 migration（本地）**

Run:

```bash
psql "$DATABASE_URL" -f migrations/2026-05-03-subcategory-backfill.sql
```

Expected: 執行成功（無 syntax error）。

- [ ] **Step 6: Commit**

```bash
git add migrations/2026-05-03-subcategory-backfill.sql test/subcategory-migration.test.js
git commit -m "db: backfill subcategories and move products to leaf category"
```

---

### Task 2: Products API 強制 category_id 必須係葉子分類

**Files:**
- Modify: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/routes/products.js`
- Test: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/test/products-category-leaf-validation.test.js`

- [ ] **Step 1: 寫 failing test（routes/products.js 必包含 leaf 校驗 SQL）**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('admin products create/update validates category_id is leaf subcategory', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', 'routes', 'products.js'), 'utf8');
  assert.match(s, /NOT\s+EXISTS\s*\\(\\s*SELECT\\s+1\\s+FROM\\s+categories/i);
  assert.match(s, /parent_id/i);
  assert.match(s, /請選擇子分類/i);
});
```

- [ ] **Step 2: 跑測試確認 fail**

Run:

```bash
npm test
```

Expected: FAIL（尚未有校驗字串/SQL）。

- [ ] **Step 3: 在 routes/products.js 加 leaf 校驗（POST/PUT 共用）**

在 admin create/update handler 最前面加入一段：

```js
async function assertLeafSubcategory(pool, categoryId) {
  const r = await pool.query(
    `SELECT c.id
     FROM categories c
     WHERE c.id = $1
       AND c.parent_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM categories c2 WHERE c2.parent_id = c.id)
     LIMIT 1`,
    [categoryId]
  );
  return r.rows.length > 0;
}
```

然後：
- 不符合就 `return res.status(400).json({ error: '請選擇子分類' });`

- [ ] **Step 4: 跑測試確認 pass**

Run:

```bash
npm test
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add routes/products.js test/products-category-leaf-validation.test.js
git commit -m "feat: enforce leaf subcategory for products.category_id"
```

---

### Task 3: Admin categories API 回傳 parent_id（支援前端兩級下拉）

**Files:**
- Modify: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/routes/categories.js`

- [ ] **Step 1: 確認 /api/admin/categories 回傳 rows 已包含 parent_id**

若 SQL 係 `SELECT * FROM categories ...` 則天然包含；否則補上 `parent_id` 欄位。

- [ ] **Step 2: 跑測試**

Run:

```bash
npm test
```

Expected: PASS。

- [ ] **Step 3: Commit**

```bash
git add routes/categories.js
git commit -m "feat: include parent_id in admin categories output"
```

---

### Task 4: 後台商品頁加入主/子分類兩級選擇

**Files:**
- Modify: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/views/admin/products.ejs`
- Modify: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/public/js/admin/products.js`

- [ ] **Step 1: 修改 products.ejs（把單一分類 select 拆成兩個）**

將：

```ejs
<label class="text-sm block">
  <div class="mb-1">分類</div>
  <select id="product-category" class="admin-input w-full"></select>
</label>
```

改為：

```ejs
<div class="grid grid-cols-2 gap-2">
  <label class="text-sm block">
    <div class="mb-1">主分類</div>
    <select id="product-parent-category" class="admin-input w-full"></select>
  </label>
  <label class="text-sm block">
    <div class="mb-1">子分類</div>
    <select id="product-category" class="admin-input w-full"></select>
  </label>
</div>
```

- [ ] **Step 2: 修改 admin/products.js：建立分類樹與聯動**

新增 refs：
- `parentCategory: $('#product-parent-category')`

載入 categories 後建立：
- `parents = categories.filter(c => !c.parent_id)`
- `childrenByParent = Map(parent_id -> children[])`

行為：
- 父分類 select：只放 parents
- 當 parent 改變：重建子分類 select（children）
- `fillForm(p)`：
  - 找到子分類 `p.category_id`
  - 計算 parent：`child.parent_id`，並設兩個 select
- submit payload：只送 `category_id = 子分類 id`

- [ ] **Step 3: 商品列表顯示 `主/子`**

在 `loadProducts()` render 行：
- 由 server 先帶 `category_name`（子）與 `parent_category_name`（主），顯示：`${parent} / ${child}`

- [ ] **Step 4: 跑測試**

Run:

```bash
npm test
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add views/admin/products.ejs public/js/admin/products.js
git commit -m "feat: admin products supports parent/subcategory selectors"
```

---

### Task 5: Admin products list 回傳主/子分類顯示名（可選但建議）

**Files:**
- Modify: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/routes/products.js`

- [ ] **Step 1: 調整 admin list SQL**

把 admin list query join categories 改為：
- `c` = 子分類（`p.category_id = c.id`）
- `pc` = 主分類（`c.parent_id = pc.id`）

示例：

```sql
SELECT p.*,
  COALESCE(c.name_zh_hk, c.name) AS category_name,
  COALESCE(pc.name_zh_hk, pc.name) AS parent_category_name
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN categories pc ON c.parent_id = pc.id
...
```

- [ ] **Step 2: 跑測試**

Run:

```bash
npm test
```

Expected: PASS。

- [ ] **Step 3: Commit**

```bash
git add routes/products.js
git commit -m "feat: admin products list includes parent/subcategory names"
```

---

## Spec Coverage Self-Review
- 子分類資料結構：使用 categories.parent_id（Task 4 + Task 3）
- 所有商品有子分類：migration 建「其他」+ 搬商品（Task 1）
- API 強制葉子分類：Task 2
- 後台顯示/選擇主子分類：Task 4 + Task 5

Placeholder scan：無 TBD/TODO；每步均有具體 code/command。

