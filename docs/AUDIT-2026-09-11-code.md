# Ohya2.0（mzakka-ecommerce）代碼質素＋架構審計

- 日期：2026-09-11
- 審計員：代碼審查員（工程）｜只讀審計，冇改任何業務代碼
- 範圍：Node.js Express 4 + EJS + Postgres，Vercel 部署（`api/index.js` → `app.js`）
- 方法：實證為主，每項標檔案:行號／數字；影響分 高／中／低；附工作量估算（S ≤ 0.5 日｜M 1–3 日｜L > 3 日）

---

## 1. Repo 衛生（最優先）

### 1.1 272 張產品相（242MB）直接 commit 入 git — 影響：高

**證據：**
- `du -sh public` = **242M**，當中 `public/images` = **241M / 272 個 jpg**，全部被 git 追蹤（`git ls-files public/images` = 272）。
- 單檔普遍 1.1–2.25MB（例：`105de4b0….jpg` 2,254,550 bytes），似係**原圖未壓縮**，未做 webp/縮圖。
- `.git` = **224MB**（`count-objects`：pack 212.66 MiB；1036 個 object），clone／CI／Vercel build 全部要食。
- 圖片名係 32 位 hex hash（mzakka 來源 md5），同 `utils/imageUtils.js` 講嘅「235k+ 本地圖庫」係同一來源體系。

**點解有問題：**
1. Vercel 每次部署都上傳整包 source（含 242MB 圖）→ 部署慢、function/static 上傳有 size 風險；Git host（GitHub push 500MB 前會愈來愈痛）。
2. 圖片二進制唔適合 git diff/branch，改一張相就永久漲歷史，`git gc` 都收唔返。
3. 同一批相喺外部其實已有「真身」：上遊 `i.mzakka.com`，而 code 本身已有 `/image/:hash` proxy 架構。

**現有架構嘅矛盾位（順手肯定＋指出問題）：**
- 已有完整圖片代理設計：`app.js:252` `GET /image/:hash`（local-first → remote proxy → sharp resize → SVG placeholder），`utils/imageUtils.js` 有 `toProxyUrl / findLocalImage`。
- 但 local-first 指向嘅目錄係 **hardcode 絕對路徑**：`utils/imageUtils.js:6`
  `LOCAL_IMAGE_DIR = '/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-clone/images'`
  → Vercel 上**一定不存在**，即 serverless 永遠行 remote proxy 分支；亦代表呢部機／呢個 user 以外全部壞。可移植性 高 影響。
- `public/images/` 嗰 272 張似乎係另一套「直接 static serve」做法，同 proxy 雙軌並行，要確認視圖實際用邊套（見 §4）。

**建議（三選一，按 CP 值排）：**

| 方案 | 做法 | 優點 | 成本 |
|---|---|---|---|
| **A. 沿用 mzakka proxy（推薦短期）** | 視圖統一行 `/image/:hash`（已有 resize/cache/placeholder）；`LOCAL_IMAGE_DIR` 改 env（`IMAGE_LOCAL_DIR`），Vercel 上唔設即行 remote；`public/images` 272 張移出 git | 0 新基建、1 年 immutable cache header 已有（app.js:309 一帶） | S–M |
| **B. Vercel Blob / Cloudflare R2（推薦中期）** | import script 入庫時上傳 Blob，DB 存 URL；CDN 原生、resize 可配 | 長線最乾淨、235k 圖都 scale 到 | M–L |
| C. 外部 CDN backfill | 把 mzakka 熱門圖 mirror 上 R2/Imagekit | 同上但要同步作業 | M |

注意方案 A 嘅版權／熱鏈風險：正式營運長期依賴 `i.mzakka.com` 做圖源唔係穩定合規做法，適合過渡。

### 1.2 `data/` 30MB：一個 31MB JSONL ＋ 一次性 import 腳本入咗庫 — 影響：中

**證據：**
- `data/sample-products.jsonl` = **31,493,195 bytes（30MB）**，被 git 追蹤（`git ls-files` 確認），亦係成個 git 歷史**最大單一 object**。
- `.gitignore` 有 `data/*sample*.json`（只 ignore `.json`，**漏咗 `.jsonl`**，所以佢入到庫）。
- 同目錄另有 `import.py / import.js / import-simple.py / db.js / test-db.js / package.json / package-lock.json`（data 目錄自帶一套獨立 package！12 個 tracked 檔）——似早期一次性 import 工具營地。
- 正式 import 已喺 `scripts/`（`import-mzakka-to-postgres.js`、`rebuild-categories-*.js`）＋ `utils/mzakkaImport.js`，`data/` 呢套好可能已過時。

