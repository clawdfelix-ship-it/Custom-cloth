# Admin Bulk SKU CSV Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增 `/admin/bulk-skus`，支援下載模板 CSV + 上傳 CSV（dry-run → apply）批量更新 SKU 成本/售價/條碼/啟用/目標庫存（寫入庫存流水）。

**Architecture:** UI 用 EJS + 原生 JS。Upload 用既有 `multer`（由 `routes/admin.js` 已接收 `upload`）。CSV parsing 用自家簡易 parser（支援引號/逗號/換行），不加新 dependency。庫存更新用 transaction + `FOR UPDATE` + `inventory_transactions`。

**Tech Stack:** Node.js / Express / EJS / PostgreSQL / multer / node:test

---

## File Map

**Create**
- `views/admin/bulk-skus.ejs`
- `public/js/admin/bulk-skus.js`
- `test/admin-bulk-skus-page.test.js`
- `test/admin-bulk-skus-api-wiring.test.js`

**Modify**
- `routes/adminPages.js`
- `views/admin/layout.ejs`
- `routes/admin.js`

---

### Task 1: Admin page + sidebar link

**Files:**
- Modify: `routes/adminPages.js`
- Modify: `views/admin/layout.ejs`
- Create: `views/admin/bulk-skus.ejs`
- Create: `public/js/admin/bulk-skus.js`
- Test: `test/admin-bulk-skus-page.test.js`

- [ ] Step 1: 寫 failing test（page/nav/js 存在）
- [ ] Step 2: 加 `/admin/bulk-skus` route（active='bulk-skus'）
- [ ] Step 3: sidebar 加「批量更新」
- [ ] Step 4: 加 EJS + JS skeleton（JS 不用 prompt）
- [ ] Step 5: `npm test` 轉綠

---

### Task 2: Template CSV endpoint

**Files:**
- Modify: `routes/admin.js`
- Test: `test/admin-bulk-skus-api-wiring.test.js`

- [ ] Step 1: 寫 failing test（template endpoint exists + content-type/header）
- [ ] Step 2: 實作 `GET /api/admin/bulk-skus/template.csv`
- [ ] Step 3: `npm test` 轉綠

---

### Task 3: CSV import endpoint（dry-run + apply）

**Files:**
- Modify: `routes/admin.js`
- Test: `test/admin-bulk-skus-api-wiring.test.js`

- [ ] Step 1: 寫 failing test（import endpoint exists + uses upload.single）
- [ ] Step 2: 實作 `POST /api/admin/bulk-skus/import`
  - parse CSV
  - validate + row limit
  - dry-run 回 summary/errors
  - apply：transaction 內逐行 update（成本/售價/條碼/is_active）+ target_stock → delta → 寫流水
- [ ] Step 3: `npm test` 轉綠

---

### Task 4: 前端互動（download + upload dry-run + apply）

**Files:**
- Modify: `public/js/admin/bulk-skus.js`

- [ ] Step 1: 下載模板：`window.location.href = /api/admin/bulk-skus/template.csv`
- [ ] Step 2: 上傳：先 POST dry_run=1 顯示 summary/errors
- [ ] Step 3: 若無錯顯示「確認套用」按鈕，再 POST dry_run=0
- [ ] Step 4: `npm test` 全綠

