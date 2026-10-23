# 後台「低庫存報表」（Low Stock Report）V1 設計稿

## 目標
新增一個每日營運會用到嘅「低庫存」頁面，幫你快速搵出缺貨 SKU，同埋一鍵匯出 CSV 做補貨/盤點。

- 後台新增 `/admin/low-stock`
- 以 **SKU** 為單位列出低庫存（因為庫存目前落喺 `product_skus.stock`）
- 全站固定門檻（預設 **5**，頁面可即時改）
- 支援 CSV 匯出
- 每行可一鍵跳去 `/admin/inventory?sku_id=...` 做調整/查流水

## 非目標（V1 不做）
- 唔做每個 SKU 自訂門檻
- 唔做分類/品牌門檻、智能補貨建議
- 唔做商品層級展開 SKU（直接做 SKU 列表）

## UI / 操作流（已確認）
- 左側選單新增「低庫存」→ `/admin/low-stock`
- 頂部操作：
  - 門檻 threshold（預設 5）
  - 刷新
  - 匯出 CSV
- 表格欄位（每行一個 SKU）：
  - 商品名｜SKU｜條碼｜庫存｜更新時間｜操作（去庫存中心）
- 操作：
  - 「去庫存中心」跳到 `/admin/inventory?sku_id=<sku_id>`

## API 設計

### 1) `GET /api/admin/low-stock/skus`
Query：
- `threshold`（可選，預設 5）

回應：
- `threshold`
- `skus: [{ sku_id, sku, barcode, stock, product_id, product_name, product_slug, updated_at }]`

篩選/排序：
- `ps.is_active = true`
- `ps.stock <= threshold`
- `ORDER BY ps.stock ASC, ps.id ASC`

### 2) `GET /api/admin/low-stock/skus/export.csv`
Query：
- `threshold`（可選，預設 5）

回應：
- `Content-Type: text/csv`
- `Content-Disposition: attachment; filename="low-stock-skus-YYYY-MM-DD.csv"`

CSV 欄位：
- `Product ID,Product Name,Product Slug,SKU ID,SKU,Barcode,Stock,Updated At`

## 後台頁面
- `GET /admin/low-stock`（require admin session）
- `views/admin/low-stock.ejs`：
  - 掛載 `/js/admin/low-stock.js`
  - 顯示 threshold input + refresh + export
  - 渲染表格 +「去庫存中心」連結

## 安全與錯誤處理
- 所有 endpoints 必須 require admin（沿用 `requireAdmin` / `requireAdminPage`）
- threshold 驗證：必須正整數（最少 0）
- UI 顯示錯誤用後台通用 error 區塊

## 測試與驗收

### 自動化測試（node:test）
- `/admin/low-stock` page 存在、載入 `low-stock.js`、layout 有 nav link
- `routes` 內有：
  - `GET /api/admin/low-stock/skus`
  - `GET /api/admin/low-stock/skus/export.csv`
- `low-stock.js` 不用 `prompt()`，並會打上述 endpoints

### 手動驗收（後台）
- threshold=5 時列出所有 active SKU `stock <= 5`
- 匯出 CSV 內容同頁面一致（排序一致）
- 點「去庫存中心」會帶 `sku_id` 去庫存中心頁

