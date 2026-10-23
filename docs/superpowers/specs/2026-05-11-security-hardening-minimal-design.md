# 安全加固（最小變更）設計規格

## 背景

現時專案使用 cookie session（express-session + connect-pg-simple）作登入狀態，後台/部分 API 以 session 權限保護。已具備 ShipAny webhook HMAC 驗證與 IP allowlist，但未見完整 CSRF 防護、頻率限制（rate limit）及通用安全 headers（helmet / CSP / HSTS 等）。

本規格目標係以「最小變更、低風險」方式加固安全，避免影響現有後台/前台流程，同時提升對常見攻擊面（CSRF、暴力登入、惡意探測、弱 headers）的抵抗力。

## 目標（Goals）

- 為網站加上合理嘅安全 headers（優先不破壞現有功能）。
- 對高風險入口加 rate limit（登入、admin 寫入、webhooks）。
- 對「使用 cookie session」嘅寫入請求加入 CSRF 防護，但不影響 webhook（webhook 不用 cookie）。
- 收緊 CORS 風險位，避免 production 反射任意 origin + credentials 導致資料外洩。
- 維持現有 routes/行為；所有新增防護具備清晰 bypass 規則（例如 webhook）。
- 提供測試覆蓋，確保防護生效且不造成回歸。

## 非目標（Non-goals）

- 不做 2FA/SSO/IP allowlist for admin（另立專案）。
- 不做完整 CSP 強約束（因現時依賴外部 `cdn.tailwindcss.com`，直接嚴格 CSP 會破壞頁面）；先做可逐步收緊嘅基礎版本。
- 不引入外部集中式 rate limit store（Redis）作第一步（先 memory store，之後視部署形態升級）。
- 不改動資料庫 schema（除非為 security 必要且極小）。

## 現狀摘要（Current State）