**建議：**
1. 確認 `data/` 腳本係咪已被 `scripts/` 取代；係就整目錄歸檔（移去獨立 archive repo 或刪除）。
2. `sample-products.jsonl` 一類大 fixture：要保留就放 artifact storage／Release attachment／git-lfs，**唔好放一般 git**。
3. 修 `.gitignore`：`data/*sample*`（覆蓋 jsonl）或明確 `!data/README.md` 白名单。
- 工作量：S（半日内）。

### 1.3 `.gitignore` 漏洞清單 — 影響：中

現有（`.gitignore` 全文得 391 bytes）缺少／出錯：

| 項目 | 狀態 | 建議 |
|---|---|---|
| `data/*sample*.json` | 防唔到 `.jsonl` | 改 `data/*sample*` |
| `public/images/`（產品圖資產） | 完全冇規則 | 遷出後加 `public/images/`（保留 `.gitkeep`） |
| `.env*` 全覆蓋 | 只 ignore `.env/.env.local/.env.*.local` | 補 `.env.*`（小心唔好 ignore `.env.example`） |
| `.vercel/` | 冇 | 加（Vercel CLI project link 檔） |
| `coverage/`、`.nyc_output/` | 冇 | 加 |
| `*.tsbuildinfo`、`.eslintcache` | 冇 | 將來加 |
| 備份／臨時 dump：`*.dump`、`*.bak`、`*.sql.gz`、`/tmp` | 冇 | 加 |
| sharp 原生二進制 | `.vercelignore` 有忽略 `node_modules/@img`、`sharp/vendor`，但 `.gitignore` 冇禁 vendor commit | 一併檢查 |

補充：`.vercelignore` 已幾進取（ignore 咗 `test docs migrations scripts *.md *.sql data`，但用 `!scripts/fetch-mzakka-description.js` 開洞）——要核對 runtime 係咪真係冇 require 其他 scripts（否則 serverless 冷啟動先爆 MODULE_NOT_FOUND），見 §5。

### 1.4 清 git 歷史嘅安全步驟（⚠️ 高風險操作，必須先備份）

224MB 入面絕大部分係 public/images ＋ 30MB jsonl，**淨係 `git rm` 唔會縮歷史**，要 rewrite history。建議步驟：

1. **全量備份先**：`cp -a Ohya2.0 Ohya2.0.bak-20260911`（連 `.git`），另外 `git bundle create ../ohya-full.bundle --all` 異地備份。
2. 確認 remote、通知所有協作者（歷史會被改寫，要重新 clone）。
3. 用 `git filter-repo`（優先；filter-branch 已 deprecated）：
   ```
   brew install git-filter-repo
   git filter-repo --invert-paths \
     --path public/images \
     --path data/sample-products.jsonl
   git filter-repo --strip-blobs-bigger-than 5M   # 掃殘
   ```
4. 圖片遷移方案（§1.1 A/B）**先做好並驗證視圖唔壞**，先好做歷史清理；兩件事拆 PR/拆時間做。
5. 重新設 remote（filter-repo 會移除 origin）：`git remote add origin <url>` → `git push --force-with-lease --all` + `--tags`。
6. GitHub 側：舊 commit 可能仲喺 fork／PR／cached，必要時聯絡 support 清 cache；本地所有人要 fresh clone（唔好 pull，會 merge 返舊歷史）。
7. 預期效果：repo 由 ~498MB（含 .git 224MB）→ 預計 **< 10–20MB**。
- 工作量：M（含遷移＋驗證約 1–2 日；如果行 Blob 方案另計）。

> ✅ 值得肯定：git log 可見近期有意識做安全加固（helmet、rate-limit、csrf、CSP report-only、prod SESSION_SECRET），commit message 有 conventional commits 紀律，呢點做得好。

---

## 2. Express 架構

### 2.1 `app.js` 876 行做太多嘢 — 影響：中
**證據：** `app.js` 876 行，塞咗：安全中介層設定（helmet/CSP/csrf/limiter，L52–150）、session、圖片 proxy＋`https` 抓取實作（L252–360）、**業務頁面路由＋大量內聯 SQL**（`/`、`/products`、`/product/:id`，L475–820）、8 個 hardcode sample products（L407–415）、19 個 sample categories（L419–440）、mzakka 描述爬蟲 hydrate + 寫庫（`maybeHydrateMzakkaDescription` L82–127）。
**點解：** 頁面路由同 API 路由雙軌（頁面喺 app.js，API 喺 routes/），新手好難估邊度改嘢；sample fallback 數據同真業務邏輯撈埋。
**建議：** 拆 `routes/storefrontPages.js`（頁面三條）、`routes/imageProxy.js`、`lib/sampleData.js`、`services/mzakkaDescription.js`；app.js 淨做 bootstrap（中介層順序、route mount、error handler）。工作量：S–M（1–2 日，風險低，純搬嘢＋test 行一次）。

