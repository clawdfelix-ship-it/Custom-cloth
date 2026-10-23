# OHYA2.0 重新營運 — 可執行修復 Runbook

- **日期**：2026-09-11
- **作者**：後端架構師（只讀審查 + 撰寫文件；**本 runbook 不含任何已執行嘅代碼改動**）
- **輸入**：`docs/AUDIT-2026-09-11-security.md`、`docs/AUDIT-2026-09-11-code.md`（視為事實基礎，不重複審計）
- **項目**：`Ohya2.0`（Express 4 + EJS + Postgres + connect-pg-simple + csurf，Vercel serverless，`ohya2-0.vercel.app`）
- **鐵律**：
  1. push master = Vercel 即時自動部署生產。**所有修復喺 feature branch 做、本地 + preview deployment 驗完先好 merge**。
  2. 唔好喺營運時間直接對生產 DB 跑 DDL；migration 要可回滾／先備份。
  3. 每個 Phase 完成後行 `npm test`（基線：169 tests），唔可以轉紅。

> 閱讀约定：每項給【位置】【修法】【風險】【本地驗證】【上線後驗證】。代碼片段只係範例，唔係已套用修改。

---

## 0. 額外發現（兩份 audit 未列出、但影響「落唔到單/入唔到屋」，喺修復中一併處理）

1. **店面表單登入/註冊路由根本不存在**：`views/login.ejs:46` `<form method="POST" action="/login">`、`views/register.ejs:46` action=`/register`，但 `app.js:843-857` 只得 `GET /login`、`GET /register`，全 repo 冇 `POST /login`/`POST /register`（只有 JSON 嘅 `POST /api/auth/login`，而且受全域 CSRF 保護）。即店面表單登入一定 404，**cart checkout 嘅「請先登入」跳轉後根本入唔到**。
2. **`POST /api/orders`（routes/orders.js:107-115）嘅 INSERT 喺全新 schema-full 庫會失敗**：只提供 `(user_id, contact_name, contact_phone, contact_address, note, total_amount, status)`，但 `schema-full.sql:565` orders 表 `subtotal_amount NOT NULL`、`shipping_fee NOT NULL`、`payment_method_code NOT NULL`（冇 default）。另訂單**從來冇 generate `order_number`**（全 repo 冇生成邏輯），而支付 webhook（logistics.js:923/957）靠 `order_number` 搵單 → 即使偽造 webhook 修咗，正常支付回調都會搵唔到單。
3. `routes/orders.js` join `order_items` 用 `p.name`（:51）但 schema-full `order_items` 係 `product_name`（雖然兩個 schema 都有 products FK，尚可；一併對齊）。

---

# Phase 0 — 本地開發環境起手（所有人做任何修改前先完成）

## 0.1 本地 Postgres（Docker，唔使裝機）

需要本機有 Docker Desktop。首次：

```bash
# 起一個專用 PG 16，端口 5544（避開本機可能已裝嘅 5432），數據用 named volume 持久化
docker run -d --name ohya-pg \
  -e POSTGRES_PASSWORD=ohya_dev_pw \
  -e POSTGRES_DB=mzakka_ecommerce \
  -p 5544:5432 \
  -v ohya-pgdata:/var/lib/postgresql/data \
  postgres:16

# 驗證
docker exec -it ohya-pg psql -U postgres -d mzakka_ecommerce -c '\dt'
```

之後每日只需 `docker start ohya-pg` / `docker stop ohya-pg`。
想推倒重來：`docker rm -f ohya-pg && docker volume rm ohya-pgdata`，再行上面 run。

## 0.2 Schema 初始化次序（重要：現況係三軌 drift，見 Phase A1）

> **現狀警告**：`schema.sql` 喺約 L523–539 有無頭屍塊（缺 `CREATE TABLE`），**由頭跑會 syntax error**；`schema-full.sql` 先係相對完整版本，但佢同 7 個 migration 有重疊/缺口。Phase A1 先會做正式收斂；**Phase 0 階段用以下「可行組合」起一個本地庫**：

```bash
# 1) 主 schema（用 full；schema.sql 暫時唔好掂）
docker exec -i ohya-pg psql -U postgres -d mzakka_ecommerce < schema-full.sql

# 2) 7 個 migration 全部冚上去（全部用 IF NOT EXISTS / ADD COLUMN IF NOT EXISTS，冧行安全，次序唔好亂）
for f in migrations/2026-04-28-add-zh-hk-columns.sql \
         migrations/2026-05-03-phase2-ops.sql \
         migrations/2026-05-03-subcategory-backfill.sql \
         migrations/2026-05-04-default-warehouse-and-sku-cost-history.sql \
         migrations/2026-05-04-inventory-levels.sql \
         migrations/2026-05-04-inventory-warehouse-default.sql \
         migrations/2026-05-04-rbac-seed.sql ; do
  echo ">> $f"; docker exec -i ohya-pg psql -U postgres -d mzakka_ecommerce < "$f"
done

# 3) 最小業務 seed（運費分區 + 支付方式）
docker exec -i ohya-pg psql -U postgres -d mzakka_ecommerce < seed-data.sql
```

驗證：`\dt` 應見到 users / products / product_skus / inventory_levels / orders / cart_items / session / refunds / admin_roles 等表；`SELECT code FROM payment_methods;` 有 6 行。

## 0.3 `.env`（本地用，**唔好寫真值、唔好 commit**）

由 `.env.example` + 代碼推出，本地開發最少要：

```bash
# .env（repo 已 gitignore .env*；自己 cp .env.example .env 再改）
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://postgres:ohya_dev_pw@localhost:5544/mzakka_ecommerce
SESSION_SECRET=dev-only-secret-not-for-prod
CORS_ALLOWED_ORIGINS=http://localhost:3000
CSP_MODE=report
CSP_REPORT_PATH=/csp-report

# Phase C 支付修復時先需要（本地留空 = webhook 要 fail-closed，用測試金鑰時再填）
SHIPANY_API_KEY=
SHIPANY_WEBHOOK_SECRET=
SHIPANY_WEBHOOK_ALLOWED_IPS=
SHIPANY_API_URL=https://api.shipany.com/v1
# 以下 3 組係新增（Phase C 會講），而家 .env.example 未涵蓋，修復時要補入 example：
FPS_PAYME_WEBHOOK_SECRET=
ALIPAYHK_WEBHOOK_SECRET=
WECHATPAY_WEBHOOK_SECRET=
```

代碼會讀但 example 未列出嘅變數（修復時補 `.env.example` 註釋）：
- `POSTGRES_URL`：`utils/getPool.js:8` 係 `DATABASE_URL` 嘅 fallback。
- 圖片本地目錄：`utils/imageUtils.js:6` 而家 hardcode 絕對路徑（壞味道，Phase E 會改成 `IMAGE_LOCAL_DIR`）。

> ⚠️ 生產密鑰（真 SESSION_SECRET、支付商密鑰、生產 DATABASE_URL）**唔好放落 .env.example，亦唔好喺呢個 runbook 出現**；由 Felix 經 Vercel Dashboard 設定（見 Phase G）。

## 0.4 最小測試數據（落單 happy path 用）

`seed-data.sql` 只有運費/支付方式，冇商品、冇用戶。建立一個 `scripts/dev-seed-minimal.sql`（新檔，可 commit 因為係假資料）：

- 1 個分類（leaf，要有 `parent_id`，因為 `routes/products.js:3` 嘅 `assertLeafSubcategory` 同前台過濾依賴層級）；
- 2 個商品：一個有貨（SKU stock=10）、一個低庫存（stock=1），`status='active'`、`name_zh_hk`/`description_zh_hk` 非空（products.js 列表有呢個過濾）；
- 每個商品至少 1 行 `product_skus`（`attributes` 係 NOT NULL JSON，例如 `{"default":"預設"}`）+ `inventory_levels`（對應預設倉，migration `2026-05-04-default-warehouse...` 會插「預設倉庫」）；
- 1 個測試顧客：密碼要用 bcrypt hash，**唔好喺 SQL 寫死 hash**，用 node 一次性生成：
  ```bash
  node -e "require('bcryptjs').hash('Test1234',10).then(h=>console.log(h))"
  ```
  再人手 `INSERT INTO users (username,password_hash,is_admin) VALUES ('testuser','<hash>',false);`
- 1 個後台管理員（生產環境用 `/admin/setup`，本地可同法 INSERT `is_admin=true`）。

## 0.5 安裝、起服務、行測試

```bash
npm install
npm run dev          # nodemon app.js，http://localhost:3000；/api/health 應回 {"status":"ok"}
npm test             # node --test ./test/*.test.js → 基線 169 pass / 0 fail（約 1 秒）
```

注意：現有 169 個測試係「讀源碼字串斷言」型（見 code audit §6），**唔會對真 DB 發 HTTP**。所以「169 pass」唔等於網站行得通——Phase A 起會新增真實 boot/HTTP smoke test。

本地 baseline 手動 smoke（修復前預期會壞，記低現象）：
1. `curl -s localhost:3000/api/health`
2. `curl -s "localhost:3000/api/products?page=1"` → 修復前預期 **500/或被 shadow 版行舊欄位**（Phase A2）
3. browser 開 `/`、`/products`、`/cart`、`/login`；試 POST `/login` → 預期 404（Phase 0 新發現 #1）

