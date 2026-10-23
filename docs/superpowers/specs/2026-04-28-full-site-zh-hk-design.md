# 全站繁體中文（方案 B）設計文檔

**Goal**
- 全站（前台 + 後台 + API 對客提示）所有可見文案一律繁體中文
- 商品資料（商品名/描述/分類/標籤）亦必須繁體中文；未翻譯內容唔可以喺前台曝光

**Current State（現況）**
- EJS（[views/](file:///Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/views)）存在大量日文硬編文案（例如年齡確認/登入/搜尋/頁尾）
- JS 內存在英文技術錯誤訊息（例如圖片 proxy 參數校驗）
- 未有 i18n 架構：冇 `locales/` 字典、冇 `t()` 翻譯 helper、文案散落於各檔
- 商品資料來源有兩種：
  - DB（Postgres）routes 讀取（完整後台域）
  - jsonl/sample（示範/回退數據）讀取（[utils/productLoader.js](file:///Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/utils/productLoader.js)）

**Non-Goals（唔做嘅嘢）**
- 唔做多語切換（只固定繁中）
- 唔引入大型 i18n framework（保持輕量、易維護）

---

## 設計總覽

方案 B 核心係兩層：
1) **UI 文案層**：所有對客文案集中去 `locales/zh-HK.json`，EJS/路由層一律用 `t(key)` 渲染  
2) **商品內容層**：新增/統一「繁中欄位」，前台只渲染繁中欄位；任何缺翻譯商品一律視作「未上架」，唔出現於列表/搜尋/推薦

---

## 1) UI 文案層（EJS + API）

### 1.1 `t()` 翻譯 helper（Server-side）
- 加入 `locales/zh-HK.json`（key-value 字典，值為繁體中文）
- 新增一個 `t(key, params)` helper：
  - key 不存在時：回傳 key（方便快速發現漏翻）
  - 支援簡單插值（例如 `{count}`、`{amount}`）
- 將 `t` 掛到 `res.locals.t`，令所有 EJS 直接用 `<%= t('nav.login') %>`

### 1.2 EJS 介面改造原則
- `html lang` 固定 `zh-HK`
- `title/meta` 全部用 `t()` 或直接繁中
- 禁止硬編日文/英文對客文案；所有對客字串都要落 dictionary
- 允許技術 log（server 端 `console.error`）保持英文，但對客 response message 必須繁中

### 1.3 API 對客錯誤訊息
- 所有 JSON error message（`res.status(...).json({ error: ... })`）統一繁中
- 規範用語：
  - `需要登入`、`需要管理員權限`、`系統繁忙，請稍後再試`、`參數無效`

---

## 2) 商品內容層（全站繁中資料）

### 2.1 資料模型（推薦：DB 優先）
以 DB 為主時，兩個可落地做法：

**Option A（最快）：直接加欄位**
- `products.name_zh_hk`
- `products.description_zh_hk`
- `products.category_zh_hk`
- `products.brand_zh_hk`（如需要）

**Option B（更正規）：translation table**
- `product_translations(product_id, locale, name, description, category, brand, updated_at)`
- locale 固定 `zh-HK`

本專案先採用 Option A（欄位）作第一階段，因為實作範圍細、上線快；日後如要支援多語才遷移到 Option B。

### 2.2 前台展示規則（關鍵）
- **只展示有繁中內容嘅商品**
  - 列表頁：`name_zh_hk` 及 `category_zh_hk` 必須存在
  - 詳情頁：`name_zh_hk`、`description_zh_hk` 必須存在；否則 404 或 redirect（避免露出原文）
- 分類/導航一律使用 `*_zh_hk`
- 任何推薦/相關商品同樣套用相同過濾規則

### 2.3 jsonl/sample 數據（過渡期）
短期內仍然存在 jsonl/sample 回退數據，因此 loader 需要：
- 支援讀取以下欄位（如果存在）：
  - `name_zh_hk`, `description_zh_hk`, `category_zh_hk`
- 若 jsonl 只得日文內容：
  - 視作未翻譯，前台唔顯示（確保全站繁中）

### 2.4 翻譯營運流程（可持續）
提供「營運可以做」嘅翻譯補全方式：
- 後台匯出：輸出 CSV（product_id, 原文, zh_hk 欄位）
- 營運用 Excel 填翻譯後匯入：後台/腳本讀 CSV 更新 `*_zh_hk`
- 上架條件：繁中欄位齊先可以「上架」

---

## 3) 測試與驗收

### 3.1 自動測試
- 新增測試：渲染主要頁面時不應包含日文關鍵字（例如 `年齢確認`, `ログイン`, `検索`）
- 新增測試：商品渲染使用 `*_zh_hk`，缺翻譯則不出現於列表

### 3.2 人手驗收 Checklist
- 首頁/列表/詳情/登入/註冊/購物車：所有按鈕、提示、footer 均為繁中
- 網站 `view-source` 不再見到日文硬編 UI 文案
- 任意商品詳情頁唔會出現原文描述

---

## 4) 上線策略（避免半中半日）
- 先做 UI 字典化 + EJS 全面繁中（確保外觀一致）
- 再做商品資料層（加 zh_hk 欄位 + 前台過濾）
- 若現階段未有足夠翻譯商品：寧願前台商品數量少，都唔可以露出原文

