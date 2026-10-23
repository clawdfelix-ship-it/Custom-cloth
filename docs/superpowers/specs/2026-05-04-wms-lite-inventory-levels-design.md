# WMS Lite（分倉庫存）V1 設計稿

## 目標
由「SKU 只有一個總庫存」升級到「SKU 可按倉庫分開庫存」，並保持現有後台庫存中心/低庫存/商品頁都可繼續用。

V1 範圍：
- 新增 `inventory_levels`（warehouse_id + sku_id 層級庫存）
- 任何庫存調整都寫入指定倉庫嘅 `inventory_levels.stock`
- 同步維持 `product_skus.stock` ＝總庫存（避免大改現有查詢/UI）
- `inventory_transactions.previous_stock/new_stock` 以「該倉庫 SKU 庫存」為準

## 非目標（V1 不做）
- 入庫單/出庫單/調撥單/盤點單
- 批量出貨/波次拣貨/包裝台
- 多倉庫自動分配出貨（先人工指定）

## 資料模型
新增表：`inventory_levels`
- `warehouse_id` FK → `inventory_warehouses(id)`
- `sku_id` FK → `product_skus(id)`
- `stock` int not null default 0
- unique `(warehouse_id, sku_id)`

## Backfill / Migration
目的：唔破壞現有庫存數字
- 以「預設倉庫（inventory_warehouses.is_default=true）優先；否則用最細 id active 倉庫」作 backfill 目標
- 把所有現有 `product_skus.stock` 填入該倉庫嘅 `inventory_levels.stock`
- 保持 `product_skus.stock` 不變（仍代表總庫存）

## API 行為改動
### `POST /api/admin/inventory/adjust`
- warehouse_id：
  - request 有傳就用傳入
  - 冇傳就用預設倉庫/第一個 active 倉庫
- transaction：
  - 確保 `inventory_levels` 行存在（insert on conflict do nothing）
  - `SELECT ... FOR UPDATE` 鎖住該倉庫 `inventory_levels` 行（同時鎖住 `product_skus` 行）
  - 計算新倉庫庫存（不可 < 0）
  - 更新 `inventory_levels.stock`
  - 同步更新 `product_skus.stock = product_skus.stock + delta`（不可 < 0）
  - insert `inventory_transactions`（previous/new 用倉庫庫存）

### `POST /api/admin/bulk-skus/import`
- `target_stock` 視為「總庫存」
- 套用時會用預設倉庫承接差額（inventory_levels + delta），並把 `product_skus.stock` 更新到 target

## UI（V1）
沿用現有：
- `/admin/inventory`：已支援 warehouse filter；調整庫存會落到該 warehouse
- `/admin/products`：仍顯示總庫存（sku 合計）

## 測試/驗收
- migration 存在並包含：
  - create `inventory_levels`
  - backfill to default warehouse
- inventory adjust route：
  - 使用 `inventory_levels`（insert on conflict + select for update）
  - `inventory_transactions` previous/new 係倉庫庫存
- `npm test` 全綠

