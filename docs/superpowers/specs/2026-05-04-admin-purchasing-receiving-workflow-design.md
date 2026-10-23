# Admin 採購 → 收貨 → 入庫（V1）設計

## 目標
- 後台提供最小可用「採購 → 收貨 → 入庫」閉環，支援分倉庫存（`inventory_levels`）：
  - 供應商管理（Suppliers）
  - 採購單（Purchase Orders）建立/查閱/狀態流轉
  - 收貨入庫：按 SKU/數量入庫到指定倉庫，寫入 `inventory_transactions` 並同步更新 `inventory_levels` + `product_skus.stock`
- 修正現有 suppliers / purchase_orders API 與 DB schema 欄位名不一致問題（避免 runtime query error）。

## 非目標（V1 不做）
- 批量列印/匯出 PO
- 複雜採購定價策略、稅務、供應商結算
- PO 多階段（partial shipment/multi receiving）以外嘅高級狀態機（V1 只做簡化狀態）
- 入庫時自動生成 SKU（V1 假設 SKU 已存在）
- ShipAny 物流工作台（屬另一條線）

## 現況與缺口
- 已存在 DB tables：`suppliers`、`purchase_orders`、`purchase_order_items`
- 已存在部分 API（`routes/logistics.js`）但欄位名與 schema 不一致：
  - suppliers：schema 用 `email`/`notes`；現 API 用 `contact_email`/`note`
  - purchase_orders：schema 用 `po_number`/`expected_arrival_date`/`notes`/`created_by`；現 API 用 `expected_arrival`/`note` 且未寫 `po_number/created_by`
  - purchase_order_items：schema 用 `po_id`/`sku_id`；現 API 用 `purchase_order_id`/`product_sku_id`
- 後台頁面缺口：沒有 `/admin/suppliers`、`/admin/purchase-orders` 對應 UI/JS。

## 權限與守門（V1）
為避免引入新 permission 體系，V1 採用既有 RBAC key：
- Pages：
  - `/admin/suppliers`：`requireAdminPage('inventory:write')`
  - `/admin/purchase-orders`：`requireAdminPage('inventory:write')`
- APIs：
  - 讀取：`requirePermission('inventory:read')`（列表/詳情）
  - 寫入：`requirePermission('inventory:write')`（新增/更新/收貨入庫/改狀態）

## 資料模型（沿用 schema）
### suppliers
- 以 schema 為準：`name, contact_name, contact_phone, email, address, payment_terms, notes, is_active`

### purchase_orders
- `po_number`：由後端生成（格式：`PO-YYYYMMDD-<seq>` 或 `PO-<timestamp>`），避免前端自行維護
- `status`（V1 簡化）：
  - `draft`（草稿）
  - `ordered`（已下單）
  - `received`（已收貨，允許 partial 收貨後手動設為 received）
  - `cancelled`
- `expected_arrival_date`：date（可選）
- `notes`：text（可選）
- `created_by`：取 `req.user.id`

### purchase_order_items
- 欄位：`po_id, product_id, sku_id, quantity, cost_price, received_quantity`
- `received_quantity` V1 支援部分收貨（<= quantity）

## API（V1）
### Suppliers
- `GET /api/admin/suppliers`（inventory:read）
  - 回 `{ suppliers: [...] }`
- `POST /api/admin/suppliers`（inventory:write）
  - body：`name, contact_name, contact_phone, email, address, payment_terms, notes`
- `PUT /api/admin/suppliers/:id`（inventory:write）
  - body：同上 + `is_active`

### Purchase Orders
- `GET /api/admin/purchase-orders`（inventory:read）
  - filters（V1）：`status`（可選）
  - 回 `{ purchase_orders: [...] }`
- `POST /api/admin/purchase-orders`（inventory:write）
  - body：
    - `supplier_id`
    - `expected_arrival_date`（可選）
    - `notes`（可選）
    - `items[]`：`{ product_id, sku_id, quantity, cost_price }`
  - 行為：
    - server 生成 `po_number`
    - 計算 `total_amount = Σ quantity * cost_price`
    - status 預設 `draft`
- `GET /api/admin/purchase-orders/:id`（inventory:read）
  - 回：`purchase_order` + `supplier` + `items[]`
- `PUT /api/admin/purchase-orders/:id/status`（inventory:write）
  - body：`status`（draft/ordered/received/cancelled）
- `POST /api/admin/purchase-orders/:id/receive`（inventory:write）
  - body：
    - `warehouse_id`（可選；缺省則用預設倉庫）
    - `lines[]`：`{ sku_id, quantity, note }`
  - 行為（transaction）：
    - 更新對應 PO item：`received_quantity = received_quantity + quantity`（不得超過 `quantity`）
    - 寫 `inventory_transactions`：type = `purchase_receive`（或 `inbound`），quantity = +N，note 包含 PO number
    - 更新 `inventory_levels`（warehouse + sku）+ 更新 `product_skus.stock`（總庫存）

## 後台 UI（V1）
### /admin/suppliers
- 列表（name/contact/email/is_active）
- 表單：新增/編輯/停用（inline modal/區塊，避免 prompt）

### /admin/purchase-orders
- 列表（po_number/supplier/status/total_amount/expected_arrival_date/created_at）
- 建立 PO（簡化）：
  - 選 supplier
  - items：以「sku_id + quantity + cost_price」為主（V1 直接輸入 sku_id；之後可接 SKU 搜尋）
- 詳情 panel：
  - 顯示 items + received_quantity
  - 改 status（draft/ordered/received/cancelled）
  - 收貨入庫：
    - 選倉庫（可選）
    - 輸入 sku_id + 收貨數量（可重複多行）
    - 提交後顯示成功/錯誤

## 錯誤處理
- schema 對齊後，任何 SQL error 都用 500 + `{ error: '服務器錯誤' }`（並在 server log 輸出）
- 收貨入庫 validation：
  - sku_id/quantity 必須為正整數
  - quantity 不得導致 item received_quantity > quantity
  - 倉庫不存在/停用則 400

## 測試（node:test）
- 以現有 repo pattern（讀檔字串）做回歸：
  - suppliers/PO endpoints 存在且使用 `requirePermission('inventory:read|write')`
  - admin pages `/admin/suppliers`、`/admin/purchase-orders` 存在且載入對應 js
  - sidebar 有入口（受 `inventory:write` 或 `inventory:read` 控制）
  - 收貨入庫 endpoint 字串存在（`/api/admin/purchase-orders/:id/receive`）

## 驗收標準
- 可以：
  - 新增供應商
  - 新增採購單（草稿）
  - 對採購單收貨入庫（指定/預設倉庫）
  - 收貨後庫存即時反映到 `inventory_levels` + `product_skus.stock`，並有 `inventory_transactions` 流水
- `npm test` 全綠

