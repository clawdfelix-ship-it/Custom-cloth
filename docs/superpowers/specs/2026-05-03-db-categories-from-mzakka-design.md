# 左邊【商品分類】按 DB 顯示（由 MZAKKA breadcrumb 重建大分類）

## 目標

- 左邊側欄【商品分類】改為「真正按 Postgres DB 分類」顯示，而且分類數量係「大分類」（幾十個），唔會得 2 個。
- 產品列表 `/products` 以 `category_id` 篩選時要對應到呢批大分類。
- 本地測試優先：先做到分類顯示正確、可點擊、可篩選。

## 背景 / 問題成因

目前 `mzakka-clone/products-metadata.jsonl` 入面嘅 `category` 係由 scraper 用 regex 撈出「整個頁面所有 category link」，所以變成超長 menu，唔係真正 breadcrumb；導致匯入時只會落到 1–2 個 root 分類，左邊側欄就得 2 個。

但實測 MZAKKA 商品頁有 `<div id="breadcrumb">...</div>`，入面嘅 category link 才係「真 breadcrumb」。例如 `00T096` breadcrumb 會回到一串路徑，首段可用作大分類。

## 決策：用「大分類」粒度

大分類定義：
- 對每件產品，抓取 `breadcrumb` 內第一個分類文字作為該產品的大分類（例如：`アダルトグッズ実演販売`）。
- DB 只保存大分類（單層 categories），避免爆出上千個 leaf 分類令側欄太長。

## 實作方式（推薦）

新增一個「重建分類」腳本：

- 讀取 DB 裏面所有產品（以 `product_skus.sku` 反推出 MZAKKA item URL）
- 逐個抓頁（有 concurrency + delay + retries）
- 從 HTML 擷取 `<div id="breadcrumb">...</div>` 內嘅 category link 文字
- 選第一個分類做大分類 name
- `categories` 以 `sha1(name)` 生成穩定 slug（同現有 import 一致）
- Upsert categories（可重跑）
- 將 products.category_id 更新到新大分類
- 支援 resume：
  - 預設只處理目前 `category_id IN (1,3)`（即舊匯入嘅「新商品」同「未分類」），避免重覆跑已處理嘅產品
  - 提供 `--rebuild-all` 強制全部重跑

## 介面 / 參數

Script：`scripts/rebuild-categories-from-mzakka.js`

參數：
- `--limit N`：只處理 N 件（方便試跑）
- `--concurrency N`：同時抓取數
- `--delay-ms N`：每次 request 之間 delay
- `--rebuild-all`：忽略 resume 條件，全部產品都更新一次

輸出：
- JSON 統計：處理件數、成功/失敗、建立/更新分類數、更新產品數

## 驗收標準（本地）

- `/products` 左邊【商品分類】顯示多個分類（唔再得 2 個），每個分類旁邊 count 正確變動。
- 點擊任一分類：
  - URL 變成 `/products?category=<分類名>`
  - 中間商品列表會被篩選（總數下降）
- `npm test` 全綠。

## 非目標

- 不做中層/最細分類（只做大分類）
- 不重構前端 UI（只確保分類資料正確）