---

# Phase A — P0 地基（schema 收斂 / shadow route / 統一錯誤處理）

> 目標：新隊友 clone repo 後可以用一條命令起出同生產結構一致嘅庫；`/api/products` 返 200；任何 async 拋錯都返 JSON 500 而唔係裸堆疊/HTML。

## A1. Schema / migration 收斂做單一可信來源（M，1.5–2 日）

**位置**
- `schema.sql:~521-539` 無頭屍塊（缺 `CREATE TABLE products (...)` 開頭，psql 跑會 syntax error）。
- `schema-full.sql`（28KB，46 張表，相對完整）、`schema.sql`（22KB，舊版，含 `products.stock`、簡陋 orders）、`migrations/07 個 SQL`（冇 runner、冇 `schema_migrations` 表）、`seed-data.sql` 四軌並存。
- 已驗 drift：`routes/orders.js:85,131,178` 同 `routes/cart.js:9,89` 用 `products.stock`，但 schema-full 冇呢欄（真實庫存喺 `product_skus.stock` + `inventory_levels`）；schema-full orders 有 `subtotal_amount/shipping_fee/payment_method_code NOT NULL`，但 orders.js INSERT 冇提供。

**修法（步驟）**
1. **凍結**：宣佈 `schema.sql` deprecated → 改名 `schema.sql.legacy.bak`（或直接刪，git 有歷史），喺檔頭/PR 描述講明以後冇人再跑佢。順手刪走 L523-539 屍塊——如果決定暫時保留檔案嘅話。
2. **定義可信來源 = `schema-full.sql`（baseline）+ `migrations/*.sql`（incremental）**。
3. 寫最細 migration runner `scripts/migrate.js`（唔使引入 knex 呢類大架架）：
   - 起 `schema_migrations(filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT now())`；
   - 按檔名排序，未記錄過嘅 `.sql` 就喺單一 transaction 內跑（`BEGIN` → `client.query(sql)` → 記錄 → `COMMIT`；失敗即 ROLLBACK 停），冧行安全；
   - `npm run migrate:up`。**唔好喺 serverless cold start 自動跑 migration**（`.vercelignore` 已 ignore migrations，保持；migration 只由 CLI/CI 顯式執行）。
4. 新增第一支對齊 migration `migrations/2026-09-11-align-checkout.sql`（用 `IF NOT EXISTS`/冧行）：
   - 盤點 code 真正需要但 schema-full 冇嘅欄/表：`orders.paid_at`、`orders.payment_transaction_id`、`orders.tracking_status`、`orders.tracking_updated_at`、`orders.shipany_label_url`、`return_requests`、`order_status_histories`（phase2-ops 已有，核對命名：code 寫 `order_status_histories`，schema-full 係單數 `order_status_history`——**呢個都係 drift**，要統一，建議跟 code：見下表）、`refunds.approved_by/approved_at/rejected_by/rejected_at/note`、`inventory_levels`、`sku_cost_history`、`is_default`、`payment_transactions` 唯一索引。
   - **明確唔好補 `products.stock`**——佢係錯誤口徑；改 code 去 SKU 模型先係根治（Phase C2）。如果時間緊要一個過渡 migration 頂住，必須一併加 trigger 由 SKU 彙總同步，並加 TODO 死線。
   - `order_status_histories`：routes/logistics.js、routes/refunds.js 全部用複數表；schema-full 係 `order_status_history`（單數）。**以 code 為準**，migration 內 `CREATE TABLE IF NOT EXISTS order_status_histories (...)`，並核對 `2026-05-03-phase2-ops.sql:24` 已經係咁做（係），即全新庫跑 full+migrations 會有複數表、schema-full 嘅單數表變孤兒，可唔可以理（或下一支 migration DROP 單數表，生產要先確認冇數據）。
5. `package.json` scripts 加 `"migrate:up": "node scripts/migrate.js"`；README（Phase F）更新起手次序。
6. CI/本地加 **空白庫 bootstrap smoke**（新 test `test/schema-bootstrap.test.js`，用 `docker exec` 或 testcontrians 均可；最簡單：npm script `db:bootstrap` 串好「dropdb→schema-full→migrate:up→seed」，再由 smoke 行 `psql -c 'SELECT 1'` + boot app 打 `/api/health`、`/api/products`）。呢個 test 會即時抓住以後嘅 drift。

**風險**
- 對生產庫首次「套用」7 支舊 migration 前，必須先對生產庫跑一次 **dry-run 盤點**（見 A1 驗證嘅 diff 腳本），因為生產可能靠人手 ALTER 行咗一部分；冧行寫法（IF NOT EXISTS）已覆蓋大部份情況，但 index/constraint 名唔同會沖突。
- `schema_migrations` 會將 7 支舊檔全部標記為已行——要喺首次執行時用「baseline 模式」：對生產庫比對後人手 mark baseline（`migrate.js` 支援 `--baseline` 將現有檔全部記錄但唔執行），淨係由 2026-09-11 新支開始真正跑。

**本地驗證**
- `docker rm -f ohya-pg` 推倒，照 0.2 + `npm run migrate:up` 重起；確認 7 支顯示 already-applied/baseline；
- `psql -c '\d orders'`、`\d order_status_histories`、`\d inventory_levels` 同 code 用到嘅欄位逐個核對；
- 新 smoke test 入 CI。

**上線後驗證**
- 上線只係文件/工具改動（無 runtime 行為改變），風險低；merge 後喺 Vercel **先對生產 DB 唯讀**跑 `migrate.js --status`（要支援 dry-run SELECT，唔好直接連寫權限用戶），確認 baseline 一致；真正 DDL 留到 Phase C 一併安排。

## A2. 滅 `/api/products` 500：shadow route 二選一（S，0.5 日）

**位置**
- 註冊次序 `app.js:375-377`：brands.js → **products.js** → products-full.js。Express 先註冊先贏。
- `routes/products.js:71`（舊版，92 行）註冊 `GET /api/products/:id`，**早過** `routes/products-full.js` 嘅 `/api/products/featured`（約 :215）→ `/api/products/featured` 被 `:id='featured'` 食咗 → Postgres `invalid input syntax for type integer` → **500（線上已驗）**。
- `/api/products` 本身而家行 products.js:17 舊版（強制 zh-hk 非空、冇 brand/tag/sort），products-full.js:127 完整版（分頁/brand/tag/sort/featured）變 dead code。
- brands 一樣有兩套（brands.js vs products-full.js，5 組 method+path shadow）。

**修法（推薦：刪舊版，留 full 版）**
1. 刪除 `require('./routes/products')(...)`（app.js:376）同整個 `routes/products.js`；刪除/合併 `routes/brands.js` 入 products-full（核對 products-full 已有齊 GET/POST/PUT/DELETE + RBAC 先好刪）。
2. 喺 products-full.js 確認 **static path 必須喺 `:id` 之前註冊**：`/api/products/featured`、任何 `/api/products/:slug` 要排在 `/api/products/:id` 前面；或把 `:id` route 收緊做整數校驗（`app.get('/api/products/:id(\\d+)', ...)`，Express 4 path-to-regexp 支援自訂 regex），雙保險。
3. 統一回應欄位：products-full 回 `pagination.page_size/total_pages`，products.js 舊版回 `perPage/totalPages`——grep 所有前端/測試邊個 contract 有人用（店面視圖而家唔 call API，admin JS 要查 `public/js/admin/`），**保留 full 版嗰套**並改消費方；順手修 N+1（products-full.js:193-201 每行再 SUM stock）→ 一個 derived table JOIN（app.js 首頁 :529-535 有現成範式）。
4. 新增 test `test/route-uniqueness.test.js`：boot app（唔聽 port）攞 `app._router.stack`，抽出所有 `METHOD + normalized path`，assert 無重複註冊。呢個會將成個 shadow class 一次過鎖死。

**風險**：中。products.js 嘅 `assertLeafSubcategory` 過濾（:3-14，要求商品掛 leaf 子分類）同 zh-hk 非空過濾喺 full 版冇——刪之前要決定呢啲 business rule 係咪保留（建議保留 leaf/可見性過濾，搬去 full 版 list query，因為分類頁同 UI 依賴兩層分類）。admin JS 若食舊 response 欄位要一併改。

**本地驗證**
- `curl 'localhost:3000/api/products/featured'` → 200；`curl 'localhost:3000/api/products?page=1&sort=price&order=asc&brand_id=1'` → 200 且分頁正確；
- `curl localhost:3000/api/products/999999` → 404（唔係 500）；`curl localhost:3000/api/products/abc` → 404；
- `npm test` 全綠 + 新增 route-uniqueness test。

**上線後驗證**：`curl -i https://ohya2-0.vercel.app/api/products/featured`、`/api/products?page=1` 200；Vercel function logs 冇 Postgres integer 錯；admin 商品頁功能正常。

## A3. 統一 async 錯誤處理 + 404 + process safety net（S，0.5–1 日）

