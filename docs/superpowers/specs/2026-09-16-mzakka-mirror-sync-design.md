# M-ZAKKA 全站鏡像同步與前台對齊設計稿

## 目標

- 將現有「只同步新品」提升為「同步 M-ZAKKA 全站主要資料」：
  - 全分類樹
  - 全產品與 SKU
  - 產品頁全文介紹
  - 商品情報表
  - 詳細圖庫
  - 首頁 banner / 廣告 / 活動模組
- 將首頁、分類頁、商品列表頁、產品頁改為使用本地資料渲染，但資訊結構、模組排序與互動層級盡量對齊 M-ZAKKA。
- 同步頻率定為**每星期一次**，不追求高頻即時同步，優先確保完整度、穩定度與可重跑。

## 非目標

- 不直接複製原站 HTML / CSS / JS 原始碼。
- 不做 pixel-perfect 保證；本次目標係「資訊架構、模組結構、主要版位與內容完整度對齊」。
- 不做分鐘級或每日多次同步。
- 不做完整 CMS 後台編輯器；本期以同步來源資料 + 基本覆寫能力為主。

## 現況

- 首頁目前使用硬編碼 `banners` 加最新商品列表 render：[app.js](file:///workspace/app.js#L503-L568)。
- 商品列表頁目前只食本地 `products` + `categories`，屬一般 catalog render，未有原站模組化概念：[app.js](file:///workspace/app.js#L570-L732)、[products.ejs](file:///workspace/views/products.ejs)。
- 商品詳情頁目前只有：
  - 基本圖片 gallery
  - 簡化價格 / 庫存
  - 單一 description 區塊
  - 相關商品
  並未保存「商品情報」原始模組與順序：[app.js](file:///workspace/app.js#L734-L840)、[product.ejs](file:///workspace/views/product.ejs)。
- 現有 M-ZAKKA 同步已可做到「爬取 -> 入 DB」，但仍以新品入口為主，資料模型不足以支援首頁模組與完整產品 detail modules。

## 設計原則

- 使用 `方案 C：混合鏡像`
  - 結構化資料用正規化 schema 保存。
  - 首頁模組與產品頁特殊區塊用模組表保存。
  - 前台全部由本地模板 render，不直接依賴原站 DOM。
- 保留原始抓取快照，方便 debug、比對與 parser 修正。
- 單個分類 / 商品 / 模組解析失敗，不應阻塞整批同步。

## 整體架構

### 1) 鏡像資料層

- `categories`
  - 補足來源欄位：`source`, `source_key`, `source_parent_key`, `sort_order`
  - 保存完整 root / child 分類樹
- `products`
  - 補足來源欄位：`source`, `source_key`, `source_url`, `sync_status`, `raw_payload`
  - 保留目前 storefront 會用到嘅核心欄位：名稱、價格、主圖、狀態、分類
- `product_skus`
  - 延續以來源 `item_id` / sku 作 dedupe key
- `mzakka_product_media`
  - 保存詳細圖庫、排序、alt / caption、媒體類型
- `mzakka_product_sections`
  - 保存產品頁各模組
  - 建議欄位：
    - `product_id`
    - `section_type`
    - `title`
    - `sort_order`
    - `content_html`
    - `content_text`
    - `content_json`
    - `source_anchor`
- `mzakka_home_modules`
  - 保存首頁 banner / 廣告 / 活動區塊 / 排行榜 / 特集
  - 建議欄位：
    - `module_key`
    - `module_type`
    - `title`
    - `subtitle`
    - `image_url`
    - `target_url`
    - `payload_json`
    - `sort_order`
    - `is_active`
- `mzakka_sync_snapshots`
  - 保存首頁、分類頁、產品頁原始 HTML / 解析後 JSON / 錯誤資訊

### 2) 鏡像渲染層

- 首頁改為讀 `mzakka_home_modules` + catalog 商品資料 render。
- 分類頁 / 商品列表頁改為讀完整分類樹與列表資料。
- 產品頁改為按 `mzakka_product_sections.sort_order` 組裝頁面，而唔再只顯示單一 description。

### 3) 同步控制層

- `全量鏡像同步`
  - 每星期一次
  - 由分類入口展開全站分類，再抓各分類列表與產品詳情
- `局部重跑`
  - 可按 category / product id / page module 手動重跑
- `錯誤重試`
  - 記錄失敗項目，支援後續 retry job

## 同步範圍

### 1) 全分類樹

- 不再只靠新品 breadcrumb 倒推。
- 直接抓 M-ZAKKA 分類入口與分類頁階層。
- 每個分類保存：
  - 來源 key
  - parent 關係
  - 標題
  - slug
  - 排序
  - 是否仍然有效

### 2) 全產品與 SKU

- 按分類逐頁抓列表，建立完整 catalog。
- `item_id` / SKU 作為 dedupe 主鍵。
- 支援下架標記，而唔係直接刪除資料。

### 3) 產品頁完整內容

- 同步以下內容：
  - 商品介紹全文
  - 商品情報表
  - 注意事項
  - 詳細圖片 / 說明圖
  - 其他 detail sections
- 每個 section 需帶 `sort_order`，前台按原站順序 render。

### 4) 首頁模組

- 同步以下模組：
  - 主 banner
  - 橫幅廣告
  - 側欄廣告
  - 排行榜
  - 注目商品
  - 特集 / 活動區塊
- 每個模組需保存：
  - 顯示位置
  - 排序
  - 圖片
  - 連結
  - 文案
  - 若模組包含商品清單，需保存商品 source keys 或 query 條件

## 前台頁面改造

### 1) 首頁

- 現有硬編碼 banner 改為資料驅動。
- 中央內容區改為模組式 render。
- 左右 sidebar 保留現有架構，但資料來源改為鏡像資料。

### 2) 分類頁 / 商品列表頁

- 顯示完整分類樹、目前分類上下文、列表排序、分頁。
- 版位與互動參考 M-ZAKKA，但仍由本地模板產出。

### 3) 產品頁

- 頂部基本商品資訊保留購物流程所需元素：
  - 圖片
  - 價格
  - 庫存
  - 加入購物車
- 下方內容由 `mzakka_product_sections` render：
  - 商品介紹
  - 商品情報
  - 圖文模組
  - 注意事項
  - 相關商品

## 同步頻率

- `每星期一次` 全量同步。
- 建議 cron：
  - `0 3 * * 1`（每星期一凌晨 3 點）
- 原因：
  - 用戶已確認唔需要太密。
  - 全量抓首頁 + 全分類 + 全產品 detail 成本較高，週更較符合穩定性。

## 分階段落地

### Phase 1：資料層完成

- 建表 / migration
- 全分類同步器
- 全產品列表同步器
- 產品 detail sections 同步器
- 首頁 modules 同步器
- 先唔改前台頁面

### Phase 2：首頁切換

- 首頁改為讀 `mzakka_home_modules`
- 保留現有頁框與 header / footer
- 驗證 banner、廣告、排行榜、活動模組完整度

### Phase 3：分類頁 / 列表頁切換

- 以鏡像分類樹與產品列表 render
- 驗證分類完整度、總商品數、分頁數

### Phase 4：產品頁切換

- 按 `mzakka_product_sections` render 詳細頁模組
- 驗證全文介紹、商品情報、圖片、模組排序

## 錯誤處理

- 單個產品失敗不影響整批 job。
- 單個首頁模組失敗時，保留上一版成功同步結果。
- 解析錯誤需寫入 `mzakka_sync_snapshots` 或 job log，方便抽樣檢查。
- 圖片抓取失敗時，保留原始遠端 URL 作 fallback。

## 風險

- 原站 DOM 變動會影響 parser，需要保留 raw snapshot 作快速修正。
- 首頁模組與產品 detail sections 可能存在非結構化內容，需允許 `content_html + content_json` 混合保存。
- 若要高度對齊原站版位，需小心避免直接複製原始模板與樣式資產；本期以本地重建方式實作。

## 驗收標準

### 資料層

- DB 內存在完整分類樹，而唔止 root category。
- 全站產品數量明顯高於新品入口同步結果。
- 抽樣 20 件產品，商品介紹、商品情報表、圖庫都存在。
- 首頁至少能同步主 banner、活動 banner、廣告區塊、排行榜 / 特集模組。

### 前台層

- 首頁主要模組順序與 M-ZAKKA 對齊。
- 分類頁 / 列表頁可按完整分類樹瀏覽。
- 產品頁可見完整商品介紹與商品情報區塊，而唔再係單一 description。

### 營運層

- 每星期 cron 可成功跑完整量同步。
- 同步失敗時不會清空現有前台內容。
- 可手動重跑單一類型同步（首頁 / 分類 / 產品 detail）。

## 推薦實作順序

- 先完成 schema + parser + sync jobs
- 再切首頁
- 再切分類 / 列表頁
- 最後切產品頁 detail modules

## 開發前補充

- 如後續需要更高相似度，可再加：
  - 模組級樣式 mapping
  - 後台覆寫 banner / 模組文案
  - 同步差異報表
