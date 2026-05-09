# REF 兩頁系統（雲端 DB 同步）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 將 REF 的兩頁系統（後台全功能 + 客戶端新單/翻單/查單）雲端化：所有資料由 localStorage 轉為 Vercel Postgres，並提供帳密登入（admin/factory 角色）與完整後台/工廠端/POPI 功能。

**Architecture:** 兩個 HTML（`admin.html` / `index.html`）維持 REF UI 結構與 `switchPage()` 互動，將資料存取抽成 API client；後端以 Vercel Functions 提供 CRUD + Auth + Session + 權限校驗；DB 以 Postgres 為單一資料來源。

**Tech Stack:** Static HTML + inline JS/CSS（維持 REF 風格）、Vercel Functions (Node.js, CommonJS)、Postgres（Vercel/Neon integration）、Node built-in test runner (`node --test`)

---

## Scope Note（分段上線建議）

Spec 要求「全部模組 V1」，但整套後台 + 工廠端 + PO/PI + 款式/尺碼庫 + 客戶端三 tab + 雲端 Auth 涉及多個子系統。為降低風險，本 plan 將工作拆成可獨立交付的任務段：

1) Auth + 基礎資料（users/sessions）  
2) 尺碼表庫 + 款式庫（含圖片 base64）  
3) 客戶端（新單/翻單/查單）  
4) 訂單管理（後台）+ 一鍵翻單  
5) 工廠端（factory role）+ 異常反饋  
6) PO/PI（前端生成 + 打印）  

每段完成都可部署驗證，最終合併成「全部都要」。

---

## File Map

**Create (Backend)**

- `api/auth/login.js`
- `api/auth/logout.js`
- `api/public/styles.js`
- `api/public/size-tables/[id].js`
- `api/public/orders.js`
- `api/public/orders/history.js`
- `api/public/orders/status.js`
- `api/admin/users.js`
- `api/admin/size-tables.js`
- `api/admin/styles.js`
- `api/admin/orders.js`
- `api/admin/orders/status.js`
- `api/admin/orders/copy.js`
- `api/admin/feedback.js`
- `api/admin/feedback/status.js`
- `api/factory/orders.js`
- `api/factory/orders/[id].js`
- `api/factory/orders/status.js`
- `api/factory/feedback.js`

**Create (Shared Lib)**

- `src/lib/db.js`
- `src/lib/http.js`
- `src/lib/auth.js` (extend existing)
- `src/lib/password.js`
- `src/lib/schema.js`
- `src/lib/hk-date.js` (reuse existing)
- `src/lib/validation.js` (extend existing)
- `src/lib/ref-mappers.js`

**Create (SQL)**

- `db/schema.sql`
- `db/seed.sql`

**Create (Tests)**

- `tests/password.test.js`
- `tests/schema.test.js`
- `tests/ref-mappers.test.js`
- `tests/auth-guard.test.js`

**Modify (Frontend)**

- `admin.html`（改成 REF 後台 UI + API 讀寫 + 帳密登入 + role menu）
- `index.html`（重建成 REF 客戶端 UI：新單/翻單/查單 + API 讀寫）

**Keep**

- `REF/Code_20260509.html`（只作對照；不直接部署）
- `REF/Code_20260509_custom.html`（現為截斷檔；不直接部署）

---

## Task 0: 依賴檢查與決策凍結

**Files:**
- Modify: `package.json` (if needed)

- [ ] **Step 1: 確認 Node 版本與測試可跑**

Run:

```bash
npm test
```

Expected: PASS

- [ ] **Step 2: 確認密碼 hash library**

Prefer `bcryptjs`（純 JS，免 native build），如 repo 無依賴則加入：

```bash
npm install bcryptjs
```

Expected: 安裝成功無 native build error

---

## Task 1: DB Schema（REF localStorage → Postgres）

**Files:**
- Create: `db/schema.sql`
- Create: `db/seed.sql`
- Test: `tests/schema.test.js`

- [ ] **Step 1: 建立 schema.sql**