### 2.2 路由註冊模式古怪：函式注入 + 兩套 auth middleware 並存 — 影響：中
**證據：**
- 每個 route file export `module.exports = function(app, pool, requireAdmin, ...)`（app.js L378–394 逐個 require 即註冊），唔係慣常 `express.Router()` + `app.use('/api', router)`。
- 同時存在兩套權限守衞：app.js 內定義嘅 `requireAdmin/requireAuth`（L222–243，只 check session）**和** `routes/middleware/auth.js`（有 `requirePermission` + `adminPermissions` RBAC）。11 個 route file 用 middleware/auth，5 個收 app.js 注入嘅 requireAdmin，部份（如 products-full、categories）仲兩套一齊用。
- `routes/products.js` 連 `requireAdmin` 參數收咗都冇用（public 端）。
**風險：** 兩套守衞語義唔同（middleware 版承認 `isBackoffice` 同細粒度 permission；app.js 版只認 `isAdmin`），將來加端點極易揀錯 → 權限繞過風險屬 高（實際有冇穿位要對每條 admin 路由核對，security audit 應跟進；本次架構層先標記）。
**建議：** 統一用 `express.Router()` mount、統一 `routes/middleware/auth.js` 一套守衞，刪 app.js 注入版。工作量：M（要逐路由回歸）。

### 2.3 重複註冊嘅路由 — 影響：中
**證據（註冊次序：app.js L371–386 順序 require；Express 先註冊先贏）：**
- products.js（L376）**早過** products-full.js（L377）註冊 → `GET /api/products` 實際行 products.js:17 嘅簡陋版（強制 `name_zh_hk IS NOT NULL AND description_zh_hk IS NOT NULL`、無 brand/tag/sort），products-full.js:127 嘅完整版（分頁、brand/tag、sort）反而係 dead code。
- 🔴 **實 bug**：products.js:71 註冊咗 `GET /api/products/:id`（`WHERE p.id = $1`），又早過 products-full.js:215 嘅 `/api/products/featured` → 請求 `/api/products/featured` 會被 `:id='featured'` 食咗，Postgres 報 invalid integer → 500。featured 端點等於已死。
- brands.js（L375）早過 products-full（L377）→ `/api/brands` GET/POST/PUT/DELETE 兩邊各一套（products-full 嗰套帶 requirePermission RBAC），邊套生效取決於次序；admin 端 `/api/admin/brands` 兩邊亦重複。以 **method+path** 核對真正 shadow 共 5 組。
- `:id`（數字）vs `:slug`（字串）語義唔同但位置形態相同，日後非常易撞。
- products.js（92 行）同 brands.js 好可能已被 products-full.js（1338 行）取代但未刪，成檔係孤兒／dead code。
**點解：** 靜默 shadowing，改 A 檔以為生效其實行緊 B 檔，係好難追嘅 bug 溫床。
**建議：** 起路由清單表（method+path+檔案:行），逐組確認唯一；刪 products.js / brands.js 等被覆蓋嘅實作，或合一方。工作量：S–M（0.5–1.5 日）。

### 2.4 冇全域錯誤處理器、冇 404 handler、冇 process-level safety net — 影響：中–高
**證據：**
- 全 repo grep `err, req, res, next`（4 參數 error middleware）= **0**；冇 `app.use((err,req,res,next)=>…)`。
- 冇 404 兜底（app.js 冇 final `app.use((req,res)=>…)`，未知 API path 會掉 Express 預設 HTML 404）。
- 冇 `process.on('unhandledRejection'/'uncaughtException')`。
- 每個 handler 各自 `try/catch → 500 {error:'服務器錯誤'}`（約 160 個 handler，try block 210+，明顯 copy-paste）；**但中間件唔係全部有 cover**：
  - `routes/adminPages.js` 4 個 async handler（L58/64/80/84）**0 個 try/catch**（例：`POST /admin/setup` L64 `await createFirstAdmin` 若 DB 爆 → unhandledRejection，serverless 直接 500 HTML／預設錯誤頁）。
  - app.js L468 嘅 categories 中介層有兜底（好），但 `maybeHydrateMzakkaDescription` 內部已 catch。
**建議：**
1. 加一個 `wrapAsync = fn => (req,res,next) => Promise.resolve(fn(req,res,next)).catch(next)`（或直接用 `express-async-handler`），所有 async 路由改用佢。
2. app.js 最後加統一 JSON error handler（區分 4xx/5xx、prod 唔 leak stack）+ 404 JSON。
3. 加 process-level logger（見 §5）。
工作量：S（wrap + handler 本身半日；逐檔遷移 M）。

### 2.5 sync I/O 塞入熱路由 — 影響：中
`app.js:268` `/image/:hash` 用 `fs.readFileSync`（阻塞 event loop）；Vercel 上 LOCAL_IMAGE_DIR 又唔存在（見 §1.1 hardcode 路徑），即永遠行 remote fetch ＋ 把整張 1–2MB 原圖 load 入 memory 再 sharp，無 CDN cache 層（瀏覽器 1 年 cache 有設，但 edge/serverless 冇）。每張圖佔一個 function invocation，235k 圖庫場景會貴兼慢。建議：遷出做 Blob/CDN（同 §1.1 一齊做）；過渡期可改 async fs.promises.readFile。工作量：S。

