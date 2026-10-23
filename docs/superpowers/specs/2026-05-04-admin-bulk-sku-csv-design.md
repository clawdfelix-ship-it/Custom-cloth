# 後台「批量更新 SKU」（CSV）V1 設計稿

## 目標
用 Excel/Google Sheets 方式批量更新 SKU 資料，減少逐件商品逐條 SKU 編輯成本：
- 後台新增 `/admin/bulk-skus`
- 提供「下載模板 CSV」
- 提供「上傳 CSV」批量更新：
  - `product_skus.cost_price`（成本）
  - `product_skus.price`（售價）
  - `product_skus.barcode`（條碼，可選）
  - `product_skus.is_active`（啟用/停用，可選）
  - `product_skus.stock`（用 *目標庫存* 寫入，並寫 `inventory_transactions` 流水）
- 全程 require admin

## 非目標（V1 不做）
- 不做自動建立 SKU（只更新既有 SKU）
- 不做多檔案/大批次佇列處理（先限制每次最多 2000 行）
- 不做複雜規格屬性批量編輯（attributes 先維持在商品頁編輯）

## UI / 操作流
後台新增「批量更新」→ `/admin/bulk-skus`
- Step 1：下載模板 CSV（可直接用 Excel 開）
- Step 2：上傳 CSV
  - 先做 dry-run（顯示成功/失敗行數 + 錯誤列表前 N 行）
  - dry-run 無錯後，按「確認套用」才真正寫入 DB

## CSV 格式（模板）
檔案第一行 header（固定）：
- `sku_id,barcode,cost_price,price,is_active,target_stock,note`

欄位規則：
- `sku_id`：必填，整數
- `barcode`：可空（空代表不更新）
- `cost_price`：可空（空代表不更新）
- `price`：可空（空代表不更新）
- `is_active`：可空；允許 `1/0/true/false`（空代表不更新）
- `target_stock`：可空；整數 >= 0（空代表不更新庫存）
- `note`：可空；如有更新庫存，會寫入 inventory_transactions.note

## 後端行為（核心）
新增 endpoint：
- `GET /api/admin/bulk-skus/template.csv`
- `POST /api/admin/bulk-skus/import`（multipart file）
  - 支援 query `dry_run=1`（只驗證，不寫 DB）
  - body 可選 `warehouse_id`：如果檔案內有任何庫存更新，該倉庫會用作流水 warehouse_id；否則用預設倉庫/第一個啟用倉庫

更新策略：
- 成本/售價/條碼/啟用：直接 update `product_skus`
- 庫存：用 `target_stock` 轉成 delta，再用 transaction 內 `FOR UPDATE` + `inventory_transactions` 記錄（type='adjustment'）

回應：
- dry-run：`{ ok:true, dry_run:true, summary:{ total, valid, invalid }, errors:[...] }`
- apply：`{ ok:true, dry_run:false, summary:{ total, updated_skus, stock_adjusted }, errors:[...] }`

## 安全與防呆
- require admin
- 行數限制：最多 2000 行
- `sku_id` 必須存在；否則該行報錯但不影響其他行（dry-run 會全列）
- `target_stock` 不可負；計算 delta 後不可令庫存變負（後端為準）

## 測試與驗收
- node:test：
  - page/nav link/JS wiring 存在
  - API wiring：template + import endpoint 存在，且使用 upload.single
- 手動：
  - 下載模板 → 填兩行 sku_id + cost/price/target_stock → dry-run 成功 → apply 後：
    - `/admin/products` SKU 成本/售價更新
    - `/admin/inventory` 可見新增流水

