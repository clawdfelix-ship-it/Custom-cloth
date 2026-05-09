# REF 兩頁系統（雲端 DB 同步）設計稿

## 目標

- 以 REF 版面/流程為主體：
  - 後台：`REF/Code_20260509.html`（功能全套：訂單、尺碼表庫、款式庫、PO/PI、工廠端、異常反饋、帳號管理）
  - 客戶端：`REF/Code_20260509_custom.html`（需重建完整版本：新單/翻單/查單）
- 資料改為雲端同步：Vercel Postgres（多裝置可用）
- 權限改為帳號密碼 + 角色（admin / factory）
- 翻單識別：公司名 + 電話
- 查單識別：訂單編號 + 電話

## 非目標

- 不做完整付款/物流追蹤/庫存管理
- 不做複雜 RBAC/多層權限（只做 admin / factory）
- 不做第三方 OAuth（只做內建帳密）

## 使用者/角色

- Admin
  - 使用後台全部功能
  - 建立工廠帳號、分配工廠、處理異常反饋
- Factory
  - 只見工廠端頁面（訂單列表、詳情、更新進度、提交異常）
- Customer（匿名）
  - 使用客戶端頁面：新單/翻單/查單

## 前端路由與頁面

- `/` → 客戶端頁（以 `index.html` 落地，外觀/流程跟 `REF/Code_20260509_custom.html`）
- `/admin` → 後台頁（以 `admin.html` 落地，外觀/流程跟 `REF/Code_20260509.html`）

說明：

- REF 文件作為「UI 原型/參考」，正式部署仍以 root 的 `index.html` / `admin.html` 為入口（方便 Vercel rewrite 與維護）
- `REF/Code_20260509_custom.html` 現時為截斷版本，會重建成完整功能頁

## 認證/Session

- `POST /api/auth/login`
  - body: `{ acc, pwd }`
  - 回傳：`{ ok, token, role, name }`
- token 為短期 session（Vercel function 端以 `Authorization: Bearer <token>` 驗證）
- token 存於 `sessionStorage`（跟 REF 的「登入一次用到關閉頁面」一致）

安全基礎：

- 密碼只存 hash（bcrypt 或類似）
- 後端不回傳密碼/敏感資料
- Factory 角色只允許讀取/更新屬於自己工廠名的訂單

## 工期/交期規則（客戶端）

- 模式
  - 新單（開板訂製）：最低工期 31（工作日）
  - 翻單（任何分類翻單）：最低工期 17（工作日）
- 以「工作日」計算：跳過週末 + 香港公眾假期（repo 內置假期表）
- 客戶端提交時，後端再次驗證 `requested_delivery_date >= suggested_delivery_date`

## 資料模型（Postgres）

### users

- `id uuid pk`
- `acc text unique not null`
- `pwd_hash text not null`
- `role text not null`（`admin` / `factory`）
- `name text not null`（admin 顯示名 / 工廠名）
- `created_at timestamptz not null default now()`

### sessions

- `token text pk`
- `user_id uuid not null references users(id)`
- `expires_at timestamptz not null`
- `created_at timestamptz not null default now()`

### size_tables

- `id uuid pk`
- `name text not null`
- `data jsonb not null`（6 尺碼表資料結構，與 REF 欄位一致：EU/胸圍/腰圍/衣長/中國碼/身高）
- `created_at timestamptz not null default now()`

### styles

- `id uuid pk`
- `code text not null`
- `name text not null`
- `cate1 text not null`
- `cate2 text not null`
- `size_table_id uuid not null references size_tables(id)`
- `img_base64 text`（V1 直接存 base64，限制 < 500KB；後續可升級 Vercel Blob）
- `remark text`
- `created_at timestamptz not null default now()`

### customers

- `id uuid pk`
- `company_name text not null`
- `contact_name text`
- `phone text not null`
- `created_at timestamptz not null default now()`
- unique 建議：`(company_name, phone)`