### 2.6 Session 喺 serverless 下嘅設定（正面＋隱憂）
✅ 用 `connect-pg-simple` 存 Postgres（app.js L160–177），serverless 水平擴展啱用；prod 強制 secure/sameSite、httpOnly；冇 DATABASE_URL 都可以 boot（fallback warn，L181）。
🟡 但 prod 若漏設 `SESSION_SECRET`，而家用**每次冷啟動 random secret**（app.js L161–167，commit 4748f12 刻意為之）——serverless 每個實例 secret 不同 → 用戶會隨機被登出、csrf token 亂。建議：prod 冇 secret 應該 fail-fast（或起碼部署 CI check env），而唔係靜默降級。工作量：S。

---

## 3. 數據層

### 3.1 🔴 Schema 同 code 不一致：`products.stock` 喺正式 schema 根本唔存在 — 影響：高
**證據：**
- 正式 `products` 表定義（`schema.sql:197–243`、`schema-full.sql:210–255`）**都冇 `stock` 欄**；stock  modelled 喺 `product_skus.stock`（schema.sql:256）＋ `inventory_levels`（migration `2026-05-04-inventory-levels.sql`）。
- 但前台／結帳 code 直接當 `products.stock` 存在：
  - `routes/orders.js:85` SELECT `p.stock`、`:131` `UPDATE products SET stock = stock - $1`、`:178` 取消訂單 `stock + $1`；
  - `routes/cart.js:9`、`:89` 都 SELECT `p.stock`。
- 全新 DB 跑 `schema-full.sql`（README L71 教嘅做法）後，`POST /api/orders` 一落單就會 `column p.stock does not exist` → **成個結帳流程喺新環境即死**。而線上庫應該係靠人手 ALTER 先行到，呢個正正係 drift 嘅證據。
- 更深問題：**兩套庫存模型並存**。店面展示用 `SUM(product_skus.stock)`（app.js 首頁／列表／詳情、products-full.js:194），落單卻扣 `products.stock`。兩個數唔會自動同步 → 展示有貨但結帳擋／或相反，**超賣風險**。
**建議：** 統一為 SKU/warehouse 模型：結帳在 transaction 內 `SELECT ... FROM product_skus FOR UPDATE`（logistics.js/products-full.js 已有 FOR UPDATE 模式可參考），刪 `products.stock` 依賴；若短期唔得，至少加 migration `ALTER TABLE products ADD COLUMN IF NOT EXISTS stock INTEGER NOT NULL DEFAULT 0` ＋ trigger/同步作業補數。工作量：M（1–3 日，含結帳回歸）。

### 3.2 🔴 `schema.sql:523–539` 有一段無頭屍塊（疑似 CREATE TABLE 缺頭），成個檔可能 run 唔完 — 影響：高
**證據：** `schema.sql` 約 L521 註解 `-- Orders table (already defined, extended version below)` 之後，直接係欄位定義（`id SERIAL PRIMARY KEY, name …, slug …, stock …, category_id REFERENCES …` 直到 L539 `);`），**冇 `CREATE TABLE` 開頭**。呢堆欄位（name/slug/stock/category_id/image_url/gallery_images）似係舊版 products 表殘骸。用 psql 由頭行 schema.sql 會喺呢度 syntax error 中斷。
**建議：** 即刻用空白庫行一次 `psql -f schema.sql` 同 `psql -f schema-full.sql` 驗證（CI 加一個 `postgres` service 跑 smoke），刪除屍塊；長線只保留一份 canonical schema（建議 schema-full），schema.sql 廢棄。工作量：S（驗證＋刪殘 0.5 日）。

### 3.3 SQL 完全冇 repository 抽象，258 個 query call 散落路由 — 影響：中
**證據：** `grep -rc "pool.query"` routes＋app.js＋utils = **258 處**；最多 products-full.js 80、logistics.js 54、members.js 41、marketing.js 31。冇任何 `repositories/` 或 `services/`（得 `lib/inventory.js` 12 行、`lib/productsSort.js` 22 行呢類小 helper）。
- 同一個「店面商品卡片」SELECT（products↔categories↔SUM(product_skus.stock)）喺 app.js 逐字重複 **4 次**（首頁、列表、詳情、related；`grep -c "SUM(stock)::int as total_stock" app.js` = 4）。
- 每個列表 endpoint 又各自重寫一套「count query + data query + 手動拼 `WHERE` + `$N` placeholder」（products-full:127、orders:205、members:320、marketing、logistics 共 10+ 處）。
**影響：** 改一個價格／庫存語義要改十幾個檔；schema drift（§3.1）就係呢種結構嘅直接後果。
**建議：** 逐步抽 `repositories/productRepo.js`、`orderRepo.js`（先由 4 連復 storefront SELECT 同列表分頁器開始），query 用常數集中；可順手做個輕量 `paginate({baseSql, where, params})` helper。唔使一次過重寫，跟功能搬。工作量：M–L（持續重構，先吃 2–3 日落 productRepo 已值回票價）。

