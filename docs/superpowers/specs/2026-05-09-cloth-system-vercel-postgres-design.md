# Cloth System（方案 1：HTML + Vercel Serverless + Vercel Postgres）設計稿

## 目標

- 兩個獨立 HTML：
  - 客戶下單頁：`index.html`
  - 後台管理：`admin.html`（路由為 `/admin`）
- 客戶落單自動分「新單 / 翻單」兩種模式。
- 翻單模式可按「電話」載入該客戶歷史訂單，點選後自動帶入：
  - 款式
  - 舊尺碼配比（結構化表格）
  - 尺碼表（先以文字/textarea 保存，必要時可升級為檔案）
- 系統按模式自動計算「最快交貨日」，禁止選過早日期。
- 必填：公司名、聯絡人、電話、送貨地址。
- 提交後訂單寫入雲端 DB，後台列表顯示並標註訂單類型。
- 後台顯示建議交貨日，並提供「一鍵翻單（預填表再確認）」。
- 自動累積客戶歷史訂單（翻單庫）。
- 後台支援：狀態流轉、搜尋/篩選、匯出 CSV。

## 交期規則

工期以「工作日」計算，需跳過：

- 週末（六/日）
- 香港公眾假期（使用 gov.hk 2026 假期頁整理成 repo 內置假期表）

兩種模式的最低工期（工作日）：

- 新單：31 工作日（設計→樣板 14 + 樣板→量產 14 + 物流最少 3）
- 翻單：17 工作日（量產 14 + 物流最少 3）

系統計算：

- `suggested_delivery_date` = `created_at` 當天起加上 N 個工作日（N 取決於模式）
- 前端限制 `requested_delivery_date >= suggested_delivery_date`
- 後端再次驗證，避免繞過前端限制

## 非目標

- 不做完整用戶系統（註冊/登入/權限分級）。
- 不做支付、物流追蹤、庫存管理。
- 不做複雜防機械人機制（只做最基本驗證/濫用保護）。

## 架構概覽

- 靜態前端：`index.html`（客戶下單）、`admin.html`（後台管理）。
- Vercel Serverless API（Node）：
  - `POST /api/orders`：提交訂單（新單/翻單都用同一 endpoint）
  - `GET /api/orders/history?phone=...`：按電話取得客戶歷史訂單（給翻單模式用）
  - `GET /api/admin/orders`：後台讀取訂單列表（需要 Admin Token）
- 資料庫：Vercel Postgres（`orders` 表為主，支援翻單庫與後台列表）。
- 路由優化：`/admin` rewrite 到 `admin.html`（乾淨網址）。

## Repo 結構（預計）

- `index.html`
- `admin.html`
- `api/orders.js`
- `api/orders/history.js`
- `api/admin/orders.js`
- `data/hk-holidays/2026.json`
- `vercel.json`
- `package.json`
- `.gitignore`
- `docs/`（設計與文件）

## URL / 路由

- `/` → `index.html`
- `/admin` → rewrite → `admin.html`
- `/api/orders`
- `/api/orders/history`
- `/api/admin/orders`

## Admin Token（簡單密碼保護）

- Vercel 環境變數：`ADMIN_TOKEN`
- `admin.html` 第一次進入要求輸入 token，暫存於 `sessionStorage`
- 後台 request header：`Authorization: Bearer <ADMIN_TOKEN>`
- 後台 API 不回傳敏感資訊（只回訂單資料）

## API 設計

### `POST /api/orders`

用途：客戶提交訂單（新單/翻單）。

Request body（JSON）：

- `orderType`：`"new" | "reorder"`（必填）
- `companyName`（string，必填）
- `contactName`（string，必填）
- `phone`（string，必填；亦作為翻單庫查詢 key）
- `address`（string，必填）
- `styleName`（string，必填）
- `sizeChart`（string，可選；先以文字保存）
- `sizeRatio`（array，必填；結構化配比表）
  - `[{ size: string, qty: number }]`
- `requestedDeliveryDate`（`YYYY-MM-DD`，必填；需 >= suggested）
- `sourceOrderId`（string，可選；當翻單由某張舊訂單建立時寫入）

Response（JSON）：

- `ok: true`
- `orderId`（string）
- `suggestedDeliveryDate`（`YYYY-MM-DD`）
- `createdAt`（ISO string）

伺服器端處理：

- 驗證必填欄位、`sizeRatio` 內容、`requestedDeliveryDate` 格式
- 依 `orderType` 計算 `suggested_delivery_date`
- 若 `requestedDeliveryDate` 過早，回傳 400 並附上 `suggestedDeliveryDate`
- 新訂單初始狀態：`received`

### `GET /api/orders/history?phone=...`

用途：翻單模式載入該電話的歷史訂單（用於客戶端「點一下帶齊」）。

Response（JSON）：

- `ok: true`
- `orders: Array<{ id, createdAt, orderType, styleName, sizeChart, sizeRatio, requestedDeliveryDate, suggestedDeliveryDate }>`