```sql
create extension if not exists "uuid-ossp";

create table if not exists users (
  id uuid primary key default uuid_generate_v4(),
  acc text unique not null,
  pwd_hash text not null,
  role text not null,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  token text primary key,
  user_id uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists size_tables (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists styles (
  id uuid primary key default uuid_generate_v4(),
  code text not null,
  name text not null,
  cate1 text not null,
  cate2 text not null,
  size_table_id uuid not null references size_tables(id),
  img_base64 text,
  remark text,
  created_at timestamptz not null default now()
);

create table if not exists customers (
  id uuid primary key default uuid_generate_v4(),
  company_name text not null,
  contact_name text,
  phone text not null,
  created_at timestamptz not null default now(),
  unique (company_name, phone)
);

create table if not exists orders (
  id uuid primary key default uuid_generate_v4(),
  order_sn text unique not null,
  customer_id uuid not null references customers(id),
  cust_name text not null,
  cust_contact text,
  cust_phone text not null,
  cate1 text not null,
  cate2 text not null,
  factory_name text,
  order_type text not null,
  status text not null,
  amount text,
  remark text,
  create_time timestamptz not null default now(),
  requested_delivery_date date,
  suggested_delivery_date date,
  source_order_id uuid references orders(id)
);

create table if not exists order_items (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references orders(id) on delete cascade,
  style_id uuid not null references styles(id),
  qty jsonb not null
);

create table if not exists feedback (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references orders(id) on delete cascade,
  order_sn text not null,
  factory_name text not null,
  content text not null,
  status text not null,
  create_time timestamptz not null default now()
);

create index if not exists idx_orders_created_time on orders(create_time desc);
create index if not exists idx_orders_phone on orders(cust_phone);
create index if not exists idx_orders_factory on orders(factory_name);
create index if not exists idx_feedback_factory on feedback(factory_name);
```

- [ ] **Step 2: 建立 seed.sql（最少 admin + demo factory + demo 尺碼表/款式）**

```sql
insert into users (acc, pwd_hash, role, name)
values
  ('admin', '$2a$10$REPLACE_WITH_BCRYPT_HASH', 'admin', '管理員'),
  ('factory1', '$2a$10$REPLACE_WITH_BCRYPT_HASH', 'factory', '測試工廠')
on conflict (acc) do nothing;
```

執行 seed 前，需要先用 Node script 生成 hash（見 Task 2）。

- [ ] **Step 3: schema.test.js（只驗證 JSON 結構 mapping helper，不直接連 DB）**

```js
const test = require('node:test');
const assert = require('node:assert/strict');

test('schema.sql contains required tables', async () => {
  const fs = require('node:fs/promises');
  const sql = await fs.readFile('db/schema.sql', 'utf8');
  for (const t of ['users', 'sessions', 'size_tables', 'styles', 'customers', 'orders', 'order_items', 'feedback']) {
    assert.match(sql, new RegExp(`create table if not exists\\s+${t}\\b`, 'i'));
  }
});
```

- [ ] **Step 4: 跑測試**

Run:

```bash
node --test tests/schema.test.js
```

Expected: PASS

---

## Task 2: 密碼 Hash + Session Token（Auth 基礎）— TDD

**Files:**
- Create: `src/lib/password.js`
- Modify: `package.json` (add bcryptjs)
- Test: `tests/password.test.js`

- [ ] **Step 1: 寫 failing test（password.test.js）**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { hashPassword, verifyPassword } = require('../src/lib/password');

