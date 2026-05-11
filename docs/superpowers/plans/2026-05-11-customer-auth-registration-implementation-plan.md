# Customer Registration/Login (Email) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增客戶註冊/登入/重設密碼（Email + 密碼），並強制「先登入後下單」，同時用 Zoho SMTP 發送 reset link。

**Architecture:** 擴展 `customers` 表存帳戶資料（email/pwd_hash/address/is_registered），新增 `customer_sessions`、`customer_password_resets`；新增 `/api/customer` 提供註冊/登入/登出/me/重設密碼；`/api/public?action=createOrder` 與 `history` 需 customer session 才可使用。`index.html` 加登入/註冊/重設密碼 UI，token 存 `localStorage` 並帶 `Authorization` header。

**Tech Stack:** Node.js 20（CommonJS）、bcryptjs、Vercel Postgres、Vercel Functions；SMTP 使用 `nodemailer`（新增 dependency）。

---

## Files Overview

**Create**
- `api/customer.js`
- `src/lib/customer-auth.js`
- `src/lib/email.js`
- `db/migrations/2026xxxxx_customer_auth.sql`
- `tests/customer-auth-api.test.js`
- `tests/customer-auth-migration.test.js`
- `tests/customer-auth-gate.test.js`

**Modify**
- `db/schema.sql`
- `api/public.js`
- `index.html`
- `package.json` / `package-lock.json`（加入 nodemailer）

---

### Task 1: DB migration（customers 擴展 + sessions/resets 新表）

**Files:**
- Create: `db/migrations/2026xxxxx_customer_auth.sql`
- Modify: `db/schema.sql`
- Test: `tests/customer-auth-migration.test.js`

- [ ] **Step 1: 寫 failing test（schema.sql 必須包含新欄位/新表）**

```js
// tests/customer-auth-migration.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');

test('schema.sql contains customer auth columns and tables', async () => {
  const raw = await fs.readFile('db/schema.sql', 'utf8');
  assert.match(raw, /create table if not exists customers/);
  assert.match(raw, /email text/);
  assert.match(raw, /pwd_hash text/);
  assert.match(raw, /address text/);
  assert.match(raw, /is_registered boolean/);
  assert.match(raw, /create table if not exists customer_sessions/);
  assert.match(raw, /create table if not exists customer_password_resets/);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test tests/customer-auth-migration.test.js
```

- [ ] **Step 3: 新增 migration SQL + 更新 schema.sql**

Migration（示意，實作按檔名排序規則放入 `db/migrations/`）：

```sql
alter table customers add column if not exists email text;
alter table customers add column if not exists pwd_hash text;
alter table customers add column if not exists address text;
alter table customers add column if not exists is_registered boolean not null default false;
create unique index if not exists idx_customers_email_unique on customers(email) where email is not null;

create table if not exists customer_sessions (
  token text primary key,
  customer_id uuid not null references customers(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists customer_password_resets (
  token text primary key,
  customer_id uuid not null references customers(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
```

並把同樣結構同步到 `db/schema.sql`（維持本地 seed/初始化一致）。

- [ ] **Step 4: Run test to verify it passes**

```bash
node --test tests/customer-auth-migration.test.js
```

- [ ] **Step 5: Commit**

```bash
git add db/migrations db/schema.sql tests/customer-auth-migration.test.js
git commit -m "feat: add customer auth schema"
```

---

### Task 2: Customer session / token helper（lib）

**Files:**
- Create: `src/lib/customer-auth.js`
- Test: `tests/customer-auth-api.test.js`（先寫一個 module-level test）

- [ ] **Step 1: 寫 failing test（module 存在並 export requireCustomerSession）**

```js
// tests/customer-auth-api.test.js
const test = require('node:test');
const assert = require('node:assert/strict');

test('customer-auth lib exports helpers', () => {
  const m = require('../src/lib/customer-auth');
  assert.equal(typeof m.newCustomerToken, 'function');
  assert.equal(typeof m.requireCustomerSession, 'function');
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test tests/customer-auth-api.test.js
```

