# 匯入全量 MZAKKA 商品資料到 Postgres（用原文暫代 zh-HK 欄位）

## 目標

- 將本機已有嘅全量 MZAKKA 商品資料匯入到本專案使用嘅 Postgres schema（`products` / `categories` / `product_skus`）。
- 讓現有 API（例如 `/api/products`）可以即時查到全量資料作本地功能測試。
- 因為原始資料主要係日文，為咗「先測功能」，**先用原文暫代 `*_zh_hk` 欄位**，確保 API filter（`name_zh_hk IS NOT NULL AND description_zh_hk IS NOT NULL`）可以正常回傳資料；之後再做正式翻譯覆蓋。

## 已確認的資料來源（本機）

- 全量產品 JSONL：`mzakka-clone/products-metadata.jsonl`
  - 每行一個 JSON object，包含：
    - `id`（例如 `00T096`）
    - `name`
    - `priceYen` / `originalPriceYen`
    - `description`（可能係空字串）
    - `category`（breadcrumb 字串，使用 ` > ` 分隔）
    - `images`（array）
    - `url`
    - `scrapedAt`
- 圖片檔案：`mzakka-clone/images/*`（本次匯入以 URL/圖片 proxy 為主，不會逐張寫入 DB blob）

## Schema 依賴（Postgres）

匯入前提：
- `categories`、`products`、`product_skus` 表已存在（可由 `schema.sql` / `schema-full.sql` 建立）。
- `products.slug` UNIQUE、`categories.slug` UNIQUE、`product_skus.sku` UNIQUE。
- `product_skus.attributes` NOT NULL。

## 欄位映射（mapping）

### Categories（只建立「主分類」層級）

`products-metadata.jsonl.category` 係超長 breadcrumb，包含大量重覆/排行/注目等分類路徑。為避免建立成千上萬分類、亦避免層級難以維護，今次先做「可測功能」版本：

- **主分類**：取 breadcrumb 第一段（`category.split(' > ')[0]`），例如：`新商品・新規取扱商品`
- `categories.name`：主分類原文
- `categories.name_zh_hk`：同 `name`（原文暫代）
- `categories.slug`：`mzakka-cat-<sha1(name)>`（確保唯一且不依賴拉丁字元 slugify）
- `categories.parent_id`：NULL（先做單層）
- `categories.status`：`active`

### Products

對每件產品：
- `products.name`：原始 `name`（可包含站名後綴；先不清理以保真）
- `products.name_zh_hk`：同 `name`（原文暫代）
- `products.slug`：`mzakka-<id.toLowerCase()>`（用原始 id 保證唯一）
- `products.description`：原始 `description`（空字串→NULL）
- `products.description_zh_hk`：若 `description` 為空，填入 `name`（確保 NOT NULL 需求滿足）
- `products.price`：`priceYen`（DECIMAL(10,2)，落庫為 `priceYen` 或 `priceYen.00`）
- `products.original_price`：`originalPriceYen`（如存在）
- `products.category_id`：指向上面建立/取得嘅主分類 `categories.id`
- `products.image_url`：`images[0]`（如有）
- `products.gallery_images`：`images` array（JSON）
- `products.status`：`active`

### Product SKU（保存原始 MZAKKA id）

因為 `products.id` 係 SERIAL，無法直接保存 `id: "00T096"` 作主鍵。為保留來源 ID：

- 為每個 product 建立一條 `product_skus`
  - `product_skus.product_id`：新建 product 的 id
  - `product_skus.sku`：原始 `id`（例如 `00T096`）
  - `product_skus.attributes`：`{}`（滿足 NOT NULL）
  - `product_skus.price`：可省略（沿用 products.price）
  - `product_skus.stock`：`0`（本次不處理存貨）

## 匯入策略（可靠 + 可重跑）

- 使用 Node.js script（stream 讀 JSONL），連接 Postgres（`DATABASE_URL`）。
- 以「batch」方式寫入（例如每 200 筆一批），降低單筆 query overhead。
- 以 `ON CONFLICT (slug) DO UPDATE` / `ON CONFLICT (sku) DO UPDATE` 令匯入可重跑：
  - Categories：以 `slug` 作 upsert key
  - Products：以 `slug` 作 upsert key
  - Product SKUs：以 `sku` 作 upsert key

## 驗收標準（本地）

- 匯入完成後：
  - `/api/products` 可以返回大量資料（唔再只係 sample）
  - 任意 `/api/products/:id`（用數字 SERIAL id）可取到 `name_zh_hk` / `description_zh_hk` 非空
- Script 輸出匯入統計：建立/更新咗幾多 category、product、sku。

## 非目標（今次唔做）

- 不做正式日文→繁中翻譯
- 不做 brand / tags / 層級分類全量建模（先以主分類支援功能測試）
- 不將 `mzakka-clone/images` 逐張寫入 DB（只存 URL，圖片交由現有 image proxy 解決）