test('hashPassword + verifyPassword roundtrip', async () => {
  const hash = await hashPassword('123456');
  assert.equal(typeof hash, 'string');
  assert.equal(await verifyPassword('123456', hash), true);
  assert.equal(await verifyPassword('wrong', hash), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test tests/password.test.js
```

Expected: FAIL（module not found）

- [ ] **Step 3: 實作 password.js（最小）**

```js
const bcrypt = require('bcryptjs');

async function hashPassword(plain) {
  const s = String(plain || '');
  if (!s) throw new Error('password required');
  return bcrypt.hash(s, 10);
}

async function verifyPassword(plain, hash) {
  const p = String(plain || '');
  const h = String(hash || '');
  if (!p || !h) return false;
  return bcrypt.compare(p, h);
}

module.exports = { hashPassword, verifyPassword };
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test
```

Expected: PASS

- [ ] **Step 5: 生成 seed 用 hash**

Run:

```bash
node -e "require('./src/lib/password').hashPassword('123456').then(console.log)"
```

Expected: 輸出 bcrypt hash；把結果貼入 `db/seed.sql` 兩行 `REPLACE_WITH_BCRYPT_HASH`

---

## Task 3: DB access layer（統一 sql + 防止散落）— TDD

**Files:**
- Create: `src/lib/db.js`
- Test: `tests/auth-guard.test.js` (later reuse)

- [ ] **Step 1: 建立 db.js（只包裝 @vercel/postgres sql）**

```js
const { sql } = require('@vercel/postgres');

module.exports = { sql };
```

---

## Task 4: Auth API（login/logout）+ guard helpers — TDD

**Files:**
- Create: `src/lib/http.js`
- Modify: `src/lib/auth.js`
- Create: `src/lib/schema.js`
- Create: `api/auth/login.js`
- Create: `api/auth/logout.js`
- Test: `tests/auth-guard.test.js`

- [ ] **Step 1: http.js（sendJson/readBody）**

```js
function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
}

module.exports = { sendJson, readBody };
```

- [ ] **Step 2: schema.js（允許值集中）**

```js
const ROLES = ['admin', 'factory'];
const ORDER_STATUS_ADMIN = ['客戶已提交', '待確認報價', '待確認樣板', '生產中', '已出貨', '已完成', '已取消'];
const FEEDBACK_STATUS = ['待處理', '已處理'];

module.exports = { ROLES, ORDER_STATUS_ADMIN, FEEDBACK_STATUS };
```

- [ ] **Step 3: 擴充 auth.js（session 取 user）**

新增：

```js
const crypto = require('node:crypto');
const { sql } = require('./db');
const { getBearerToken } = require('./auth');

function newToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function requireSession(req, res) {
  const token = getBearerToken(req.headers.authorization);
  if (!token) return null;
  const r = await sql`
    select s.token, s.expires_at, u.id as user_id, u.acc, u.role, u.name
    from sessions s
    join users u on u.id = s.user_id
    where s.token = ${token}
  `;
  const row = r.rows[0];
  if (!row) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) return null;
  return { token: row.token, userId: row.user_id, acc: row.acc, role: row.role, name: row.name };
}
```

並 export `newToken` / `requireSession`。

- [ ] **Step 4: auth-guard.test.js（只測 getBearerToken/newToken 不碰 DB）**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { newToken } = require('../src/lib/auth');

test('newToken returns hex string', () => {
  const t = newToken();
  assert.equal(typeof t, 'string');
  assert.ok(t.length >= 32);
});
```

- [ ] **Step 5: api/auth/login.js**

```js
const { sql } = require('../../src/lib/db');
const { sendJson, readBody } = require('../../src/lib/http');
const { verifyPassword } = require('../../src/lib/password');
const { newToken } = require('../../src/lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });

  try {
    const raw = await readBody(req);
    const body = raw ? JSON.parse(raw) : {};
    const acc = typeof body.acc === 'string' ? body.acc.trim() : '';
    const pwd = typeof body.pwd === 'string' ? body.pwd : '';
    if (!acc || !pwd) return sendJson(res, 400, { ok: false, error: 'bad_request' });

    const r = await sql`select id, acc, pwd_hash, role, name from users where acc = ${acc}`;
    const u = r.rows[0];
    if (!u) return sendJson(res, 401, { ok: false, error: 'invalid_credentials' });
    const ok = await verifyPassword(pwd, u.pwd_hash);
    if (!ok) return sendJson(res, 401, { ok: false, error: 'invalid_credentials' });

    const token = newToken();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 12).toISOString();
    await sql`insert into sessions (token, user_id, expires_at) values (${token}, ${u.id}, ${expiresAt})`;

    return sendJson(res, 200, { ok: true, token, role: u.role, name: u.name });
  } catch (e) {
    return sendJson(res, 400, { ok: false, error: 'bad_request' });
  }
};
```

- [ ] **Step 6: api/auth/logout.js**

```js
const { sql } = require('../../src/lib/db');
const { sendJson } = require('../../src/lib/http');
const { getBearerToken } = require('../../src/lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  const token = getBearerToken(req.headers.authorization);
  if (token) await sql`delete from sessions where token = ${token}`;
  return sendJson(res, 200, { ok: true });
};
```

- [ ] **Step 7: 跑全測試**

Run:

```bash
npm test
```

Expected: PASS

---

## Task 5: 公開資料 API（款式/尺碼表）— TDD（最小）

**Files:**
- Create: `api/public/styles.js`
- Create: `api/public/size-tables/[id].js`
- Create: `src/lib/ref-mappers.js`
- Test: `tests/ref-mappers.test.js`

- [ ] **Step 1: ref-mappers.test.js**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeQtyJson } = require('../src/lib/ref-mappers');

