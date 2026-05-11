# 客戶註冊/登入/重設密碼（先註冊後下單）設計稿

## 目標

- 客戶必須先註冊並登入，先可以在客戶端（/）下單
- 登入後自動回填公司/聯絡人/電話/地址，但每張單仍可手動修改（不回寫帳戶）
- 支援「忘記密碼」：發送 Email 重設連結（Zoho Mail SMTP）
- 不影響 admin/factory 既有登入（/api/auth）與後台功能

## 現況（相關結構）

- 後台登入：`/api/auth?action=login`，users/sessions 表（role=admin|factory）
- 下單與查單：`/api/public`（目前下單不需要登入）
- DB 既有客戶資料：`customers` 表（company_name/contact_name/phone…），`orders.customer_id` 指向 `customers.id`

## 核心決策

採用「擴展 customers 表 + 新增 customer_sessions / customer_password_resets」：

- 讓 `orders.customer_id` 直接對應到「已註冊客戶」的 customers row
- 過往舊資料仍可存在（customers.email 允許為 null）；但新下單必須是「已登入」的 customer session
- 與 admin/factory 的 users/sessions 完全分離，避免混淆權限

## 資料模型

### customers 表新增欄位

- `email text unique`（登入帳號）
- `pwd_hash text`（bcrypt hash）
- `address text`（註冊預設地址）
- `is_registered boolean not null default false`（或以 `pwd_hash is not null` 判斷；建議顯式欄位）

備註：
- `company_name`、`contact_name`、`phone` 仍保留並作為客戶檔案資料
- `unique(company_name, phone)` 既有約束保留；email unique 另外加

### customer_sessions（新表）

- `token text primary key`
- `customer_id uuid not null references customers(id) on delete cascade`
- `expires_at timestamptz not null`
- `created_at timestamptz not null default now()`

### customer_password_resets（新表）

- `token text primary key`（隨機長 token）
- `customer_id uuid not null references customers(id) on delete cascade`
- `expires_at timestamptz not null`（例如 30 分鐘）
- `used_at timestamptz`（null = 未用）
- `created_at timestamptz not null default now()`

## API 設計

新增 API entry：`/api/customer`（仿照 /api/auth，採用 query param action）

### 1) 註冊

`POST /api/customer?action=register`

body:
- `email`（必填）
- `password`（必填）
- `companyName`（必填）
- `contactName`（必填）
- `phone`（必填）
- `address`（必填）

行為：
- email 必須唯一
- password 用 bcrypt hash
- 建立 customers row（`is_registered=true`）
- 建立 session token（12 小時）

response:
- `{ ok: true, token, customer: { email, companyName, contactName, phone, address } }`

### 2) 登入

`POST /api/customer?action=login`

body:
- `email`
- `password`

行為：
- 驗證 customers.email + pwd_hash
- 建立 session token（12 小時）

### 3) 登出

`POST /api/customer?action=logout`

header:
- `Authorization: Bearer <token>`

### 4) 取得目前登入客戶

`GET /api/customer?action=me`

header:
- `Authorization: Bearer <token>`

response:
- `{ ok: true, customer: {...} }`

### 5) 忘記密碼（寄出重設連結）

`POST /api/customer?action=requestPasswordReset`

body:
- `email`

行為：
- 若 email 存在：建立 reset token（30 分鐘有效），寫入 customer_password_resets
- 用 SMTP 發送 email：包含 `resetUrl`（見下）
- 若 email 不存在：回 `{ ok: true }`（避免枚舉）

resetUrl：
- `https://<你的域名>/?mode=reset&token=<token>`
  - 用客戶端首頁承載 reset form（避免新增路由檔）

### 6) 重設密碼

`POST /api/customer?action=resetPassword`

body:
- `token`
- `newPassword`

行為：
- token 必須存在、未使用、未過期
- 更新 customers.pwd_hash，並標記 reset token `used_at=now()`
- 可選：清除該客戶所有 customer_sessions（強制重新登入）

## 客戶端 UI / 流程（index.html）

### 登入 gate

- 未登入時：
  - 頁面頂部顯示「登入 / 註冊」卡片（同一風格，ZENEX-SPORTS）
  - 下單/翻單 tab 保留可見，但點擊時提示「請先登入」
  - 查單 tab 仍可用（不要求登入）

- 已登入時：
  - header 顯示「已登入：<email>」+ 登出
  - 下單/翻單可用
  - 表單自動回填：公司/聯絡人/電話/地址（可改，不回寫）

### 忘記密碼

- 登入區加「忘記密碼」：
  - 輸入 email → 呼叫 requestPasswordReset
  - 顯示通用提示：已發送（不暴露 email 是否存在）

### Reset 密碼頁（同一個 /）

- 若 URL query `mode=reset&token=...`：
  - 顯示 reset form：newPassword + confirmPassword
  - 成功後自動返回登入畫面

## 下單 API gate（public）

調整 `POST /api/public?action=createOrder`：

- 改為必須帶 `Authorization: Bearer <customer_session_token>`
- 由 token 取到 customer_id
- 下單時：
  - `orders.customer_id` 用登入客戶的 id
  - `cust_name/cust_contact/cust_phone` 仍用本次表單提交內容（允許臨時改）
  - 不再「按 company+phone 自動新建 customers」

## Email（Zoho SMTP）設定

實作採用 SMTP 發信（Node.js），憑證全部放在 Vercel Environment Variables：

- `SMTP_HOST`（Zoho：`smtp.zoho.com`）
- `SMTP_PORT`（Zoho TLS 常用：`465`；STARTTLS 常用：`587`）
- `SMTP_SECURE`（`true`/`false`，465= true；587= false）
- `SMTP_USER`（你的 Zoho 寄件 email）
- `SMTP_PASS`（Zoho App Password / SMTP password）
- `SMTP_FROM`（寄件人顯示，如：`ZENEX-SPORTS <no-reply@yourdomain.com>` 或 Zoho 帳戶）
- `PUBLIC_BASE_URL`（例如 `https://xxx.vercel.app`，用於組 resetUrl）

備註：
- Zoho 強烈建議用 App Password（而非主密碼）
- 若 SMTP 未配置齊全：`requestPasswordReset` 返回 500 並提示 `email_not_configured`

## 安全/限制

- 密碼使用 bcrypt（repo 已有 bcryptjs）
- session 有效期 12 小時（與 admin 一致）
- 重設 token 單次使用 + 30 分鐘過期
- requestPasswordReset 回應不透露 email 是否存在

## 測試策略（TDD）

- Migration test：新增欄位/新表存在
- Customer API module test：/api/customer 存在 action 分支
- 密碼重設：token 寫入 + resetPassword 更新 pwd_hash + used_at
- createOrder gate：未帶 customer token → 401；有 token → 200
- index.html：登入/註冊 UI 元素存在 + mode=reset path 存在（字串測試）

