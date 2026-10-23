# Admin 訂單出貨工作流（ShipAny）+ Orders 權限對齊（V1）設計

## 目標
- 後台 `/admin/orders` 提供順手嘅出貨工作流：
  - 生成 ShipAny 面單
  - 顯示/打開面單連結
  - 顯示物流單號、物流狀態、最後更新時間
  - 可手動刷新 tracking（ShipAny tracking）
- Orders 相關 `/api/admin/*` 權限同後台 page gate 對齊，避免「入到頁但 API 403」或權限過闊。

## 非目標（V1 不做）
- 批量出貨 / 批量列印面單
- 完整出貨狀態機（packing/picked 等）
- ShipAny webhook 全量同步 tracking events 入庫（V1 先做手動刷新 + 顯示）
- 物流供應商配置後台（SHIPANY_SENDER_* 等）

## 現況盤點
- 後台頁：
  - `/admin/orders` 已存在，page guard 係 `requireAdminPage('orders:read')`
- 前端：
  - `public/js/admin/orders.js` 已有「生成 ShipAny 面單」按鈕，會打 `POST /api/admin/shipany/generate-label`
- 後端：
  - `POST /api/admin/shipany/generate-label` 已存在，且已用 `requirePermission('orders:write')`
  - `GET /api/admin/orders/:id/tracking` 已存在，且已用 `requirePermission('orders:read')`
  - 但 Orders 核心 API（list/detail/status update）仍使用 `requireAdmin`（與 RBAC 混用）

## 權限與守門（必做）
### 原則
- Page gate、menu 隱藏、API guard 要一致：
  - 讀取：`orders:read`
  - 更新：`orders:write`
- super admin（`is_admin=true`）維持 `*` 全權限。

### 具體改動
- 將以下 endpoints 從 `requireAdmin` 改為 `requirePermission`：
  - `GET /api/admin/orders` → `requirePermission('orders:read')`
  - `GET /api/admin/orders/:id` → `requirePermission('orders:read')`
  - `PUT /api/admin/orders/:id/status` → `requirePermission('orders:write')`

## API 行為（V1）
### GET /api/admin/orders/:id/tracking
- 保持現狀（已存在）：
  - 若無 `tracking_number`：回 `{ status: 'not_shipped', tracking_number: null, order_number }`
  - 若無 ShipAny API Key：回 DB 內 tracking status/updated_at（如果有）
  - 若有 ShipAny API Key：直連 ShipAny tracking endpoint，回傳 ShipAny 原始 JSON
- V1 前端需容錯處理不同回傳形狀（例如 `events` 欄位可能唔同名）。

### POST /api/admin/shipany/generate-label
- 保持現狀（已存在）：
  - 成功：更新 `orders.tracking_number`、`orders.shipany_label_url`、`orders.status='shipping'`
  - 寫入 `order_status_histories`（status='shipping'）

## 後台 UI（/admin/orders）設計（V1）
### 訂單詳情「ShipAny 出貨」區塊
新增一個區塊（放喺 detail card 內，現有「ShipAny」字樣下方延伸）：
- 顯示欄位：
  - 面單：`ShipAny 面單連結`（已有 `shipany_label_url` 時顯示可點擊 link）
  - 物流單號：`tracking_number`（如有）
  - 物流狀態：`tracking_status`（如有）
  - 最後更新：`tracking_updated_at`（如有）
- 操作：
  - `生成 ShipAny 面單`（保留現有按鈕）
  - `刷新 tracking`（新增按鈕）：
    - 呼叫 `GET /api/admin/orders/:id/tracking`
    - 若回傳含 events：render timeline/table
    - 若無 events：顯示 status + raw 摘要（以避免空白）

### Tracking 呈現（容錯）
- 優先偵測以下形狀（按次序）：
  1) `events` 為 array：用 events
  2) `tracking.events` 為 array：用 tracking.events
  3) `data.events` 為 array：用 data.events
  4) 否則：只顯示 `status`/`message`/`raw` 摘要
- 每條 event 顯示（如可取得）：
  - 時間：`timestamp` / `time` / `datetime`
  - 地點：`location` / `facility`
  - 狀態：`status` / `description`
  - 備註：`remark`

## 錯誤處理
- 生成面單失敗：
  - 顯示後端 `error`（現有 setError 已覆蓋）
  - 保持按鈕 disabled 期間，finally 解除
- tracking 刷新失敗：
  - 顯示錯誤訊息，不影響其他 detail render
- 未設定 ShipAny API Key：
  - tracking endpoint 會回 DB 狀態；UI 顯示「未連接 ShipAny，顯示上次儲存狀態」文案（V1 可用細字）

## 測試（node:test）
- 新增/更新測試覆蓋：
  - Orders routes 改用 `requirePermission('orders:read|write')`（避免回歸到 requireAdmin）
  - orders.js 前端包含 tracking refresh endpoint 字串（防止 UI wiring 被刪）

## 驗收標準
- 非 super admin（有 `orders:read`）：
  - 可入 `/admin/orders`
  - 可 list / 打開詳情
  - 可刷新 tracking（有權限）
- 有 `orders:write`：
  - 可更新狀態
  - 可生成 ShipAny 面單
- `npm test` 全綠