### 3.4 N+1 查詢 — 影響：中
- `routes/products-full.js:193–201`：商品列表每個 product 各自再查一次 `SUM(stock) FROM product_skus`（24 項 = 25 個 query）。app.js 嘅頁面已用 derived table JOIN 一次過做（好範例），API 版卻冇跟。建議：`LEFT JOIN (SELECT product_id, SUM(stock) … GROUP BY 1) s` 或 `ANY($ids)` 批次。
- `routes/marketing.js:218` flash sales：每個 sale 再查 products（`Promise.all(map)`）；`:310` affiliates stats 同類。
- 數量細時痛感有限，但無 limit 保證（flash sale 冇 cap），流量起上嚟會放大 DB 連接壓力——而 pool `max: 1`（見 §5），序列化等待會幾明顯。
工作量：S（每處約 1–2 小時）。

### 3.5 SQL 注入面：✅ 大致安全，兩個動態位已做白名單
- 所有值全部 `$1/$2…` 參數化，動態 WHERE 都係先 push params 再拼 placeholder（products-full:144、members:325、orders:212 等），**冇發現** `${req.body/query/params}` 直接入 SQL。
- 兩個動態 ORDER BY 位：app.js 用 `lib/productsSort.js` 白名單 map（✅）；products-full.js:168–183 用 `allowedSort` map＋`order` 限 ASC/DESC（✅）。
- 🟡 小建議：products-full.js:182 嘅 `order` 可以直接用 boolean 三元而唔好留 raw string 習慣；列表 `categoryId/brandId` 未做整數校驗（當字串參數化冇注入風險，但會行無用索引比較，建議 `Number()` 校型）。

