# SKU／成本／庫存（參考 mall PMS）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 後台商品支援 SKU 管理（新增/編輯/停用）、SKU 成本價（可追溯）、SKU 庫存調整（寫流水），並止血統一 admin products API 走 `products-full.js`。

**Architecture:** 以 `product_skus` 作為 SKU 核心資料（成本/庫存），以 `inventory_transactions` 記錄庫存流水；新增「預設倉庫」滿足 `warehouse_id NOT NULL`。後端更新商品時改為 upsert/停用 SKU，避免 delete+reinsert 造成 sku_id 不穩定與歷史斷裂。後台 UI 在 `/admin/products` 加 SKU 管理區塊與庫存調整彈窗。

**Tech Stack:** Node.js（node:test）、Express、Postgres(pg)、EJS、原生 DOM + fetch

---

## Files Overview（會改動/新增嘅檔案）

**DB**
- Create: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/migrations/2026-05-04-default-warehouse-and-sku-cost-history.sql`

**Backend**
- Modify: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/app.js`
- Modify: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/routes/products.js`（停用 admin products endpoints）
- Modify: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/routes/products-full.js`（SKU diff/upsert + 庫存調整 API）

**Admin UI**
- Modify: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/views/admin/products.ejs`
- Modify: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/public/js/admin/products.js`

**Tests**
- Create: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/test/admin-products-route-precedence.test.js`
- Create: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/test/sku-upsert-not-delete.test.js`
- Create: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/test/inventory-adjustment-route-wiring.test.js`
- Create: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/test/inventory-adjustment-logic.test.js`

---

## Task 0: 先確認現況（避免改錯入口）

**Files:**
- Inspect: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/app.js`

- [ ] **Step 1: 確認 app.js routes 載入順序**

預期現況：`routes/products.js` 先於 `routes/products-full.js` 註冊，導致 `/api/admin/products*` 命中舊版。

- [ ] **Step 2: 寫 test 鎖定「admin products 只能由 products-full.js 提供」**

（見 Task 1）

---

### Task 1: 止血—統一 admin products API（避免使用 products.stock）

**Files:**
- Create: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/test/admin-products-route-precedence.test.js`
- Modify: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/routes/products.js`
- Modify: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/app.js`（如需要）

