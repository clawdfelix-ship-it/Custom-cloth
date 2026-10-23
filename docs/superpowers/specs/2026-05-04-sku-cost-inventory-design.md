# SKU／成本／庫存（參考 mall PMS）設計稿

## 目標
在不重寫技術棧（仍然 Node/Express + EJS + Postgres）前提下，參考 `macrozheng/mall` 的 PMS 思路，把後台「商品營運」補到可用：
- 商品編輯支援新增/管理 SKU（先用現有 `sku` 欄位，之後再升級到「商品ID + 規格組合」生成）
- 支援 SKU 成本價（可編輯、可追溯）
- 支援 SKU 庫存調整（寫入庫存流水，可追溯）
- 保持分類兩級（大分類＞子分類）不變

## 已確認決策
- **SKU 唯一識別策略**：先用現有 `product_skus.sku`（方案 C：先 A，再升級到 B）
- **未拆規格商品**：允許商品「零 SKU」（未設定 SKU 前，庫存功能視為未啟用）

## 非目標（Phase 1 不做）
- 不做完整 mall 式「屬性分類/規格模板/屬性關聯」全家桶
- 不做分倉庫存（先用單一 SKU stock；倉庫只作流水記錄必填欄位）
- 不做採購/出入庫單/調撥等完整 WMS

## 現況盤點（與本次改造直接相關）
- DB 已有：
  - `product_skus`：含 `cost_price`、`stock`、`attributes(json)`、`is_active`
  - `warehouses`
  - `inventory_transactions`（但目前主要只有查詢 API，欠缺寫入調整）
- 系統存在兩套 products admin API：
  - `routes/products.js`（舊）：使用 `products.stock`（但 schema 無此欄位）
  - `routes/products-full.js`（新）：使用 `product_skus.stock` 聚合總庫存（export/low-stock 已用）
- `app.js` 目前載入順序會令舊版 `/api/admin/products*` 先匹配，影響後台一致性

## Phase 1 設計（最小可營運）

### 1) 路由止血與一致性
目標：後台所有 `/api/admin/products*` 一律以 `routes/products-full.js` 為準。
- 調整方式：
  - 停用/移除 `routes/products.js` 內所有 `/api/admin/products*` 註冊（保留其 public API 如仍被使用）
  - 或改 `app.js` 載入順序，確保 admin products 由 full 版本先註冊且可用
- 驗收：後台商品列表/編輯實際返回 `skus` 並可見 `SUM(product_skus.stock)` 的總庫存

### 2) Default Warehouse（滿足 inventory_transactions.warehouse_id NOT NULL）
目標：庫存流水寫入必需 warehouse_id，但 Phase 1 不做分倉。
- 新增 migration：確保至少存在 1 個啟用倉庫（例如 `預設倉庫`），並記錄其 id 為「預設倉」
- API 行為：庫存調整若未提供 `warehouse_id`，自動使用「預設倉」

### 3) SKU 管理（避免 delete + reinsert）
目標：SKU id 穩定，避免抹掉歷史（inventory_transactions 會引用 sku_id）。

#### 3.1 新增/更新 SKU（策略）
- 產品更新時不再 `DELETE FROM product_skus WHERE product_id = $1`
- 改為 diff/upsert：
  - payload 帶 `skus: [{ id?, sku?, barcode?, attributes, price?, cost_price?, original_price?, stock?, is_active? }]`
  - 有 `id`：UPDATE 該 SKU（並限制必屬於該 product_id）
  - 無 `id`：INSERT 新 SKU（屬於該 product_id）
  - 被移除的舊 SKU：不刪除，改 `is_active=false`（保留歷史）

#### 3.2 成本價（可追溯）
- Phase 1：沿用 `product_skus.cost_price` 作主要成本價欄位（UI 可編輯）
- 成本歷史（兩個選項）：
  - **A（最小）**：先只依賴 `admin_action_logs` 記錄 old/new data（如目前已存在）
  - **B（推薦）**：加 `sku_cost_history` 以便精準查詢/導出
- 本期採用：B（推薦）

### 4) 庫存調整（寫入流水 + 更新 SKU stock）
新增一個後台 API（參考 mall 的「庫存調整」概念）：
- `POST /api/admin/inventory/adjust`
  - body：`sku_id`, `delta`（可正可負）, `warehouse_id?`, `note?`
  - 行為（必須在 DB transaction 中完成）：
    1) `SELECT ... FROM product_skus WHERE id=$1 FOR UPDATE`
    2) 計算 `previous_stock` / `new_stock = previous_stock + delta`（不可小於 0）
    3) `UPDATE product_skus SET stock=new_stock, updated_at=NOW()`
    4) `INSERT inventory_transactions (...) type='adjustment' quantity=delta previous_stock/new_stock warehouse_id`
  - 回傳：`{ success:true, sku:{...}, transaction:{...} }`
- 驗收：每次調整都會出現一筆 inventory_transactions；SKU stock 即時更新

### 5) 後台 UI（商品頁支援 SKU/成本/庫存）
目標：在現有 `/admin/products` 上增加 SKU 管理區塊，保持操作流暢。
- 商品列表：
  - 「庫存」改為顯示 `SUM(active SKUs stock)`；若零 SKU 顯示 `—`（代表未啟用庫存）
- 商品編輯：
  - 新增「SKU 管理」區塊：
    - SKU 列表（可新增行、編輯、停用）
    - 欄位：SKU、條碼、規格（attributes）、售價/成本、庫存（讀取）、啟用狀態
    - 庫存調整按鈕：彈窗輸入 `delta + note (+ warehouse)`，提交後刷新該 SKU 庫存
  - 若零 SKU：顯示提示「未設定 SKU，庫存功能未啟用」，並提供「新增 SKU」一鍵加第一行

## Phase 2（之後升級，對齊 mall 更完整 PMS）
- 規格/屬性模型（商品ID + 規格組合生成 SKU）
- 分倉庫存：新增 `sku_warehouse_stocks`，庫存調整落分倉表並自動聚合總庫存
- 倉庫管理 UI + 調撥/入庫/出庫單

## 測試與驗收
### 自動化測試（node:test）
- 路由一致性：確保 `/api/admin/products` 命中 full 版本（不再使用舊版 products.js 的 `products.stock`）
- SKU 更新不刪歷史：PUT product 不會 delete 全部 SKU（會 update/insert/停用）
- 庫存調整：adjust endpoint 會寫 inventory_transactions 並更新 SKU stock
- 預設倉庫：未提供 warehouse_id 仍可成功寫入（使用預設倉）

### 手動驗收（後台）
- `/admin/products`：
  - 商品可新增 SKU；可編輯成本價；可調整庫存且可見流水
  - 商品列表庫存顯示正確；零 SKU 顯示 `—`

