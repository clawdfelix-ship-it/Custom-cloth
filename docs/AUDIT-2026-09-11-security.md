# OHYA2.0 安全審計報告（只讀滲透測試）

- **日期**：2026-09-11
- **審計員**：滲透測試安全工程師（授權只讀審計，未發任何寫請求、未改任何代碼）
- **目標**：Ohya2.0（香港成人用品電商），Node Express 4 + EJS + Postgres，Vercel serverless（ohya2-0.vercel.app）
- **範圍**：`app.js`、`routes/`、`lib/`、`middleware/`、`utils/`、`migrations/`、`views/`、依賴（npm audit）
- **方法**：白盒源碼審查（OWASP Top 10 + 業務邏輯滥用），無主動利用
- **嚴重度**：P0 = 可直接大規模攻陷/資金損失；P1 = 高影響需特定條件；P2 = 加固項

> 進度日誌：本報告每查完一個範疇即時 append，防止超時丟失。

---

## 0. 攻擊面總覽（偵察）

- 入口 `app.js`（876 行）集中掛 helmet / CORS / rate limiter / session / csurf，再 `require('./routes/*')(app, pool, ...)`。
- **關鍵觀察：路由註冊簽名不一致**——
  - 有傳入 `requireAdmin`：`auth`、`admin`、`categories`、`brands`、`products`、`cart(requireAuth)`、`orders(requireAuth, requireAdmin)`。
  - **冇傳任何 auth middleware**：`members`、`marketing`、`shipping`、`logistics`、`refunds`、`reconciliation`、`reports`、`products-full`、`adminPages`（adminPages 自包）。
  - 即退款/對數/物流/推廣/會員呢啲高敏路由，授權完全依賴檔案內部自己把關，需逐個核實（下文逐項查）。
- 全局 CSRF（csurf，session store）對所有非 GET 生效，只豁免 `/webhooks/` 同 CSP report path。
- 全局 `express.json({verify})` 保存 rawBody（畀 webhook 簽名用）。


## 1. SQL 注入（Injection）

掃描全部 `routes/ utils/ lib/ app.js scripts/` 嘅 `pool.query`，重點查模板拼接、`+` 拼接、`IN(...)`、動態 column/table、ORDER BY。

- **絕大部分查詢用參數化佔位符（`$1..$N`）**，搜索/過濾 `where += ... $${n}` 全部綁參數（orders:212-218、members:325-333、marketing:99/427、products-full:144-152/458-470/932-965、admin:75-79、reports:136-410、shipping:84-207、logistics:84/250、refunds:14-18）。**未發現可直接注入字串值嘅經典 SQLi。**
- **動態 ORDER BY 有白名單把關**：
  - `app.js:690` `ORDER BY ${getProductsOrderBy(sort)}` → `lib/productsSort.js` 用固定 map，未知 key fallback `recommend`。✓
  - `products-full.js:170-184` `ORDER BY ${allowedSort[sort]} ${order}` → 固定 column map + `order` 只係 `'ASC'|'DESC'`。✓
- **動態 SET 子句**：`products-full.js:1262` `SET ${fields.join(', ')}`（warehouse update）、`admin.js:348` —— 欄位名全部係 server 端 hardcode 字串，值全部綁參數，**無 SQLi**（mass-assignment 另行見授權章節）。

> 結論：SQLi 面向暫無可利用點。風險在於「新增動態排序/欄位時若複製粘貼而唔用白名單」會即刻變注入——建議加 lint/test 卡死（已有 `test/sql-surface.test.js`，保持）。

## 2. 認證 / 授權 / Session

### 2a.【P0】生產環境 SESSION_SECRET 缺失時用隨機密鑰仍可啟動
- **位置**：`app.js:177-184`（commit `4748f12 "allow boot without SESSION_SECRET in prod"`）。
- **程式碼**：prod 冇 `SESSION_SECRET` → `crypto.randomBytes(32)` 每次 boot 重新生成，只 `console.warn`。
- **攻擊/業務情境**：
  1. **Vercel serverless 每個 lambda instance 有自己嘅隨機 secret**（且每次 cold start 變）→ 所有 session cookie 被其他 instance 視為無效，用戶/管理員不斷被登出，session store 堆滿無效列。
  2. 更致命：若任一 instance 嘅密鑰可經錯誤/日誌/`.env` 外洩，或部署平台將 env 暫時清空，攻擊者**唔需要知道密鑰**——配合下面 2b 嘅 session 內容，一旦 secret 可預測/重啟固定即可偽造 `req.session.isAdmin=true` 成為管理員。
  3. 此改動直接推翻咗上一個 commit `7139d1d "require SESSION_SECRET in prod"` 嘅 hard-fail 保護，屬於安全回退（regression）。