**位置**
- 全 repo 冇 4 參數 error middleware（grep `err, req, res, next` = 0）；冇全局 404；冇 `unhandledRejection` handler。
- 約 160 個 handler 各自 try/catch copy-paste；`routes/adminPages.js:58,64,80,84` 4 個 async handler **完全冇 catch**（`POST /admin/setup`、`POST /admin/login` DB 爆 → unhandled rejection / Express 預設 HTML 500）。
- `app.js:417-419` route load 失敗回 `details: error.message`（漏內部錯誤）；`products-full.js:1166` inventory adjust 直接回 `e.message`。

**修法**
1. 新檔 `utils/asyncHandler.js`：
   ```js
   const wrapAsync = (fn) => (req, res, next) =>
     Promise.resolve(fn(req, res, next)).catch(next);
   module.exports = { wrapAsync };
   ```
   所有 `app.xxx('/...', async (req,res)=>{})` 改用 `wrapAsync(...)` 包（機械式搬，**先包冇 try/catch 嘅 adminPages 4 個，再逐檔遷移**；已有 try/catch 嘅可後續先清理，唔使一次過）。
2. `app.js` 所有路由註冊**之後**（而家 route load try/catch 後面）加：
   ```js
   // JSON 404（API）＋ EJS 404（頁面）
   app.use('/api', (req, res) => res.status(404).json({ error: '找不到資源' }));
   app.use((req, res) => res.status(404).render('404', { title: '頁面不存在' })); // 可先簡單 send
   // 統一 error handler（必須 4 參數）
   app.use((err, req, res, next) => {
     console.error('request error', { path: req.path, method: req.method, message: err && err.message });
     if (res.headersSent) return next(err);
     const isApi = req.path.startsWith('/api') || req.path.startsWith('/webhooks');
     const status = Number.isInteger(err && err.status) ? err.status : 500;
     const body = { error: status < 500 ? err.message : '伺服器錯誤' };
     if (isApi) return res.status(status).json(body);
     return res.status(status).send(status < 500 ? err.message : '伺服器錯誤');
   });
   ```
   csurf 拋出嘅 EBADCSRFTOKEN 要特登 map 403 JSON：error handler 開頭 `if (err.code === 'EBADCSRFTOKEN') return res.status(403).json({error:'CSRF token 無效'})`。
3. 刪 `app.js:417-419` 回傳 `details`；`products-full.js:1166` 改 500 唔帶 message（保留 server log）。
4. serverless 入面 `unhandledRejection` 唔好 exit（會殺冷實例），但要 log：`process.on('unhandledRejection', r => console.error('unhandledRejection', r))`；本地 `npm run dev` 可保留 exit 方便發現問題。

**風險**：低–中。wrap 改動面廣但行為等價；最大風險係某啲 handler 依賴「catch 後繼續執行」嘅怪行為——搬時每檔行 npm test + 手動 smoke。404 fallback 要放喺所有 route 之後、唔好誤殺 static。

**本地驗證**：故意打 `/api/nope` → 404 JSON；`POST /admin/login` 停咗 DB 再打 → 500 表頁/通用訊息但**進程唔死**；帶錯 CSRF POST → 403 JSON；169 tests + 新錯誤處理 test。

**上線後驗證**：Vercel logs 用壞 path/停 DB 情境試；確認 prod 回應冇 stack/SQL 片段。

---

# Phase B — P0 安全（fail-closed 配置 / 支付 webhook / 登入限流 / RBAC）

## B1. SESSION_SECRET 生產缺失必須 fail-closed（S，0.25 日）

**位置**：`app.js:177-184`（prod 冇 secret → `crypto.randomBytes(32)` 照 boot，只 warn；commit 4748f12 推翻咗 7139d1d 嘅 hard-fail）。

**修法**：喺 session middleware 建立**之前**：
```js
if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  throw new Error('FATAL: SESSION_SECRET is required in production');
}
const sessionSecret = process.env.SESSION_SECRET || 'dev-secret-change-me';
app.use(session({
  store: new pgSession({ pool, tableName: 'session', createTableIfMissing: true }),
  // 密鑰輪換：新 secret 行頭、舊 secret 行尾，舊 cookie 仍可驗、新 cookie 用新 secret 簽
  secret: process.env.SESSION_SECRET_OLD
    ? [sessionSecret, process.env.SESSION_SECRET_OLD] : sessionSecret,
  ...
}));
```
- **正確嘅「Vercel 重啟不踢人」做法 = 固定 env var，唔係 fallback 隨機**。隨機 secret 喺 serverless 多實例下必壞（每實例唔同 secret，csrf/session 亂、無端登出）。
- 生成：`openssl rand -hex 32`，設入 Vercel env（Production scope）。
- 同理 `DATABASE_URL` 缺失而家 boot 到但所有頁退化 sample data：prod 都應 fail-fast（可同項改）。

**風險**：如果生產而家真係冇設 SESSION_SECRET，merge 後首次部署會即時 500——**所以上線順序係：先喺 Vercel set env，核實存在，先 deploy 代碼**（見 Phase G checklist）。現有用戶會被登出一次（可以接受，重開前公告）。

**本地驗證**：`NODE_ENV=production`（但唔設 secret）`node app.js` → 即刻退出帶 FATAL；設咗 → 正常 boot，重啟兩次 session cookie 仲有效。

**上線後驗證**：deploy 後登入→等 15 分鐘（跨 cold start）→ refresh 仍然登入；`/admin` session 一致。

## B2. 支付 webhook：驗簽 + 核金額 + 冪等（FPS/PayMe、AlipayHK、WeChat Pay HK）（M–L，2–3 日，含同支付商對接測試）

**位置**：`routes/logistics.js`
- `POST /webhooks/fps-payme`（:882-913）、`/webhooks/alipayhk`（:920-954）、`/webhooks/wechatpay`（:957-998）。
- 三個回調全部冇簽名驗證、冇核金額、冇核商戶單號、冪等靠 `ON CONFLICT DO UPDATE`（:873-880，重放會覆寫）；CSRF 全域豁免 `/webhooks/`（app.js:74）。任何人 `curl` 即可將任意訂單標 paid。
- 對照 `/webhooks/shipany`（:725-756）：已有 HMAC（`utils/webhookSignatures.js`）+ IP allowlist（`utils/ipAllowlist.js`）嘅正確模式可照抄。

**通用修法（三個閘道共同）**
1. **fail-closed 驗證**：每個閘道對應 secret 喺 prod 缺失 → 回調一律 403/500 拒絕（**唔好跳過驗證**，唔好學 shipany 而家「有 secret 先驗」嘅 optional 模式，順手把 shipany 都改強制）。用 `req.rawBody`（app.js:145 已保存）驗簽。
2. **後端核對交易先落單**（不信任 body 自我聲稱）：驗簽通過後，用閘道查單 API（server-to-server）攞真實交易，核對：
   - 金額：`gatewayAmount === orders.total_amount`（用整數 cents 比，DECIMAL 轉 string 比，避免浮點）；
   - 幣別 HKD；
   - `out_trade_no`/商戶訂單號屬於本商戶且對到我哋訂單；
   - 狀態係成功類；
   - 支付商商戶號（PID/mchid）係自己個號。
3. **冪等 + 狀態機**：
   - `payment_transactions` 已有唯一索引 `(payment_method_code, transaction_id)`（phase2-ops migration :74）→ insert 衝突時**唔好覆寫狀態**，改 `DO NOTHING` 並照回成功（ACK），防止重放改數；
   - 訂單流轉加條件：`UPDATE orders SET payment_status='paid', paid_at=NOW() WHERE id=$1 AND payment_status <> 'paid' RETURNING id`，查 affected rows；
   - 只有由我哋 server 主動建立/記錄嘅單先接受（防憑空 order_id）；記來源 IP + 整個 raw body。
4. **IP allowlist** 做縱深第二層（用現有 `extractClientIp/isIpAllowed`，trust proxy 已設 app.js:43）。
5. webhook 收到「失敗/取消」狀態可以記 transaction，但**唔可以**由 webhook 任意改 paid→failed（要有退款/對賬流程先得，見 Phase D1）。

**逐個閘道要 Felix 確認/提供嘅嘢（文末 unknowns 再列）**：而家 code 完全冇支付商配置，亦冇文件講用緊邊間 aggregator。三種路徑：