test('normalizeQtyJson returns 6-size object', () => {
  assert.deepEqual(normalizeQtyJson({ S: 1, M: 2 }), { S: 1, M: 2, L: 0, XL: 0, '2XL': 0, '3XL': 0 });
});
```

- [ ] **Step 2: ref-mappers.js（最小）**

```js
function normalizeQtyJson(qty) {
  const q = qty && typeof qty === 'object' ? qty : {};
  return {
    S: Number(q.S || 0),
    M: Number(q.M || 0),
    L: Number(q.L || 0),
    XL: Number(q.XL || 0),
    '2XL': Number(q['2XL'] || q.XL2 || 0),
    '3XL': Number(q['3XL'] || q.XL3 || 0)
  };
}

module.exports = { normalizeQtyJson };
```

- [ ] **Step 3: /api/public/styles**

```js
const { sql } = require('../../src/lib/db');
const { sendJson } = require('../../src/lib/http');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  const url = new URL(req.url, 'http://localhost');
  const cate1 = (url.searchParams.get('cate1') || '').trim();
  const cate2 = (url.searchParams.get('cate2') || '').trim();

  const r = await sql`
    select s.id, s.code, s.name, s.cate1, s.cate2, s.size_table_id, s.img_base64, s.remark, st.name as size_table_name
    from styles s
    join size_tables st on st.id = s.size_table_id
    where (${cate1} = '' or s.cate1 = ${cate1})
      and (${cate2} = '' or s.cate2 = ${cate2})
    order by s.created_at desc
    limit 200
  `;

  const styles = r.rows.map((x) => ({
    id: x.id,
    code: x.code,
    name: x.name,
    cate1: x.cate1,
    cate2: x.cate2,
    sizeTableId: x.size_table_id,
    sizeTableName: x.size_table_name,
    imgBase64: x.img_base64 || '',
    remark: x.remark || ''
  }));

  return sendJson(res, 200, { ok: true, styles });
};
```

- [ ] **Step 4: /api/public/size-tables/[id]**

```js
const { sql } = require('../../../src/lib/db');
const { sendJson } = require('../../../src/lib/http');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  const id = req.query && req.query.id ? String(req.query.id) : '';
  if (!id) return sendJson(res, 400, { ok: false, error: 'id_required' });
  const r = await sql`select id, name, data from size_tables where id = ${id}::uuid`;
  const row = r.rows[0];
  if (!row) return sendJson(res, 404, { ok: false, error: 'not_found' });
  return sendJson(res, 200, { ok: true, sizeTable: { id: row.id, name: row.name, data: row.data } });
};
```

Note: Vercel dynamic route 參數取得方式需按實際 runtime（本 plan 假設 `req.query.id` 可用；實作時若環境不同，改用 `new URL(req.url, ...)` 解析 path segment）。

- [ ] **Step 5: 跑測試**

Run:

```bash
npm test
```

Expected: PASS

---

## Task 6: 客戶端（重建 REF custom：新單/翻單/查單）

**Files:**
- Modify: `index.html`

- [ ] **Step 1: 以 REF UI 風格重建 index.html（完整三 tab）**

重點：

- Tab: 新單 / 翻單 / 查單
- 新單：選 cate1/cate2 → styles list（含圖片）→ 顯示 size table → 填 qty → 填公司名/聯絡人/電話/地址/交貨日 → submit
- 翻單：公司名 + 電話 → call history → 點選一張 order 帶入 style/qty/尺碼表
- 查單：訂單編號 + 電話 → call status → 顯示狀態

API 使用：

- `GET /api/public/styles?cate1=&cate2=`
- `GET /api/public/size-tables/:id`
- `POST /api/public/orders`
- `GET /api/public/orders/history?companyName=&phone=`
- `GET /api/public/orders/status?orderSn=&phone=`

---

## Task 7: 客戶端 Orders API（public/orders + history + status）

**Files:**
- Create: `api/public/orders.js`
- Create: `api/public/orders/history.js`
- Create: `api/public/orders/status.js`
- Modify: `src/lib/validation.js`
- Modify: `src/lib/hk-date.js` (if need 31/17 business-day helper)

- [ ] **Step 1: 擴充 validation（qty 6 尺碼）**

Add:

```js
function requiredQtyJson(v) {
  if (!v || typeof v !== 'object') throw new Error('qty required');
  const keys = ['S', 'M', 'L', 'XL', '2XL', '3XL'];
  const out = {};
  for (const k of keys) {
    const n = Number(v[k] || 0);
    if (!Number.isFinite(n) || n < 0) throw new Error('qty invalid');
    out[k] = n;
  }
  if (Object.values(out).reduce((a, b) => a + b, 0) <= 0) throw new Error('qty empty');
  return out;
}
```

- [ ] **Step 2: `POST /api/public/orders`**

行為：

- upsert `customers` by `(company_name, phone)`
- 計算 `suggested_delivery_date`（新單=31 工作日；翻單=17 工作日）
- 驗證 requested >= suggested
- 產生 `order_sn`（格式先用 `ORD` + timestamp，例如 `ORD20260509123456`）
- insert `orders` + `order_items`
- 回傳 `orderSn` + `suggestedDeliveryDate` + `status`

- [ ] **Step 3: `GET /api/public/orders/history`（公司名+電話）**

- 查 `orders` where `cust_name` + `cust_phone` match
- 回傳最近 50 張（含 items/款式/qty）

- [ ] **Step 4: `GET /api/public/orders/status`（訂單號+電話）**

- 查 `orders` where `order_sn` + `cust_phone` match
- 回傳 status + delivery dates + 摘要

- [ ] **Step 5: 跑測試**

Run:

```bash
npm test
```

Expected: PASS

---

## Task 8: 後台（重構 REF admin：localStorage → API、登入、角色顯示）

**Files:**
- Modify: `admin.html`

- [ ] **Step 1: 改造登入流程**

- 移除硬編碼 `admin/123456` 作為固定值；保留預填僅作便利（可選）
- `login()` 改 call `POST /api/auth/login`
- 成功後存 `sessionStorage.token`、`sessionStorage.role`、`sessionStorage.name`

- [ ] **Step 2: role-based menu**

- admin：顯示全部 sidebar
- factory：只顯示工廠端（factoryHome/factoryOrderDetail）與登出

- [ ] **Step 3: 將 KEY_* localStorage 全面替換為 API client**

對應映射（從 REF code 抽象）：

- users → `/api/admin/users`
- size tables → `/api/admin/size-tables`
- styles → `/api/admin/styles`
- orders → `/api/admin/orders` / `/api/admin/orders/status` / `/api/admin/orders/copy`
- feedback → `/api/admin/feedback` / `/api/admin/feedback/status`
- factory view → `/api/factory/...`

---

## Task 9: 後台 API（admin CRUD：users/size-tables/styles/orders/feedback）

**Files:**
- Create: `api/admin/users.js`
- Create: `api/admin/size-tables.js`
- Create: `api/admin/styles.js`
- Create: `api/admin/orders.js`
- Create: `api/admin/orders/status.js`
- Create: `api/admin/orders/copy.js`
- Create: `api/admin/feedback.js`
- Create: `api/admin/feedback/status.js`

- [ ] **Step 1: 寫 guard helper（requireSession + requireRole）**

新增到 `src/lib/auth.js`：

```js
function requireRole(session, role) {
  return session && session.role === role;
}
```

實作每個 admin endpoint：

- 先 `requireSession`
- 驗證 role=admin

- [ ] **Step 2: users CRUD（只允許 admin）**

- list factory users
- create factory user（hash pwd）
- delete factory user

- [ ] **Step 3: size-tables CRUD（list/create/delete）**

body data 結構沿用 REF（6 尺碼欄位）

- [ ] **Step 4: styles CRUD（list/create/delete）**

- 圖片 base64：限制大小；後端驗證 base64 字串長度上限

- [ ] **Step 5: orders**

- list + filters（訂單號/公司/電話/狀態/分類/交貨日）
- create（手動新建）
- update status
- copy（建立翻單：source_order_id 指向原單；並把 items/qty 複製）

- [ ] **Step 6: feedback**

- list
- update status（待處理/已處理）

---

## Task 10: 工廠端 API（factory role）

**Files:**
- Create: `api/factory/orders.js`
- Create: `api/factory/orders/[id].js`
- Create: `api/factory/orders/status.js`
- Create: `api/factory/feedback.js`

- [ ] **Step 1: guard（requireSession role=factory）**

- factory 只允許查 `orders.factory_name = session.name`

- [ ] **Step 2: orders list/detail/status update**

- list 最近訂單
- detail 連 items/款式/尺碼表
- status update（生產進度）

- [ ] **Step 3: feedback create**

- 建立 feedback 記錄（status=待處理）

---

## Task 11: PO/PI（前端生成 + 打印）

**Files:**
- Modify: `admin.html`

- [ ] **Step 1: 保留 REF 的 PO/PI UI 與打印樣式**

- 訂單 select 改為從 `/api/admin/orders` 取得
- 生成內容仍由前端組合（V1 不存 DB）

---

## Task 12: 本機與線上驗證

**Files:**
- (none)

- [ ] **Step 1: 跑測試**

Run:

```bash
npm test
```

Expected: PASS

- [ ] **Step 2: 部署前必要環境變數**

Vercel Project Settings:

- `POSTGRES_URL`（integration 提供）

- [ ] **Step 3: 初始化 DB**

在 Postgres console 跑 `db/schema.sql`，再跑 `db/seed.sql`

- [ ] **Step 4: E2E 手動驗收（線上）**

- 客戶端新單：能選分類/款式/填 qty，提交成功並得到 orderSn
- 客戶端翻單：公司名+電話能查到歷史並帶入
- 客戶端查單：orderSn+電話能看到狀態
- 後台 admin 登入：所有模組正常，訂單/款式/尺碼表/feedback 可管理，一鍵翻單可用
- 工廠帳號登入：只見自己工廠訂單，能更新進度與提交異常
- PO/PI：可生成並打印

---

## Plan Self-Review

- Spec coverage:
  - 雲端同步：所有 KEY_* localStorage 轉 DB
  - Auth：帳密 + role：admin/factory
  - 客戶端：新單/翻單（公司名+電話）/查單（訂單號+電話）
  - 後台：訂單/尺碼/款式/POPI/工廠端/異常/帳號
  - 圖片：先 DB base64 + 限制
- Placeholder scan: 無 TBD/TODO（seed hash 由 Task 2 生成）
- Type consistency: 表名/欄位名/API query key 與 spec 對齊

