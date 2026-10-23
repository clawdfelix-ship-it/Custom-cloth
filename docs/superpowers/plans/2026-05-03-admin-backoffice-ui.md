# Admin Backoffice UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a deployable admin backoffice UI at `/admin/*` (EJS) with one-time `/admin/setup`, admin login/logout, and minimal usable pages that reuse existing `/api/admin/*` endpoints.

**Architecture:** Server renders a shared EJS layout (topbar + left nav + content shell). Each admin page loads a small JS module that fetches JSON from existing admin APIs using cookie session and renders tables/forms. Access is guarded by existing session-based `isAdmin` checks.

**Tech Stack:** Node.js + Express + EJS + node:test, existing session middleware, existing `/api/admin/*` routes.

---

## File map (create/modify)

**Create (views):**
- `views/admin/layout.ejs` (shared frame)
- `views/admin/login.ejs`
- `views/admin/setup.ejs`
- `views/admin/dashboard.ejs`
- `views/admin/orders.ejs`
- `views/admin/products.ejs`
- `views/admin/categories.ejs`
- `views/admin/users.ejs`

**Create (public JS/CSS):**
- `public/js/admin/common.js` (fetch helpers, DOM helpers)
- `public/js/admin/dashboard.js`
- `public/js/admin/orders.js`
- `public/js/admin/products.js`
- `public/js/admin/categories.js`
- `public/js/admin/users.js`
- `public/css/admin.css` (minimal)

**Create (backend):**
- `routes/adminPages.js` (GET/POST routes for `/admin/*` pages)
- `utils/adminBootstrap.js` (hasAdmin check, createFirstAdmin helper)

**Modify (backend wiring):**
- `app.js` (mount `/admin/*` pages router)

**Create/Modify tests:**
- `test/adminPages.test.js`

---

### Task 1: Admin bootstrap helpers (hasAdmin + createFirstAdmin)

**Files:**
- Create: `utils/adminBootstrap.js`
- Test: `test/adminPages.test.js`

- [ ] **Step 1: Write failing tests for bootstrap helpers**

```js
const test = require('node:test');
const assert = require('node:assert/strict');

test('adminBootstrap: hasAdmin queries users.is_admin', async () => {
  const { hasAdmin } = require('../utils/adminBootstrap');
  const calls = [];
  const fakePool = {
    query: async (sql) => {
      calls.push(sql);
      return { rows: [{ exists: true }] };
    },
  };
  const out = await hasAdmin(fakePool);
  assert.equal(out, true);
  assert.match(calls[0], /FROM\\s+users/i);
  assert.match(calls[0], /is_admin\\s*=\\s*true/i);
});

test('adminBootstrap: createFirstAdmin inserts admin user with bcrypt hash', async () => {
  const { createFirstAdmin } = require('../utils/adminBootstrap');
  const calls = [];
  const fakePool = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      if (/INSERT\\s+INTO\\s+users/i.test(sql)) return { rows: [{ id: 9, username: params[0], is_admin: true }] };
      return { rows: [] };
    },
  };
  const out = await createFirstAdmin(fakePool, { username: 'admin', password: 'admin123', contact: '' });
  assert.equal(out.id, 9);
  assert.equal(out.username, 'admin');
  assert.equal(out.is_admin, true);
  assert.match(String(calls[0].params[1]), /^\\$2b\\$/); // bcrypt hash
});
```

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test`  
Expected: FAIL with `Cannot find module '../utils/adminBootstrap'`

- [ ] **Step 3: Implement minimal helpers**

```js
// utils/adminBootstrap.js
const bcrypt = require('bcryptjs');

async function hasAdmin(pool) {
  const r = await pool.query(`SELECT EXISTS(SELECT 1 FROM users WHERE is_admin = true) AS exists`);
  return Boolean(r.rows && r.rows[0] && r.rows[0].exists);
}

async function createFirstAdmin(pool, { username, password, contact }) {
  const hash = await bcrypt.hash(String(password), 10);
  const r = await pool.query(
    `INSERT INTO users (username, password_hash, email, is_admin, contact, status)
     VALUES ($1, $2, $3, true, $4, 'active')
     RETURNING id, username, is_admin`,
    [String(username), hash, '', String(contact || '')]
  );
  return r.rows[0];
}