| 閘道 | 官方簽名機制（正式做法） | 若供應商唔支援簽名嘅最低風險方案 |
|---|---|---|
| **FPS 轉數快** | FPS 本身係銀行轉帳、**冇統一 webhook**；若經收款 aggregator/閘道（如港銀行商戶收款、第三方 SaaS），用佢哋嘅 HMAC/RSA 通知 + 查單 API。需要 Felix 提供：用緊邊間（支付寶HK 商家收款 / PayMe for Business / 第三方如 TapPay/PayDollar/Stripe 等）。 | 唔好做自動入賬 webhook。改為：訂單建立時生成**唯一 FPS ID（FPS 收款附註/二維碼 ID）**，後端定時/人手喺銀行 portal 核對「金額 + 附註 ID」一致先喺後台手動確認收款；確認動作要 RBAC + audit log。ID 唔好等於可枚舉 order id。 |
| **PayMe** | PayMe for Business 官方冇公開 webhook 簽名生態；通常經 aggregator。同上要確認供應商。 | 同上：附註碼對賬 + 後台確認；或者只做「展示 PayMe 收款 code + 訂單附註」，唔設自動 callback 端點。 |
| **AlipayHK 支付寶HK** | 若用支付寶國際/香港官方 merchant API：**RSA2**（SHA256withRSA）簽名，webhook 通知用商戶私鑰/支付寶公鑰驗；`trade_status=TRADE_SUCCESS|TRADE_FINISHED`；必須 server 端 `alipay.trade.query` 查單核金額。需要 Felix 提供：APP ID、商戶私鑰、支付寶公鑰、env（prod/sandbox）。 | 若只係個人收款碼：唔好開 webhook，行 FPS 同款附註碼人工程序。 |
| **WeChat Pay HK 微信支付HK** | 官方 v3：HTTP 頭 `Wechatpay-Signature`（商戶 API 私鑰 SHA256-RSA + 微信支付平台證書驗）、`Wechatpay-Timestamp/Nonce-Serial`；resource 係 **AEAD AES-256-GCM** 加密要解密；再用 `out_trade_no` 查單核額。需要：mchid、APIv3 key、商戶私鑰+證書序列號、微信平台證書。 | 若經第三方 aggregator：用 aggregator 嘅 webhook 簽名 + 查單；若人仔/個人收款：唔好開自動端點。 |

> 即：**修 B2 之前一定要 Felix 答「實際用緊邊個支付商帳戶」**。喺未確認前，正確嘅臨時姿態係：三個 webhook endpoint 喺 prod **直接回 503/停用**（或保留但 fail-closed 403），店面落單後行「人手確認收款」流程——都安全過而家任何人可標 paid。

**順帶要修嘅合約缺口**：webhook 靠 `orders.order_number` 搵單，但 `POST /api/orders` 從來唔生成 order_number（見 Phase C3）。落單必須生成唯一單號（例如 `OHY` + yyMMdd + 序列/隨機 base30，DB 唯一約束已有），俾支付商做 out_trade_no。

**風險**：高。簽名/解密實作錯會令真回調被拒（賣咗貨冇入賬或成單卡住）——必須用支付商 sandbox 做「成功/失敗/重放/改金額」四個案例；上線初期 webhook 一邊嚴格驗證、一邊把「驗證失敗」全部 alert（唔好靜默），方便發現配置錯。

**本地驗證**
- 用 node 寫簽名 fixture（每個閘道合法/非法簽名/改過金額/重放四隻 case），對本地 app 打模擬回調：
  1. 無簽名 → 403；2. 正簽名但金額唔啱 → 拒絕 + 訂單維持 pending；3. 正簽名金額啱 → paid 一次；4. 同一 txn id 再打 → 200 ACK 但狀態/paid_at/歷史唔變；5. 他人 order_number → 搵唔到/拒絕。
- `npm test` 加行為級 webhook test（而家 `payment-webhooks-transactions.test.js` 只係字串斷言，要擴展）。

**上線後驗證**：sandbox→prod 各打一筆真細額（見 Phase G smoke）；Vercel logs 觀察 24–48h 冇異步 403 洪水；對賬表（reconciliation）金額一致。

## B3. 後台登入限流 + session fixation + 帳號鎖（S，0.5 日）

**位置**
- `app.js:152` 只對 `/api/auth/login` 掛 `loginLimiter`（20/15min，偏鬆）；`routes/adminPages.js:84 POST /admin/login`、`app.js:64 POST /admin/setup`、`routes/auth.js:4 POST /api/auth/register` 全部冇限流。
- `utils/security/rateLimiters.js:3-11`。

**修法**
1. 新增獨立 `adminLoginLimiter`：**10 次 / 15 分鐘 / IP**（serverless 用現有 memory store 唔完美——實例間唔共享，防暴力只係一半；認真做法：rate-limit 表入 Postgres 或 Vercel KV，起碼喺 DB 做「同帳號連續失敗 N 次鎖 15 分鐘」，下表 `login_logs` schema-full 已有，直接用）。
2. 掛位：`app.use('/admin/login', adminLoginLimiter)`（POST path）、`/admin/setup` 同款；`/api/auth/register` 加 registerLimiter（如 5/小時）；前台 `/api/auth/login` 收緊到 10/15min。
3. 登入成功後 `req.session.regenerate()`（adminPages.js:102、auth.js:47）防 fixation；管理員 session 獨立短壽命（建議 12h idle / 24h absolute；可喺 session middleware 按路徑唔同 cookie，或喺後台 middleware 檢查 `loginAt` timestamp）。
4. 失敗登入寫 `login_logs`（success bool、IP、username），連續失敗有告警（最簡單：console 結構化 log → Vercel log drain）。

**風險**：低–中。memory-store 限流喺 serverless 多實例下偏鬆（要講明唔好當萬靈丹）；帳號鎖要有管理員解鎖途徑，否則變 DoS 顧客。

**本地驗證**：連打 11 次錯密碼第 11 次 429；正密碼登入成功後 session cookie sid 改變；`SELECT count(*) FROM login_logs` 有記錄。

**上線後驗證**：用測試帳號驗鎖定/解鎖；觀察 rate-limit headers（`RateLimit-Remaining`）。

## B4. RBAC 收斂：marketing / shipping 寫操作改用 requirePermission（S–M，1 日）

**位置**
- `routes/marketing.js`：coupons CUD（:122/:158/:192）、flash sales（:251）、affiliates（:329）、abandoned carts admin、blog CUD（:508/:528/:553）全部用檔案內鬆版 `requireAdmin`（:10，來自 `routes/middleware/auth.js:36`，**isBackoffice 就過，唔睇 permission**）。
- `routes/shipping.js`：運費方式/提貨點 CUD（:136–461 共 11 個寫端）同款鬆版。
- 對比 products-full/refunds/reconciliation/reports 已正確用 `requirePermission('scope:act')`。
- 兩套守衞語義唔同：app.js:222 內聯版只認 `isAdmin===true`；middleware 版認 isBackoffice。

**修法**
1. marketing 寫端逐個掛正確 scope（RBAC seed `migrations/2026-05-04-rbac-seed.sql` 已定義角色；要擴展 permission key 清單，建議：`marketing:write`（coupon/flash/affiliate）、`content:write`（blog）、`shipping:write`）。
2. shipping admin 端一律 `requirePermission('shipping:write')`；公開 GET（zones/available/pickup 查詢）維持公開。
3. 順手廢除 app.js 注入式守衞（長期：統一 `routes/middleware/auth.js` 一套，route 全改 `express.Router()` mount；大搬動可開獨立 PR，唔阻上線）。
4. 擴展現有 `test/rbac-*.test.js`：marketing/shipping 每條寫路由 assert 用 `requirePermission`；加「低權帳號（例如只有 content:read）打 coupons CUD → 403」嘅行為測試。
5. `routes/admin.js:42 POST /api/admin/upload` 同 stats/CSV import 而家用 app.js 嚴格版（要真 admin）——保留最嚴（upload 另見 D2）。

**風險**：中。如果而家有後台帳號靠鬆權限做緊 daily ops，上線前要盤點每個後台帳號角色，補發權限，否則一上線有人做唔到嘢。

**本地驗證**：建 3 個帳號（super admin / catalog-only / marketing-only），用 supertest 或瀏覽器逐端點驗 200/403 matrix；`npm test`。

**上線後驗證**：用真後台同事帳號行一次日常操作；admin action log 冇 403 異常。

---

# Phase C — P1 交易主線（購物車接駁 / 防超賣落單 / 結帳 E2E）

> 呢個 Phase 係「重新營運」嘅命脈：而家真實用戶行唔成一單（localStorage 車唔入 DB、店面 POST /login 404、orders INSERT 喺新庫會壞、冇 order_number、庫存口徑錯）。

## C1. 先補店面表單登入/註冊（S，0.25 日）

**位置**：`views/login.ejs:46` form POST `/login`、`views/register.ejs:46` POST `/register` 無對應路由（只有 `POST /api/auth/*` JSON）。

**修法（二選一）**
- **方案 1（快）**：app.js 加表單路由 `POST /login`、`POST /register`，內部重用 auth 邏輯（bcrypt、session、`req.session.regenerate()`），成功 → `res.redirect('/cart')` 或 `?next=` 白名單跳轉（防 open redirect：只允許站內相對路徑），失敗 → 重 render 表單帶繁中錯誤訊息。兩個端點記得**豁免/處理 CSRF**：表單已有 `_csrf` hidden 嘅只有 admin 表單，店面 ejs 要補 `<input type="hidden" name="_csrf" value="<%= csrfToken %>">`（全域 csurf 對 form POST 生效）。
- 方案 2（靹）：店面 JS 改用 `fetch('/api/auth/login', {headers:{'x-csrf-token': csrfToken}})`，順手為 Phase C2 嘅 API 化鋪路。
- `/admin/setup` 已帶 `_csrf`（admin/setup.ejs:18），店面跟佢就啱。

**風險**：低。**本地驗證**：瀏覽器註冊→登入→購物車頁顯示已登入；登出再入。**上線驗證**：同上走一次。