### 3.6 Migrations 有檔無軌跡、無 runner，schema 三軌並行 — 影響：中
**證據：** `migrations/` 7 個 SQL（2026-04-28～05-04），但 package.json 冇 migrate script、冇 `node-pg-migrate`/`knex` 之類工具、冇 `schema_migrations` 追蹤表；全靠人手 psql 餵。根目錄同時放 `schema.sql`（22KB）、`schema-full.sql`（28KB）、`seed-data.sql`，`docs/superpowers/specs/2026-05-03…design.md:90` 自己都承認「routes 用咗 full 欄位但 DB 未必存在」。`.vercelignore:6` 仲將 migrations 排除出部署，即部署流程完全冇自動 migrate。
**建議：**
1. 引入 `node-pg-migrate`（或最簡單：一個 `scripts/migrate.js` 按 `schema_migrations` 順序行 migrations/*.sql），`npm run migrate:up`，部署前／CI 行。
2. 新庫一律 schema-full + migrations；標 schema.sql 為 deprecated 並修掉 §3.2 屍塊。
3. 補一支 migration 對齊 `products.stock`（見 §3.1）。
工作量：M（1–2 日，工具接入不算難，難在清 drift）。

---

## 4. 視圖／前端

### 4.1 🔴 兩套購物車並存：視圖用 localStorage，後台結帳讀 DB — 影響：高
**證據：**
- 前台所有加車／改量邏輯都係寫瀏覽器 `localStorage`：`views/index.ejs:139–179`（`addToCart`）、`views/product.ejs:248–271`、`views/cart.ejs:103–178`（全車操作），成個 storefront 視圖 **0 個 `fetch(`／0 個 `/api/` 呼叫**（grep 證實）。
- 但後端購物車係 DB 模型：`routes/cart.js` 全套 `/api/cart`（要登入）寫 `cart_items` 表；而 `POST /api/orders`（orders.js:83–87）落單係 `SELECT … FROM cart_items ci JOIN products p … WHERE ci.user_id=$1`，空車即回 400「購物車是空的」。
- 兩邊完全冇接駁：用戶喺頁面加嘅車永遠唔會入 `cart_items`，去到結帳 API 一定係空（除非另外用 API 客戶端）。**即真實用戶行唔成落單主流程**（除非 checkout 另有未完成之類）。
**建議：** 二選一盡快收斂——
1. 短期：cart 頁加「前往結帳」時將 localStorage cart POST 去 `/api/cart`（merge），再行現有 orders API（要登入）；
2. 中期：購物車全面 server-side（session user），localStorage 只做匿名暫存＋登入後 merge。
順手為「加車→落單→睇單」補一個 e2e／集成 test（見 §6）。工作量：M（1–3 日）。

### 4.2 Tailwind CDN runtime 編譯上生產 — 影響：中
**證據：** 10 個視圖（含 admin layout L8）全部 `<script src="https://cdn.tailwindcss.com">`（`views/partials/head.ejs:4`；grep 命中 10 檔）。
**點解：** 官方明確講 CDN play 版**唔係生產用**：每個頁面要下載＋瀏覽器端 JIT 編譯整份 utility（FOUC、閃樣、LCP 變差）、依賴第三方域可用性、CSP 要為佢開 `script-src 'unsafe-inline' + cdn.tailwindcss.com`（app.js:64–65 就係咁，見 security audit 嘅 CSP 寬鬆項）。
**建議：** 轉 Tailwind CLI／PostCSS build（`npx tailwindcss -i … -o public/css/app.min.css --minify`），輸出單一靜態檔，視圖刪 CDN script，CSP 即可收緊到 `'self'`。工作量：M（1–2 日，templates 多但機械）。

### 4.3 視圖內聯大量 JS/CSS、冇 storefront 靜態 JS、重複 — 影響：中
**證據：**
- 6 個店面頁每個都有 `<style>` 區塊＋大段 `<script>`（年齡驗証 `checkAgeVerification/verifyAge` 喺 index/product/cart/products/login 逐字複製；購物車 localStorage 邏輯 index/product/cart 三份）。`public/js/` **店面部份係空嘅**（只有 `public/js/admin/` 16 隻共 ~131KB）。
- 大量全域函式掛 window（`addToCart`、`toggleCategories`、inline `onclick=`：cart 4 處、product 3 處等），配合上面 CSP unsafe-inline。
- 後台反而有結構：`views/admin/layout.ejs` + 獨立 `public/js/admin/*.js`（common.js 共享）——明顯比店面整齊。
**建議：** 抽 `public/js/storefront/{age-gate,cart,ui}.js`（細 vanilla ES module 已夠，唔使 framework），每頁 EJS 只留 data island（JSON）；CSS 去 Tailwind build 後只保留 `mzakka-theme.css` 少量品牌覆寫。工作量：M。

### 4.4 JSON data island 用未轉義輸出 — 影響：中（潛在 XSS／語法破壞）
**證據：** `views/index.ejs:116` `<script type="application/json"><%- JSON.stringify(rankingProducts) %></script>`、`views/product.ejs:199` 同款。若商品名／描述含 `</script>` 或控制字元（mzakka 爬返嚟嘅數據完全可能有），會衝出 script 上下文 → XSS 或頁面 JS 直接 syntax error。
**建議：** 序列化後 escape：`JSON.stringify(x).replace(/</g,'\\u003c').replace(/ /g,'\\u2028')…`，或封一個 `res.locals.jsonForScript` helper 統一用。工作量：S。

### 4.5 視圖層正面觀察
✅ partial 化做得唔錯：header/footer/head/sidebar/age-modal 喺 6 個店面頁一致 include（31 個 ejs，店面合計 ~1,100 行內）；admin 有自己 layout；`<%= %>` 預設轉義用得規範（除 §4.4）；`locales/zh-HK.json`＋`createTranslator` 已開 i18n 位（雖然 hardcode 中文仲多）。

---

## 5. 配置／可觀測性／Vercel serverless 相容性

### 5.1 serverless 相容性整體合格，但有幾個實在隱憂 — 影響：中
✅ 做得好嘅位：entry `api/index.js → require('../app')`、冇 `app.listen` 喺 serverless（有 `require.main === module` guard，app.js:866）；pool 係 module-level singleton（`utils/getPool.js`，跨 invocation 重用連線，好做法）；session 入 Postgres（`connect-pg-simple`）唔靠記憶體；冇長駐 `setInterval`／background worker。

🟡 隱憂：
1. **`Pool({ max: 1 })`**（getPool.js:24）：serverless 單實例下安全但非常保守——任何並發請求（一頁已有多個並發 query；圖片 proxy + API）要排隊，tail latency 上升。建議 `max: 3–5`（配合 Postgres 連線上限），或用 serverless driver（Neon/`@neondatabase/serverless`）做 HTTP 模式。工作量：S。
2. **記憶體 cache 喺 serverless 近乎無效且各實例不一致**：`app.js:80` mzakkaDescriptionCache（6h TTL，冇上限，MZ 爬返內容一 key 一 entry，長期會長；cold start 全失）、`utils/productLoader.js:8` 類別 Map。唔會壞，但唔好當佢可靠 cache；`maybeHydrateMzakkaDescription` 仲會喺用戶請求期間**同步爬 mzakka.com（10s 超時）再 UPDATE DB**（app.js:104–119）——冷 cache 下商品詳情頁有機會慢 10 秒。建議：描述補完搬走做離線 job（scripts/ 已有 backfill-descriptions-from-web.js，應排程做），用戶路徑只讀 DB。工作量：S–M。
3. **圖片 proxy 唔適合 serverless**（§2.5）：每張圖一次 function 冷熱啟動＋整圖入記憶體＋sharp（原生 binary，`.vercelignore` 特別排除 `node_modules/@img`、`sharp/vendor`，要驗證 Vercel build 後 sharp 真係行到——app.js 有 graceful fallback 去原圖，所以唔會死，但 resize 會靜默失效）。
4. `vercel.json` 冇 `functions` 嘅 `maxDuration`／memory 配置，預設 10s（Hobby）——上述 10s 爬蟲超時正正喺邊緣。建議明確設定或縮短爬蟲超時。
5. 冇設定 Vercel 健康檢查依賴嘅 DB 連線重試語義（`connectionTimeoutMillis` 有設 10s，尚可）。

### 5.2 `.vercelignore` 開洞風險 — 影響：中
`scripts` 整目錄被 ignore，但 app.js:21 runtime require `./scripts/fetch-mzakka-description`，要用 `!scripts/`＋`!scripts/fetch-mzakka-description.js` 開洞（commit 0b44524 就係修呢個 MODULE_NOT_FOUND）。**本質上 runtime 依賴藏咗喺 scripts 目錄**，將來有人重組或再收緊 ignore 就會冷啟動即死（test 有 entrypoints.test.js 守著 /api/health，但冇人守住「描述 hydrate 路徑」）。建議：把 `fetchHtml / extractDescriptionFromDetailHtml` 搬到 `lib/mzakka/description.js`，scripts 只做 CLI wrapper。工作量：S。順手：`*.md`、`*.sql` 全 ignore → 部署包冇 schema 冇文件屬預期，但要確認冇 runtime 讀 `.md/.sql`（grep 所見 code 冇，OK）。

### 5.3 Env 管理 — 影響：低–中
✅ 有 `.env.example`（16 個變數有註解）、dotenv、`.env*` 入 gitignore、冇見到 `.env` 被追蹤。
🟡
- `SESSION_SECRET` prod 漏設時靜默降級做 random（§2.6）——應 fail fast。
- DB SSL `rejectUnauthorized: false`（getPool.js:26）：Vercel Postgres／Supabase 常見做法，但理論上容許中間人。若 DB 提供者給 CA，應設 `ca`。影響低（全加密傳輸仍在）。
- SHIPANY webhook 允許 IP 由 env 控制（有 `utils/ipAllowlist.js` + xff 解析 + `trust proxy=1`），✅ 正路；提醒 XFF 信任鏈要靠 Vercel proxy（已設 trust proxy）。

### 5.4 可觀測性幾乎為零 — 影響：中
- 全 app **210 個 `console.*`**（app.js/routes/utils/scripts），冇 logger 庫（冇 pino/winston/morgan）、冇 request id、冇結構化欄位、冇錯誤匯總（Sentry 類）。Vercel Log Drains 可以收 stdout，但 `console.error(err)` 直接印 object，查單一請求要好難。
- 冇 access log（morgan）、冇 per-route 計時。
- 建議（漸進）：(1) 加 `pino` + `pino-http`（或最簡單一個 logger.js 包 JSON 輸出），error handler 統一 `log.error({err,reqId})`；(2) Vercel 配 Log Drain；(3) 關鍵路徑（落單、webhook、退款）加業務事件 log。工作量：S–M。

### 5.5 README 同現實嚴重過時 — 影響：中
- README L42 寫 **「Frontend: Vue 3 + Vite (SPA）」**、Getting Started L73「Build and run frontend from the `frontend/` directory」——但 repo **根本冇 `frontend/` 目錄**（`ls` 證實），實際係 EJS server-rendered + Tailwind CDN。`.gitignore` 嘅 `frontend/dist` 都係遺物。新人照 README 行必卡。
- L69 教行 `schema-full.sql`，但冇提 7 個 migrations（行完 schema-full 都可能同 code drift，見 §3.1）、冇講 `npm test`、冇 env 完整清單對照（example 有）。
- 冇 Vercel 部署 env／build 注意（DATABASE_URL、SESSION_SECRET 必填、CSP_MODE 含義）。
建議：重寫 Getting Started（pg 起庫 → schema-full → migrations 順序 → `.env` → `npm run dev` → `npm test`）、stack 改 EJS/Tailwind、加 Vercel env checklist、加「圖片／data 不入 git」貢獻約定。工作量：S。

---

## 6. 測試

**現況（證據）：** `test/` 89 個檔、~1,939 行，`node:test` 無外部依賴；我實跑 `node --test ./test/*.test.js` → **169 tests pass / 0 fail**（~0.9s，無 DB 狀態依賴，快）。
- ✅ 覆蓋面其實幾有心思：RBAC（10+ 檔：middleware、menu hiding、route permissions、migration seed）、security（cors/csp/csrf/helmet/rate-limit/webhook signature/ip allowlist）、inventory（levels、adjustment、warehouse default、sku upsert-not-delete）、mzakka 工具（description extract、breadcrumb、import args）、route precedence（admin-products-route-precedence）、entrypoint/health、ui 斷言（nav link、modal 存在）。
- 🟡 **核心弱點：測試形態係「讀原始碼斷言字串／結構」而非行 HTTP**——64 個測試檔用 `fs.readFileSync(...route source...)` 然後 `includes(...)`（例 `sql-surface.test.js` 要求 products.js「包含 name_zh_hk」）。呢類測試能防簡單回歸，但：
  1. 完全唔會發現 §3.1（schema 冇 stock 欄）呢類運行時錯誤，因為冇對真 DB／mock DB 行過路由；
  2. 唔會發現 §4.1（購物車 localStorage 對唔到 DB 結帳）；
  3. 重複路由 shadowing（§2.3）要一個 `admin-products-route-precedence` 先守到，其餘 30+ 組重複冇守。
- **缺嘅關鍵測試**：結帳 happy path（加車→落單→扣庫存→訂單讀取）、auth 實際登入 session、支付 webhook 冪等/簽名端到端、schema 可從零起（空白 postgres 行 schema-full + migrations + 一次 request smoke）。
**建議（按 CP）：**
1. 加 `schema bootstrap smoke`：CI 用 postgres service container，空白庫行 schema-full + migrations，再 boot app 打 `/api/health` 同 `/api/products`（會即時抓到 §3.1／§3.2）。工作量：S–M。
2. 引入 `supertest`（細依賴）＋pg mock 或 testcontainers，為 `/api/orders`、`/api/cart`、admin RBAC 寫行為級測試。工作量：M。
3. 加路由表唯一性測試（method+path 冇重複註冊）。工作量：S。
現有測試唔使刪，字串斷言作為廉價 guard 留低都得，但要知道佢唔係行為保證。

---

## 7. 其他正面觀察（值得保持）
- 安全基線意識強：helmet、CSP report-uri（先 report 後 enforce 嘅推進策略正確）、csrf（webhook 路徑豁免合理）、rate limit 分級、bcrypt、session cookie 安全標誌、RBAC 細粒度 permission model（`middleware/auth.js` 設計乾淨）。
- SQL 全部參數化、ORDER BY 有白名單（§3.5）。
- DB 相關大量操作有用 transaction + `FOR UPDATE`（logistics/products-full/admin 嘅收貨、調庫），示範咗正確悲觀鎖模式——要做嘅係將同一紀律推番去結帳主流程。
- 提交紀律好（conventional commits、安全修復有獨立 commit）、scripts 有 dry-run 模式（deactivate-ended-products、cleanup-gallery 等）——營運操作有安全網。

---

## 8. 建議優次總表（按 CP 值排序）

| # | 事項 | 影響 | 工作量 | 類別 |
|---|---|---|---|---|
| 1 | **修結帳主線**：(a) localStorage 車 → `/api/cart` 接駁；(b) 統一庫存模型（products.stock vs product_skus/inventory_levels，FOR UPDATE 扣 SKU）；(c) 空白庫 smoke test | 高 | M | 正確性 |
| 2 | **修路由 shadow／dead code**：刪 products.js、brands.js 舊版或合一方， featured 被 `:id` 食嘅 500；統一一套 auth middleware；加路由唯一性 test | 高 | S–M | 正確性 |
| 3 | **schema 止血**：刪 schema.sql 無頭屍塊（L523–539）、空白庫驗 schema-full+migrations、引入最小 migrate runner + `schema_migrations` | 高 | S–M | 數據層 |
| 4 | **統一錯誤處理**：wrapAsync + 全域 JSON error/404 + process safety net；adminPages 4 個無 catch async 即修 | 中–高 | S | 穩定性 |
| 5 | **Repo 瘦身**：備份→圖片走 proxy/Blob（兼修 hardcode LOCAL_IMAGE_DIR）→ git filter-repo 清 public/images＋30MB jsonl→補 .gitignore | 高 | M | 衛生/部署 |
| 6 | 將 mzakka 描述爬取移出用戶路徑（離線 backfill），縮短/設 maxDuration | 中 | S–M | 效能 |
| 7 | Tailwind CDN → 離線 build，收緊 CSP；抽 storefront JS | 中 | M | 前端/安全 |
| 8 | logger（pino）+ Sentry/log drain + 結構化錯誤 | 中 | S–M | 可觀測 |
| 9 | SESSION_SECRET prod fail-fast；pool max 1→3–5 | 中 | S | 配置 |
| 10 | 重寫 README（刪 Vue/frontend 過時描述）；JSON data island escape 防 XSS | 低–中 | S | 文件/安全 |

> 審計完成：全文連證據（檔案:行號）見上面 §1–§7。測試 169/169 pass，但屬原始碼斷言型，建議優先補「空白庫 boot + 結帳行為級」兩類測試。