- [ ] **Step 1: 寫 failing test（確保 app.js 不再註冊舊 admin products）**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('admin products routes must not be registered by routes/products.js', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', 'routes', 'products.js'), 'utf8');
  assert.doesNotMatch(s, /app\\.post\\('\\/api\\/admin\\/products'\\)/);
  assert.doesNotMatch(s, /app\\.put\\('\\/api\\/admin\\/products\\//);
  assert.doesNotMatch(s, /app\\.get\\('\\/api\\/admin\\/products'\\)/);
});
```

- [ ] **Step 2: 跑測試確認 fail**

Run:

```bash
npm test
```

Expected: FAIL（因為 routes/products.js 目前仍有 admin products endpoints）。

- [ ] **Step 3: 在 routes/products.js 移除/停用所有 `/api/admin/products*`**

要求：
- 保留 public products API（如仍有用）
- 保留 `assertLeafSubcategory` 等公用 helper 可留，但唔再註冊 admin products routes

最小改法：刪除或註解（刪除優先）：
- `app.get('/api/admin/products'...)`
- `app.post('/api/admin/products'...)`
- `app.put('/api/admin/products/:id'...)`
- `app.delete('/api/admin/products/:id'...)`

- [ ] **Step 4: 如 app.js 仍需要，確保 `products-full.js` 提供 admin products routes**

檢查 `routes/products-full.js` 已有 `GET/POST/PUT/DELETE /api/admin/products`，若缺則補齊。

- [ ] **Step 5: 跑測試確認 pass**

Run:

```bash
npm test
```

Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add routes/products.js test/admin-products-route-precedence.test.js
git commit -m "fix(admin): ensure admin products routes use products-full implementation"
```

---

### Task 2: DB migration（預設倉庫 + SKU 成本歷史表）

**Files:**
- Create: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/migrations/2026-05-04-default-warehouse-and-sku-cost-history.sql`

- [ ] **Step 1: 寫 failing test（migration 檔案存在且包含預設倉庫與 sku_cost_history）**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('sku cost/inventory migration exists', () => {
  const p = path.join(__dirname, '..', 'migrations', '2026-05-04-default-warehouse-and-sku-cost-history.sql');
  assert.ok(fs.existsSync(p), 'migration file must exist');
  const s = fs.readFileSync(p, 'utf8');
  assert.match(s, /CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+sku_cost_history/i);
  assert.match(s, /INSERT\\s+INTO\\s+warehouses/i);
});
```

- [ ] **Step 2: 跑測試確認 fail**

Run:

```bash
npm test
```

Expected: FAIL（migration file not exist）。

- [ ] **Step 3: 寫 migration SQL**

```sql
-- Ensure there is at least one default warehouse and add SKU cost history.

CREATE TABLE IF NOT EXISTS sku_cost_history (
  id SERIAL PRIMARY KEY,
  sku_id INTEGER NOT NULL REFERENCES product_skus(id) ON DELETE CASCADE,
  old_cost_price DECIMAL(10,2),
  new_cost_price DECIMAL(10,2),
  changed_by_admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed a default warehouse if none exists (Phase 1: no per-warehouse stock, warehouse_id required for transactions)
INSERT INTO warehouses (name, address, contact_name, contact_phone, is_active)
SELECT '預設倉庫', NULL, NULL, NULL, true
WHERE NOT EXISTS (SELECT 1 FROM warehouses WHERE is_active = true LIMIT 1);
```

- [ ] **Step 4: 跑測試確認 pass**

Run:

```bash
npm test
```

Expected: PASS（migration test pass）。

- [ ] **Step 5: 手動執行 migration（本地）**

Run:

```bash
psql "$DATABASE_URL" -f migrations/2026-05-04-default-warehouse-and-sku-cost-history.sql
```

Expected: 成功（無 syntax error）。

- [ ] **Step 6: Commit**

```bash
git add migrations/2026-05-04-default-warehouse-and-sku-cost-history.sql test/*.test.js
git commit -m "db: add sku cost history and seed default warehouse"
```

---

### Task 3: 庫存調整 API（POST /api/admin/inventory/adjust）

**Files:**
- Create: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/test/inventory-adjustment-route-wiring.test.js`
- Create: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/test/inventory-adjustment-logic.test.js`
- Modify: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/routes/products-full.js`

- [ ] **Step 1: 寫 failing wiring test（route 存在）**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('inventory adjustment route is registered', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', 'routes', 'products-full.js'), 'utf8');
  assert.match(s, /\\/api\\/admin\\/inventory\\/adjust/);
});
```

- [ ] **Step 2: 寫 failing logic test（抽出純函數：computeNewStock）**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { computeNewStock } = require('../lib/inventory');

test('computeNewStock rejects negative result', () => {
  assert.throws(() => computeNewStock({ previousStock: 2, delta: -3 }), /stock cannot go below 0/i);
});

test('computeNewStock returns new stock', () => {
  assert.deepEqual(computeNewStock({ previousStock: 2, delta: 3 }), { previousStock: 2, newStock: 5 });
});
```

- [ ] **Step 3: 跑測試確認 fail**

Run:

```bash
npm test
```

Expected: FAIL（lib/inventory 未存在 + route 未註冊）。

- [ ] **Step 4: 新增 lib/inventory.js（minimal implementation）**

Create:
`/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/lib/inventory.js`

```js
function computeNewStock({ previousStock, delta }) {
  const prev = Number(previousStock);
  const d = Number(delta);
  if (!Number.isInteger(prev) || prev < 0) throw new Error('invalid previousStock');
  if (!Number.isInteger(d)) throw new Error('invalid delta');
  const next = prev + d;
  if (next < 0) throw new Error('stock cannot go below 0');
  return { previousStock: prev, newStock: next };
}

module.exports = { computeNewStock };
```

- [ ] **Step 5: 在 products-full.js 加 route**

在既有 `GET /api/admin/inventory/transactions` 附近加入：

```js
const { computeNewStock } = require('../lib/inventory');

app.post('/api/admin/inventory/adjust', requireAdmin, async (req, res) => {
  try {
    const skuId = Number(req.body.sku_id);
    const delta = Number(req.body.delta);
    const note = req.body.note ? String(req.body.note) : null;
    let warehouseId = req.body.warehouse_id ? Number(req.body.warehouse_id) : null;

    if (!Number.isInteger(skuId) || skuId <= 0) return res.status(400).json({ error: 'sku_id 不正確' });
    if (!Number.isInteger(delta) || delta === 0) return res.status(400).json({ error: 'delta 不正確' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      if (!warehouseId) {
        const w = await client.query('SELECT id FROM warehouses WHERE is_active = true ORDER BY id ASC LIMIT 1');
        if (w.rows.length === 0) return res.status(500).json({ error: '未設定倉庫' });
        warehouseId = w.rows[0].id;
      }

      const skuRow = await client.query(
        `SELECT ps.id, ps.product_id, ps.stock
         FROM product_skus ps
         WHERE ps.id = $1
         FOR UPDATE`,
        [skuId]
      );
      if (skuRow.rows.length === 0) return res.status(404).json({ error: 'SKU 不存在' });

      const { previousStock, newStock } = computeNewStock({ previousStock: skuRow.rows[0].stock, delta });

      await client.query(
        'UPDATE product_skus SET stock = $1, updated_at = NOW() WHERE id = $2',
        [newStock, skuId]
      );

      const tx = await client.query(
        `INSERT INTO inventory_transactions
          (product_id, sku_id, warehouse_id, type, quantity, previous_stock, new_stock, reference_id, note)
         VALUES ($1,$2,$3,'adjustment',$4,$5,$6,NULL,$7)
         RETURNING *`,
        [skuRow.rows[0].product_id, skuId, warehouseId, delta, previousStock, newStock, note]
      );

      await client.query('COMMIT');
      return res.json({ success: true, transaction: tx.rows[0], sku: { id: skuId, stock: newStock } });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (e) {
    return res.status(500).json({ error: e && e.message ? e.message : '服務器錯誤' });
  }
});
```

- [ ] **Step 6: 跑測試確認 pass**

Run:

```bash
npm test
```

Expected: PASS（wiring + computeNewStock tests pass）。

- [ ] **Step 7: Commit**

```bash
git add lib/inventory.js routes/products-full.js test/inventory-adjustment-*.test.js
git commit -m "feat(admin): add inventory adjustment endpoint with transaction log"
```

---

### Task 4: SKU 更新改為 upsert/停用（不再 delete+reinsert）

**Files:**
- Create: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/test/sku-upsert-not-delete.test.js`
- Modify: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/routes/products-full.js`

- [ ] **Step 1: 寫 failing test（routes/products-full.js 不應出現 DELETE 全部 SKU）**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('product update must not delete all skus', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', 'routes', 'products-full.js'), 'utf8');
  assert.doesNotMatch(s, /DELETE\\s+FROM\\s+product_skus\\s+WHERE\\s+product_id\\s*=\\s*\\$1/i);
});
```

- [ ] **Step 2: 跑測試確認 fail**

Run:

```bash
npm test
```

Expected: FAIL（因為現況有 delete+reinsert）。

- [ ] **Step 3: 在 PUT /api/admin/products/:id 改成 diff/upsert**

實作策略（最小可行）：
- 讀 `req.body.skus`（如 undefined/null -> 視為不改 SKU；如 [] -> 全部停用）
- 先查現有 SKU：`SELECT id FROM product_skus WHERE product_id=$1`
- 逐個 payload sku：
  - 有 `id`：`UPDATE product_skus SET ... WHERE id=$1 AND product_id=$2`
  - 無 `id`：`INSERT INTO product_skus (...) VALUES (...) RETURNING id`
- 最後將「存在但不在 payload」嘅 SKU：`UPDATE product_skus SET is_active=false WHERE id = ANY($1)`
- 注意：`sku` 欄位 UNIQUE，插入時若空值允許多筆（Postgres UNIQUE 對 NULL 允許重複），因此允許零 SKU 的同時也允許 sku 先留空。

- [ ] **Step 4: 可選：成本價變更寫入 sku_cost_history**

當 UPDATE SKU 時，如果 `cost_price` 有變：
- 插入 `sku_cost_history(sku_id, old_cost_price, new_cost_price, changed_by_admin_id, reason)`
  - `changed_by_admin_id` 取 `req.session.userId`（如存在）
  - `reason` 可先留空（UI 下一步再加）

- [ ] **Step 5: 跑測試確認 pass**

Run:

```bash
npm test
```

Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add routes/products-full.js test/sku-upsert-not-delete.test.js
git commit -m "feat(admin): upsert/disable product skus on update (preserve history)"
```

---

### Task 5: 後台商品頁加入 SKU 管理區塊 + 庫存調整 UI

**Files:**
- Modify: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/views/admin/products.ejs`
- Modify: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/public/js/admin/products.js`

- [ ] **Step 1: 先寫 failing UI test（確認 products.ejs 有 SKU 區塊 marker）**

Create:
`/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/test/admin-products-sku-ui.test.js`

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('admin products form includes sku management section', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', 'views', 'admin', 'products.ejs'), 'utf8');
  assert.match(s, /sku-management/i);
  assert.match(s, /新增\\s*SKU|SKU\\s*管理/);
});
```

- [ ] **Step 2: 跑測試確認 fail**

Run:

```bash
npm test
```

Expected: FAIL。

- [ ] **Step 3: 在 products.ejs 加 SKU 管理區塊（不加註解）**

加入一個簡單 table + 按鈕：
- `#sku-management` 容器（供 JS 渲染）
- 「新增 SKU」按鈕
- 「庫存調整」彈窗（可用 `<dialog>` 或 hidden div）

（具體 DOM 結構由 JS 渲染為主，EJS 只提供容器）

- [ ] **Step 4: 在 admin/products.js**

要求：
- load product detail 時取 `data.skus`
- render SKU rows：
  - 欄位：sku、barcode、cost_price、price、stock（read-only）、is_active
  - 新增 SKU：append 空白 row
  - 停用：toggle is_active
- submit payload：
  - 加入 `skus` array（包含 id?）
  - 對於商品零 SKU：送 `skus: []`（表示全部停用/無 SKU）
- 庫存調整：
  - 選一個 sku 行 -> 輸入 delta/note -> `POST /api/admin/inventory/adjust`
  - 成功後刷新該 SKU stock（可直接用回傳值更新）
- 商品列表庫存顯示：
  - 若 API 已回 `total_stock` 或 `sku_stock_sum`：用該欄位
  - 否則先顯示 `—`（避免依賴不存在嘅 `p.stock`）

- [ ] **Step 5: 跑測試確認 pass**

Run:

```bash
npm test
```

Expected: PASS。

- [ ] **Step 6: 手動驗收**

Run:

```bash
PORT=3334 npm run dev
```

Manual checks:
- `/admin/products`：新增 SKU、儲存後仍可再次編輯（SKU id 保持）
- 庫存調整：改動後庫存即時變、且 `/api/admin/inventory/transactions?product_id=...` 查到流水
- 商品零 SKU：庫存顯示 `—`，且無 crash

- [ ] **Step 7: Commit**

```bash
git add views/admin/products.ejs public/js/admin/products.js test/admin-products-sku-ui.test.js
git commit -m "feat(admin): add sku management UI and inventory adjustment flow"
```

---

### Task 6: 最終回歸（全測試 + 重要路徑 smoke）

**Files:**
- Modify (if needed): `routes/products-full.js`, `public/js/admin/products.js`

- [ ] **Step 1: 跑全測試**

Run:

```bash
npm test
```

Expected: PASS。

- [ ] **Step 2: 手動 smoke**

Check:
- `GET /api/admin/products` 不再報 products.stock
- `GET /api/admin/products/:id` 有 `skus: []` 或陣列
- `POST /api/admin/inventory/adjust` 正常寫入流水

- [ ] **Step 3: Commit（如有零碎修正）**

```bash
git add -A
git commit -m "fix(admin): polish sku/cost/inventory UX and wiring"
```