- **修法（務必）**：prod 必須 **fail-closed**——`if (NODE_ENV==='production' && !process.env.SESSION_SECRET) throw new Error('SESSION_SECRET required')`。密鑰用 `openssl rand -hex 32` 生成並設定喺 Vercel env；支援密鑰輪換用 `secret:[old,new]` 陣列。移除隨機 fallback。


### 2b.【P0】後台登入無速率限制 → 管理員帳號可被無限暴力破解 / 撞庫
- **位置**：`routes/adminPages.js:84-115`（`POST /admin/login`）。`app.js:152` 只對 `/api/auth/login`（前台 API）掛 `loginLimiter`，**後台表單登入 `/admin/login` 冇掛任何 limiter**；`adminWriteLimiter` 只 match `/api/admin` 前綴，覆蓋唔到。
- **攻擊情境**：攻擊者對 `/admin/login` 高速噴 username/password（bcrypt 只 server 端慢，但無封禁/節流），用常見密碼字典或洩漏密碼撞庫，24×7 掃。一旦命中一個後台/管理員帳號即可下單改價、退款、匯出客戶資料（成人用品店客戶私隱極敏感）。
- **修法**：`app.use('/admin/login', loginLimiter())`（建議更嚴格，例如 10 次/15 分鐘 + 帳號級鎖定/指數退避）；對 `/admin/setup` 同 `POST /api/auth/register` 都加。登入失敗記 audit log + 告警。

### 2c.【P1】RBAC 授權不一致：大量 /api/admin 端點只用寬鬆 `requireAdmin`，繞過細粒度權限
- **背景**：`/admin/login` 對非 `is_admin` 用戶，只要喺 `admin_permissions` 有**至少一條**權限就登入成功，並設 `session.isBackoffice=true`（`adminPages.js:101-112`）。
- shared `requireAdmin`（`routes/middleware/auth.js:36-45`）只要 `isAdmin || isBackoffice` 即放行，**完全唔檢查 `adminPermissions`**。
- **受影響端點（任何最低權限後台帳號都可存取）**：
  - `routes/marketing.js`：全部 coupon 增刪改（:122/:158/:192）、flash-sale、affiliate、abandoned-carts、blog post 增刪改（:89–553）——可建任意高額優惠券/100% 折扣、改聯盟返佣。
  - `routes/shipping.js`：運費方式增刪改（:136/:153 等）。
  - 對比 `products-full.js` / `refunds.js` / `reconciliation.js` / `reports.js` / orders admin 全部正確用 `requirePermission('<scope>:<act>')`。
- **攻擊情境**：一個只獲授「寫 blog」或「看報表」嘅兼職/外包後台帳號，直接 `POST /api/admin/coupons` 開一張無門檻 100% 折扣碼自己落單，或改運費/聯盟帳號抽水。
- **修法**：所有 `/api/admin/*` 寫操作統一用 `requirePermission('<scope>:<action>')`，禁止再用裸 `requireAdmin`（除真正「任何後台成員都可」嘅唯一起步資料）。加測試掃描路由註冊保證（已有 `test/rbac-*`，擴展到 marketing/shipping）。

### 2d.【P1】退款金額無任何校驗（負數／超大／零）+ 退款狀態機無把關（可重複 complete、跳過審批）
- **位置**：`routes/refunds.js`
  - `POST /api/admin/refunds`（:34-58）：`amount` 直接入庫，**無檢查 `>0`、無檢查 ≤ 訂單已付/可退餘額、無檢查是否已有退款單**。
  - `/approve`（:61）：任意 pending（甚至不存在才擋）可批准；`/complete`（:112）：**只 SELECT 退款單、無檢查現 status**，可對同一張退款單重複 POST `complete`，每次都重算 `orders.payment_status` 並寫一條 history；`refund_transaction_id`（真實閘道憑證）由客戶端字串傳入，**不與支付閘道核對**。
  - `utils/refundsLogic.js:5`：`refund >= total → 'refunded'`，負數退款令狀態停留/回退為 `partial_refunded`，可擾亂對賬。