- [ ] **Step 3: Implement `src/lib/customer-auth.js`**

```js
const crypto = require('node:crypto');
const { sql } = require('./db');
const { getBearerToken } = require('./auth');

function newCustomerToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function requireCustomerSession(req) {
  const token = getBearerToken(req.headers.authorization);
  if (!token) return null;
  const r = await sql`
    select s.token, s.expires_at, c.id as customer_id, c.email, c.company_name, c.contact_name, c.phone, c.address
    from customer_sessions s
    join customers c on c.id = s.customer_id
    where s.token = ${token}
  `;
  const row = r.rows[0];
  if (!row) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) return null;
  return {
    token: row.token,
    customerId: row.customer_id,
    email: row.email || '',
    companyName: row.company_name,
    contactName: row.contact_name || '',
    phone: row.phone,
    address: row.address || ''
  };
}

module.exports = { newCustomerToken, requireCustomerSession };
```

- [ ] **Step 4: Run test to verify it passes**

```bash
node --test tests/customer-auth-api.test.js
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/customer-auth.js tests/customer-auth-api.test.js
git commit -m "feat: add customer session helper"
```

---

### Task 3: Email 發送（Zoho SMTP via nodemailer）

**Files:**
- Modify: `package.json`, `package-lock.json`
- Create: `src/lib/email.js`
- Test: `tests/customer-auth-api.test.js`（加一個簡單 export test）

- [ ] **Step 1: 寫 failing test（email.js export sendMail）**

```js
// append to tests/customer-auth-api.test.js
test('email lib exports sendMail', () => {
  const m = require('../src/lib/email');
  assert.equal(typeof m.sendMail, 'function');
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test tests/customer-auth-api.test.js
```

- [ ] **Step 3: 安裝依賴 + 實作 `src/lib/email.js`**

Add dependency:

```bash
npm install nodemailer
```

Implementation:

```js
const nodemailer = require('nodemailer');

function getSmtpConfig() {
  const host = process.env.SMTP_HOST || '';
  const port = Number(process.env.SMTP_PORT || 0);
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true';
  const user = process.env.SMTP_USER || '';
  const pass = process.env.SMTP_PASS || '';
  const from = process.env.SMTP_FROM || '';
  if (!host || !port || !user || !pass || !from) return null;
  return { host, port, secure, auth: { user, pass }, from };
}

async function sendMail({ to, subject, html, text }) {
  const cfg = getSmtpConfig();
  if (!cfg) return { ok: false, error: 'email_not_configured' };
  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.auth
  });
  await transporter.sendMail({ from: cfg.from, to, subject, html, text });
  return { ok: true };
}

module.exports = { sendMail };
```

- [ ] **Step 4: Run full tests**

```bash
npm test
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/lib/email.js tests/customer-auth-api.test.js
git commit -m "feat: add smtp email sender"
```

---

### Task 4: `/api/customer`（register/login/logout/me/reset）

**Files:**
- Create: `api/customer.js`
- Modify: `vercel.json`（可選：新增 rewrites）
- Test: `tests/customer-auth-api.test.js`（確認 api module 存在 action 分支）

- [ ] **Step 1: 寫 failing test（api/customer.js module 存在）**

```js
// append to tests/customer-auth-api.test.js
test('customer api entrypoint exists', () => {
  const handler = require('../api/customer');
  assert.equal(typeof handler, 'function');
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test tests/customer-auth-api.test.js
```

- [ ] **Step 3: Implement `api/customer.js`**

Requirements:
- `ensureMigrations()` 先跑
- action: `register|login|logout|me|requestPasswordReset|resetPassword`
- password 用 `hashPassword/verifyPassword`
- session 用 `customer_sessions`（12 小時）
- reset token 用 `customer_password_resets`（30 分鐘）
- `requestPasswordReset` 對不存在 email 也回 `{ ok: true }`

