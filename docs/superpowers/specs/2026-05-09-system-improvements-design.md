# 系統優化設計（客戶 / 工廠 / 管理員）

目標：在不增加 Vercel Hobby plan Functions 數量（維持 4 個 API 入口）的前提下，提升資料一致性、可維運性、安全性與實際工作流完整度。

## 現狀摘要

- 前端：純靜態頁面
  - 客戶端：[index.html](file:///Users/chansiulungfelix/Documents/TraeProjects/Cloth%20System/index.html)
  - 後台/工廠端：[admin.html](file:///Users/chansiulungfelix/Documents/TraeProjects/Cloth%20System/admin.html)
- 後端：4 個 API 入口（Hobby plan friendly）
  - `api/auth.js`、`api/public.js`、`api/admin.js`、`api/factory.js`
  - 由 `vercel.json` rewrites 分流 action
- DB：Neon Postgres（`users/sessions/styles/size_tables/orders/order_items/feedback`）

## 問題與優化方向（按角色）

### 客戶（落單 / 翻單 / 查單）

1) 款式庫為空時，客戶流程中斷（無法落單）
- 改善：強化空狀態提示；可選擇在 staging/測試環境 seed demo 款式（production 可關閉）

2) 交貨日「可選範圍」存在前後端雙重判斷
- 改善：新增「交期計算 API」讓 UI 先拿到 earliest/suggested（避免客戶填完先被拒）

3) 查單驗證使用 `orderSn + phone`，易受電話轉手/誤填影響
- 改善（後續）：增加查單碼（short code）或改成 `orderSn + 查單碼`

### 工廠（接單 / 更新狀態 / 反饋）

1) 工廠身份目前靠 `users.name` 對應 `orders.factory_name`
- 風險：改名/同名會造成查錯單或查不到單
- 改善（P0）：引入 `factory_user_id` 作為主關聯；`factory_name` 僅作顯示

2) 工廠端工作流不完整（仍偏查閱）
- 改善（P1）：補齊狀態更新所需欄位（例：出貨單號、備註），與反饋附件

### 管理員（管理 / 審計 / 安全）

1) 缺少審計（誰做咗咩）
- 改善（P1）：增加 `audit_logs`，把重要操作寫入（建立/刪除/改狀態/翻單/反饋處理）

2) 缺少 DB schema 版本管理（migration）
- 改善（P0）：加入 `schema_migrations` + 應用 migrations 的 runner（使用 DB advisory lock 避免多個 function 同時跑）

3) Auth 缺少防暴力嘗試
- 改善（P2）：login rate limit（DB-based），並提供 admin 端「強制登出某 user」功能

## Roadmap（P0 → P2）

### P0（資料正規化 + 可維運）

1) 工廠綁定改用 `factory_user_id`
- DB
  - `orders.factory_user_id uuid references users(id)`
  - `orders.factory_name` 保留（顯示用途）
  - 新增 index：`idx_orders_factory_user_id`
- API
  - `api/factory.js`：用 `factory_user_id = session.userId` 查單/改狀態/寫反饋
  - `api/admin.js`：訂單列表回傳 `factoryUserId`，並新增「指派工廠」API（action=assignFactory）
- UI
  - admin 訂單列表新增「工廠指派」欄位（從 users(role=factory) 選擇）

2) Migration 機制（避免人手 SQL）
- DB
  - `schema_migrations (id text primary key, applied_at timestamptz default now())`
- Repo
  - 新增 `db/migrations/` 以檔名排序：`YYYYMMDDHHMM_<name>.sql`
- Runner 設計（不增加 functions 數量）
  - 在 `src/lib/migrate.js` 實作 `ensureMigrations()`
  - 使用 `pg_advisory_lock`（固定 key）防止並發
  - 每個 API 入口在首次 request 時執行一次（module scope cache）
- 目標：新環境不用手動入 Neon；只要 deploy 後第一個 request 已自動建表/seed（seed 可做成 migration）

### P1（工作流完整度 + 可觀測）

1) Audit logs
- `audit_logs (id uuid, actor_user_id uuid, action text, entity_type text, entity_id uuid/text, payload jsonb, created_at timestamptz)`
- 覆蓋：建立/刪除 users、size_tables、styles；訂單狀態更新；翻單 copy；工廠提交反饋；管理員標記反饋狀態

2) 附件/圖片搬到 object storage（預設：Vercel Blob）
- DB
  - `styles.img_url text`（逐步取代 `img_base64`；保留向後相容）
  - `feedback.attachments jsonb`（array of {url, name, mime, size}）
- API
  - `api/admin.js` 新增 action=upload（產生上傳 URL / 或直接上傳）
- UI
  - 款式圖上傳改成 blob；反饋新增附件上傳

### P2（安全與體驗）

1) Login rate limit（DB based）
- `login_attempts (id uuid, ip text, acc text, created_at timestamptz)`，按窗口計算
- 多次失敗返回 429（並加 audit）

2) 查單碼
- `orders.lookup_code text`
- 落單成功回傳 lookup_code；查單改用 `orderSn + lookup_code`

## 驗收清單（完成後）

- 管理員
  - 能登入、能建立尺碼表/款式/帳號、能指派工廠、能改狀態、能翻單
  - audit_logs 有記錄
- 工廠
  - 用 factory 帳號只看到自己被指派的訂單（不受 name 變動影響）
  - 能改狀態、能提交反饋（含附件）
- 客戶
  - 新單/翻單/查單正常，交期計算提示一致

