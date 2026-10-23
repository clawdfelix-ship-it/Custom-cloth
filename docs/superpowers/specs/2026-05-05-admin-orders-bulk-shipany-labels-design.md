# Admin Orders：批量生成 ShipAny 面單（前端逐張生成）設計

## 目標
- 在 `/admin/orders` 訂單列表支援「批量生成 ShipAny 面單」。
- 不新增後端 bulk endpoint；沿用現有 `POST /api/admin/shipany/generate-label`，由前端逐張呼叫並顯示進度/結果。
- 盡量減少重覆生成：如訂單已有 `tracking_number` 或 `shipany_label_url`，預設跳過並提示。

## 非目標
- 後端一次性 bulk endpoint（`/api/admin/shipany/generate-label/bulk`）
- 自動從 webhook 同步 tracking events 入庫
- 批量列印/下載面單 PDF（留待下一輪）

## 現況（已存在）
- 單張生成面單：
  - `POST /api/admin/shipany/generate-label`（guard：`requirePermission('orders:write')`）
  - 成功後會更新 `orders.tracking_number`、`orders.shipany_label_url`，以及把狀態設為 `shipping`
- 訂單列表 API：
  - `GET /api/admin/orders` 回傳 `orders.*`（已包含收件資料欄位），足夠用作批量 payload 資料來源

## 方案（採用）
### 前端逐張生成（不加新後端 endpoint）
- 在 `/admin/orders` 列表加 checkbox 選取機制
- 加一個「批量生成 ShipAny 面單」按鈕
- 點擊後逐張呼叫 `POST /api/admin/shipany/generate-label`
- UI 顯示進度與彙總結果（成功/失敗/跳過）

## UI/UX 設計
### 訂單列表新增欄位
- 表格新增第一欄：checkbox
- 表頭提供「全選（本頁）」checkbox

### 工具列新增按鈕
- 新增按鈕：`批量生成 ShipAny 面單`
- 按鈕僅在選中 >= 1 張訂單時可用（否則 disabled）

### 進度與結果區塊
- 按鈕按下後顯示一個區塊（可放在列表上方/下方）：
  - 進度：`已完成 x/y`
  - 三類結果：
    - 成功：顯示 order id/單號 + label url（如有）
    - 跳過（已存在 tracking/label）：顯示原因
    - 失敗：顯示錯誤訊息（服務器錯誤/缺欄位等）

## 行為規則（重要）
### 選取/全選
- `selectedIds:Set<number>` 管理已選訂單
- 全選只影響「當前列表頁」顯示嘅訂單（由 `loadOrders()` 拿到嗰批）
- Refresh/換 filter 後最簡單策略：清空 `selectedIds`

### 逐張生成流程
對每張選中訂單：
1) 若已有 `tracking_number` 或 `shipany_label_url`：
   - 標記為「跳過（已存在）」
2) 否則嘗試組 payload 呼叫 `POST /api/admin/shipany/generate-label`：
   - `order_id`（必填）
   - `recipient_name/recipient_phone/recipient_address/district` 等（用 list response 內 `orders.*` 填）
   - 其他欄位（service_type/weight）如 list 無，採用前端預設值（例如 service_type 預設、weight 預設 1）
3) 成功：
   - 標記成功
   - 重新載入列表（或只更新該行狀態/tracking 顯示；V1 可用重新載入）
4) 失敗：
   - 標記失敗並顯示錯誤訊息

### 失敗類型（V1 要顯示到）
- API 回 400：通常係缺資料（收件資訊不足）或 payload 不合法 → 提示去訂單詳情補資料再試
- API 回 403：冇 `orders:write` → 提示權限不足
- API 回 500：服務器錯誤 → 顯示錯誤並允許重試

## 權限
- 後端保持不變：
  - `POST /api/admin/shipany/generate-label`：`orders:write`
- 前端：
  - 按鈕顯示/可用與否可依賴現有頁面權限 gate（已有 RBAC menu/page guard）

## 實作範圍（文件/改動點）
**Modify**
- `views/admin/orders.ejs`
  - 表格 header/body 加 checkbox 欄位容器
  - 工具列加 bulk button + results 區塊容器
- `public/js/admin/orders.js`
  - 擴展 `loadOrders()`：render checkbox + 維護 `selectedIds`
  - 新增 `bulkGenerateShipanyLabels()`：逐張呼叫 generate-label，render 進度/結果
  - 加 `orderCacheById:Map`（由 list 填充）方便砌 payload

**Create**
- `test/admin-orders-bulk-shipany-ui.test.js`
  - 鎖定 orders.ejs 有 bulk/checkbox marker
  - 鎖定 orders.js 有 `/api/admin/shipany/generate-label` + bulk marker

## 驗收標準
- `/admin/orders` 可選多張訂單並批量生成面單
- 遇到已存在 tracking/label 會跳過並顯示原因
- 失敗會顯示錯誤訊息且不影響其他訂單繼續
- `npm test` 全綠