## C2. localStorage cart ↔ 後端 cart API 合約（M，1–1.5 日）

**現況**：6 個店面頁嘅車全部寫 `localStorage`（`views/index.ejs:139-179`、`product.ejs:253-271`、`cart.ejs:103-178`，0 個 fetch）；後端 `/api/cart/*`（routes/cart.js，要登入、寫 `cart_items`）同店面完全冇接駁；而 cart.js 查嘅 `p.stock` 欄喺 schema-full 唔存在（:9,:89），一齊改成 SKU 口徑。

**合約（前端要遵守嘅 server contract）**

| 動作 | Method + Path | Request body | 回應 | 備註 |
|---|---|---|---|---|
| 取車 | `GET /api/cart` | — | `{items:[{id, product_id, name, slug, price, image_url, quantity, available_stock}], total, count}` | 需登入 session cookie；CSRF 只對非 GET，GET 唔使 token |
| 加碼 | `POST /api/cart/add` | `{product_id:int, sku_id?:int, quantity:int>=1}` | `{success:true, count}` | **以 SKU 可售存量做上限**（見 C3 口徑）；已有同 product（+sku）就加碼；價格/名稱全部以 DB 為準，唔信 body |
| 改量 | `PUT /api/cart/:id` | `{quantity:int}` quantity=0 視作刪除 | `{success:true}` | cart item id 必須屬於本人（而家已有 WHERE user_id） |
| 刪行 | `DELETE /api/cart/:id` | — | `{success:true}` | |
| 清車 | `DELETE /api/cart` | — | `{success:true}` | |

- 所有非 GET 請求要帶 CSRF：fetch header `'x-csrf-token': <csrfToken>`；server 端喺每個店面頁 inject `<meta name="csrf-token" content="<%= csrfToken %>">`（admin layout 已有範例 `views/admin/layout.ejs:7`），storefront JS 統一由 meta 讀。
- **匿名車策略（短期最簡）**：未登入時維持 localStorage 暫存；按結帳/登入成功後，將 localStorage 內容**逐項 POST /api/cart/add 做 server-side merge**（server 逐項驗存在、價格、庫存，壞行跳過並喺回應講明），merge 完先清 localStorage。唔好整支「batch replace cart」端點（會變成可信任 client 車內容）。
- cart.js 嘅 stock 查詢改做：
  `COALESCE(SUM(ps.stock) FILTER (WHERE ps.is_active),0)`（或要諗 warehouse 口徑——見 C3 決策），加貨時唔做硬性阻截都得，但要喺車 UI 標示「庫存不足」；**硬性防超賣喺落單事務做先係終極把關**。
- 店面三個 cart 實作收斂做一支 `public/js/storefront/cart.js`（而家 index/product/cart 三份複製品），每頁 EJS 只保留 data island；cart.ejs `checkout()`（:173-184）而家只係 alert 假成功，改成：merge 匿名車 → 跳 `/checkout`（見 C4）。

**風險**：中。匿名車 merge 嘅重複商品/下架商品/價格變動要逐項處理；session 過期時 POST 會 401，前端要導登入。

**本地驗證**：瀏覽器無登入加車（localStorage 有）→ 登入 → 車出現喺 DB（`SELECT * FROM cart_items`）→ 改量/刪行 → 另一瀏覽器登入同一帳號車一致。

**上線後驗證**：真實手機行一次加車→登入流程。

## C3. 落單事務重寫：鎖 SKU 行 → 校存量 → 扣 SKU → 建單（M，1.5–2 日，最重要一項）

**位置**：`routes/orders.js:83-145 POST /api/orders`。問題：① 交易外逐項 if 檢查 stock（TOCTOU）；② `UPDATE products SET stock=...`（:131）用錯誤口徑欄（schema-full 冇呢欄，且展示用 SKU SUM）；③ 冇行鎖、冇條件更新，serverless 多實例並發必超賣；④ INSERT 唔齊 NOT NULL 欄（subtotal/shipping/payment_method_code）、唔生成 `order_number`；⑤ cancel（:155）同款無條件補貨。

**先做業務決策（要 Felix/營運確認一項）**：可售存量口徑用邊個？
- 選項 A（簡單，推薦先上）：`SUM(product_skus.stock) WHERE product_id=? AND is_active`，唔分倉；
- 選項 B（完整）：`SUM(inventory_levels.stock)`（要指定可售倉/預設倉，schema 有 `inventory_warehouses.is_default`）。
後台調庫（products-full.js:1097）而家係改 levels，**若選 A 要同時確認 SKU stock 點同步**（而家似乎雙軌）。為一致性，建議：**可售 = product_skus.stock（簡單模型）**，inventory_levels 只做倉儲內部視角，並由後台調庫時同步 SKU stock；或反過來。呢個要喺修復前寫低決定，全 repo 統一。

**修法（事務順序，全部喺同一個 client、SERIALIZABLE 或 RC + 行鎖）**
```sql
-- 1) 冪等：client 要帶 Idempotency-Key（見 C4），server 用訂單級去重表
-- 2) BEGIN;
-- 3) 鎖住該用戶購物車對應嘅 SKU 行（定序避免 deadlock）
SELECT ci.product_id, ci.quantity,
       ps.id AS sku_id, ps.stock AS sku_stock, ps.price AS sku_price,
       p.price, p.status, p.name_zh_hk, p.slug
FROM cart_items ci
JOIN products p ON p.id = ci.product_id
JOIN product_skus ps ON ps.product_id = p.id AND ps.is_active = true   -- 單 SKU 商品；多 SKU 要 cart 帶 sku_id
WHERE ci.user_id = $1
ORDER BY ps.id
FOR UPDATE OF ps;
-- 4) 應用層校驗：車非空、status='active'、每項 quantity>=1 且 <= 可售（若多 SKU：GROUP BY sku_id 合併）
-- 5) 條件式扣減，affected rows 必須每項 = 1，否則 ROLLBACK → 409「庫存不足：<商品名>」
UPDATE product_skus
SET stock = stock - $qty, updated_at = NOW()
WHERE id = $sku_id AND stock >= $qty;
-- 6) 後端重算金額（價格以 DB 為準，唔信 client；coupon/運費喺之後 Phase 另接，呢階段 subtotal=total, shipping_fee=0, payment_method_code 先存用戶選擇嘅 method，要驗證存在及 is_active）
-- 7) 建 order（齊 NOT NULL 欄）+ order_items（寫 product_name、sku_id、unit_price、subtotal，snaphot）
-- 8) 生成 order_number（應用層生成＋唯一重試，或 DB sequence）：
--    建 sequence：CREATE SEQUENCE IF NOT EXISTS order_number_seq;
--    order_number = 'OHY' || to_char(now(),'YYMMDD') || lpad(nextval... % 1000000, 6,'0')
-- 9) DELETE cart_items WHERE user_id=$1（成功先清）
-- 10) COMMIT；返回 {orderId, order_number}
```
- **取消/退款補貨**（orders.js:148-187）：同樣事務化，條件流轉 `UPDATE orders SET status='cancelled' WHERE id=$1 AND user_id=$2 AND status IN ('pending','paid') RETURNING id`，affected rows=0 就視作已處理（冪等，唔好重複加庫存）；補貨 `UPDATE product_skus SET stock=stock+$q WHERE id=$sku`，要 join order_items 攞 sku_id（order_items 而家有 sku_id 欄，落單時要寫）。
- 取消已 paid 嘅單唔應該自動入返貨——要視支付/退款狀態：建議 pending 先允許用戶自取銷；paid 後走退款流程。起碼加 `AND payment_status IN ('pending')` 或做成「申請取消」。

**風險**：高（錢與貨）。並發扣帳係核心；多 SKU 商品而家 cart 模型冇 sku_id（cart_items 只有 product_id）——若店有「尺寸/款式」商品，要加 `cart_items.sku_id` 欄（migration）；若全店都係單一規格，可視每 product 隱含一個 default SKU，落單時揀 active SKU。**需要 Felix 確認商品有冇多規格**。

**本地驗證（要自動化）**
- happy path：建車 → POST /api/orders（齊欄）→ 200 有 order_number；DB：order/order_items 齊、SKU stock 減、cart 清空。
- 缺貨：stock=1 開兩個並發 `curl &`（同商品 qty=1）→ 一單 200 一單 409，stock 最終 0 唔會負數。
- 負數/非整數 quantity → 400；空車 → 400；車中含下架商品 → 409 講明邊行。
- 取消冪等：同一單連打兩次 cancel → 第一次 200、第二次 409/200-noop，stock 只補一次。
- 新增 `test/checkout-flow.test.js`（supertest + 真本地 PG；用 testcontainers 或假設 docker pg 已開，喺 CI 用 postgres service）。

**上線後驗證**：真細額交易行完整流程（Phase G）；DB 即場核 stock 變動；並發用兩部手機試。

## C4. 結帳頁 + 端到端 happy path / 邊界 / 冪等（M，1–2 日）

而家唔存在 `/checkout` 頁（cart.ejs 嘅 checkout 係假 alert）。要做：

