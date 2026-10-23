# Admin 建 PO 體驗（SKU 搜尋 + 自動帶出成本價）設計（V2-2）

## 目標
- 在 `/admin/purchase-orders` 建立採購單時，提供「搜尋 SKU → 一鍵加入 items」流程，減少手打 `sku_id`。
- 揀中 SKU 後，自動帶出 `product_skus.cost_price` 作為 `items[].cost_price` 預設值（可手改）。
- 保持現有建立 PO API payload 兼容：仍使用 `items: [{ sku_id, quantity, cost_price }]`。

## 非目標
- 上次採購價預填 / 供應商專屬報價
- 批量貼入 SKU（可保留舊方式，但唔係本輪核心）
- PO 匯出/列印/批量收貨（其他輪次做）

## 現況（已存在）
- 建 PO API：
  - `POST /api/admin/purchase-orders`
  - body：`{ supplier_id, expected_arrival_date?, notes?, items: [{ sku_id, quantity, cost_price }] }`
- SKU 搜尋 API（庫存中心已用）：
  - `GET /api/admin/inventory/skus?q=...&limit=...`
  - 現況回傳：`{ skus: [{ id, sku, barcode, stock, product_id, product_name }] }`
  - **缺口：未回 `cost_price`**

## 方案
### 方案 A（採用）：擴展 SKU 搜尋 API 回傳 cost_price
- 擴展 `GET /api/admin/inventory/skus` 回傳欄位：加上 `cost_price`（來源 `product_skus.cost_price`）。
- 前端選中 SKU 後，直接用該回應值預填 `cost_price`，不再需要額外 API round-trip。

## UI 設計（/admin/purchase-orders）
### 新增「搜尋 SKU」輸入框 + 下拉結果
- 位置：建 PO items 區域上方（同新增 item 行為同一區）。
- 行為：
  - debounce（例如 250–400ms）後 call `GET /api/admin/inventory/skus?q=...`
  - 顯示下拉列表（最多 20）
  - 列表顯示欄位（可簡化，但至少含 product_name + sku）：
    - 商品名（product_name）
    - sku / barcode（若有）
    - 現有庫存 stock（可顯示為參考）

### 選中 SKU → 加入 items
- 如果 items 已存在同一 `sku_id`：
  - 預設行為：將該行 `quantity += 1`（或聚焦該行 quantity）；並顯示簡短提示「已加入，數量+1」。
- 否則：
  - 新增一行 item：
    - `sku_id`（隱藏或只讀顯示 `#id`）
    - `product_name`（只讀）
    - `quantity`（number，min=1，預設 1）
    - `cost_price`（number，min=0，預設為搜尋結果 cost_price；可手改）
    - 移除按鈕（刪除該行）

### 防呆
- 建立 PO 前：
  - items 為空 → 阻止提交並顯示錯誤
  - quantity 需為整數且 >= 1
  - cost_price 需為數值且 >= 0（允許 0）

## API 設計
### 擴展：GET /api/admin/inventory/skus
- 新增回傳欄位：
  - `cost_price`：`product_skus.cost_price`
- 回應示例：
```json
{
  "skus": [
    {
      "id": 123,
      "sku": "ABC-001",
      "barcode": "4900000000000",
      "stock": 5,
      "cost_price": 12.3,
      "product_id": 99,
      "product_name": "示例商品"
    }
  ]
}
```
- 權限：沿用現有 `inventory:read`（同庫存中心一致）。

## 測試（node:test）
- 新增 2–3 個字串鎖定測試，防回歸：
  - `routes/products-full.js` inventory/skus query/select 內包含 `cost_price`
  - `views/admin/purchase-orders.ejs` 有「搜尋 SKU」marker
  - `public/js/admin/purchase-orders.js` 有 `GET /api/admin/inventory/skus` 字串與「加入 item」行為 marker

## 驗收標準
- `/admin/purchase-orders` 建 PO 時可：
  - 搜尋 SKU 並選中加入 items
  - 加入後 cost_price 自動帶出且可手改
  - 建立成功 payload 維持 `{ items: [{ sku_id, quantity, cost_price }] }`
- `npm test` 全綠