- Session cookie：prod 才 secure，sameSite=lax，httpOnly=true；SESSION_SECRET 有 fallback（需確保 prod 一定設 env）。
- 未見 csurf；大量 session-based write endpoints（/api/admin/*、/api/auth/*、/admin/*）。
- 未見通用 helmet headers。
- CORS：production 設 `origin: true` + `credentials: true`（存在反射 origin 風險）。
- Webhook：ShipAny 有 HMAC 驗證 + 可選 IP allowlist（已有）。

## 設計概述

本方案拆成 4 塊，依序上線：

1) **Security Headers**：引入 `helmet`，加入基本 headers；CSP 以寬鬆起步，避免破壞現有外部資源。
2) **Rate Limiting**：引入 `express-rate-limit`，針對特定路由套用不同限制策略。
3) **CSRF**：引入 `csurf`（或等價自家 token 機制），只保護「帶 session cookie」嘅 state-changing 請求，並豁免 webhooks/純公開 API。
4) **CORS tighten**：改為 allowlist（env 配置），保留 dev 體驗，但 production 嚴格限制 origin。

## 詳細設計

### 1) Security Headers（Helmet）

#### 依賴

- 新增 dependency：`helmet`

#### 行為

- 於 `app.js` 全域套用 helmet middleware。
- 最小配置（優先安全但不破壞現有）：
  - `frameguard`：防 clickjacking（除非你需要 iframe embed，預設 deny/sameorigin）。
  - `xContentTypeOptions`：nosniff
  - `referrerPolicy`：same-origin 或 strict-origin-when-cross-origin
  - `hsts`：只在 production 啟用（避免本地 https 問題）
  - `contentSecurityPolicy`：先用較寬鬆 policy，允許 `https://cdn.tailwindcss.com`、`data:`（圖片）、以及本地 inline（如現有 EJS 有 inline script/style）

#### 驗收

- Response headers 出現常見 security headers（至少：X-Content-Type-Options、X-Frame-Options 或 CSP frame-ancestors、Referrer-Policy）。
- Admin 與 storefront 頁面仍正常載入。

### 2) Rate Limiting

#### 依賴

- 新增 dependency：`express-rate-limit`

#### 目標路由與策略

- **Auth 登入**：`POST /api/auth/login`（以及任何 admin login endpoint）
  - 例如：每 IP 每 15 分鐘 20 次（可由 env override）。
  - 回應：HTTP 429 + 明確訊息（但不洩漏帳號存在與否）。
- **Admin 寫入**：對 `/api/admin/*` 之中 method 係 POST/PUT/PATCH/DELETE 加較高額度限流（避免惡意刷單/刷庫存）
  - 例如：每 IP 每分鐘 120 次（按實際操作調整）。
- **Webhooks**：`POST /webhooks/*` 加較高額度限流（防探測/垃圾請求）
  - 例如：每 IP 每分鐘 300 次；並保留現有 HMAC/IP allowlist。

#### 例外與注意

- 需要配合 `trust proxy` 設定（部署於反向代理後面時，rate limit 應以真實 client ip 計）。
- 對 webhook：真正阻擋依然以 HMAC/IP allowlist 為主；rate limit 係最後防線。

### 3) CSRF（針對 session-based write）

#### 依賴

- 新增 dependency：`csurf`

#### 受保護範圍（Scope）

- 只保護「會帶 cookie session」嘅寫入請求：HTTP method 為 POST/PUT/PATCH/DELETE。
- 對外部系統呼叫嘅 webhook 一律豁免（webhook 不使用 cookie，且已用 HMAC/IP allowlist）。
- 對純公開 GET API（例如 products list）不加 CSRF。

#### Token 發放與帶法

- **Admin UI**
  - 在 admin layout（EJS）輸出一個 `<meta name="csrf-token" content="...">`。
  - `public/js/admin/common.js` 的 `adminApiRequest` 自動讀取 meta token，並在 method 非 GET 時加 header：`X-CSRF-Token`.
- **Storefront**
  - 對需要寫入嘅表單（如 login/register/cart actions 若有）用 hidden input 或 header。
  - 若現時 storefront 寫入全部走 API fetch，一樣可用 header 帶。

#### 失敗行為

- CSRF token 缺失/不符：回 403（JSON endpoints 回 `{ error: '...' }`；頁面 form 可以顯示友好錯誤）。

### 4) CORS tighten（allowlist）

#### 行為

- 改 `cors` 設定：
  - production：只允許 env 提供嘅 allowlist origins（例如 `CORS_ALLOWED_ORIGINS` comma-separated）。
  - development：允許 `http://localhost:*`（保留本地測試便利）。
- 保留 `credentials: true` 但只配合 allowlist origins。

#### 驗收

- 未在 allowlist 的 origin 不應該得到 `Access-Control-Allow-Origin`（尤其係帶 credentials 時）。

## 測試策略

- 新增/更新 node:test 測試：
  - `helmet` headers 存在（至少對 `/api/health` 或 `/admin/login`）。
  - `rate limit` 對 `/api/auth/login` 生效（多次請求會 429）。
  - `CSRF`：對一個代表性 admin write endpoint（例如倉庫 update/庫存調整/PO 收貨）在缺 token 時 403，有 token 時可通過（可以用 stub/session 或檔案級測試以 regex 驗證 wiring）。
  - `webhook` endpoint 明確豁免 CSRF（不需要 token 仍然可走到驗簽/回應邏輯）。

## 風險與緩解

- **CSP 可能破壞頁面**：先用寬鬆 policy，逐步收緊；必要時先用 report-only。
- **CSRF 可能阻斷 admin 操作**：先只覆蓋 admin fetch（透過 `adminApiRequest` 自動帶 token），並加入測試確保關鍵 write endpoint 仍正常。
- **Rate limit 在多 instance 下不準**：第一步接受；如部署多 instance，再升級集中 store。
- **Proxy/真實 IP**：加入 `trust proxy` 策略並與現有 IP allowlist 一致。

## 實施步驟（Implementation Outline）

1) 引入 dependencies（helmet、express-rate-limit、csurf）與基本 wiring。
2) Admin layout 注入 CSRF meta；adminApiRequest 自動帶 token。
3) 加入路由層豁免規則（webhooks、public GET）。
4) 調整 CORS 到 allowlist。
5) 加測試 + 跑全測試。

