# M-ZAKKA 新品直入 DB 同步設計稿

## 目標

- 將 M-ZAKKA「新品」同步流程由「只爬資料」提升為「爬完即匯入 Postgres」，令前台商品資料可以直接反映同步結果。
- 同時支援兩種觸發方式：
  - 後台人手觸發同步
  - 內部 secret 保護的自動同步 endpoint，供 cron / scheduler 呼叫
- 保留 JSONL 作 debug 輸出用途，但唔再將 JSONL 當成正式上線流程的必要中介。

## 非目標

- 今期唔做完整排程基建管理介面（例如後台設定 cron 頻率）。
- 今期唔做多來源商品同步框架；範圍只限 M-ZAKKA 新品。
- 今期唔做翻譯流程、價格換算、圖片另存 CDN、庫存同步。
- 今期唔保證「每次同步都只新增、永不更新」；現階段仍以 upsert 方式覆寫來源最新資料。

## 現況盤點

- 現有 repo 已有 M-ZAKKA crawler、Postgres importer、admin products 頁同步按鈕同 API route。
- 前台商品顯示依賴資料庫資料；單靠部署 crawler 程式碼，唔會令前台自動出現新品。
- `utils/mzakkaSync.js` 已具備單一同步核心：
  - 正規化同步參數
  - 呼叫 crawler 抓取新品
  - 可選輸出 debug JSONL
  - 將記錄直接交畀 importer 寫入 DB
- `routes/mzakka-sync.js` 已具備兩個入口：
  - `POST /api/admin/catalog/mzakka-sync`
  - `GET` / `POST /api/internal/jobs/mzakka-sync`
- 自動同步需要部署環境設定 secret；若使用 Vercel Cron，應配合 `CRON_SECRET` bearer token。

## 設計原則

- 單一同步核心：無論係 admin 手動同步定 scheduler 自動同步，都必須共用同一條 service flow，避免兩套邏輯漂移。
- DB 先行：同步完成標準唔係「成功爬到資料」，而係「資料已成功 upsert 入 Postgres」。
- 可重跑：重覆同步唔應產生重覆商品，應靠既有商品 slug / SKU key 做 upsert。
- 可觀測：每次同步都要回傳 pages fetched、records fetched、products upserted、skus upserted 等統計。
- 失敗可定位：保留 debug JSONL 選項，方便針對 parser / importer 問題重播資料。

## 同步流程

### 1) 觸發

- 後台管理員於商品頁按「同步 M-ZAKKA 新品」。
- 或由外部 scheduler 以 secret 呼叫內部同步 endpoint。

### 2) 參數正規化

由 `normalizeSyncOptions()` 統一處理：

- `categoryId`：預設 `1894`（M-ZAKKA 新品分類）
- `startPage`：預設 `1`
- `pages`：預設 `1`
- `limit`：預設 `24`
- `delayMs`：預設 `150`
- `includeEnded`：預設 `false`
- `batchSize`：預設 `100`
- `debugJsonlPath`：可選

### 3) Crawl

- crawler 先抓新品列表頁，再視需要抓詳情頁補齊資料。
- parser 需盡量抽出可穩定重跑嘅來源欄位，例如：
  - `item_id` / 原始商品 id
  - 商品名
  - 價格 / 原價
  - 商品連結
  - 主圖 / gallery
  - breadcrumb / category path
  - 清理後 description
- 預設略過 ended / 售完商品；只有顯式指定 `includeEnded` 先納入。

### 4) Import

- 同步 service 將 crawler 產生嘅記錄直接交畀 importer，唔需要先落磁碟再重讀。
- importer 繼續沿用現有 upsert 策略：
  - category：按既定 slug / 正規化 key upsert
  - product：按 product slug upsert
  - sku：按來源 SKU / item_id upsert
- 若 `records.length === 0`，仍回傳成功結果，但 import 統計為 0。

### 5) 回應結果

回傳統一 result payload，至少包括：

- `pagesRequested`
- `pagesFetched`
- `pageNumbers`
- `listItemsSeen`
- `recordsFetched`
- `batchSize`
- `debugJsonlPath`
- `import.categoriesUpserted`
- `import.productsUpserted`
- `import.skusUpserted`

