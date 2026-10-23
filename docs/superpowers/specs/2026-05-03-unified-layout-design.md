# 全站統一 Header + 左側【商品分類】版型（EJS Partials）

## 目標

- 全部前台頁面（`/`、`/products`、`/product/:id`、`/cart`、`/login`、`/register`）統一使用與首頁一致嘅：
  - 頂部 Menu Bar（Header）
  - 「☰ 商品分類」導航（Header 內）
  - 左邊側欄固定顯示【商品分類】

## 現況觀察

- 現時各頁面各自 hardcode header/footer/age modal，導致：
  - Header 細節不一致（例如購物車文字、搜尋 placeholder、登入/註冊顯示）
  - 部分頁面無「☰ 商品分類」導覽
  - 部分頁面無左側【商品分類】側欄
  - `/login`、`/register` 在部分情況下可能會因 template 變數缺失而顯示 Error

## 推薦方案（B）：EJS Partials 單一來源

### 核心原則

- 共用 UI 必須只有一份來源，避免改 UI 要同步改多個檔。
- 頁面只負責「內容區」；Header/Sidebar/Footer/Age Modal 由 partials 提供。

### 新增/調整的 Partials

- 既有：
  - `views/partials/header.ejs`：作為全站唯一 Header（含「☰ 商品分類」導航），所有頁面 include。
  - `views/partials/footer.ejs`：作為全站唯一 Footer，所有頁面 include。
- 新增：
  - `views/partials/sidebar.ejs`：全站左側欄，標題固定【商品分類】；清單由 `categories` 動態 loop 生成（避免 hardcode）。
  - `views/partials/age-modal.ejs`：全站年齡確認彈窗（內容用 `t()`，確保 zh-HK 一致）。

### 全站一致的版面骨架

所有頁面統一變成以下骨架：

1. `<%- include('partials/age-modal', ...) %>`
2. `<%- include('partials/header', ...) %>`
3. Wrapper：左 sidebar + 右 main content
   - 左：`<%- include('partials/sidebar', ...) %>`
   - 右：各頁面內容（原本 page 嘅主要內容區）
4. `<%- include('partials/footer', ...) %>`

## 資料注入（res.locals）

為確保所有頁面都可 render header/sidebar，而唔使每個 route 都手動傳入，會喺 `app.js` 增加一個 middleware，設定：

- `res.locals.user`
  - 由 session 推導（`userId`, `isAdmin`）
- `res.locals.categories`
  - 來源：現有 `getSampleCategories()` 或之後改為 DB 亦可
- `res.locals.formatPrice`（如需要）
- `res.locals.t` 已存在，保持不變

頁面 render 時仍可覆寫（例如 products page 傳入 `selectedCategory`）。

## Route 行為修正

- `/login`、`/register`：確保 render 時提供 `error`（預設 `null`），避免 template 讀取未定義變數導致頁面 Error。

## 驗收標準

- 任一頁面打開後：
  - 頂部 header 文字/按鈕/購物車呈現一致（同一個 partial）
  - 必定有「☰ 商品分類」導航
  - 必定有左側【商品分類】側欄
- `/login`、`/register` 可正常顯示（無 Error 頁）
- 本地瀏覽 `/`、`/products`、`/product/1`、`/cart`、`/login`、`/register` 版面一致

## 非目標（今次唔做）

- 不改 CSS/視覺設計風格（只做結構統一）
- 不引入新 template engine / layout library
- 不處理實際購物車/登入 API 流程（只確保頁面 UI 正常與一致）