- **攻擊/舞弊情境**：
  1. 有 `refunds:write` 嘅帳號（或配合 2c 提升後）開一張 `amount=99999999` 退款並 complete，令訂單被標 `refunded`，再憑內部憑證向財務/閘道申請真退款。
  2. 重複 complete 洗 audit/對賬（`reconciliation` 會信賴 `payment_status`）。
  3. 金額負數作人為調節，掩飾資金缺口。
- **修法**：
  - 入庫前 `Number(amount)>0` 且整數/兩位小數；在交易內對訂單加鎖（`SELECT ... FOR UPDATE`），核對「已退款總額 + 本次 ≤ 訂單可退額」。
  - 嚴格狀態機：只允許 `pending→approved→completed`、`pending/approved→rejected`；complete 前 `WHERE id=$1 AND status='approved'` 並檢查 affected rows。
  - 加唯一/約束防同一訂單重複退款；真退款必須由後端呼叫支付閘道、用閘道回寫嘅 transaction id，而非客戶端傳入。

### 2e.【P2】Session 配置與登入相關
- Cookie：`httpOnly:true`、prod `secure:true`、prod `sameSite:'lax'`（`app.js:188-198`）——基本正確。✓
- **登入後無重新產生 session ID**（`auth.js:47-51`、`adminPages.js:102` 都直接寫舊 session）→ 存在 session fixation 面（需配合子域/其他管道先能種 cookie，風險中等偏低）。建議登入時 `req.session.regenerate()`。
- session 有效期 30 日、無 idle timeout；後台屬高權限，建議後台 session 獨立較短生命週期 + idle timeout。
- 密碼：bcrypt cost=10（`auth.js:18`、`adminPages`/`members.js:98`）——可接受，建議 11–12。無密碼複雜度/黑名單（僅 ≥6 字）。**全專案無「忘記密碼/重設」流程**（不算漏洞，但需正規實作時要帶 token 時效+單次使用）。


## 3. 支付 / 退款 / 對數業務邏輯

### 3a.【P0】支付 Webhook 完全無認證 + 無金額核對 → 免費落單 / 任意訂單偽造付款
- **位置**：`routes/logistics.js`
  - `POST /webhooks/fps-payme`（:882-913）
  - `POST /webhooks/alipayhk`（:916-954）
  - `POST /webhooks/wechatpay`（:957-998）
- 三個支付回調**全部冇任何簽名/來源驗證**（對比 `/webhooks/shipany` :725 至少有 HMAC + IP allowlist）。CSRF 中間件又全域豁免 `/webhooks/`（`app.js:74`），等於任何人可直接 POST JSON。
- 亦**無核對金額**：webhook body 給咩 `transaction_id/order_id/amount/status` 就信；`alipayhk/wechatpay` 甚至用訂單自己嘅 `total_amount` 寫入 `payment_transactions`，但都無同閘道真實交易比對。
- **攻擊情境（無需登入、無需付款）**：
  1. 用正常途徑開一張訂單（或枚舉/得知他人 `order_number`）。
  2. `curl -X POST https://ohya2-0.vercel.app/webhooks/fps-payme -d '{"order_id":<id>,"transaction_id":"x","amount":1,"status":"success"}'`
     → 訂單即被設 `payment_status='paid'`、`paid_at=NOW()`，無需過數即可要求發貨（**直接收入/貨品損失**）。
  3. Alipay/WeChat 版本用 `order_number` 定位，攻擊者可對**任意他人訂單**偽造付款（或配合退款流程擾亂對賬）。
  4. 重放：`transaction_id` 無單次性/冪等綁定狀態校驗（`upsert ... ON CONFLICT DO UPDATE` 會覆蓋），可反覆標 paid。
