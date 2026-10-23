# Admin Warehouses Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增 `/admin/warehouses` 倉庫管理頁（新增/停用/設為預設）+ 增強庫存調整會優先用預設倉庫。

**Architecture:** 以現有 `inventory_warehouses` 為主；增加 `is_default` 欄位並用 partial unique index 保證單一 default。API 延續放喺 `routes/products-full.js`。後台頁面用 EJS + 原生 JS（`AdminCommon.adminApiRequest`）。

**Tech Stack:** Node.js / Express / EJS / PostgreSQL / node:test

---

## File Map

**Create**
- `migrations/2026-05-04-inventory-warehouse-default.sql`
- `views/admin/warehouses.ejs`
- `public/js/admin/warehouses.js`
- `test/admin-warehouses-page.test.js`
- `test/admin-warehouses-api-wiring.test.js`
- `test/warehouse-default-migration.test.js`

**Modify**
- `routes/adminPages.js`
- `views/admin/layout.ejs`
- `routes/products-full.js`

---

### Task 1: Migration（is_default + unique index + seed default）

**Files:**
- Create: `migrations/2026-05-04-inventory-warehouse-default.sql`
- Test: `test/warehouse-default-migration.test.js`

- [ ] Write failing test → run `npm test` (expect FAIL)
- [ ] Add migration (idempotent) → run `npm test` (expect PASS)

---

### Task 2: API（warehouses update + make-default + adjust default selection）

**Files:**
- Modify: `routes/products-full.js`
- Test: `test/admin-warehouses-api-wiring.test.js`

- [ ] Write failing test (PUT + make-default + is_default ordering) → run `npm test` (FAIL)
- [ ] Implement:
  - `GET /api/admin/warehouses` 支援 `include_inactive=1`
  - `POST /api/admin/warehouses` 支援 `is_default`
  - `PUT /api/admin/warehouses/:id`
  - `POST /api/admin/warehouses/:id/make-default`
  - inventory adjust 無 warehouse_id 時 `ORDER BY is_default desc, id asc`
- [ ] Run `npm test` (PASS)

---

### Task 3: Admin UI（/admin/warehouses page + sidebar link + JS）

**Files:**
- Modify: `routes/adminPages.js`
- Modify: `views/admin/layout.ejs`
- Create: `views/admin/warehouses.ejs`
- Create: `public/js/admin/warehouses.js`
- Test: `test/admin-warehouses-page.test.js`

- [ ] Write failing test (page + nav link + JS wiring) → run `npm test` (FAIL)
- [ ] Implement page + nav + JS (no prompt; buttons use type=button) → run `npm test` (PASS)