並用 `PUBLIC_BASE_URL` 組 resetUrl。

- [ ] **Step 4: Run tests**

```bash
npm test
```

- [ ] **Step 5: Commit**

```bash
git add api/customer.js tests/customer-auth-api.test.js
git commit -m "feat: add customer auth api"
```

---

### Task 5: 強制「先登入後下單」（public createOrder + history gate）

**Files:**
- Modify: `api/public.js`
- Test: `tests/customer-auth-gate.test.js`

- [ ] **Step 1: 寫 failing test（public.js 使用 requireCustomerSession 來 gate createOrder）**

```js
// tests/customer-auth-gate.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');

test('public createOrder requires customer session', async () => {
  const js = await fs.readFile('api/public.js', 'utf8');
  assert.match(js, /requireCustomerSession/);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test tests/customer-auth-gate.test.js
```

- [ ] **Step 3: Implement gate**

Changes:
- `handleCreateOrder`：第一步 `const session = await requireCustomerSession(req)`；無則 401
- 下單：不再 upsert customers（company+phone）；改用 `session.customerId`
- `handleHistory`：改為 requireCustomerSession，並按 `o.customer_id = session.customerId` 查

- [ ] **Step 4: Run full tests**

```bash
npm test
```

- [ ] **Step 5: Commit**

```bash
git add api/public.js tests/customer-auth-gate.test.js
git commit -m "feat: require customer login before ordering"
```

---

### Task 6: 客戶端 UI（index.html）加入註冊/登入/忘記密碼/reset 模式

**Files:**
- Modify: `index.html`
- Test: `tests/index-html.test.js`

- [ ] **Step 1: 寫 failing test（index.html 有註冊/登入區塊與 reset mode 字串）**

```js
// add to tests/index-html.test.js
test('index.html includes customer auth ui', async () => {
  const fs = require('node:fs/promises');
  const html = await fs.readFile('index.html', 'utf8');
  assert.match(html, /customerLogin/);
  assert.match(html, /customerRegister/);
  assert.match(html, /mode=reset/);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test tests/index-html.test.js
```

- [ ] **Step 3: Implement UI + client logic**

Requirements:
- token 存 `localStorage`：key `customerToken`
- `init()` 時：
  - 若 URL `mode=reset` → 顯示 reset form
  - 否則先呼叫 `/api/customer?action=me` 驗證 token；成功則顯示已登入狀態
- 未登入：下單/翻單 tab 點擊時提示並切回登入區（查單 tab 仍可用）
- 登入後：預填 company/contact/phone/address（可改但不回寫）
- 下單 API request 加 `Authorization: Bearer <token>`
- 忘記密碼：呼叫 `requestPasswordReset`
- reset：呼叫 `resetPassword` 成功後清掉 query（history replaceState）

- [ ] **Step 4: Run full tests**

```bash
npm test
```

- [ ] **Step 5: Commit**

```bash
git add index.html tests/index-html.test.js
git commit -m "feat: add customer registration and login gate"
```

---

### Task 7: 文件（Zoho SMTP / Vercel env）

**Files:**
- Modify: `docs/deploy-vercel.md`（或新增 `docs/customer-auth.md`）

- [ ] **Step 1: 補充 Vercel env 設定步驟（Zoho）**

內容包含：
- Zoho SMTP host/port/secure
- App Password 取得方法（高層描述）
- PUBLIC_BASE_URL 設定

- [ ] **Step 2: Commit**

```bash
git add docs/deploy-vercel.md
git commit -m "docs: add customer auth env setup"
```

---

## Execution Choice

Plan complete and saved to `docs/superpowers/plans/2026-05-11-customer-auth-registration-implementation-plan.md`.

Two execution options:

1. **Subagent-Driven (recommended)** — 逐個 Task 開 subagent 做，完成一個我 review 一個
2. **Inline Execution** — 喺同一個 session 直接按 Task 做

請回覆 `1` 或 `2`。

