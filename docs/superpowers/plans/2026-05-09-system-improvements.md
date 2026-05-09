# System Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 依 spec 分階段（P0→P2）提升資料一致性、可維運性、安全性與實際工作流完整度，同時保持 Vercel Hobby plan（4 個 API 入口）可部署。

**Architecture:** DB 層引入 migrations + schema_migrations；orders 改用 `factory_user_id` 做工廠指派主鍵；API/前端保持現有 endpoint（透過 vercel.json rewrites）但回傳/接收新增欄位；後續再加入 audit logs、附件上傳與安全限制。

**Tech Stack:** Node.js 20（Vercel Functions）、@vercel/postgres、純 HTML/JS（index.html/admin.html）、Vercel rewrites（vercel.json）。

---

## File/DB Change Map

**DB**
- Create: `db/migrations/202605091900_init.sql`（把現有 schema.sql + seed.sql 轉成 migration）
- Create: `db/migrations/202605091910_factory_user_id.sql`
- Create: `db/migrations/202605091920_schema_migrations.sql`
- (P1) Create: `db/migrations/202605091930_audit_logs.sql`
- (P1) Create: `db/migrations/202605091940_attachments_and_img_url.sql`（取決於 storage 方案）
- (P2) Create: `db/migrations/202605091950_login_rate_limit.sql`
- (P2) Create: `db/migrations/202605091960_order_lookup_code.sql`

**Runtime / Server**
- Create: `src/lib/migrate.js`
- Modify: `api/auth.js` `api/public.js` `api/admin.js` `api/factory.js`（每個入口 early-init migrations）

**API / UI**
- Modify: `api/admin.js`（新增 assignFactory action、orders 回傳 factoryUserId）
- Modify: `api/factory.js`（按 factory_user_id 取單）
- Modify: `admin.html`（訂單列表加「指派工廠」）
- (P1) Modify: `admin.html`（反饋附件上傳 UI）
- (P1) Modify: `index.html`（更友善空狀態；可選交期 API）

**Tests**
- Add: `tests/migrate.test.js`
- Add: `tests/factory-assignment.test.js`（以 query string 方式做最小化 integration 測試，不依賴真 DB）

---

## Task 1 (P0): Introduce migrations framework (schema_migrations + runner)

