# 後台「庫存中心」（Inventory Center）V1 設計稿

## 目標
把「庫存流水 + 快速調整庫存」由分散喺商品頁的操作，提升成一個每日可用嘅營運頁面：
- 後台新增 `/admin/inventory`：集中查看庫存流水（可篩選/翻頁）
- 提供快速「調整庫存」入口（選 SKU、輸入 delta、備註可選）
- 仍然維持 Phase 1 單倉/單一 stock（warehouse 主要用作流水記錄欄位）

## 非目標（V1 不做）
- 不做採購/入庫單/出庫單/調撥單（完整 WMS）
- 不做分倉庫存拆帳（只記流水 warehouse_id；不維護 sku_warehouse_stocks）
- 不做自動補貨建議/安全庫存模型（可留待低庫存報表）

## 現況盤點（已存在能力）
- 已有 API：
  - `GET /api/admin/inventory/transactions`（流水列表，支援 `product_id` + pagination）
  - `POST /api/admin/inventory/adjust`（交易內更新 `product_skus.stock` + 寫入 `inventory_transactions`）
  - `GET /api/admin/warehouses`（倉庫列表）
- 已有後台商品頁 SKU 管理：可對單一 SKU 做庫存調整（modal）

## V1 UX（已確認）
- 後台新增選單「庫存」→ `/admin/inventory`
- 頁面上方：篩選條（倉庫、商品、SKU、日期範圍 optional）+ 刷新
- 頁面下方：流水表格（時間｜商品｜SKU｜倉庫｜類型｜變動數量｜調整前｜調整後｜備註）
- 右上角「調整庫存」：modal 內搜索/選 SKU → 輸入 delta/note → 成功後刷新列表（第 1 頁）

## API 設計

### 1) 擴展 `GET /api/admin/inventory/transactions`
保持向後相容，新增可選 query（全部可同時使用）：
- `sku_id`：只看某 SKU
- `warehouse_id`：只看某倉庫
- `type`：例如 `adjustment`
- `from` / `to`：以 `created_at` 範圍過濾（建議用 ISO 字串；後端轉 timestamp）
- 保留：`product_id`、`page`、`page_size`

回應：
- `transactions: []`（包含 `product_name`、`warehouse_name`）
- `pagination: { page, page_size, total }`

### 2) 新增 `GET /api/admin/inventory/skus`
目的：支援 modal「搜索 SKU」而唔需要一次過載入全商品 SKU。

Query：
- `q`（必填）：模糊搜尋 SKU / barcode / 商品名
- `limit`（可選，預設 20，上限 50）

回應（list）：
- `skus: [{ id, sku, barcode, stock, product_id, product_name }]`

### 3) 沿用 `POST /api/admin/inventory/adjust`
Body：
- `{ sku_id, delta, note?, warehouse_id? }`

行為：
- 交易內 `FOR UPDATE` 鎖定 SKU 行
- `new_stock = previous_stock + delta` 不可 < 0
- 寫入 `inventory_transactions`（type='adjustment'）
- 回傳 `{ success:true, transaction, sku:{ id, stock } }`

## 後台頁面

### 1) 新增 admin page
- `GET /admin/inventory`（require admin session）
- sidebar 增加「庫存」入口

### 2) 前端互動（admin JS）
初始化：
- 拉倉庫列表（`/api/admin/warehouses`）填 filter
- 拉流水第一頁（`/api/admin/inventory/transactions?page=1`）

篩選/翻頁：
- 將 filter 轉成 query string，重拉 transactions

調整庫存（modal）：
- 搜索 SKU：呼叫 `GET /api/admin/inventory/skus?q=...`
- 提交調整：`POST /api/admin/inventory/adjust`
- 成功後：刷新 transactions（第 1 頁）並清空 modal 狀態

## 錯誤處理與安全
- 所有 endpoints 必須 require admin（沿用現有 `requireAdmin`）
- 顯示錯誤用後台通用 error 區塊（同 products 頁一致）
- delta 驗證：必須 integer 且不為 0；庫存不可變負數（後端為準）
- 不記錄敏感資料（無需）

## 測試與驗收

### 自動化測試（node:test）
- `GET /api/admin/inventory/transactions` 支援新增 filters（至少驗證 SQL 會用 bind params，而非 string concat）
- `GET /api/admin/inventory/skus` 存在且 require admin
- `/admin/inventory` page 存在並載入對應 JS

### 手動驗收（後台）
- `/admin/inventory`：
  - 可見最新流水；可按倉庫/商品/SKU/日期範圍篩選
  - 「調整庫存」成功後即刻出現新流水，並且 stock 更新正確