- **修法（上線前必修）**：
  - 每個閘道按官方規範驗簽（AlipayHK RSA2、WeChat Pay v3 AEAD/HMAC、FPS/PayMe 供應商簽名），用快取原始 body；**prod 缺 secret 必須拒絕請求（fail-closed），而不是跳過驗證**。
  - 驗證通過後，後端主動向閘道查詢/用回調內欄位核對：`amount == orders.total_amount`、幣別 HKD、`out_trade_no` 屬於本商戶、交易狀態成功，先好標 paid。
  - 冪等：以閘道交易號唯一約束 + 只在 `payment_status<>'paid'` 時流轉；記錄來源 IP 並用閘道 IP allowlist。

### 3b.【P1】商品價格/優惠以資料庫為準（正面），但「優惠券核銷」需重點防競態與濫用
- 訂單建立（`orders.js:97-100`）`total` 由 `products.price`（DB）× 數量計算，**價格唔係前端傳入**，呢點正確。✓
- `routes/marketing.js:17 POST /api/coupons/validate`（requireAuth）只做驗證；需核實落單時優惠金額是否後端重算、可否重複/疊加使用、到期/門檻可否繞過（見 3c 跟進）。


## 4. XSS / 模板輸出

- Storefront EJS 動態值幾乎全部用轉義輸出 `<%= %>`（products/product/index 的 name、price、search、category），`<%- %>` 僅見於 `include(...)`——**默認無反射型 XSS**。
- 後台 `views/admin/*.ejs` 無對數據用 `<%- %>`；後台前端 `public/js/admin/*.js` 渲染訂單姓名/電話/地址等客戶可控欄位時用 `textContent`（如 `orders.js:198+`），**未發現 innerHTML 注入 sink**（唯一 `categories.js:86` 係清空節點）。✓

### 4a.【P2】內聯 `<script>` 以未編碼 JSON.stringify 注入產品數據 → 理論上的 stored/break-out XSS
- **位置**：`views/product.ejs:199` `<script ...><%- JSON.stringify(product) %></script>`、`views/index.ejs:116` `<%- JSON.stringify(rankingProducts||[]) %>`。
- `JSON.stringify` **唔會轉義 `</script>`、`<!--`、U+2028/U+2029**。若任一產品欄位（name/description，含從 mzakka 抓取並入庫嘅描述）含字串 `</script><script>...`，即可跳出 script 標籤執行任意 JS。
- 目前緩解：mzakka 描述抓取有 `stripTags()`（`scripts/fetch-mzakka-description.js:15`）剝 HTML 標籤；商品名一般無 `<>`。故**目前可利用性低**，但屬真實 sink，且日後若經 CSV 匯入/其他管道寫入含 `</script>` 嘅欄位即變 stored XSS（打訪客/管理員）。
- **修法**：輸入到 `<script>` 前做安全序列化，例如
  `JSON.stringify(x).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/ /g,'\\u2028').replace(/ /g,'\\u2029')`
  或用 `serialize-javascript`；更佳係改成 fetch JSON API，唔好內聯。

## 5. CSRF

- 全域 csurf（session store，非 double-submit cookie）對所有非 GET/HEAD/OPTIONS 生效，豁免僅 `/webhooks/` 同 CSP report（`app.js:67-79,200-202`）。退款/管理寫操作/會員操作**全部受 CSRF 保護**，配合 `sameSite=lax`（prod）縱深防禦。✓
- **風險點**：豁免係用 `req.path.startsWith('/webhooks/')`，而支付 webhook 本身無簽名（見 3a）——CSRF 豁免 + 無簽名令偽造付款更直接。修復 3a 後此顧慮消除。
- 注意：`csurf@1.11.0` 已被官方封存（archived，不再維護），建議遷移至 maintained 方案（如 `csrf-csrf`）或自研 double-submit + same-site。

## 6. 檔案上傳

### 6a.【P1】圖片上傳未校驗檔案類型/副檔名，檔名直接含用戶 originalname
- **位置**：`routes/admin.js:42-62` `POST /api/admin/upload`（守衛用裸 `requireAdmin`，見 2c）。
- `multer({storage:memory, limits:{fileSize:10MB}})` **無 `fileFilter`、無 MIME/副檔名白名單**；落盤檔名 = `${timestamp}-${rand}-${req.file.originalname.replace(/\s+/g,'-')}`。
- 風險：
  1. `originalname` 可含 `../../`：雖 `path.join(__dirname,'../public/images', fileName)` 配合 `..` 可寫出 images 目錄（路徑穿越覆寫，例如 `....js`/`....json`；`.replace(/\s/,'-')` 唔擋 `/`），需管理員權限，但屬後台帳號即可用（2c 再降低門檻）。
  2. 可上傳 `.html`/`.svg`（含 JS）/任意類型到 `/images/`（static 同一 origin 提供），做 stored XSS / 釣魚託管；10MB 未限制總量可灌爆 serverless/磁碟（本地自託管情境）。