module.exports = { hasAdmin, createFirstAdmin };
```

- [ ] **Step 4: Run tests to verify GREEN**

Run: `npm test`  
Expected: PASS for the new tests

---

### Task 2: Add `/admin/setup` (one-time bootstrap page)

**Files:**
- Create: `routes/adminPages.js`
- Modify: `app.js`
- Create: `views/admin/setup.ejs`
- Modify: `public/css/admin.css`
- Test: `test/adminPages.test.js`

- [ ] **Step 1: Add failing test for setup gating behavior**

```js
const test = require('node:test');
const assert = require('node:assert/strict');

test('admin setup: blocks when admin already exists', async () => {
  const { setupEnabled } = require('../routes/adminPages');
  const out = await setupEnabled({ hasAdmin: async () => true });
  assert.equal(out, false);
});
```

- [ ] **Step 2: Verify test fails**

Run: `npm test`  
Expected: FAIL with `Cannot find module '../routes/adminPages'` or missing exports.

- [ ] **Step 3: Implement setup route + helpers (minimal)**

Implementation requirements:
- Export pure helper `setupEnabled({ hasAdmin })` for testability.
- `GET /admin/setup`: if `hasAdmin` true → 404; else render `views/admin/setup.ejs`.
- `POST /admin/setup`: if `hasAdmin` true → 404; else create admin via `createFirstAdmin`, then set session `userId/isAdmin`, redirect `/admin`.

Code skeleton:

```js
// routes/adminPages.js
const express = require('express');
const { getPool } = require('../db/pool');
const { hasAdmin, createFirstAdmin } = require('../utils/adminBootstrap');

function setupEnabled(deps) {
  return deps.hasAdmin().then(exists => !exists);
}

function createRouter() {
  const router = express.Router();

  router.get('/setup', async (req, res) => {
    const pool = getPool();
    if (await hasAdmin(pool)) return res.status(404).send('Not Found');
    res.render('admin/setup', { title: '後台初始化' });
  });

  router.post('/setup', async (req, res) => {
    const pool = getPool();
    if (await hasAdmin(pool)) return res.status(404).send('Not Found');
    const { username, password, contact } = req.body || {};
    const user = await createFirstAdmin(pool, { username, password, contact });
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.isAdmin = true;
    res.redirect('/admin');
  });

  return router;
}

module.exports = { createRouter, setupEnabled };
```

Mount in `app.js`:

```js
const adminPages = require('./routes/adminPages');
app.use('/admin', adminPages.createRouter());
```

- [ ] **Step 4: Add `views/admin/setup.ejs`**

EJS requirements:
- Minimal form: username/password/contact, POST to `/admin/setup`
- Use local CSS `public/css/admin.css`

- [ ] **Step 5: Run tests to verify GREEN**

Run: `npm test`

---

### Task 3: Add `/admin/login` + `/admin/logout` pages (session-based)

**Files:**
- Modify: `routes/adminPages.js`
- Create: `views/admin/login.ejs`
- Test: `test/adminPages.test.js`

- [ ] **Step 1: Write failing tests for login route helpers**

Add pure helpers (exported):
- `buildAdminSession(userRow)` → `{ userId, username, isAdmin, contact }`
- `isAdminSession(session)` → boolean

Test snippet:

```js
const test = require('node:test');
const assert = require('node:assert/strict');

test('adminPages: isAdminSession requires userId + isAdmin true', () => {
  const { isAdminSession } = require('../routes/adminPages');
  assert.equal(isAdminSession({ userId: 1, isAdmin: true }), true);
  assert.equal(isAdminSession({ userId: 1, isAdmin: false }), false);
  assert.equal(isAdminSession({}), false);
});
```

- [ ] **Step 2: Verify RED**

Run: `npm test` and see new test fail.

- [ ] **Step 3: Implement login/logout routes**

Implementation requirements:
- `GET /admin/login`: render login page.
- `POST /admin/login`: verify credentials using same logic as `/api/auth/login` (reuse functions or inline minimal: query user by username, bcrypt.compare, require `is_admin=true`). On success set session, redirect `/admin`.
- `POST /admin/logout`: `req.session.destroy(...)` then redirect `/admin/login`.

- [ ] **Step 4: Verify GREEN**

Run: `npm test`

---

### Task 4: Add protected admin layout + guard middleware

**Files:**
- Modify: `routes/adminPages.js`
- Create: `views/admin/layout.ejs`
- Create: `public/css/admin.css` (if not already)
- Test: `test/adminPages.test.js`

- [ ] **Step 1: Write failing test for guard behavior**

Add exported middleware factory:
- `requireAdminPage()` → middleware that redirects `/admin/login` when not admin

Test snippet:

```js
const test = require('node:test');
const assert = require('node:assert/strict');