排序：

- `created_at` DESC

資料最小化：

- 只回翻單所需欄位（避免把後台用途欄位一併暴露）

### `GET /api/admin/orders`

用途：後台讀取訂單列表（包含類型、建議交貨日）。

Auth：

- Header `Authorization: Bearer <ADMIN_TOKEN>`

Query（可選，用於搜尋/篩選）：

- `phone`：精確匹配
- `company`：模糊匹配（ILIKE）
- `orderType`：`new | reorder`
- `status`：狀態值
- `from`：`YYYY-MM-DD`（created_at 起）
- `to`：`YYYY-MM-DD`（created_at 迄）
- `format`：`csv`（回傳 CSV；否則回 JSON）

Response（JSON）：

- `ok: true`
- `orders: Array<{ id, createdAt, orderType, status, companyName, contactName, phone, address, styleName, requestedDeliveryDate, suggestedDeliveryDate, sourceOrderId }>`

排序：

- `created_at` DESC

### `POST /api/admin/orders/status`

用途：後台更新訂單狀態。

Auth：

- Header `Authorization: Bearer <ADMIN_TOKEN>`

Request body（JSON）：

- `orderId`（string，必填）
- `status`（string，必填）

Response（JSON）：

- `ok: true`
- `orderId`
- `status`

## 資料庫 Schema

表：`orders`

- `id`：UUID（primary key）
- `created_at`：timestamp with time zone（default now）
- `updated_at`：timestamp with time zone（default now）
- `order_type`：text（`new` / `reorder`）
- `status`：text
- `company_name`：text
- `contact_name`：text
- `phone`：text
- `address`：text
- `style_name`：text
- `size_chart`：text（可空）
- `size_ratio`：jsonb（`[{ size, qty }]`）
- `suggested_delivery_date`：date
- `requested_delivery_date`：date
- `source_order_id`：uuid（可空，FK to orders.id）

建議 index：

- `phone`
- `created_at desc`
- `status`

建議狀態值（可再調整）：

- `received`（已收到）
- `follow_up`（跟進中）
- `confirmed`（已確認）
- `production`（量產中）
- `shipping`（運送中）
- `done`（已完成）
- `cancelled`（已取消）

## 假期資料

- `data/hk-holidays/2026.json`：由 gov.hk（2026 假期頁）整理成 `YYYY-MM-DD` 字串陣列
- 計算工作日函數：
  - 跳過週末 + 假期表
  - 以「加 N 個工作日」方式得到最早交貨日

## 前端行為

### `index.html`（客戶下單）

- 進入頁面後要求選擇模式（新單/翻單）
- 新單：
  - 填必填欄位 + 款式 + 尺碼表（可選） + 尺碼配比表格 + 交貨日
  - 交貨日最早值為「今日 + 31 工作日」
- 翻單：
  - 先輸入電話 → 載入歷史訂單列表
  - 點選一張歷史訂單 → 自動帶入款式/尺碼表/配比
  - 交貨日最早值為「今日 + 17 工作日」
- 提交：
  - `fetch('/api/orders')` 寫入雲端 DB
  - 顯示成功/失敗訊息（包括 `requestedDeliveryDate` 過早時的提示）

### `admin.html`（後台）

- 第一次輸入 Admin Token 後才會載入列表
- 列表顯示：訂單類型、新單/翻單、建議交貨日、客戶選擇交貨日
- 列表顯示：狀態（並可即時更新）
- 搜尋/篩選：電話、公司、類型、狀態、日期範圍
- 匯出 CSV：以目前篩選結果匯出
- 「一鍵翻單」：
  - 按鈕 → 打開預填表（modal 或獨立段落）
  - 預填款式/尺碼表/配比/客戶資料
  - 確認後呼叫 `POST /api/orders`（`orderType=reorder`，並寫入 `sourceOrderId`）

## Vercel 部署要點

- GitHub repo connect 到 Vercel，push 後自動 deploy
- 啟用 Vercel Postgres（使用 `@vercel/postgres`）
- 設定環境變數：
  - `POSTGRES_URL`（由 integration 提供）
  - `ADMIN_TOKEN`（自行設定）
- DB 初始化：
  - 方案 A：Vercel Postgres console 跑建表 SQL
  - 方案 B：提供一次性 admin 初始化 endpoint（需要 token），手動 call 一次

## 驗收標準

- 客戶端可選新單/翻單；翻單可按電話載入歷史訂單並一鍵帶入資料。
- 系統能正確計算最快交貨日（工作日 + 週末 + 香港假期），並禁止選過早日期（前後端一致）。
- 後台可看到訂單類型與建議交貨日；能以「預填表再確認」方式建立翻單。
- 後台可更新訂單狀態；可按條件搜尋/篩選；可匯出 CSV。
- Admin Token 未提供/錯誤時後台 API 不能讀取訂單列表。