- **修法**：加 `fileFilter` 白名單（jpeg/png/webp）、用 magic bytes 驗證（`file-type`）、檔名只用 server 生成嘅隨機名 + 強制安全副檔名（棄用 originalname 或先 `path.basename` 再剝非白名單字元）、上傳到物件存儲並以不執行內容嘅 bucket/域名服務、加上傳頻率限制。

## 7. SSRF / 外部請求

- `/image/:hash`（`app.js:237`）：`:hash` 強制 `^[a-f0-9]{32}$`，`w/h` 上限 2000 且 `parseInt`；遠端 host 喺 `getRemoteUrl` 固定指向 mzakka 圖床（`imageUtils.js`，hash 只入 path），**攻擊者控制唔到 host/scheme → 無 SSRF、無 open redirect**。✓
- mzakka 描述抓取（`app.js:98`）URL 由固定前綴 + 經 `encodeURIComponent(itemId)` 構造，itemId 來自商品 slug（受現有商品限制），SSRF 面很低；但該回應內容會寫入 DB（見 4a），屬「外部內容入庫」信任邊界，宜持續視為不可信。
- ShipAny tracking 請求（`logistics.js:~800`）用 `SHIPANY_API_URL` 後端配置，非用戶可控。✓

## 8. 庫存 / 積分 / 業務競態

### 8a.【P2】落單扣庫存非原子、無條件防超賣
- **位置**：`routes/orders.js:84-130`。庫存檢查喺交易外逐項 `if(stock<qty)`，交易內 `UPDATE products SET stock=stock-$1 ...`（**冇 `WHERE stock>=$1`、冇 `SELECT ... FOR UPDATE`**）。
- 多個並發訂單（尤其 serverless 多實例）可同時通過檢查 → **超賣/負庫存**。取消補貨（:155）亦無條件，配合重複取消邏輯需確保狀態流轉（目前 cancel 檢查 pending/paid，但無幂等鎖，並發雙重 cancel 可重複加庫存）。
- **修法**：交易內 `UPDATE products SET stock=stock-$q WHERE id=$id AND stock>=$q RETURNING ...`，檢查 affected rows，否則 rollback 報「庫存不足」；訂單狀態流轉加 `WHERE status IN (...)` 條件判斷。
- 對比：後台 `inventory/adjust`（`products-full.js:1097`）正確用 `FOR UPDATE OF ps,il` 行鎖。✓（建議落單同樣做法）
- 另：cart/orders 用 legacy `products.stock`，但實際庫存以 `product_skus`/`inventory_levels` 為準（前台列表 SUM sku），**兩套庫存口徑不一致**，落單可能睇住錯嘅 stock（功能性+超賣風險），需統一。

### 8b.【P2】積分兌換可提交負數/零，且扣減檢查存在 TOCTOU
- **位置**：`routes/members.js:240-285` `POST /api/user/points/redeem`。
- 只檢查 `points > currentPoints`，**無檢查 `points>0`/整數** → 提交 `points:-1000` 會 `points = points - (-1000)` **增加積分**，並寫入 `-$2`（變正數）交易記錄，可無限刷積分/折扣。
- `SELECT points` 後喺交易內扣減但**無行鎖/無條件更新**，並發多次 redeem 可繞過餘額檢查（TOCTOU）雙花。
- `order_id` 客戶端傳入且未驗證屬於本人/未被使用 → 可把兌換掛到任意/重複訂單。
- **修法**：`Number.isInteger(points) && points>0`；交易內 `UPDATE users SET points=points-$1 WHERE id=$2 AND points>=$1 RETURNING points`，驗 affected rows；兌換與訂單在同一結賬交易內冪等綁定，校驗 order 所屬。

## 9. 依賴漏洞（npm audit --omit=dev，152 packages）

metadata：`low 3 / moderate 1 / high 1 / critical 0`。