1. **GET /checkout**（登入）：render 結帳頁，server render 車內容（由 `/api/cart` 背後同一查詢）、聯絡資料預填（users/user_addresses，members.js 有地址 CRUD）、運費方式（shipping.js `/api/shipping/methods/available` 有計費 util `computeShippingFee`）、支付方式清單（payment_methods is_active）。
2. **POST /api/orders** 要擴充 body：`{contact_name, contact_phone, contact_address, payment_method_code, shipping_method_id?, pickup_point_id?, note?, coupon_code?}`（coupon 未落實就拒絕非空 coupon_code，唔好靜默吞）。server 重算運費（唔信 client）＋小計＋總額。
3. **重複提交（double submit）防禦**：
   - 結帳頁 render 一個一次性 `checkout_token`（入 session 或專表，TTL 30 分鐘），POST 要帶回；用過即失效——最簡單有效；
   - 另加 `Idempotency-Key` header（UUID，client 生成）配 DB 表 `idempotency_keys(key PRIMARY KEY, user_id, response_status, response_body jsonb, created_at)`：事務前置 `INSERT ... ON CONFLICT DO NOTHING`，衝突就回第一次嘅 response。網絡重試/用戶㩒兩下都安全。
4. **邊界**：缺貨（C3 409）、電話/地址格式（HK 電話 8 位數基本校驗）、payment_method 停用中、運費方式唔匹配地區、金額 0（如 100% 優惠——而家 coupons 未接，落單總額 0 嘅處理要諗：行「免費單直接 confirmed」定唔允許，建議首期要求 total>0）。
5. 落單成功 → 跳 `/orders/:id` 或多謝頁（展示 order_number + FPS/PayMe 收款附註碼/QR）。**訂單詳情頁（店面）而家似乎都未有 EJS**，要加最簡版本（用 `GET /api/orders/:id` 數據）或先做 JSON 多謝頁。

**風險**：中。主要工作量喺 EJS/前端膠合；支付選擇咗但未完成 B2 支付商確認前，訂單停留 pending + 顯示收款資訊，靠後台/對賬確認。

**本地驗證**：完整瀏覽器腳本（年齡閘→加車→登入→checkout→確認→多謝頁→order_number 出現）；F5 重複 POST、back button 重複提交各一次。

**上線後驗證**：Phase G 真細額單。

---

# Phase D — P1 其他（退款完整性 / 上傳安全）

## D1. 退款金額、狀態機、重複校驗（S–M，1 日）

**位置**：`routes/refunds.js`
- 建立 `POST /api/admin/refunds`（:34-58）：`amount` 直入庫，冇校 `>0`、冇校可退餘額、冇檔重複。
- approve（:61）：冇檢查現 status；reject 要 note（:76 做得好）但都冇檢查 status；
- complete（:104-151）：只 SELECT 唔檢查 status → 同一單可重複 complete，每次重寫 orders.payment_status + 加 history；`refund_transaction_id` 由客戶端字串傳入，唔同支付閘道核對。
- `utils/refundsLogic.js:5`：負數退款可搞亂狀態。

**修法**
1. 建立時（一個事務 + `SELECT ... FOR UPDATE` 鎖 orders 列）：
   - `const amount = Number(body.amount)`；必須有限數字、`>0`、最多兩位小數、`type ∈ {full, partial}`（partial 時 amount < total，full 時金額要等於可退額）；
   - 可退額 = `orders.total_amount − SUM(已完成/已批退款)`（視乎是否計 approved，保守啲：計埋 pending+approved 凍結額）；超額 → 400；
   - 同一 order 已有 pending/approved 退款 → 409（要佢先處理）；
   - 訂單必須 `payment_status='paid'` 先可以開退款單。
2. 狀態機（全部用條件 UPDATE + affected rows）：
   - `pending→approved`：`WHERE id=$1 AND status='pending'`；
   - `pending/approved→rejected`：`WHERE id=$1 AND status IN ('pending','approved')`；
   - `approved→completed`：`WHERE id=$1 AND status='approved'`；重複 complete → 409；
   - 加 DB constraint 保險：`ALTER TABLE refunds ADD CONSTRAINT refunds_amount_positive CHECK (amount > 0)`（migration，注意舊數據要先清洗）。
3. **真退款由 server 對閘道發起**（AlipayHK `alipay.trade.refund` / WeChat v3 退款 API），用閘道返回嘅 refund id 寫入；唔接受 client 傳 transaction id。若支付商未確認（見 B2 unknowns），complete 只可記「已人手退款憑證」＋ 上傳憑據，並要求第二個角色覆核（segregation of duties：建議 `refunds:approve` 同 `refunds:write` 分開，最小都要 approve 嘅人唔可以係 create 同一單嘅人）。
4. 每次流轉寫 `order_status_histories`（from/to status，而家得 notes 字串）。

**風險**：中。改 status 流轉可能撞到現有後台 UI 假設，要睇 admin refunds 頁 JS；CHECK constraint 上生產前先 `SELECT` 搵異常數據。

**本地驗證**：建單→重複建 409；負數/0/超大 400；pending 直接 complete 409；complete 兩次第二次 409；退款總和 > total 400；狀態/history 正確。

**上線後驗證**：用一筆真細額交易走完整退款（sandbox 或真細額），對 orders.payment_status（partial_refunded/refunded）同 payment_transactions。

## D2. 圖片上傳：白名單 + magic bytes + 安全檔名（S，0.5–1 日）

**位置**：`routes/admin.js:42-62`：`multer({storage:memory, limits:{fileSize:10MB}})` 冇 fileFilter、冇 MIME/副檔名校驗；檔名用 `req.file.originalname`（可含 `../`，:50），寫入 `public/images`（Vercel serverless 檔案系統係只讀/臨時，**即上傳喺 Vercel 根本持久唔到**——而家功能上都係壞嘅）。

**修法**
1. multer 加：
   ```js
   const ALLOWED = new Set(['image/jpeg','image/png','image/webp']);
   fileFilter: (req, file, cb) => cb(null, ALLOWED.has(file.mimetype)),
   limits: { fileSize: 5*1024*1024, files: 1 }
   ```
2. 收檔後用 magic bytes 再驗（唔信 mimetype）：用 `file-type`（`await fileTypeFromBuffer(req.file.buffer)`），類型必須喺白名單；順手用 sharp 重新編碼一次（剝潛在 metadata payload）。
3. 檔名只用 server 隨機值 + 強制副檔：`${crypto.randomUUID()}.${ext}`，完全棄用 originalname。
4. **存儲位置**：Vercel 冇持久磁碟——正路係上傳去 Vercel Blob / Cloudflare R2 / S3（由 server 用 token 直傳或經 function 中轉），DB 只存 URL；過渡期本地 dev 先寫 `public/images/`（gitignore）。
5. `/images/` 靜態目錄要設 `Content-Disposition`/唔執行、`X-Content-Type-Options: nosniff`（helmet 默認有 nosniff）；上傳頻率受 adminWriteLimiter 包住即可。
6. multer 升 2.x（npm audit 建議；配合 `npm audit fix` 一併回歸）。

**風險**：中（要接 Blob/R2，涉及帳號開通，見 unknowns）；未接 object storage 前可先落地白名單+隨機名（本地/自託管有效），Vercel 環境暫時 disable 上傳端點並回 501 提示。

**本地驗證**：傳 .txt 偽裝 jpg → 400；傳 SVG（含 script）→ 400；`../../x.js` 檔名 → 落盤係隨機名；真 jpg → 成功且可顯示；6MB → 413。

**上線後驗證**：後台上傳一張產品圖，公開 URL 可存取、headers 正確。

---

# Phase E — P2 效能、repo 衛生、可觀測

## E1. 主頁 6.4s 診斷步驟（S，0.5–1 日查 + 修）

**假設唔好靠估，按次序量**：
1. **區分 cold/warm**：連續 `curl -w` 打 5 次 `https://ohya2-0.vercel.app/`：
   `curl -o /dev/null -s -w 'dns=%{time_namelookup} connect=%{time_connect} ttfb=%{time_starttransfer} total=%{time_total}\n' <url>`
   - 第 1 次慢、之後快好多 → serverless cold start（Vercel Hobby 預設；應對：減 bundle/require 成本、必要時升 plan 開 fluid compute，唔好為呢樣嘢亂 ping）。
   - 每次都慢 → 睇下一步。
2. **DB 連線**：`utils/getPool.js:24 max:1`——單實例內所有 query 串行；主頁 + categories middleware（app.js:464-497）+ session load + 視圖內查詢會排隊。臨時調 `max:3`（留意 PG `max_connections`：serverless 實例數 × max）；長線用 Neon serverless driver（HTTP/WebSocket）。
3. **query 計時**：暫時喺 pool 包一層 timing log（`const t=Date.now(); pool.query(...)` → log ms + SQL 前 80 字），或 Vercel dashboard → Storage/query analytics。重點查：主頁 :523 商品 query、categories count query（:463，含 `category_id IN (SELECT...)` OR 條件，可能唔行 index）、`SUM FROM product_skus` derived table。
4. **冷 cache 爬蟲**：`maybeHydrateMzakkaDescription`（app.js:82-127）會喺用戶請求期間同步 fetch mzakka.com（10s timeout）再 UPDATE——冷 cache 商品詳情頁可以慢 10 秒。**搬走**：用戶路徑只讀 DB；描述補完行離線 `scripts/backfill-descriptions-from-web.js`（人手/cron 觸發，serverless 冇常駐 cron，用 Vercel Cron 或本地定時）。
5. `/image/:hash`（app.js:237）：sync `readFileSync` + 每張圖一次 function invocation + 1–2MB 原圖入 memory sharp。過渡先改 `fs.promises.readFile`；中期落 Phase E3 圖床遷移。
6. `vercel.json` 冇 `functions.maxDuration`/memory 配置； Hobby 預設 10s——爬蟲 timeout 正壓邊。搬走爬蟲後呢個風險消除。