**Files:**
- Create: [migrate.js](file:///Users/chansiulungfelix/Documents/TraeProjects/Cloth%20System/src/lib/migrate.js)
- Create: `db/migrations/202605091920_schema_migrations.sql`
- Create: `db/migrations/202605091900_init.sql`
- Test: `tests/migrate.test.js`
- Modify: [auth.js](file:///Users/chansiulungfelix/Documents/TraeProjects/Cloth%20System/api/auth.js), [public.js](file:///Users/chansiulungfelix/Documents/TraeProjects/Cloth%20System/api/public.js), [admin.js](file:///Users/chansiulungfelix/Documents/TraeProjects/Cloth%20System/api/admin.js), [factory.js](file:///Users/chansiulungfelix/Documents/TraeProjects/Cloth%20System/api/factory.js)

- [ ] **Step 1: Write failing unit test for migrate runner interface**

Create `tests/migrate.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');

test('migrate exports ensureMigrations', () => {
  const { ensureMigrations } = require('../src/lib/migrate');
  assert.equal(typeof ensureMigrations, 'function');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test tests/migrate.test.js
```

Expected: FAIL with "Cannot find module '../src/lib/migrate'".

- [ ] **Step 3: Add migration files**

Create `db/migrations/202605091920_schema_migrations.sql`:

```sql
create table if not exists schema_migrations (
  id text primary key,
  applied_at timestamptz not null default now()
);
```

Create `db/migrations/202605091900_init.sql` with the current schema + seed in one file (idempotent):

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

insert into users (acc, pwd_hash, role, name)
values
  ('admin', '$2b$10$0my2q9NkMv/2Rt4AEBzoTefEkG6B0iUm4XtCmpFkxLlutjSwyHPyK', 'admin', '管理員'),
  ('factory1', '$2b$10$0my2q9NkMv/2Rt4AEBzoTefEkG6B0iUm4XtCmpFkxLlutjSwyHPyK', 'factory', '測試工廠')
on conflict (acc) do nothing;
```

- [ ] **Step 4: Implement migrate runner**

Create `src/lib/migrate.js`:

```js
const fs = require('node:fs/promises');
const path = require('node:path');
const { sql } = require('./db');

let ensured = false;

async function ensureMigrations() {
  if (ensured) return;

  await sql`select pg_advisory_lock(94091234)`;
  try {
    await sql`create table if not exists schema_migrations (id text primary key, applied_at timestamptz not null default now())`;
    const applied = await sql`select id from schema_migrations`;
    const appliedSet = new Set(applied.rows.map((r) => r.id));

    const dir = path.join(process.cwd(), 'db', 'migrations');
    const entries = (await fs.readdir(dir)).filter((f) => f.endsWith('.sql')).sort();

    for (const file of entries) {
      if (appliedSet.has(file)) continue;
      const sqlText = await fs.readFile(path.join(dir, file), 'utf8');
      if (sqlText.trim()) {
        await sql.query(sqlText);
      }
      await sql`insert into schema_migrations (id) values (${file}) on conflict (id) do nothing`;
    }

    ensured = true;
  } finally {
    await sql`select pg_advisory_unlock(94091234)`;
  }
}

module.exports = { ensureMigrations };
```

- [ ] **Step 5: Wire ensureMigrations into API entrypoints**

At the top of each `api/*.js` handler (before reading request body), add:

```js
const { ensureMigrations } = require('../src/lib/migrate');
```

Then inside `module.exports = async function handler(req, res) {` first line:

```js
await ensureMigrations();
```

- [ ] **Step 6: Run tests to verify green**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add db/migrations src/lib/migrate.js api/*.js tests/migrate.test.js
git commit -m "feat: add db migrations runner"
git push
```

---

## Task 2 (P0): Normalize factory assignment with factory_user_id

**Files:**
- Create: `db/migrations/202605091910_factory_user_id.sql`
- Modify: `api/admin.js`
- Modify: `api/factory.js`
- Modify: `admin.html`
- Modify: `vercel.json`
- Test: `tests/factory-assignment.test.js`

- [ ] **Step 1: Write failing test for new API route presence**

Create `tests/factory-assignment.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');

test('vercel rewrites include assignFactory endpoint', async () => {
  const fs = require('node:fs/promises');
  const raw = await fs.readFile('vercel.json', 'utf8');
  const cfg = JSON.parse(raw);
  const rewrites = cfg.rewrites || [];
  const found = rewrites.some((r) => r.source === '/api/admin/orders/assign-factory');
  assert.equal(found, true);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test tests/factory-assignment.test.js
```

Expected: FAIL (rewrite not found).

- [ ] **Step 3: Add migration**

Create `db/migrations/202605091910_factory_user_id.sql`:

```sql
alter table orders add column if not exists factory_user_id uuid references users(id);
create index if not exists idx_orders_factory_user_id on orders(factory_user_id);
```

- [ ] **Step 4: Update admin orders query to include factory_user_id**

In `api/admin.js` `ordersHandler` select list, add `o.factory_user_id`, and in returned JSON include:

```js
factoryUserId: x.factory_user_id,
```

- [ ] **Step 5: Add admin action assignFactory**

In `api/admin.js` implement `assignFactoryHandler(req,res)` with:
- requireAdmin
- method POST only
- body: `{ orderId, factoryUserId }` (factoryUserId can be empty string to clear)
- update:

```sql
update orders
set factory_user_id = ${factoryUserId || null}::uuid,
    factory_name = (select name from users where id = ${factoryUserId}::uuid)
where id = ${orderId}::uuid
returning id, factory_user_id, factory_name
```

Wire in router:

```js
if (action === 'assignFactory') return assignFactoryHandler(req, res);
```

- [ ] **Step 6: Update factory API to use factory_user_id**

In `api/factory.js`, replace all `factory_name = ${session.name}` conditions to:

```sql
where factory_user_id = ${session.userId}::uuid
```

For feedback insert, set `factory_name` still using `session.name` for display.

- [ ] **Step 7: Add vercel rewrite**

Modify `vercel.json` add:

```json
{ "source": "/api/admin/orders/assign-factory", "destination": "/api/admin?action=assignFactory" }
```

- [ ] **Step 8: Update admin.html to show and set assignment**

In `admin.html`:
- On login (admin role) call `/api/admin/users` and cache `factoryUsers = users.filter(u => u.role==='factory')`
- In orders table add a `<select>` column with options = `factoryUsers`
- On change call `/api/admin/orders/assign-factory` with `{orderId, factoryUserId}`

- [ ] **Step 9: Run tests**

```bash
npm test
```

- [ ] **Step 10: Commit**

```bash
git add db/migrations api/admin.js api/factory.js admin.html vercel.json tests/factory-assignment.test.js
git commit -m "feat: assign orders to factories by user id"
git push
```

---

## Task 3 (P1): Add audit_logs and write logs for key actions

**Files:**
- Create: `db/migrations/202605091930_audit_logs.sql`
- Create: `src/lib/audit.js`
- Modify: `api/admin.js`, `api/factory.js`, `api/auth.js`
- Test: `tests/audit.test.js`

- [ ] **Step 1: Create migration**

`db/migrations/202605091930_audit_logs.sql`:

```sql
create table if not exists audit_logs (
  id uuid primary key default uuid_generate_v4(),
  actor_user_id uuid references users(id),
  action text not null,
  entity_type text not null,
  entity_id text,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_created_at on audit_logs(created_at desc);
```

- [ ] **Step 2: Add audit helper**

`src/lib/audit.js`:

```js
const { sql } = require('./db');

async function audit(actorUserId, action, entityType, entityId, payload) {
  await sql`
    insert into audit_logs (actor_user_id, action, entity_type, entity_id, payload)
    values (${actorUserId || null}::uuid, ${action}, ${entityType}, ${entityId || null}, ${payload ? JSON.stringify(payload) : null}::jsonb)
  `;
}

module.exports = { audit };
```

- [ ] **Step 3: Instrument key actions**

Add `audit()` calls after success:
- auth login/logout
- admin create/delete user, size table, style
- admin assignFactory, orderStatus, orderCopy
- factory orderStatus, feedback create

- [ ] **Step 4: Tests**

Add `tests/audit.test.js` that checks module exports exist (DB-less). Keep it minimal.

- [ ] **Step 5: Run tests + commit**

`npm test` then commit:

```bash
git add db/migrations src/lib/audit.js api/*.js tests/audit.test.js
git commit -m "feat: add audit logs"
git push
```

---

## Task 4 (P1): Move images/attachments to object storage (requires storage decision)

**Decision required:** Vercel Blob / Cloudflare R2 / 暫不做

If Vercel Blob:
- Add dependency `@vercel/blob`
- Add API actions to generate upload URLs / store returned URLs
- DB migration adds `styles.img_url` and `feedback.attachments`
- Update admin.html style image upload and factory feedback upload

---

## Task 5 (P2): Login rate limiting

**Files:**
- Create migration `db/migrations/202605091950_login_rate_limit.sql`
- Modify `api/auth.js`
- Add `tests/rate-limit.test.js` (DB-less guard tests)

Implement rule:
- 5 failed attempts / 10 minutes per (ip, acc) => 429
- On success, optionally clear recent failures for that acc+ip

---

## Task 6 (P2): Order lookup code (查單碼)

**Files:**
- Create migration `db/migrations/202605091960_order_lookup_code.sql`
- Modify `api/public.js` createOrder to generate and return `lookupCode`
- Modify `api/public.js` status endpoint to use `orderSn + lookupCode` instead of phone (keep backward compatibility for now)
- Modify `index.html` 查單 tab UI

---

## Self-Review (Plan vs Spec)

- Spec P0: factory_user_id + migrations runner → 覆蓋於 Task 1 & 2
- Spec P1: audit logs + attachments → 覆蓋於 Task 3 & 4（Task 4 需 storage decision）
- Spec P2: rate limit + 查單碼 → 覆蓋於 Task 5 & 6
- 無 placeholders：Task 4 以「需要 storage 決策」作 gating（不可直接實作）