| 嚴重 | 套件 | 問題 | 專案影響 / 建議 |
|---|---|---|---|
| High | `ip-address@10.2.0`（經 express-rate-limit） | leading-zero 八進制歧義、CIDR 尾碼繞過 special-use 分類 → SSRF/trust-boundary bypass | **本專案自訂 IP allowlist（`utils/ipAllowlist.js`）字串精確比對，唔使用呢個庫**，故實際可利用性低；但要留意 rate-limit 嘅 IP 信任。升到修復版本（更新 express-rate-limit / override）即可。 |
| Moderate | `qs`（經 body-parser/express） | null/undefined 逗號陣列 DoS、array-limit 繞過、isBuffer DoS | 僅深度/異常 body 觸發 DoS；統一更新 express/body-parser/qs。 |
| Low | body-parser / cookie / csurf | limit 設定失效 DoS；cookie 非法字元 | 一併更新；`csurf` 已封存需規劃替換。 |
| — | **multer `1.4.5-lts.1`** | npm 安裝警告明確指出 **1.x 有多個已修於 2.x 嘅漏洞**（audit 因 lts 版本可能未列 CVE） | **建議升到 multer 2.x**，配合第 6 節 fileFilter 一併處理。 |

> 全部為可遠端觸發嘅 DoS/繞過類，未見直接 RCE/資料外洩 CVE，但 multer 2.x 同 qs/body-parser 應排速更新。`npm audit fix` 後需回歸測試（express 4 生態）。

## 10. 敏感資訊 / 設定 / 日誌

- `.env.example` 只有佔位值，**無真實密鑰** ✓；`.gitignore` 已忽略 `.env*` ✓（建議確認 git 歷史從未 commit 過真 `.env`：`git log --all -p -- .env`）。
- **本機絕對路徑硬編碼入庫**：`utils/imageUtils.js:6` `LOCAL_IMAGE_DIR='/Users/chansiulungfelix/.openclaw/.../mzakka-clone/images'`——泄露開發者用戶名/目錄結構，且 Vercel 上必然不存在（永遠走遠端，功能可用但屬資訊洩漏＋壞味道）。建議改 env 配置且不 hardcode。
- **錯誤處理兩極**：多數 API 只回「服務器錯誤」（好），但 `app.js:419` 路由載入失敗回 `details: error.message`，`products-full.js:1166` inventory adjust 直接回 `e.message`，`app.js` image proxy `console.warn(error.message)`——可能洩露內部錯誤/SQL 片段；建議統一 prod 不回傳原始錯誤，只記 server-side。
- 全局最後**無統一 404/error-handler、無 `app.listen` 外嘅 unhandledRejection 處理**；堆疊在 Express 預設 HTML 錯誤頁可能於非 API 路由洩露（`NODE_ENV!=='production'` 時）。確保 Vercel 上 `NODE_ENV=production`。
- CSP 目前預設 `report`（report-only）且允許 `'unsafe-inline'` 同 `https://cdn.tailwindcss.com`（script-src/style-src）。`unsafe-inline` 削弱 XSS 防護；建議收斂（nonce/hash）後轉 `enforce`。`img-src/connect-src https:` 較寬但可接受。
- rate limit：`loginLimiter` 20/15min **偏寬鬆**（建議前台 ≤10、後台更嚴）；`webhookLimiter` 300/min、`adminWriteLimiter` 120/min 合理；依賴 `trust proxy=1`（Vercel 正確）取 client IP。


## 11. 補充：IDOR / 公開端點 / 濫用

- **訂單/地址/退貨 IDOR 防護正確**：`orders.js` 一律 `WHERE id=$1 AND user_id=$2`；`members.js` 地址 CRUD scoped by user；`logistics.js` 開退貨前先驗訂單屬本人（:35-40）。`api/orders/:id/tracking` 亦 scoped user_id。✓
- **abandoned-carts token 端點（`marketing.js:354/397`）**：
  - `POST /abandoned-carts` 完全公開（無登入），`token` 由客戶端提供、`cart_data` 直接 `JSON.stringify` 入庫，無大小/頻率限制 → 可被濫用灌爆 `abandoned_carts` 表（儲存型 DoS/垃圾資料），且可覆蓋任意已知 token 嘅 cart。
  - `POST /abandoned-carts/:token/recover` 無驗證 token 擁有者/order 歸屬，可把任意 token 標 recovered（低影響，資料污染）。建議：token 由 server 生成高熵、寫入限流、recover 時核對 order。