**上線後驗證**：修後同樣 5 次 curl，p50 TTFB < 500ms（warm）為目標；Vercel function 時長圖確認。

## E2. Repo 498MB 瘦身（M，1–1.5 日，高風險操作要備份）

現況：`public/images` 272 張 jpg / 241MB 入 git；`data/sample-products.jsonl` 30MB 入 git（`.gitignore` 規則 `data/*sample*.json` 漏咗 `.jsonl`）；`.git` 224MB。

**步驟（嚴格按次序）**
1. **備份先（唔可以跳）**：
   ```bash
   cp -a Ohya2.0 Ohya2.0.bak-$(date +%Y%m%d)          # 連 .git 全量
   cd Ohya2.0 && git bundle create ../ohya-full-$(date +%Y%m%d).bundle --all
   ```
   bundle 放異地（外置盤/雲盤）。
2. **圖片遷移先行、驗證視圖唔壞**（見 E3；起碼做到「public/images 移出 repo 後圖片仍顯示」）先好做歷史清理。
3. 工作目錄移除追蹤（呢步 commit 後 working tree 乾淨，但歷史仲大）：
   ```bash
   git rm -r --cached public/images
   git rm --cached data/sample-products.jsonl
   echo -e "public/images/\ndata/*sample*\n.vercel/\ncoverage/\n*.dump\n*.bak" >> .gitignore
   # 保留 public/images/.gitkeep
   ```
   `data/` 目錄嘅舊 import 營地（import.py/import.js/db.js 自帶 package）確認被 `scripts/` 取代後一併歸檔刪除。
4. **清歷史**（另開時間做，協調所有 clone）：
   ```bash
   brew install git-filter-repo
   git filter-repo --invert-paths --path public/images --path data/sample-products.jsonl
   git filter-repo --strip-blobs-bigger-than 5M
   git remote add origin <url>     # filter-repo 會刪 origin
   git push --force-with-lease --all && git push --force-with-lease --tags
   ```
   其他人必須 fresh clone（pull 會 merge 返舊歷史）；GitHub fork/cache/PR 可能留底，必要時聯絡 GitHub support。
5. 驗證：repo size < 20MB；Vercel deploy 時間明顯縮短；站內圖片全部正常。

**風險**：高（歷史改寫）。降險：第 2 步（圖床）同第 4 步（filter-repo）可以隔幾日/幾週做；第 3 步本身已令未來 deploy 唔再包新圖（Vercel clone 仍大直到清歷史）。

## E3. 圖片策略（同 E2 綑綁，M，1–2 日）

短期（推薦先做）：統一視圖用現有 `/image/:hash` proxy（local-first→mzakka remote→sharp→placeholder 已存在），`utils/imageUtils.js:6` hardcode 路徑改 env `IMAGE_LOCAL_DIR`（Vercel 唔設就行 remote）；272 張 committed 圖移出（本地保留或上 Blob）。
中期：import script 入庫時上傳 Vercel Blob/R2，products.image_url 存絕對 URL；版權風險要留意——長期熱鏈 i.mzakka.com 非合規做法，只宜過渡（**需要 Felix 確認圖片版權/來源**）。

## E4. README 重寫（S，0.25 日）

- 刪走「Vue 3 + Vite / frontend/ directory」（README L42、L73），實際係 EJS SSR + Tailwind CDN；
- 新 Getting Started 同本 runbook Phase 0 一致：docker pg → schema-full → migrate:up → seed-data.sql + dev seed → `.env` → `npm run dev` → `npm test`；
- Vercel env checklist（SESSION_SECRET、DATABASE_URL、支付密鑰、CSP_MODE）、「push master 即部署」警告、圖片/data 唔入 git 嘅貢獻約定、migration 點加（檔名日期 + 冧行）。

## E5.（可選但建議）其餘 P2 衛生
- Tailwind CDN → 離線 build（10 個視圖機械改），CSP 先可以收緊走 `unsafe-inline`/cdn.tailwindcss.com（app.js:57-66）；JSON data island 加 escape helper（`views/product.ejs:199`、`index.ejs:116`）。
- `utils/getPool.js:26` SSL `rejectUnauthorized:false`，若 DB 商給 CA 就設 `ca`。
- logger：最細一支 `utils/logger.js`（JSON stdout）+ request id；Vercel Log Drain；Sentry 可後補。
- `npm audit fix`：qs/body-parser/multer 2.x；csurf 已封存，計劃換 `csrf-csrf`（唔好臨上線先換，獨立 PR）。
- 會員積分負數/TOCTOU（members.js:240-285）同結帳同級修（條件 UPDATE + 整數校驗），若 relaunch 開通積分功能就要包；唔開就 hide UI。
- Pool max 1→3 同 E1 一齊。

---

# Phase G — 上線計劃

## G1. Vercel / 第三方環境變數 checklist（Production scope）

| 變數 | 必要性 | 點搞 | 備註 |
|---|---|---|---|
| `NODE_ENV=production` | 必須 | Vercel 預設已設 | 確認存在（fail-closed 邏輯依賴） |
| `DATABASE_URL`（或 `POSTGRES_URL`） | 必須 | Felix 提供；**先確認邊個 DB 係生產**（見 unknowns #1） | 建議應用帳號非 superuser；SSL |
| `SESSION_SECRET` | 必須（B1 後缺佢即 boot fail） | `openssl rand -hex 32` 本地生成，dashboard 貼入 | 固定值，唔好喺代碼/對話流傳；日後輪換用 `SESSION_SECRET_OLD` |
| `CORS_ALLOWED_ORIGINS` | 必須 | 真實域名（自訂域 + `https://ohya2-0.vercel.app`） | |
| `CSP_MODE` | 建議 | 維持 `report` 直到 Tailwind 離線化（E5），先轉 `enforce` | |
| `CSP_REPORT_PATH` | 可選 | 預設 `/csp-report` | |
| `FPS_PAYME_WEBHOOK_SECRET` / 查單憑據 | B2 確認支付商後必須 | 支付商 dashboard 取 | sandbox 先試 |
| `ALIPAYHK_WEBHOOK_SECRET`（RSA 密鑰對：APP ID、商戶私鑰、平台公鑰） | 同上 | | |
| `WECHATPAY_WEBHOOK_SECRET`（mchid、APIv3 key、商戶私鑰、證書序列號、平台證書） | 同上 | | |
| `SHIPANY_API_KEY` / `SHIPANY_WEBHOOK_SECRET` / `SHIPANY_WEBHOOK_ALLOWED_IPS` / `SHIPANY_API_URL` / sender 資料 | 若用 ShipAny | 現有 .env.example 已有位 | webhook 改強制驗簽後 secret 不能留空 |
| `IMAGE_LOCAL_DIR` | 唔好設（Vercel） | E3 改動後用 env 取代 hardcode 路徑 | |
| Object storage 憑據（BLOB_READ_WRITE_TOKEN / R2 keys） | D2 上傳修復後 | | 首期可暫停後台上傳 |

設定方法：Vercel dashboard → Project → Settings → Environment Variables（Production）；**唔好感謝對話/文檔貼真值**。設完先用最近一次 deploy 嘅 Functions 環境確認（或部署一個輸出「env present = boolean」嘅內部檢查，唔好輸出值）。

## G2. 發佈次序（由低風險到需維護）

**Wave 1 — 可隨時上（唔改交易行為、向後相容），各自獨立 PR、可食 Vercel preview：**
1. A3 統一錯誤處理（wrapAsync/404/error handler）
2. A2 shadow route 清理（featured 500 修復）—— API 形狀改動要 grep 埋 admin JS
3. E4 README、E1 診斷性 log、pool max 微調
4. B1 SESSION_SECRET fail-closed —— **但 deploy 前必須先完成 G1 設 env**（其實零停機，設好 env 先合 code）
5. B3 登入限流、B4 RBAC 收緊（先確認後台帳號權限矩陣）

**Wave 2 — 地基（建議短維護窗口或確認低流量時段；香港店可選凌晨 2–5 點）：**
6. A1 schema 收斂工具（只加 runner/文件，唔即跑 DDL）→ 備份生產 DB → 對生產 DB 跑 align migration（A1 第 4 步）。DDL 大多 `IF NOT EXISTS`/ADD COLUMN，風險低但要備份。
7. C1 店面表單登入/註冊
8. D1 退款校驗、D2 上傳白名單（未接 Blob 前 Vercel 環境 501）

