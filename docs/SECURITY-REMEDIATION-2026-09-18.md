# Ohya2.0 上線前必修清單（安全 + 架構）

> 2026-09-18 代碼審查產出。狀態：**尚未對外營運、未收真錢**，故無即時風險；下列 🔴 項目必須在「收真錢 / 公開開張」前完成。
> 每項附檔案:行號 + 修法。✅ = 已由 agent 親自核實屬真。

## 🔴 P0 — 上線/收款前必修

### 1. 支付 webhook 零驗證（可偽造「已付款」）✅
- 位置：`routes/logistics.js:882` (fps-payme)、`:916` (alipayhk)、`:957` (wechatpay)
- 問題：三個 webhook 冇簽名驗證、冇 IP allowlist、冇校金額、冇 idempotency。任何人 POST `{out_trade_no, trade_status:'TRADE_SUCCESS'}` 即可將任意訂單標記 paid。
- 對比：ShipAny webhook `:725` 有 HMAC + IP allowlist（可參考）。
- 修法：
  1. 各閘道照官方規格驗簽（支付寶 RSA2 / 微信 V3 HMAC-SHA256 / FPS 閘道 token），用已保留嘅 `req.rawBody`（app.js:164）。
  2. secret 未設定 → 直接 reject，唔好靜默放行。
  3. handler 流程：先查訂單存在 → 校金額與幣別一致 → 用交易號做冚等冚（ON CONFLICT）冚狀態，全件包一個 pg transaction。
  4. 無效簽名回非 2xx；加 idempotency key 防重複入賬。

### 2. 庫存超賣（競態）✅
- 位置：`routes/orders.js:88-143`
- 問題：庫存檢查在 transaction 外，入 txn 後冇 `SELECT ... FOR UPDATE`、冇重新校驗；`UPDATE products SET stock = stock - $1`（:131）冇 `WHERE stock >= $1`。並發下可買到負庫存。
- 另：下單更新 `products.stock`，但正式 schema 庫存喺 `product_skus.stock` + `inventory_levels`，兩套數會越行越 drift。
- 修法：txn 內鎖行做
  `UPDATE product_skus SET stock = stock - $q WHERE id=$1 AND stock >= $q RETURNING stock`，
  0 row → ROLLBACK 回「庫存不足」；全面統一落 SKU/inventory_levels。
- 取消訂單（:152-181）：只允許 pending 單取消，並驗證係咪已扣過庫存（幂等）；paid 單唔可以自助 cancel。

### 3. 被停用/封鎖用戶仍可登入 ✅
- 位置：`routes/auth.js:38,46,74-85`、`routes/adminPages.js:86-113`
- 問題：登入 SELECT 冇 filter `is_active`，全 path 冇檢查 `is_active`/`is_blacklisted`；封號後 session 仲有效 30 日。
- 修法：登入加 `AND is_active = true AND COALESCE(is_blacklisted,false)=false`；middleware 對敏感操作重新查用戶狀態；封號時一併刪除該用戶 session（pg session store 可按 user id 刪）。

### 4. 路由互相遮蔽，featured/slug 係死路由 ✅
- 位置：`app.js:379-380`（products.js 先註冊，products-full.js 後註冊）
- 問題：`routes/products.js:71` 嘅 `GET /api/products/:id` 食晒所有單段路徑：
  - `/api/products/featured`（products-full.js:215）落入 `:id`，'featured' 塞去 int 欄位 → Postgres 22P02 → 500。
  - `/api/products/:slug`（:235）同樣被遮蔽。
  - `/api/brands` 喺 brands.js:9 同 products-full.js:31 重複定義，前者贏、後者係死碼。
- 修法：剷走重疊舊檔 products.js，或將具名路由（featured 等）擺在 `:id`/`:slug` 之前，並對 id 加 `^\d+$` 校驗；長遠一個 resource 一個 route file。

### 5. DB schema 三套來源，全新環境起唔完整 ✅
- 位置：`utils/dbBootstrap.js`（30 step）、根目錄 `schema.sql`、`schema-full.sql`、`migrations/`（7 個 SQL，冇 runner）
- 問題：dbBootstrap 漏建大量實際使用表（member_levels、points_transactions、coupons、flash_sales、return_requests、product_reviews、suppliers、purchase_orders 等）；`schema.sql:521` 有缺 CREATE TABLE 頭嘅屍塊；migrations 冇版本表、`.vercelignore:6` 仲排除埋佢。
- 修法：只留一份 canonical（schema-full + 編號 migration），引入 `node-pg-migrate`；CI 用空 Postgres 由頭行一次 + smoke 幾個 API；dbBootstrap 改做「最低限度啟動」，唔好宣稱完整成功。

## 🟡 P1 — 盡快排期

