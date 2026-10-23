# 全站 UI 近乎 1:1 跟 mzakka.com（繁中文案）

## 目標

- 全站所有頁面（`/`、`/products`、`/product/:id`、`/cart`、`/login`、`/register`）版面結構與區塊排序「近乎 1:1」跟 `https://mzakka.com/`。
- UI 文案維持繁中（zh-HK）。分類名/商品名可照 DB（可能含日文），但**不在 template 靜態寫入日文 UI 字串**，以免觸發 repo 內現有 UI 文案測試規則。
- 首頁「ランキング」以 **最新上架（created_at DESC）** 實作。
- **使用 mzakka.com 圖片資產**以達成觀感 1:1：把圖片下載落 repo（`public/assets/mzakka/`），模板只引用本地路徑（唔 hotlink），確保本地/上線穩定。

## 非目標

- 不做像素級 100% 完全一致（容許字體、間距在 Tailwind 實作下有小差異）。
- 不做真正銷量排行（缺少訂單數據）；排行榜以最新上架替代。
- 不改動核心後端 API 行為（只調整頁面模板/資料 query/partials）。

## 現況要點（作為改造基礎）

- 全站已統一 include：`partials/header`、`partials/sidebar`、`partials/age-modal`、`partials/footer`。
- `/products`、`/product/:id` 已由 DB 讀取並分頁。
- 左邊【商品分類】已由 DB `categories` + count 提供（`res.locals.categories`），並加了短 TTL cache。
- 目前 header 仍屬「現代電商」樣式，未符合 mzakka「資訊密集」header + 超長分類列。
- 目前首頁仍以輪播+卡片為主，未符合 mzakka 的「大量活動 banner 長列 + 排行榜」。

## 目標版面拆解（以 mzakka.com 為參考）

## 資產策略（mzakka 圖片落地）

### 原則

- 圖片資產以「下載落 repo」為主：避免 hotlink 依賴原站可用性/防盜鏈策略變更。
- 模板內只寫本地路徑（例如 `/assets/mzakka/logo.png`），**唔**直接寫 `https://mzakka.com/...`。
- UI 文字維持繁中；圖片若含日文屬圖片內容，唔會觸發「模板內禁止日文 UI 字串」測試，但圖片的 `alt` 文字必須用繁中。

### 目錄約定

- `public/assets/mzakka/logo/`：logo、header 小 icon
- `public/assets/mzakka/banners/`：首頁 banner（主 banner、側邊小 banner、活動圖）
- `public/assets/mzakka/ui/`：footer bar 背景、分隔線、按鈕/小 icon（如有）

### 下載方式

- 提供一個 scripts 工具，從預先整理好的「URL 清單」下載並寫入上述目錄。
- 下載後以 `npm test` + 本地開頁驗收確保引用路徑正確。

### 1) Header（頂部兩段）

對齊 mzakka：
- **Top Utility Bar**（最上細字工具列）
  - 連結：購物車、注目商品、使用指南、常見問題、我的頁面、聯絡我們（繁中）
- **Main Header**（主 header）
  - 左：Logo（用 mzakka 圖片資產落地到 `public/assets/mzakka/logo/`）
  - 中：搜尋區（「分類下拉」+ keyword input + 搜尋按鈕）
  - 右：登入/註冊 或 會員狀態 + 購物車

實作方式：
- 以 `views/partials/header.ejs` 作單一來源，令所有頁面共用。
- Mobile：以折疊/簡化方式保持可用（不追求 1:1）。

### 2) 超長主分類列（Nav）

對齊 mzakka：一整行「全分類」橫向導覽，可左右滑動。
- 資料來源：`res.locals.categories`（DB categories + count）
- 行為：
  - 點擊分類 → `/products?category=<分類名>&page=1`
  - 顯示 count（可選）

### 3) 左邊【商品分類】側欄

保留並做得更像 mzakka：
- 密集列表、hover 行為、字級/行距接近 mzakka
- 資料來源：同上 `res.locals.categories`

### 4) 首頁（/）區塊排序

按 mzakka 觀感重排：
- **(a) 活動/公告 Banner 長列**
  - 以 mzakka 圖片 banner 做 1:1 版面（主 banner + 側邊小 banner + 多段活動圖）
  - 文案繁中；連結可指向 `/products` 或特定分類
  - 圖像來源：`public/assets/mzakka/banners/`（由下載腳本落地）
- **(b) ランキング（排行榜）— 以「最新上架」**
  - 顯示最新上架商品（預設 20 件）
  - 版面：列表式（圖 + 商品名 + 價格 + 連結），接近 mzakka ranking 區塊
  - 資料 query：`products WHERE status='active' ... ORDER BY created_at DESC LIMIT 20`
- **(c) 主題商品模組（2–3 段）**
  - 每段：標題（繁中）+ 商品列表（grid 或橫向列）
  - 資料來源：可用最新上架、或按熱門分類（以 count 高者）

### 5) 其他頁面

保持「同一套 header + nav + 左側欄」：
- `/products`：維持分頁與分類篩選
- `/product/:id`：顯示商品詳情 + 相關商品
- `/cart`、`/login`、`/register`：只調整版面框架與 header/nav 對齊（內容可先不大改）

## 資料與 query 規格

### categories（側欄/主 nav）
- 使用現有 `res.locals.categories`（含「全部商品」+ count）
- cache TTL 可保持 30 秒（本地測試更即時）

### ranking（最新上架）
- DB query 需要回傳 storefront 使用的字段：
  - `id`
  - `name_zh_hk as name`
  - `description_zh_hk as description`
  - `COALESCE(c.name_zh_hk, c.name) as category_name`
  - `price/original_price`（前端顯示以 cents 轉換）
  - `image_url`
  - `stock`（由 sku sum）

## 測試與驗收

### 自動化
- `npm test` 必須全綠
- 新增/更新的 UI 測試（node:test）：
  - 首頁包含「排行榜」區塊（以關鍵 heading 或 id/class 檢查）
  - header 含分類下拉 + 搜尋 input（以關鍵字/結構檢查）

### 手動驗收
- 開啟：
  - `/`：banner 長列 + 排行榜呈現，整體密度/排序接近 mzakka
  - `/products`：左側分類多個、可點擊篩選、分頁正常
  - `/product/:id`：仍可正常顯示商品
  - `/cart`、`/login`、`/register`：同一套 header/nav/側欄一致

## 風險與注意事項

- 圖片資產來源於原站，存在版權/合規風險；此規格假設使用者已知悉並接受此風險。