**Wave 3 — 交易主線（一次過上，需要 maintenance page 或最低限度「暫停落單」橫額 30–60 分鐘）：**
9. C2 cart 接駁 + C3 落單事務重寫 + C4 checkout（一組 PR 分 commit，一次 deploy；因為合約互相依賴，分開上會出半新半舊狀態）
10. B2 webhook 驗簽/核額/冪等 —— **前提：Felix 已確認支付商並提供 sandbox**。若支付商未確認：webhook 三端先改為 prod 503/403，訂單行「後台人手確認收款」運營流程（見 B2 表格），唔好帶住公開可偽造嘅端點開業。

**Wave 4 — 上線穩定後：** E2/E3 repo 瘦身與圖床、E5 Tailwind/CSP/logger/csurf 替換、積分修復、coupon 真正接軌結帳（而家落單完全冇套用 coupon，若首波賣優惠要額外開工，見 unknowns #6）。

每個 Wave：branch → 本地 169+ 新測試全綠 → `vercel` preview deploy 跑 smoke checklist → merge → 生產 smoke。

## G3. 回滾方法

- **代碼回滾（首選，秒級）**：Vercel Dashboard → Deployments → 揀上一個 stable deployment → **Promote to Production**（即時切回，唔使 redeploy）。所以每個 Wave deploy 後唔好即刻刪舊 deployment。
- Git 層面：`git revert <merge commit>` → push（會觸發新 deploy，內容等於舊版）；**唔好**喺 master 直接 reset --force push。
- **DB 回滾**：migration 一律向後相容（只加欄/加表/加 IF NOT EXISTS 索引）→ 舊代碼遇到新欄唔會壞，所以多數情況只需回滾代碼。若真係要退欄：先備份、另寫 down migration、停維護先跑。**千祈唔好**喺仍有流量時 DROP 欄。
- SESSION_SECRET：若誤設壞值導致全部登出，仲用緊舊 secret 嘅話設 `SESSION_SECRET_OLD=<bad>` + `SESSION_SECRET=<new>` 做雙 secret 平滑過渡。
- 支付 webhook 出問題：支付商 dashboard 暫停回調 URL（或我端返 503 會令支付商重試；Alipay/WeChat 有重試機制，修好後會補推）。
- 觸發回滾嘅條件（事先講明）：任何 smoke 失敗、落單/付款異常、5xx 率 >1%、後台登入唔到。

## G4. 上線後 smoke test 清單（每次 deploy 後照行，約 15 分鐘）

**唯讀/公開**
- [ ] `GET /` 200，warm TTFB 記低（對比 E1 baseline）
- [ ] `/products`、`/product/<slug>`、`/cart`、`/login`、`/admin/login` 全部 200
- [ ] `GET /api/health` `{status:ok}`；`GET /api/products?page=1` 200 且分頁欄位正確
- [ ] `/api/products/featured` **200（唔再 500）**；`/api/products/abc` 404；`/api/nope` 404 JSON
- [ ] 圖片：一張 `/image/<hash>` 200 並有 immutable cache header

**安全**
- [ ] `curl -X POST https://<域>/webhooks/fps-payme -d '{...}'`（無簽名）→ 403/503，訂單**冇**被標 paid
- [ ] 連續錯密碼打 `/admin/login` 11 次 → 429
- [ ] 低權後台帳號 POST `/api/admin/coupons` → 403
- [ ] 壞 CSRF token POST `/api/cart/add` → 403

**交易（用測試帳號 testuser）**
- [ ] 匿名加車 → 登入 → 車 merge 入帳號
- [ ] 改量/刪行/重新登入車仍在
- [ ] checkout happy path：落單成功、有 `order_number`、總額同車一致、SKU stock 減、cart 清空
- [ ] **真實細額交易（≥1 筆，金額最小，例如最平配件/或支付商 sandbox 優先；若 sandbox 唔涵蓋就用 HK$1 產品自製測試 SKU）**：選 FPS/AlipayHK/WeChat 其中一條 → 真付款 → webhook 到賬 → 訂單自動/正確變 paid（或人手確認流程如 B2 後備方案）→ 後台見單 → 退款流程行一次（若金額許可）
- [ ] 缺貨競態：stock=1 商品兩個 session 同時落單 → 一單 409，stock 唔會負
- [ ] 雙重提交結帳（refresh/㩒兩下）→ 只生成一張單
- [ ] 取消 pending 單 → stock 補返；再取消 → 冇雙重補貨

**後台**
- [ ] 各角色帳號登入，見到嘅 menu/可做操作同權限矩陣一致
- [ ] 上傳 jpg 成功（若 Blob 已接）；txt/svg 偽裝被拒
- [ ] Vercel function logs：15 分鐘內無未處理 error、無 EBADCSRFTOKEN 洪水

---

# 工作量估算（工程師人天，一個熟 Express/PG 嘅人做；不含營運/設計等待）

| 階段 | 內容 | 人天 |
|---|---|---:|
| Phase 0 | 本地環境/seed/smoke baseline | 0.5 |
| A1 | schema 收斂 + migrate runner + bootstrap smoke | 1.5–2 |
| A2 | shadow route 清理 + 唯一性 test | 0.5–1 |
| A3 | 統一錯誤處理 | 0.5–1 |
| B1 | SESSION_SECRET fail-closed | 0.25 |
| B2 | 支付 webhook（三閘道，含 sandbox 對接；**若供應商未明要加 1–2 日聯絡/等待**） | 2–3（+buffer 1–2） |
| B3 | 登入限流/鎖帳/session regenerate | 0.5 |
| B4 | marketing/shipping RBAC + matrix 測試 | 1 |
| C1 | 店面表單登入/註冊 | 0.25 |
| C2 | cart 前後端接駁（含 storefront JS 收斂） | 1–1.5 |
| C3 | 落單事務/防超賣/order_number | 1.5–2 |
| C4 | checkout 頁 + E2E + 冪等 | 1–2 |
| D1 | 退款完整性 | 1 |
| D2 | 上傳白名單/magic bytes（Blob 接入另計 0.5–1） | 0.5–1.5 |
| E1 | 6.4s 診斷與修復 | 0.5–1 |
| E2+E3 | repo 瘦身 + 圖片遷移（含備份/協調） | 1.5–2.5 |
| E4 | README | 0.25 |
| E5 | Tailwind build/CSP/logger/audit fix/csurf | 2–3 |
| G | 上線編排、preview、smoke、真交易、buffer | 1.5–2 |
| **合計** | **最小可安全重開（Phase 0–D + G，不含 E5 大 frontend 工程）** | **約 14–19 人天（3–4 週，一個人；2 人並行約 2 週，但 B2/C3 要同一人把關）** |
| | 連 E2/E3/E5 全部 P2 完成 | **約 18–25 人天** |

> 關鍵路徑：**支付商確認（B2 外部依賴）** 同 **schema 口徑決策（C3）**。呢兩件事 Felix 一日內答到，成個計劃就可以壓到 3 週。

---

# ⚠️ 我唔肯定、要 Felix 提供/決策嘅嘢（blockers）

1. **邊個 Postgres 係生產庫？** 連線資料（邊間 host：Vercel Postgres / Supabase / Neon / 自有？）、規格、現有 row 量、最近備份。migration 同所有修復都要喺生產庫嘅副本先演練。**未有答案前唔好對任何遠端 DB 跑 DDL。**
2. **而家係咪真係有做生意、有真客戶/真訂單/真付款數據？** 決定：(a) 可唔可以推倒 schema 重建 vs 必須保留數據演進；(b) 維護窗口安排；(c) 仲使唔使歷史訂單遷移。
3. **支付商到底用邊間？** FPS/PayMe 係個人收款定商戶帳戶？AlipayHK / WeChat Pay HK 嘅 merchant 憑據（sandbox + prod）？定係經 aggregator（Stripe/PayDollar/TapPay 等）？——冇呢個答案，B2 只能做「停用自動 webhook + 人手確認收款」後備方案。
4. **域名**：用緊自訂域名未？DNS/SSL 喺邊管理？CORS/CSP/支付商回調 URL 全部要填。
5. **商品有冇多規格（SKU）？**（尺寸/款式/颜色）——決定 cart_items 使唔使加 sku_id、checkout 使唔使規格選擇 UI。
6. **重新營運首波使唔使優惠券/閃購/積分？** 而家落單完全冇套用 coupon（`routes/orders.js` 冇 discount 邏輯），積分 redeem 有負數 bug。若要賣優惠，C3–C4 要加 1–1.5 日做後端原子核銷。
7. **圖片版權/來源**：272 張 committed 圖 + `/image/:hash` 熱鏈 i.mzakka.com 係咪有權用？定要全部換圖？影響 E3 方案同開業合規風險（成人用品題材更要小心支付商/平台條款）。
8. **ShipAny 係咪真係用緊？** 憑據/IP allowlist 要有；唔用就將成個整合收埋，減攻擊面。
9. **後台帳號清單 + 權限矩陣**：而家有幾多個後台帳號、各自應該有咩 role（B4 收權前必須知，否則會鎖死自己人）。
10. **Vercel plan**：Hobby 定 Pro？（10s function 上限、cold start、fluid compute、Blob 可用性都取決於此）。另：成人用品賣 Vercel/支付商/銀行嘅條款要 Felix 自行確認合規。