### orders

- `id uuid pk`
- `order_sn text unique not null`
- `customer_id uuid not null references customers(id)`
- `cust_name text not null`
- `cust_contact text`
- `cust_phone text not null`
- `cate1 text not null`
- `cate2 text not null`
- `factory_name text`（可空；分配後寫入）
- `order_type text not null`（對應 REF：開板新單/現貨新單/客戶翻單；後端會按規則計算）
- `status text not null`
- `amount text`
- `remark text`
- `create_time timestamptz not null default now()`
- `requested_delivery_date date`
- `suggested_delivery_date date`
- `source_order_id uuid references orders(id)`（翻單來源）

### order_items

- `id uuid pk`
- `order_id uuid not null references orders(id)`
- `style_id uuid not null references styles(id)`
- `qty jsonb not null`（例如：`{ "S": 10, "M": 20, "L": 10, "XL": 0, "2XL": 0, "3XL": 0 }`）

### feedback

- `id uuid pk`
- `order_id uuid not null references orders(id)`
- `order_sn text not null`
- `factory_name text not null`
- `content text not null`
- `status text not null`（`待處理` / `已處理`）
- `create_time timestamptz not null default now()`

## API（概要）

Auth

- `POST /api/auth/login`
- `POST /api/auth/logout`

公開（客戶端）

- `GET /api/public/styles?cate1=&cate2=`：按分類取款式列表（含圖片/綁定尺碼表）
- `GET /api/public/size-tables/:id`
- `POST /api/public/orders`：新單提交（含工期驗證）
- `GET /api/public/orders/history?companyName=&phone=`：翻單查歷史（公司名+電話）
- `GET /api/public/orders/status?orderSn=&phone=`：查單（訂單編號+電話）

後台（需登入 token）

- 尺碼表庫：`GET/POST/DELETE /api/admin/size-tables...`
- 款式庫：`GET/POST/DELETE /api/admin/styles...`
- 訂單：`GET /api/admin/orders`（搜尋/篩選），`POST /api/admin/orders`（手動新建），`POST /api/admin/orders/status`（改狀態），`POST /api/admin/orders/copy`（一鍵翻單）
- PO/PI：V1 以前端生成 + 打印為主；如需保存編號/紀錄再加 `POST /api/admin/docs`
- 異常反饋：`GET /api/admin/feedback`、`POST /api/admin/feedback/status`
- 帳號管理：`GET/POST/DELETE /api/admin/users`（建立/刪除工廠帳號）

工廠端（需登入 token，role=factory）

- `GET /api/factory/orders`：只回自己工廠 `factory_name` 的訂單
- `GET /api/factory/orders/:id`
- `POST /api/factory/orders/status`：更新生產進度
- `POST /api/factory/feedback`：提交異常

## 前端重建範圍

### 客戶端（重建 REF custom）

- Tab 1：全新款式下單（按分類 → 款式 → 顯示尺碼表 → 填尺碼數量）
- Tab 2：歷史訂單翻單（公司名 + 電話）→ 顯示歷史訂單 → 一鍵帶入
- Tab 3：訂單狀態查詢（訂單編號 + 電話）→ 顯示狀態/交貨日/摘要

### 後台（REF admin）

- 保留原有 UI 結構（sidebar + switchPage）
- 將 localStorage keys 全面替換為 API 讀寫
- 角色顯示：
  - admin：顯示全部 menu
  - factory：只顯示工廠端 menu

## 驗收標準

- 客戶端新單/翻單/查單完整可用（查詢 key 符合：翻單=公司名+電話；查單=訂單號+電話）
- 後台所有 REF 模組都能正常運作且資料雲端同步
- 工廠帳號登入後只見自己訂單，不能讀取其他工廠資料
- 圖片上傳可保存並在其他裝置打開仍可見（V1 用 DB base64 + 限制大小）
