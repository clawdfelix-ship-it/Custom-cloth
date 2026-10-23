# 商品子分類（兩級分類）設計規格

## 目標

為「所有商品」補回子分類概念，後台商品編輯必須揀到子分類（葉子分類），並確保現有商品資料自動補齊，避免資料不一致。

## 範圍

### In Scope
- 使用 `categories.parent_id` 建立兩級分類：主分類 → 子分類。
- `products.category_id` 只存子分類（葉子分類）。
- 後台商品編輯頁新增「主分類/子分類」兩級選擇，並在商品列表顯示 `主分類 / 子分類`。
- 資料補齊：為每個主分類自動建立一個「其他」子分類；把目前指向主分類嘅商品批量改到該「其他」子分類。
- API 驗證：建立/更新商品時，若 `category_id` 不是葉子分類，回 400。

### Out of Scope（今次唔做）
- SKU（`product_skus`）管理 UI（新增/編輯 SKU、SKU 成本價/庫存）與後台頁面。
- 商品成本價欄位 UI（`products.cost_price`）與毛利/報表。

> 註：你最初提到「新增 SKU、成本價」，會建議拆下一個 spec/plan 單獨做，避免今次子分類改動同 SKU UI 打架。

## 現況觀察（Repo）
- `categories` 已有 `parent_id` 欄位（可直接用）。
- `products` 已有 `cost_price` 欄位；另有 `product_skus` 表（含 `sku`、`attributes`、`cost_price`、`stock` 等），但後台商品編輯目前只處理 `products` 本體欄位。
- 後台商品頁（`views/admin/products.ejs` + `public/js/admin/products.js`）目前只有一個分類下拉（`category_id`）。

## 資料模型與規則

### 分類層級
- **主分類**：`categories.parent_id IS NULL`
- **子分類**：`categories.parent_id = <主分類id>`
- 今次只支援兩級；不處理孫分類（第三級）。

### 商品分類儲存規則（強制）
- `products.category_id` 必須指向「子分類（葉子）」：
  - 子分類定義：`parent_id IS NOT NULL`
  - 葉子定義：該分類 **沒有任何 child**（`NOT EXISTS (SELECT 1 FROM categories c2 WHERE c2.parent_id = categories.id)`）

## Migration（資料補齊策略）

### 1) 建立「其他」子分類（按主分類逐個補）
- 對每個主分類：
  - 若已存在任何子分類：仍會建立「其他」子分類（如已存在則跳過），用作承接舊商品。
  - 若無子分類：建立「其他」子分類，之後後台可再逐步建立真子分類並搬商品。

### 2) 將舊商品由主分類搬到「其他」子分類
- 找出 `products.category_id` 指向主分類（`parent_id IS NULL`）嘅商品
- 更新到對應主分類底下嘅「其他」子分類 id

### 3) Slug/命名規則
- 子分類名稱（繁中）：`其他`
- slug：`<parent.slug>-other`
- 唯一性：若 slug 已存在，使用 `<parent.slug>-other-2`、`-3` 依序遞增（migration 內處理）

## API 改動（Admin products）

### `/api/admin/categories`
回傳需要包含：
- `id`
- `name_zh_hk/name`
- `slug`
- `parent_id`
- （可選）`sort_order`

### `/api/admin/products`（POST/PUT）
新增驗證：
- `category_id` 必須存在且為子分類葉子
- 若不符合：`400 { error: '請選擇子分類' }`

## 後台 UI（商品管理）

### 商品列表
- 顯示欄位「分類」改為：`主分類 / 子分類`
  - 如果資料未補齊（理論上 migration 後不會發生），顯示：`未設定`

### 商品編輯表單
新增兩級下拉：
- 主分類（只列 `parent_id IS NULL`）
- 子分類（依主分類動態列 `parent_id = 主分類id`）

行為：
- 編輯現有商品：會自動選中對應主/子分類。
- 主分類改變：子分類下拉重建；預設選第一個子分類（或空，若主分類未有子分類則提示先建立/使用「其他」）。
- 提交時只送 `category_id=子分類id`。

## 測試與驗收

### 單元/靜態測試（node:test）
- 驗證 products routes 有「子分類（葉子）校驗」字串/SQL（避免回退）。
- 驗證 migration 檔案存在並包含建立「其他」子分類及搬商品語句（避免漏做資料補齊）。

### 手動驗收
- 後台商品頁可選主分類→子分類；儲存成功。
- 如果強行送主分類 id 當 `category_id`，API 回 400。
- 跑完 migration 後，所有商品都能顯示 `主/子`，且不再存在商品指向主分類。