test('requireAdminPage: redirects to /admin/login when not admin', async () => {
  const { requireAdminPage } = require('../routes/adminPages');
  const mw = requireAdminPage();
  let redirected = null;
  const req = { session: {} };
  const res = { redirect: (u) => (redirected = u) };
  await mw(req, res, () => {});
  assert.equal(redirected, '/admin/login');
});
```

- [ ] **Step 2: Verify RED**

Run: `npm test`

- [ ] **Step 3: Implement layout + guard + basic pages**

Implementation requirements:
- `views/admin/layout.ejs` accepts `active` menu key + `title` + `body` slot via include.
- Add left nav with links:
  - `/admin` `/admin/orders` `/admin/products` `/admin/categories` `/admin/users`
- Minimal styling in `public/css/admin.css`.

Routes (all guarded):
- `GET /admin` render `admin/dashboard`
- `GET /admin/orders` render `admin/orders`
- `GET /admin/products` render `admin/products`
- `GET /admin/categories` render `admin/categories`
- `GET /admin/users` render `admin/users`

- [ ] **Step 4: Verify GREEN**

Run: `npm test`

---

### Task 5: Add page JS modules that call existing admin APIs

**Files:**
- Create: `public/js/admin/common.js`
- Create: `public/js/admin/dashboard.js`
- Create: `public/js/admin/orders.js`
- Create: `public/js/admin/products.js`
- Create: `public/js/admin/categories.js`
- Create: `public/js/admin/users.js`
- Modify: each `views/admin/*.ejs` to include correct script

- [ ] **Step 1: Add minimal common fetch helper**

```js
// public/js/admin/common.js
export async function apiGet(path) {
  const r = await fetch(path, { headers: { 'Accept': 'application/json' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return await r.json();
}
```

- [ ] **Step 2: Implement dashboard.js**

Requirements:
- call `/api/admin/dashboard` and render JSON into a `<pre>` (first version).

- [ ] **Step 3: Implement orders/products/categories/users pages similarly**

First version per page:
- call a primary list endpoint and render into `<pre>` so it is usable immediately.
  - orders: `/api/admin/orders`
  - products: `/api/admin/products`
  - categories: `/api/admin/categories`
  - users: `/api/admin/users`

- [ ] **Step 4: Manual verification**

Run server and verify:
- Setup first admin → login → open `/admin` and see data in each page.

---

### Task 6: Refine pages to “minimal usable” tables/forms

**Files:**
- Modify: `public/js/admin/*.js`
- Modify: `views/admin/*.ejs`

- [ ] **Step 1: Orders table + status update**

Implementation:
- Render rows with order id, status, total, created_at.
- Provide a dropdown/select to update status; submit via existing endpoint (use `fetch` with method PUT).

- [ ] **Step 2: Categories CRUD**

Implementation:
- Render list.
- Add a small create form (name).
- Add delete button with confirm.

- [ ] **Step 3: Products minimal update**

Implementation:
- Render list.
- Provide a “toggle status” button (active/inactive) if endpoint exists; else keep read-only.

- [ ] **Step 4: Users create + set admin**

Implementation:
- Create form with `is_admin` checkbox.
- POST to `/api/admin/users`.

---

## Plan self-review

- Spec coverage:
  - `/admin/setup` one-time gating: Tasks 1-2 cover.
  - `/admin/login/logout`: Task 3 covers.
  - Protected pages + shared layout: Task 4 covers.
  - Reuse `/api/admin/*`: Tasks 5-6 cover.
  - Tests: Tasks 1-4 cover core behaviors.
- Placeholder scan: no TODO/TBD; each task includes concrete code/commands.
- Name/type consistency: sessions use `userId/isAdmin` consistent with existing app conventions.