安全：
1. **上傳無類型校驗 + 路徑穿越 + 同步寫碟** ✅ `routes/admin.js:42-60`、multer `app.js:230`。加 fileFilter（jpeg/png/webp）、用 `crypto.randomUUID()` 檔名、強制副檔名、改 async 寫、prod 上 S3/R2（Vercel 碟唯讀易失）。
2. **CSP 形同虛設** ✅ `app.js:62`：`script-src 'unsafe-inline'` + Tailwind CDN。改 nonce-based CSP + build-time Tailwind。
3. **登入 rate limit 唔完整**：只有 `/api/auth/login` 掛 limiter（app.js:155，20/15min 偏鬆）；`/admin/login`、`/login` POST 冇掛。統一掛，admin 收緊 5-8 次。
4. **Session fixation**：`routes/auth.js` setSessionUser 直接寫現有 session；登入成功後應先 `req.session.regenerate()`。
5. **sync secret 用 `includes` 比較**（非常數時間）`routes/mzakka-sync.js:53` → 用 `crypto.timingSafeEqual`（webhookSignatures.js 有正確例子）。
6. **DB SSL 不驗憑證** `utils/getPool.js:25` `rejectUnauthorized:false` → 用 provider CA。
7. **內部錯誤訊息回吐客戶端**（admin bulk import、products-full inventory adjust）→ 客戶端統一通用訊息，詳情留 log。
8. **XSS**：`views/product.ejs:148` `<%- section.contentHtml %>` 直接渲染爬返嚟嘅 HTML → sanitize-html 白名單；`:234`、`views/index.ejs:156` 將 `JSON.stringify` 塞入 `<script>` 未 escape `</script>`，最少將 `<` 換 `\u003c`。
9. **積分 double-spend** `routes/members.js:240-283`：改 `WHERE points>=$1` 條件 UPDATE + RETURNING 校 rowCount、驗訂單擁有權、拒負數。
10. **退款無 transaction / 無金額上限** `routes/refunds.js:36-59,114`：包 txn、累計退款 ≤ 訂單額 guard、校退款必須 pending。

正確性/效能：
11. **連接池 `max:1`** `utils/getPool.js:24`：並發要排隊；配合產品列表 N+1（products-full.js:193-203 每產品獨立查 SUM stock）會好慢。pool max 5-10，stock 改 GROUP BY 子查詢一次過取。
12. **冇全域 error handler / 404 JSON handler**：csurf EBADCSRFTOKEN、multer LIMIT_FILE_SIZE 會 fall through 預設 HTML。加 error-first middleware（CSRF→403 等）。
13. **`per_page` 無上限**（orders.js:9、members.js:314、products-full.js 等）：clamp 到最多 100。
14. **Vercel cron 可能 401**：cron GET 冇帶自訂 header，而 internal secret 檢查（mzakka-sync.js:46）要 header secret；核對 Vercel CRON_SECRET 慣例有冇對應。

架構：
15. **兩套 requireAdmin 語義不一致**：app.js:228 認 `isAdmin`；middleware/auth.js:36 認 `isAdmin||isBackoffice`。統一用 middleware/auth，剷 app.js 內置版。
16. **上帝檔案**：app.js、products-full.js（1312 行）、logistics.js（997 行，5 個 domain）按 domain 拆模組。
17. **硬編碼本機絕對路徑** `utils/imageUtils.js:6`：`/Users/chansiulungfelix/...` → 改 `process.env.LOCAL_IMAGE_DIR`（亦係 prod 圖片 proxy 永遠 fallback 遠端嘅原因）。

## 🧪 測試
- 全套 `node --test ./test/*.test.js`：**198 tests，192 pass / 6 fail**。
- 6 個失敗全部係**過時嘅源碼字串 grep**（唔係而家功能壞）：
  - `admin-categories-hierarchy-api-validation`：測試要求「上級必須係大分類（兩層）」，但實際已改用遞迴 CTE 防循環（任意層數）。**需先確認業務規格：到底要唔要限兩層？** 要 → categories.js 補「parent 必須頂層」；唔要 → 更新測試。
  - 5 個 UI（homepage.mzakka-layout、mzakka-theme-layout）：主題改版後 marker（mz-topbar、mzakka-ranking、black-body、左右 sidebar、dense header）對唔上，更新測試到新主題。
- 更深問題：大量測試只 grep 源碼/標記，唔做真 render 或行為驗證，重構會誤報且俾假安全感。核心交易（下單/退款/庫存/admin 權限/webhook）應用 supertest + 測試 DB 做整合測試。

## ✅ 已做得好（保留）
SQL 全面參數化（含 ORDER BY 白名單）、EJS 用戶輸出基本有轉義、CSRF 全域（僅豁免 webhooks/CSP）、bcrypt、helmet+CSP 框架、四個 rate-limiter、session cookie httpOnly+secure(prod)、pg client connect/release 對稱、CORS 白名單、admin 寫路由普遍有 requireAdmin/requirePermission。

---
建議落地順序：**P0-1（webhook）→ P0-2（庫存）→ P0-3（封號）→ P0-4（死路由）→ P0-5（schema）**，每一項連整合測試一併做。