- **`/api/coupons/validate` 信任客戶端 `order_total`**（`marketing.js:19`）：可傳大數試出折扣額，但**目前落單 `orders.js` 完全冇套用 coupon/discount**（核實：orders.js 無 coupon/discount 邏輯），故即時無資金影響；**一旦接軌結賬，必須在後端以真實小計重新計算並原子核銷（used_count++ / coupon_usages），否則會變成可偽造折扣**。登記為 P2 設計警告。
- **註冊端 `/api/auth/register` 無速率限制**（只有 login 有）→ 可批量註冊垃圾帳號；建議加 limiter + 驗證碼/電郵驗證。
- **兩套 requireAdmin 語義不一致**（易踩坑/日後回歸）：`app.js:213` 內聯版本要求 `session.isAdmin===true`；`routes/middleware/auth.js:36` 版本接受 `isAdmin||isBackoffice`。`routes/admin.js`（upload、stats、CSV 匯入）用嘅係 app.js 傳入嘅嚴格版（要真 admin），影響較細；但建議統一為單一 middleware 並預設最小權限，避免未來誤用寬鬆版。

---

## 12. Executive Summary（管理層摘要）

| 嚴重 | 數量 | 項目 |
|---|---|---|
| **P0** | **3** | 3a 支付 webhook 無簽名無金額核對（免費落單/偽造付款）；2a prod SESSION_SECRET 缺失仍可啟動（隨機密鑰/可偽造 session）；2b 後台登入無速率限制（暴力破解管理員） |
| **P1** | **3** | 2c 大量 admin API 用寬鬆 requireAdmin 繞過 RBAC；2d 退款金額/狀態機無校驗（負數/超額/重複）；6a 圖片上傳無類型校驗+originalname 路徑 |
| **P2** | 9+ | XSS JSON sink、落單超賣競態、庫存口徑不一、積分負數/TOCTOU、註冊無限流、abandoned-cart 濫用、依賴更新（multer 2.x/qs/csurf 替換）、CSP unsafe-inline、錯誤訊息/本機路徑洩漏 |

### 最致命 3 項（上線前必修）
1. **支付 webhook 全無認證（3a，P0）**——任何人 `POST /webhooks/fps-payme|alipayhk|wechatpay` 即可把任意訂單標為「已付款」而毋須過數，直接造成貨品/收入損失，亦可打他人訂單。必須驗簽（fail-closed）＋後端核對金額/幣別/商戶單號＋冪等。
2. **SESSION_SECRET 生產缺失仍啟動（2a，P0）**——serverless 隨機密鑰令 session 失效/不一致，並把原本 fail-closed 嘅保護回退；密鑰一旦可預測或外洩即可偽造 `isAdmin` session 全面接管後台。必須缺密鑰即拒絕啟動。
3. **後台登入無暴力破解防護（2b，P0）＋ RBAC 可被低權後台帳號繞過（2c，P1）**——`/admin/login` 無限流可離線撞庫；登入後 marketing/shipping 等接口只檢查「是否後台成員」而忽略細粒度權限，低權限（或被撞破嘅帳號）可自建 100% 優惠券、改運費/聯盟返佣。需加嚴格登入限流＋全接口 `requirePermission`。

### 正面發現（已做對）
- 全專案 SQL 查詢基本參數化，動態 ORDER BY/SET 用白名單/固定欄位，**未見可利用 SQLi**。
- Storefront 模板預設轉義、後台前端用 `textContent`，CORS 生產環境 allowlist，cookie httpOnly/secure/sameSite=lax，全域 CSRF（含退款/管理操作），密碼 bcrypt、改密需驗舊密碼、自我資料更新無 mass-assignment 提權。
- 後台庫存調整/CSV 匯入有用 `SELECT ... FOR UPDATE` 行鎖；訂單/退貨/地址查詢正確做用戶隔離（無 IDOR）。
- `.env` 無真實密鑰入庫；image proxy 無 SSRF；npm audit 無 critical/RCE 級 CVE。

> 建議修復順序：3a → 2a → 2b → 2c/2d/6a → 其餘 P2。修 3a 後一併收緊 webhook 嘅 CSRF 豁免邊界。

