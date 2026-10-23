# 後台管理介面（Admin Backoffice UI）設計規格

## 背景與目標

目前專案只有前台 EJS 頁面（`/`, `/products`, `/product/:id`, `/cart`, `/login`, `/register`）以及一組以 Session + `is_admin` 控制的管理員 API（`/api/admin/*`）。缺少可操作的後台管理 UI，導致管理流程必須透過 API 工具完成。

本規格目標是新增「可用、可部署、與現有架構一致」的後台管理頁，直接重用既有 `/api/admin/*` 管理 API 與 session 權限模型。

## 範圍（Scope）

### In Scope

- 新增 `/admin/*` 後台頁面（EJS）與共用 layout（header + 左側 menu + content）。
- 新增 `/admin/setup` 一次性初始化頁（只在 DB 尚未存在任何 admin 時開放），用來建立第一個管理員帳號。
- 新增 `/admin/login`、`/admin/logout`。
- 新增下列後台頁面「骨架 + 可用的基本 CRUD/操作」：
  - `/admin`：Dashboard（總覽數字與入口）
  - `/admin/orders`：訂單列表 + 詳情/狀態更新（最小可用）
  - `/admin/products`：商品列表 + 基本新增/更新/下架（最小可用）
  - `/admin/categories`：分類列表 + 基本增刪改（最小可用）
  - `/admin/users`：用戶列表 + 建立用戶/管理員 + 重設密碼（最小可用）
- 後台頁面全部使用既有 session 權限：`req.session.userId` + `req.session.isAdmin === true`。
- 後台頁面透過少量前端 JS `fetch('/api/admin/...')` 取得資料並渲染到表格（避免重寫 DB 查詢、集中重用既有 API 驗證/權限）。

### Out of Scope（第一版不做）

- 建立全新 admin SPA（React/Vue/Vite build pipeline）。
- 以角色/權限表（`admin_roles/admin_permissions`）做細粒度 RBAC。
- 進階表格（批量編輯、複雜搜尋、匯出/匯入 UI、可視化圖表）。
- 2FA、SSO、IP allowlist 等企業級安全機制（後續可加）。

## 使用者故事（User Stories）

- 作為管理員，我可以先建立第一個 admin 帳號（只需一次）。
- 作為管理員，我可以登入後台並看到總覽。
- 作為管理員，我可以查看訂單並更新狀態。
- 作為管理員，我可以查看/維護商品、分類。
- 作為管理員，我可以查看/建立用戶（包含建立管理員）。

## 路由與頁面

### Public/Bootstrap

- `GET /admin/setup`
  - 只在「DB 沒有任何 `users.is_admin=true`」時可用。
  - 已存在 admin 時：回傳 404 或固定訊息（不可再用）。
- `POST /admin/setup`
  - 建立第一個 admin（`is_admin=true`），建立成功後導向 `/admin` 或 `/admin/login`。

### Auth

- `GET /admin/login`
  - 顯示後台登入頁（username/password）。
- `POST /admin/login`
  - 內部呼叫既有登入邏輯（等同 `/api/auth/login` 的驗證），成功後寫 session（`userId/isAdmin`）並 redirect `/admin`。
- `POST /admin/logout`
  - 內部呼叫既有登出邏輯（等同 `/api/auth/logout`），清 session 後 redirect `/admin/login`。

### Protected（requireAdmin）

- `GET /admin`：Dashboard
- `GET /admin/orders`：Orders 管理頁
- `GET /admin/products`：Products 管理頁
- `GET /admin/categories`：Categories 管理頁
- `GET /admin/users`：Users 管理頁

所有 `/admin/*`（除 login/setup）：
- 未登入或非 admin：redirect `/admin/login`

## 資料流與前端渲染策略

### 原則

- 後台 UI 不直接查 DB：全部走現有 `/api/admin/*`。
- EJS 先 render layout + 空的容器（table/body），前端 JS 再 fetch JSON 填表。
- 所有 fetch 都依賴 cookie session，不引入 token。

### 例：Orders 頁

- EJS render：
  - 左側 menu（Dashboard/Orders/Products/Categories/Users）
  - 一個 `#admin-table` 容器
- JS：
  - `GET /api/admin/orders` 拿 list
  - 點擊一筆：`GET /api/admin/orders/:id`
  - 更新狀態：`PUT /api/admin/orders/:id/status`

## 一次性 Setup 安全設計

### 判斷是否允許 setup

- 以 DB 查詢 `SELECT 1 FROM users WHERE is_admin=true LIMIT 1`：
  - 若存在：setup 永久不可用（返回 404 或固定拒絕）。
  - 若不存在：允許建立第一個 admin。

### 風險控制

- setup 只允許建立一次（以「是否已有 admin」作為唯一開關）。
- setup 提交成功後，必須立即能登入後台。

## 驗收標準（Acceptance Criteria）

- `/admin/setup`：
  - 沒有 admin 時可用，成功建立 admin 後即不可再用。
  - 已有 admin 時不可用。
- `/admin/login`：
  - 使用 admin 帳密可登入，登入後 `/admin` 可打開。
  - 非 admin 帳密登入後，仍不可進 `/admin/*`（會被擋/redirect）。
- `/admin/*`：
  - 未登入會被 redirect 到 `/admin/login`。
  - 登入後可看到左側 menu 與對應頁面骨架。
- 後台頁面能成功讀取至少一個 admin API endpoint（例如 dashboard 或 orders）並渲染到頁面。

## 測試策略

- 新增 node:test 測試覆蓋：
  - setup gating：無 admin / 有 admin 行為
  - admin page guard：未登入 redirect、登入後可訪問
  - login/logout：session 變化與可訪問 admin API

## 相容性與部署

- 不新增新框架與 build 流程，保持 Node + Express + EJS。
- 沿用現有 session 設定（`SESSION_SECRET`、cookie）。
- 確保 Vercel/Serverless 入口仍可載入（不引入不支援的原生依賴）。

