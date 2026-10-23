# 全站統一 Header + 左側【商品分類】Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 全部前台分頁統一使用同一個 Header（含「☰ 商品分類」）以及左側【商品分類】側欄。

**Architecture:** 用 EJS partials 做單一來源（header/sidebar/footer/age modal），並用 `res.locals` 注入 `categories`、`user`、`formatPrice` 等共用資料，避免每個 route 重覆傳參。

**Tech Stack:** Node.js + Express + EJS + Tailwind CDN

---

## File Structure（會改/新增）

**Create**
- `views/partials/age-modal.ejs`：全站年齡確認彈窗
- `views/partials/sidebar.ejs`：全站左側【商品分類】側欄（用 `categories` loop）
- `docs/superpowers/plans/2026-05-03-unified-layout.md`：本 plan 文件（已新增）

**Modify**
- `app.js`：加入 `res.locals` middleware；修正 `/login`、`/register` render 參數
- `views/index.ejs`：改用 partials；保留首頁 layout；移除會觸發日文假名/片假名測試嘅字元
- `views/products.ejs`：改用 partials；加入左側欄；保留原本內容區
- `views/product.ejs`：改用 partials；加入左側欄；保留原本內容區
- `views/cart.ejs`：改用 partials；加入左側欄；保留原本內容區
- `views/login.ejs`：改用 partials；加入左側欄；保留原本內容區
- `views/register.ejs`：改用 partials；加入左側欄；保留原本內容區

---

### Task 1: 新增共用 Partials（age modal + sidebar）

**Files:**
- Create: `views/partials/age-modal.ejs`
- Create: `views/partials/sidebar.ejs`

- [ ] **Step 1: 建立 `age-modal.ejs`**

要求：
- 使用現有 i18n keys（`t('age.title')`, `t('age.desc')`, `t('common.yes')`, `t('common.no')`）
- 使用現時首頁同款 modal 結構（hidden/顯示用 localStorage `ageVerified`）

- [ ] **Step 2: 建立 `sidebar.ejs`**

要求：
- 顯示標題【商品分類】
- `categories` 由 `res.locals.categories` 提供，按 `cat.name` link 去 `/products?category=...`
- 保留首頁左側 sidebar + ad 的整體風格（不要求逐字一樣）

---

### Task 2: 在 `app.js` 注入共用 locals + 修正 login/register render

**Files:**
- Modify: `app.js`

- [ ] **Step 1: 加入 middleware 設定 `res.locals.user`、`res.locals.categories`、`res.locals.formatPrice`**
- [ ] **Step 2: `/login`、`/register` render 時傳入 `error: null`**
- [ ] **Step 3: 跑 `npm test` 確認唔會再出現 login/register Error 頁**

---

### Task 3: 全站 views 改用 partials 並加入左側欄

**Files:**
- Modify: `views/index.ejs`
- Modify: `views/products.ejs`
- Modify: `views/product.ejs`
- Modify: `views/cart.ejs`
- Modify: `views/login.ejs`
- Modify: `views/register.ejs`

- [ ] **Step 1: 每頁 include `partials/age-modal` + `partials/header`**
- [ ] **Step 2: 每頁使用首頁 wrapper（`#wrapper`）並 include `partials/sidebar`**
- [ ] **Step 3: 每頁 include `partials/footer`（如原本 footer 係 hardcode，就替換）**
- [ ] **Step 4: 移除 views 中任何會匹配 `/[\\u3040-\\u30ff]/` 嘅字元（例如 `・`）**

---

### Task 4: 驗證（本地 + 測試）

**Files:**
- Test: `test/*.test.js`（既有）

- [ ] **Step 1: Run tests**

Run:
```bash
npm test
```
Expected: 全部 PASS

- [ ] **Step 2: 本地人工驗證**

打開：
- `http://localhost:3000/`
- `http://localhost:3000/products`
- `http://localhost:3000/product/1`
- `http://localhost:3000/cart`
- `http://localhost:3000/login`
- `http://localhost:3000/register`

Expected:
- 每頁都有同款 header（含「☰ 商品分類」）
- 每頁都有左側【商品分類】側欄