## API 設計

### 1) Admin 手動同步

- Route：`POST /api/admin/catalog/mzakka-sync`
- 權限：`requirePermission('catalog:write')`
- 用途：由後台產品頁按鈕觸發
- Request body：可傳入同步參數覆寫預設值

預期回應：

- `200 OK`
- `{ ok: true, source: 'admin', result }`

失敗回應：

- `500`：crawler / importer / DB 失敗
- `500`：`DATABASE_URL` 未配置

### 2) Internal 自動同步

- Route：`GET` / `POST /api/internal/jobs/mzakka-sync`
- 驗證：
  - `x-sync-secret`
  - 或 `Authorization: Bearer <secret>`
- Secret 來源：
  - `MZAKKA_SYNC_SECRET`
  - `CRON_SECRET`（Vercel Cron）
- 用途：俾 Vercel Cron、GitHub Actions、外部 scheduler 等機制呼叫

預期回應：

- `200 OK`
- `{ ok: true, source: 'internal', result }`

失敗回應：

- `401`：secret 錯誤或缺失
- `503`：`MZAKKA_SYNC_SECRET` / `CRON_SECRET` 都未設定
- `500`：crawler / importer / DB 失敗

## 後台 UX

- 入口保留喺 `views/admin/products.ejs` 商品頁。
- `public/js/admin/products.js` 的同步按鈕流程維持簡潔：
  - click 後 disable 按鈕並顯示「同步中...」
  - 呼叫 admin sync API
  - 顯示摘要，例如「已抓取 X 件，更新商品 Y 件，SKU Z 筆」
  - 成功後重新載入商品列表
- 呢個頁面只負責人工觸發同顯示結果；唔承擔排程管理責任。

## 自動同步建議

- 生產環境新增：
  - `MZAKKA_SYNC_SECRET`（自定 scheduler / 手動 server-to-server 呼叫）
  - `CRON_SECRET`（Vercel Cron）
- 若使用 Vercel Cron，會以 `GET /api/internal/jobs/mzakka-sync` 觸發，並自動帶 bearer token。
- 若使用自定 scheduler，則可用 `POST /api/internal/jobs/mzakka-sync`。
- 建議初期頻率：
  - 每日 1 至 2 次
  - 先用 `pages=1`，避免對來源站造成不必要壓力
- 若之後觀察到新品更新頻密，再調整 pages / limit / frequency。

## 失敗處理

- 任何同步錯誤都應保留 server log，方便區分：
  - 來源站抓取失敗
  - parser 抽欄位失敗
  - importer / SQL 寫入失敗
  - 環境變數缺失
- `debugJsonlPath` 只用作診斷，不應成為 production 必須依賴。
- 當 DB 未配置時應立即 fail fast，避免誤以為「同步成功但前台無資料」。

## 驗收標準

### 自動化

- `test/mzakkaSync.test.js` 覆蓋：
  - option normalization
  - crawl 結果會交畀 importer
  - 0 records 時唔會硬調 importer
  - debug JSONL 會按要求寫出

### 手動

- 後台按「同步 M-ZAKKA 新品」後，API 回傳成功統計。
- Postgres `products` / `product_skus` 可見新增或更新紀錄。
- 前台商品 API / 商品列表可見同步後資料。
- internal route 以正確 secret 呼叫成功，錯 secret 會被拒絕。

## 部署需求

- 必須確認 production 已有：
  - `DATABASE_URL`
  - `CRON_SECRET`
- 如需非 Vercel scheduler 額外呼叫，可再加：
  - `MZAKKA_SYNC_SECRET`
- 若使用 Vercel：
  - production branch 部署完成後，再以 admin sync 或 internal sync 驗證一次
  - `vercel.json` 需包含 cron schedule 指向 internal route

## 風險與後續

- M-ZAKKA HTML 結構變動會直接影響 parser，需預留 smoke test / 小批量同步驗證。
- 若來源站反爬或限流，可能需要再加重試、proxy-aware fetch 或更保守 delay。
- 之後可擴充：
  - 後台顯示最近同步紀錄
  - 同步結果落表保存
  - 將 scheduler 配置正式納入基建
  - 針對 ended 商品加下架策略
