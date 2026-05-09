# Cloth System V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 提供客戶下單（新單/翻單）+ 後台管理（狀態/搜尋/匯出/翻單）並以 Vercel Postgres 作雲端資料來源，GitHub push 後由 Vercel 自動 deploy。

**Architecture:** 兩個獨立 HTML（`index.html` / `admin.html`）+ Vercel Serverless Functions（`/api/...`）+ Vercel Postgres；交期以「工作日 + 香港公眾假期」計算，前後端一致驗證。

**Tech Stack:** Static HTML + Tailwind CDN、Vercel Functions (Node.js)、`@vercel/postgres`、Node built-in test runner (`node --test`)

---

## File Map

**Create**

- `package.json`
- `.gitignore`
- `vercel.json`
- `data/hk-holidays/2026.json`
- `src/lib/hk-date.js`
- `src/lib/validation.js`
- `src/lib/csv.js`
- `api/orders.js`
- `api/orders/history.js`
- `api/admin/orders.js`
- `api/admin/orders/status.js`
- `tests/hk-date.test.js`
- `tests/validation.test.js`
- `tests/csv.test.js`

**Modify**

- `index.html`
- `admin.html`

---

### Task 1: 專案基礎檔（Node/Vercel）

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `vercel.json`

- [ ] **Step 1: 建立 package.json**

```json
{
  "name": "cloth-system",
  "private": true,
  "type": "commonjs",
  "scripts": {
    "test": "node --test"
  },
  "dependencies": {
    "@vercel/postgres": "^0.10.0"
  },
  "engines": {
    "node": ">=18"
  }
}
```

- [ ] **Step 2: 建立 .gitignore**

```gitignore
.DS_Store
.vercel
node_modules
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
```

- [ ] **Step 3: 建立 vercel.json（/admin rewrite）**

```json
{
  "rewrites": [
    { "source": "/admin", "destination": "/admin.html" }
  ]
}
```

- [ ] **Step 4: 本機安裝依賴**

Run:

```bash
npm install
```

Expected: 生成 `node_modules`，無 error

---

### Task 2: 香港假期資料（2026）

**Files:**
- Create: `data/hk-holidays/2026.json`

- [ ] **Step 1: 建立 2026 假期表（YYYY-MM-DD array）**

來源：https://www.gov.hk/tc/about/abouthk/holiday/2026.htm（只需列公眾假期，星期日已由週末規則處理）

```json
[
  "2026-01-01",
  "2026-02-17",
  "2026-02-18",
  "2026-02-19",
  "2026-04-03",
  "2026-04-04",
  "2026-04-06",
  "2026-04-07",
  "2026-05-01",
  "2026-05-25",
  "2026-06-19",
  "2026-07-01",
  "2026-09-26",
  "2026-10-01",
  "2026-10-19",
  "2026-12-25",
  "2026-12-26"
]
```

---

### Task 3: 核心共用函數（交期/驗證/CSV）+ 單元測試

**Files:**
- Create: `src/lib/hk-date.js`
- Create: `src/lib/validation.js`
- Create: `src/lib/csv.js`
- Test: `tests/hk-date.test.js`
- Test: `tests/validation.test.js`
- Test: `tests/csv.test.js`

- [ ] **Step 1: 建立 hk-date.js（HK date + business day 計算）**

```js
const holidays2026 = require('../../data/hk-holidays/2026.json');

function hkTodayYmd(now = new Date()) {
  const s = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Hong_Kong' });
  return s;
}

function isWeekend(ymd) {
  const d = new Date(`${ymd}T00:00:00.000Z`);
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}

function addDaysYmd(ymd, days) {
  const d = new Date(`${ymd}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function normalizeHolidaySet(holidayList) {
  return new Set((holidayList || []).map(String));
}

function addBusinessDays(startYmd, businessDays, holidaySet) {
  const holidays = holidaySet || normalizeHolidaySet(holidays2026);
  let cursor = String(startYmd);
  let left = Number(businessDays);
  if (!Number.isFinite(left) || left < 0) throw new Error('businessDays must be >= 0');

  while (left > 0) {
    cursor = addDaysYmd(cursor, 1);
    if (isWeekend(cursor)) continue;
    if (holidays.has(cursor)) continue;
    left -= 1;
  }

  return cursor;
}

module.exports = {
  hkTodayYmd,
  isWeekend,
  addDaysYmd,
  normalizeHolidaySet,
  addBusinessDays
};
```

- [ ] **Step 2: 建立 validation.js（input 驗證）**

```js
function requiredString(v, name) {
  const s = typeof v === 'string' ? v.trim() : '';
  if (!s) throw new Error(`${name} required`);
  return s;
}

function requiredEnum(v, allowed, name) {
  if (!allowed.includes(v)) throw new Error(`${name} invalid`);
  return v;
}

function requiredYmd(v, name) {
  const s = requiredString(v, name);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error(`${name} invalid`);
  return s;
}

function requiredSizeRatio(v) {
  if (!Array.isArray(v) || v.length === 0) throw new Error('sizeRatio required');
  const normalized = v.map((r) => {
    const size = requiredString(r && r.size, 'size');
    const qty = Number(r && r.qty);
    if (!Number.isFinite(qty) || qty <= 0) throw new Error('qty invalid');
    return { size, qty };
  });
  return normalized;
}

module.exports = {
  requiredString,
  requiredEnum,
  requiredYmd,
  requiredSizeRatio
};
```

- [ ] **Step 3: 建立 csv.js（json array -> csv string）**

```js
function csvEscape(s) {
  const v = String(s ?? '');
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function toCsv(rows, columns) {
  const cols = columns.slice();
  const header = cols.map((c) => csvEscape(c.header)).join(',');
  const lines = rows.map((r) => cols.map((c) => csvEscape(r[c.key])).join(','));
  return [header, ...lines].join('\n');
}

module.exports = { csvEscape, toCsv };
```

- [ ] **Step 4: 加 hk-date.test.js（先寫測試，確保 fail 再實作）**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { addBusinessDays, normalizeHolidaySet } = require('../src/lib/hk-date');

test('addBusinessDays skips weekend', () => {
  const holidays = normalizeHolidaySet([]);
  assert.equal(addBusinessDays('2026-05-08', 1, holidays), '2026-05-11');
});

test('addBusinessDays skips holiday', () => {
  const holidays = normalizeHolidaySet(['2026-01-01']);
  assert.equal(addBusinessDays('2025-12-31', 1, holidays), '2026-01-02');
});
```

- [ ] **Step 5: 加 validation.test.js**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { requiredSizeRatio } = require('../src/lib/validation');

test('requiredSizeRatio normalizes and validates', () => {
  const out = requiredSizeRatio([{ size: 'M', qty: 2 }]);
  assert.deepEqual(out, [{ size: 'M', qty: 2 }]);
});
```

- [ ] **Step 6: 加 csv.test.js**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { toCsv } = require('../src/lib/csv');

test('toCsv outputs header and rows', () => {
  const csv = toCsv([{ a: 'x', b: 'y' }], [
    { key: 'a', header: 'A' },
    { key: 'b', header: 'B' }
  ]);
  assert.equal(csv.trim(), 'A,B\nx,y');
});
```

- [ ] **Step 7: 跑測試**

Run:

```bash
npm test
```

Expected: PASS

---

### Task 4: 資料庫 Schema + 初始化 SQL

**Files:**
- (Doc in plan) 初始化 SQL（在 Vercel Postgres Console 執行）

- [ ] **Step 1: 建表 SQL**

Run in Vercel Postgres Console:

```sql
create extension if not exists "uuid-ossp";

create table if not exists orders (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  order_type text not null,
  status text not null,
  company_name text not null,
  contact_name text not null,
  phone text not null,
  address text not null,
  style_name text not null,
  size_chart text,
  size_ratio jsonb not null,
  suggested_delivery_date date not null,
  requested_delivery_date date not null,
  source_order_id uuid references orders(id)
);

create index if not exists idx_orders_phone on orders(phone);
create index if not exists idx_orders_created_at on orders(created_at desc);
create index if not exists idx_orders_status on orders(status);
```

- [ ] **Step 2: 狀態允許值（不加 DB enum，先用 app 驗證）**

允許值：

```txt
received, follow_up, confirmed, production, shipping, done, cancelled
```

---

### Task 5: Serverless API（寫入/歷史/後台/狀態/CSV）

**Files:**
- Create: `api/orders.js`
- Create: `api/orders/history.js`
- Create: `api/admin/orders.js`
- Create: `api/admin/orders/status.js`

- [ ] **Step 1: 建立 api/orders.js**

```js
const { sql } = require('@vercel/postgres');
const { hkTodayYmd, addBusinessDays } = require('../src/lib/hk-date');
const { requiredString, requiredEnum, requiredYmd, requiredSizeRatio } = require('../src/lib/validation');

const ORDER_TYPES = ['new', 'reorder'];
const STATUS = ['received', 'follow_up', 'confirmed', 'production', 'shipping', 'done', 'cancelled'];

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method_not_allowed' });

  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', async () => {
    try {
      const body = raw ? JSON.parse(raw) : {};

      const orderType = requiredEnum(body.orderType, ORDER_TYPES, 'orderType');
      const companyName = requiredString(body.companyName, 'companyName');
      const contactName = requiredString(body.contactName, 'contactName');
      const phone = requiredString(body.phone, 'phone');
      const address = requiredString(body.address, 'address');
      const styleName = requiredString(body.styleName, 'styleName');
      const sizeChart = typeof body.sizeChart === 'string' ? body.sizeChart.trim() : '';
      const sizeRatio = requiredSizeRatio(body.sizeRatio);
      const requestedDeliveryDate = requiredYmd(body.requestedDeliveryDate, 'requestedDeliveryDate');
      const sourceOrderId = typeof body.sourceOrderId === 'string' ? body.sourceOrderId.trim() : null;

      const today = hkTodayYmd(new Date());
      const lead = orderType === 'new' ? 31 : 17;
      const suggestedDeliveryDate = addBusinessDays(today, lead);

      if (requestedDeliveryDate < suggestedDeliveryDate) {
        return json(res, 400, { ok: false, error: 'delivery_date_too_early', suggestedDeliveryDate });
      }

      const status = 'received';
      if (!STATUS.includes(status)) throw new Error('status invalid');

      const inserted = await sql`
        insert into orders
          (order_type, status, company_name, contact_name, phone, address, style_name, size_chart, size_ratio, suggested_delivery_date, requested_delivery_date, source_order_id)
        values
          (${orderType}, ${status}, ${companyName}, ${contactName}, ${phone}, ${address}, ${styleName}, ${sizeChart || null}, ${JSON.stringify(sizeRatio)}::jsonb, ${suggestedDeliveryDate}, ${requestedDeliveryDate}, ${sourceOrderId || null}::uuid)
        returning id, created_at
      `;

      const row = inserted.rows[0];
      return json(res, 200, { ok: true, orderId: row.id, suggestedDeliveryDate, createdAt: row.created_at });
    } catch (e) {
      return json(res, 400, { ok: false, error: 'bad_request', message: String(e && e.message ? e.message : e) });
    }
  });
};
```

- [ ] **Step 2: 建立 api/orders/history.js**

```js
const { sql } = require('@vercel/postgres');

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'method_not_allowed' });
  const url = new URL(req.url, 'http://localhost');
  const phone = (url.searchParams.get('phone') || '').trim();
  if (!phone) return json(res, 400, { ok: false, error: 'phone_required' });

  const result = await sql`
    select id, created_at, order_type, style_name, size_chart, size_ratio, requested_delivery_date, suggested_delivery_date
    from orders
    where phone = ${phone}
    order by created_at desc
    limit 50
  `;

  const orders = result.rows.map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    orderType: r.order_type,
    styleName: r.style_name,
    sizeChart: r.size_chart || '',
    sizeRatio: r.size_ratio || [],
    requestedDeliveryDate: String(r.requested_delivery_date),
    suggestedDeliveryDate: String(r.suggested_delivery_date)
  }));

  return json(res, 200, { ok: true, orders });
};
```

- [ ] **Step 3: 建立 api/admin/orders.js（支援 filter + csv）**

```js
const { sql } = require('@vercel/postgres');
const { toCsv } = require('../../src/lib/csv');

function unauthorized(res) {
  res.statusCode = 401;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ ok: false, error: 'unauthorized' }));
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function getToken(req) {
  const h = req.headers.authorization || '';
  const m = String(h).match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : '';
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'method_not_allowed' });
  const token = getToken(req);
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) return unauthorized(res);

  const url = new URL(req.url, 'http://localhost');
  const phone = (url.searchParams.get('phone') || '').trim();
  const company = (url.searchParams.get('company') || '').trim();
  const orderType = (url.searchParams.get('orderType') || '').trim();
  const status = (url.searchParams.get('status') || '').trim();
  const from = (url.searchParams.get('from') || '').trim();
  const to = (url.searchParams.get('to') || '').trim();
  const format = (url.searchParams.get('format') || '').trim();

  const result = await sql`
    select id, created_at, order_type, status, company_name, contact_name, phone, address, style_name,
      requested_delivery_date, suggested_delivery_date, source_order_id
    from orders
    where
      (${phone} = '' or phone = ${phone})
      and (${company} = '' or company_name ilike ${'%' + company + '%'})
      and (${orderType} = '' or order_type = ${orderType})
      and (${status} = '' or status = ${status})
      and (${from} = '' or created_at >= ${from}::date)
      and (${to} = '' or created_at < (${to}::date + interval '1 day'))
    order by created_at desc
    limit 500
  `;

  const orders = result.rows.map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    orderType: r.order_type,
    status: r.status,
    companyName: r.company_name,
    contactName: r.contact_name,
    phone: r.phone,
    address: r.address,
    styleName: r.style_name,
    requestedDeliveryDate: String(r.requested_delivery_date),
    suggestedDeliveryDate: String(r.suggested_delivery_date),
    sourceOrderId: r.source_order_id
  }));

  if (format === 'csv') {
    const csv = toCsv(orders, [
      { key: 'createdAt', header: 'createdAt' },
      { key: 'orderType', header: 'orderType' },
      { key: 'status', header: 'status' },
      { key: 'companyName', header: 'companyName' },
      { key: 'contactName', header: 'contactName' },
      { key: 'phone', header: 'phone' },
      { key: 'address', header: 'address' },
      { key: 'styleName', header: 'styleName' },
      { key: 'suggestedDeliveryDate', header: 'suggestedDeliveryDate' },
      { key: 'requestedDeliveryDate', header: 'requestedDeliveryDate' },
      { key: 'sourceOrderId', header: 'sourceOrderId' }
    ]);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="orders.csv"');
    return res.end(csv);
  }

  return json(res, 200, { ok: true, orders });
};
```

- [ ] **Step 4: 建立 api/admin/orders/status.js（更新狀態）**

```js
const { sql } = require('@vercel/postgres');

const STATUS = ['received', 'follow_up', 'confirmed', 'production', 'shipping', 'done', 'cancelled'];

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function getToken(req) {
  const h = req.headers.authorization || '';
  const m = String(h).match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : '';
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method_not_allowed' });
  const token = getToken(req);
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) return json(res, 401, { ok: false, error: 'unauthorized' });

  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', async () => {
    try {
      const body = raw ? JSON.parse(raw) : {};
      const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : '';
      const status = typeof body.status === 'string' ? body.status.trim() : '';
      if (!orderId) throw new Error('orderId required');
      if (!STATUS.includes(status)) throw new Error('status invalid');

      const updated = await sql`
        update orders
        set status = ${status}, updated_at = now()
        where id = ${orderId}::uuid
        returning id, status
      `;

      const row = updated.rows[0];
      if (!row) return json(res, 404, { ok: false, error: 'not_found' });
      return json(res, 200, { ok: true, orderId: row.id, status: row.status });
    } catch (e) {
      return json(res, 400, { ok: false, error: 'bad_request', message: String(e && e.message ? e.message : e) });
    }
  });
};
```

---

### Task 6: index.html（客戶下單：新單/翻單、歷史帶入、交期限制、寫入 DB）

**Files:**
- Modify: `index.html`

- [ ] **Step 1: 將 index.html 由 localStorage 改為 API + 新 UI**

Implementation source 可用 `mockups/order.html` 版面，落地後改為：

- `loadHistoryBtn` → call `GET /api/orders/history?phone=...`
- submit → call `POST /api/orders`
- 交期計算 → fetch `/data/hk-holidays/2026.json` 讀假期表後本機計算（同 `src/lib/hk-date.js` 同規則）

具體落地檔案內容（覆蓋整個 `index.html`）：

```html
<!DOCTYPE html>
<html lang="zh-HK">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>客戶下單</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-50 text-slate-900">
  <div class="mx-auto w-full max-w-4xl px-4 py-8">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">客戶下單</h1>
        <p class="mt-1 text-sm text-slate-600">新單 / 翻單；系統會按工作日 + 香港假期限制最快交貨日。</p>
      </div>
      <a href="/admin" class="rounded-lg border bg-white px-3 py-2 text-sm hover:bg-slate-50">後台</a>
    </div>

    <div class="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
      <button id="modeNew" type="button" class="rounded-xl border bg-white p-4 text-left shadow-sm hover:bg-slate-50">
        <div class="flex items-center justify-between">
          <div class="text-sm font-medium">全新款式下單</div>
          <span class="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">31 工作日</span>
        </div>
        <div class="mt-1 text-xs text-slate-600">確認設計→樣板 14天；樣板→量產 14天；物流香港最少3天</div>
      </button>
      <button id="modeReorder" type="button" class="rounded-xl border bg-white p-4 text-left shadow-sm hover:bg-slate-50">
        <div class="flex items-center justify-between">
          <div class="text-sm font-medium">歷史訂單翻單</div>
          <span class="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">17 工作日</span>
        </div>
        <div class="mt-1 text-xs text-slate-600">豁免設計/起樣板；量產 14天 + 物流最少3天</div>
      </button>
    </div>

    <div class="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
      <section class="rounded-xl border bg-white p-5 shadow-sm lg:col-span-3">
        <div class="flex items-center justify-between">
          <h2 class="text-base font-semibold">訂單資料</h2>
          <div id="modeBadge" class="hidden rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"></div>
        </div>

        <form id="orderForm" class="mt-4 space-y-4">
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label class="text-sm font-medium">公司名 *</label>
              <input id="company" class="mt-1 w-full rounded-lg border px-3 py-2 text-sm" required />
            </div>
            <div>
              <label class="text-sm font-medium">聯絡人 *</label>
              <input id="contact" class="mt-1 w-full rounded-lg border px-3 py-2 text-sm" required />
            </div>
            <div>
              <label class="text-sm font-medium">電話 *</label>
              <input id="phone" class="mt-1 w-full rounded-lg border px-3 py-2 text-sm" required />
            </div>
            <div>
              <label class="text-sm font-medium">送貨地址 *</label>
              <input id="address" class="mt-1 w-full rounded-lg border px-3 py-2 text-sm" required />
            </div>
          </div>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label class="text-sm font-medium">款式 *</label>
              <input id="style" class="mt-1 w-full rounded-lg border px-3 py-2 text-sm" required />
            </div>
            <div>
              <label class="text-sm font-medium">交貨日 *</label>
              <input id="deliveryDate" type="date" class="mt-1 w-full rounded-lg border px-3 py-2 text-sm" required />
              <div id="minDateHint" class="mt-1 text-xs text-slate-600"></div>
            </div>
          </div>

          <div>
            <label class="text-sm font-medium">尺碼表（文字，可選）</label>
            <textarea id="sizeChart" class="mt-1 w-full rounded-lg border px-3 py-2 text-sm" rows="3"></textarea>
          </div>

          <div class="rounded-xl border bg-slate-50 p-4">
            <div class="flex items-center justify-between">
              <div class="text-sm font-semibold">舊尺碼配比 *</div>
              <button id="addRowBtn" type="button" class="rounded-lg border bg-white px-3 py-1.5 text-xs font-medium hover:bg-slate-50">新增尺寸</button>
            </div>
            <div class="mt-3 overflow-x-auto">
              <table class="w-full min-w-[420px] text-sm">
                <thead>
                  <tr class="border-b bg-white">
                    <th class="px-3 py-2 text-left font-medium">尺寸</th>
                    <th class="px-3 py-2 text-left font-medium">數量</th>
                    <th class="px-3 py-2 text-right font-medium">操作</th>
                  </tr>
                </thead>
                <tbody id="ratioBody"></tbody>
              </table>
            </div>
          </div>

          <div class="flex items-center justify-between gap-3">
            <div id="msg" class="text-sm font-medium"></div>
            <button id="submitBtn" type="submit" class="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">提交訂單</button>
          </div>
        </form>
      </section>

      <aside class="rounded-xl border bg-white p-5 shadow-sm lg:col-span-2">
        <div class="flex items-center justify-between">
          <h2 class="text-base font-semibold">翻單庫（依電話）</h2>
          <button id="loadHistoryBtn" type="button" class="rounded-lg border bg-white px-3 py-1.5 text-xs font-medium hover:bg-slate-50">載入</button>
        </div>
        <p class="mt-1 text-xs text-slate-600">翻單模式會顯示該電話的歷史訂單，點選即可帶入。</p>
        <div id="historyEmpty" class="mt-4 rounded-xl border border-dashed p-4 text-sm text-slate-600">未載入歷史訂單</div>
        <ul id="historyList" class="mt-4 hidden space-y-3"></ul>
      </aside>
    </div>
  </div>

  <script>
    const Mode = { NEW: 'new', REORDER: 'reorder' };
    let selectedMode = null;
    let holidays = new Set();
    let selectedSourceOrderId = null;

    const modeNewBtn = document.getElementById('modeNew');
    const modeReorderBtn = document.getElementById('modeReorder');
    const modeBadge = document.getElementById('modeBadge');
    const deliveryDateInput = document.getElementById('deliveryDate');
    const minDateHint = document.getElementById('minDateHint');

    const ratioBody = document.getElementById('ratioBody');
    const addRowBtn = document.getElementById('addRowBtn');

    const historyEmpty = document.getElementById('historyEmpty');
    const historyList = document.getElementById('historyList');
    const loadHistoryBtn = document.getElementById('loadHistoryBtn');

    function pad(n) { return String(n).padStart(2, '0'); }
    function formatDate(d) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
    function addDaysYmd(ymd, days) {
      const d = new Date(`${ymd}T00:00:00.000Z`);
      d.setUTCDate(d.getUTCDate() + days);
      return d.toISOString().slice(0, 10);
    }
    function isWeekend(ymd) {
      const d = new Date(`${ymd}T00:00:00.000Z`);
      const day = d.getUTCDay();
      return day === 0 || day === 6;
    }
    function addBusinessDays(startYmd, businessDays) {
      let cursor = String(startYmd);
      let left = Number(businessDays);
      while (left > 0) {
        cursor = addDaysYmd(cursor, 1);
        if (isWeekend(cursor)) continue;
        if (holidays.has(cursor)) continue;
        left -= 1;
      }
      return cursor;
    }
    function hkTodayYmd() {
      return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Hong_Kong' });
    }

    function setMode(mode) {
      selectedMode = mode;
      modeBadge.classList.remove('hidden');
      if (mode === Mode.NEW) {
        modeBadge.textContent = '新單';
        modeBadge.className = 'rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700';
      } else {
        modeBadge.textContent = '翻單';
        modeBadge.className = 'rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700';
      }

      const lead = mode === Mode.NEW ? 31 : 17;
      const earliest = addBusinessDays(hkTodayYmd(), lead);
      deliveryDateInput.min = earliest;
      if (!deliveryDateInput.value || deliveryDateInput.value < earliest) deliveryDateInput.value = earliest;
      minDateHint.textContent = `最快交貨日：${earliest}`;
    }

    function addRatioRow(size = '', qty = '') {
      const tr = document.createElement('tr');
      tr.className = 'border-b bg-white';
      tr.innerHTML = `
        <td class="px-3 py-2">
          <input class="w-full rounded-lg border px-3 py-1.5 text-sm" value="${String(size)}" required />
        </td>
        <td class="px-3 py-2">
          <input type="number" min="1" class="w-full rounded-lg border px-3 py-1.5 text-sm" value="${String(qty)}" required />
        </td>
        <td class="px-3 py-2 text-right">
          <button type="button" class="removeRow rounded-lg border bg-white px-2.5 py-1 text-xs font-medium hover:bg-slate-50">刪除</button>
        </td>
      `;
      tr.querySelector('.removeRow').addEventListener('click', () => tr.remove());
      ratioBody.appendChild(tr);
    }

    function readRatio() {
      const rows = Array.from(ratioBody.querySelectorAll('tr'));
      const ratio = rows.map((tr) => {
        const inputs = tr.querySelectorAll('input');
        return { size: inputs[0].value.trim(), qty: Number(inputs[1].value) };
      }).filter((r) => r.size && Number.isFinite(r.qty) && r.qty > 0);
      return ratio;
    }

    function renderHistory(orders) {
      historyList.innerHTML = '';
      if (!orders.length) {
        historyEmpty.classList.remove('hidden');
        historyList.classList.add('hidden');
        historyEmpty.textContent = '冇歷史訂單';
        return;
      }
      historyEmpty.classList.add('hidden');
      historyList.classList.remove('hidden');
      orders.forEach((o) => {
        const li = document.createElement('li');
        li.className = 'rounded-xl border p-3 hover:bg-slate-50';
        const ratioSummary = (o.sizeRatio || []).map((r) => `${r.size}:${r.qty}`).join(' / ');
        li.innerHTML = `
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="text-sm font-semibold">${o.styleName}</div>
              <div class="mt-1 text-xs text-slate-600">上次交貨日：${o.requestedDeliveryDate}</div>
            </div>
            <button type="button" class="selectOrder rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800">選擇</button>
          </div>
          <div class="mt-2 text-xs text-slate-600">配比：${ratioSummary}</div>
        `;
        li.querySelector('.selectOrder').addEventListener('click', () => {
          document.getElementById('style').value = o.styleName || '';
          document.getElementById('sizeChart').value = o.sizeChart || '';
          ratioBody.innerHTML = '';
          (o.sizeRatio || []).forEach((r) => addRatioRow(r.size, r.qty));
          selectedSourceOrderId = o.id;
          setMode(Mode.REORDER);
          document.getElementById('msg').textContent = '已帶入歷史訂單資料';
        });
        historyList.appendChild(li);
      });
    }

    modeNewBtn.addEventListener('click', () => setMode(Mode.NEW));
    modeReorderBtn.addEventListener('click', () => setMode(Mode.REORDER));
    addRowBtn.addEventListener('click', () => addRatioRow());

    loadHistoryBtn.addEventListener('click', async () => {
      const phone = document.getElementById('phone').value.trim();
      if (!phone) {
        historyEmpty.classList.remove('hidden');
        historyList.classList.add('hidden');
        historyEmpty.textContent = '請先輸入電話再載入';
        return;
      }
      const res = await fetch(`/api/orders/history?phone=${encodeURIComponent(phone)}`);
      const data = await res.json().catch(() => null);
      if (!data || !data.ok) {
        historyEmpty.classList.remove('hidden');
        historyList.classList.add('hidden');
        historyEmpty.textContent = '載入失敗';
        return;
      }
      renderHistory(data.orders || []);
    });

    document.getElementById('orderForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = document.getElementById('msg');
      msg.textContent = '';
      if (!selectedMode) {
        msg.textContent = '請先選擇「新單」或「翻單」';
        return;
      }
      const payload = {
        orderType: selectedMode,
        companyName: document.getElementById('company').value.trim(),
        contactName: document.getElementById('contact').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        address: document.getElementById('address').value.trim(),
        styleName: document.getElementById('style').value.trim(),
        sizeChart: document.getElementById('sizeChart').value,
        sizeRatio: readRatio(),
        requestedDeliveryDate: deliveryDateInput.value,
        sourceOrderId: selectedMode === Mode.REORDER ? selectedSourceOrderId : null
      };

      document.getElementById('submitBtn').disabled = true;
      try {
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json().catch(() => null);
        if (!data || !data.ok) {
          if (data && data.error === 'delivery_date_too_early' && data.suggestedDeliveryDate) {
            msg.textContent = `交貨日過早，最快：${data.suggestedDeliveryDate}`;
          } else {
            msg.textContent = '提交失敗';
          }
          return;
        }
        msg.textContent = '下單成功！';
        e.target.reset();
        ratioBody.innerHTML = '';
        addRatioRow('S', 10);
        addRatioRow('M', 20);
        addRatioRow('L', 10);
        selectedSourceOrderId = null;
        selectedMode = null;
        modeBadge.classList.add('hidden');
        minDateHint.textContent = '';
      } finally {
        document.getElementById('submitBtn').disabled = false;
      }
    });

    async function init() {
      const r = await fetch('/data/hk-holidays/2026.json').catch(() => null);
      const list = r ? await r.json().catch(() => []) : [];
      holidays = new Set(Array.isArray(list) ? list.map(String) : []);
      ratioBody.innerHTML = '';
      addRatioRow('S', 10);
      addRatioRow('M', 20);
      addRatioRow('L', 10);
    }

    init();
  </script>
</body>
</html>
```

---

### Task 7: admin.html（後台：token、列表、狀態、搜尋/篩選、匯出 CSV、翻單）

**Files:**
- Modify: `admin.html`

- [ ] **Step 1: 將 admin.html 由 localStorage 改為 API + 新 UI**

落地檔案內容（覆蓋整個 `admin.html`）：

```html
<!DOCTYPE html>
<html lang="zh-HK">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>後台訂單管理</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-50 text-slate-900">
  <div class="mx-auto w-full max-w-7xl px-4 py-8">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">後台訂單管理</h1>
        <p class="mt-1 text-sm text-slate-600">狀態流轉、搜尋/篩選、匯出 CSV、一鍵翻單。</p>
      </div>
      <div class="flex items-center gap-2">
        <button id="refreshBtn" class="rounded-lg border bg-white px-3 py-2 text-sm hover:bg-slate-50">刷新</button>
        <button id="exportBtn" class="rounded-lg border bg-white px-3 py-2 text-sm hover:bg-slate-50">匯出 CSV</button>
        <a href="/" class="rounded-lg border bg-white px-3 py-2 text-sm hover:bg-slate-50">下單頁</a>
      </div>
    </div>

    <section class="mt-6 rounded-xl border bg-white p-5 shadow-sm">
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-6">
        <div class="lg:col-span-2">
          <label class="text-sm font-medium">Admin Token</label>
          <input id="tokenInput" type="password" class="mt-1 w-full rounded-lg border px-3 py-2 text-sm" placeholder="輸入後台密碼" />
          <button id="saveTokenBtn" class="mt-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800">儲存 Token</button>
        </div>
        <div class="lg:col-span-4">
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <label class="text-sm font-medium">電話</label>
              <input id="fPhone" class="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
            </div>
            <div class="lg:col-span-2">
              <label class="text-sm font-medium">公司</label>
              <input id="fCompany" class="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
            </div>
            <div>
              <label class="text-sm font-medium">類型</label>
              <select id="fType" class="mt-1 w-full rounded-lg border px-3 py-2 text-sm">
                <option value="">全部</option>
                <option value="new">新單</option>
                <option value="reorder">翻單</option>
              </select>
            </div>
            <div>
              <label class="text-sm font-medium">狀態</label>
              <select id="fStatus" class="mt-1 w-full rounded-lg border px-3 py-2 text-sm">
                <option value="">全部</option>
                <option value="received">已收到</option>
                <option value="follow_up">跟進中</option>
                <option value="confirmed">已確認</option>
                <option value="production">量產中</option>
                <option value="shipping">運送中</option>
                <option value="done">已完成</option>
                <option value="cancelled">已取消</option>
              </select>
            </div>
            <div>
              <label class="text-sm font-medium">由</label>
              <input id="fFrom" type="date" class="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
            </div>
            <div>
              <label class="text-sm font-medium">至</label>
              <input id="fTo" type="date" class="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
            </div>
            <div class="sm:col-span-2 lg:col-span-2">
              <label class="text-sm font-medium">&nbsp;</label>
              <button id="applyFilterBtn" class="mt-1 w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700">套用篩選</button>
            </div>
          </div>
          <div id="adminMsg" class="mt-2 text-sm font-medium"></div>
        </div>
      </div>
    </section>

    <section class="mt-6 rounded-xl border bg-white p-5 shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-base font-semibold">訂單列表</h2>
        <div class="text-sm text-slate-600" id="summary"></div>
      </div>
      <div class="mt-4 overflow-x-auto">
        <table class="w-full min-w-[1100px] text-sm">
          <thead>
            <tr class="border-b bg-slate-50 text-left">
              <th class="px-3 py-2 font-medium">時間</th>
              <th class="px-3 py-2 font-medium">類型</th>
              <th class="px-3 py-2 font-medium">狀態</th>
              <th class="px-3 py-2 font-medium">公司</th>
              <th class="px-3 py-2 font-medium">聯絡人</th>
              <th class="px-3 py-2 font-medium">電話</th>
              <th class="px-3 py-2 font-medium">款式</th>
              <th class="px-3 py-2 font-medium">建議交貨日</th>
              <th class="px-3 py-2 font-medium">客戶交貨日</th>
              <th class="px-3 py-2 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody id="tbody"></tbody>
        </table>
      </div>
    </section>
  </div>

  <div id="modal" class="fixed inset-0 hidden items-center justify-center bg-black/40 p-4">
    <div class="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
      <div class="flex items-center justify-between border-b px-5 py-4">
        <div>
          <div class="text-base font-semibold">翻單（預填表再確認）</div>
          <div class="mt-1 text-xs text-slate-600">確認後會建立新一張翻單</div>
        </div>
        <button id="closeModal" class="rounded-lg border bg-white px-3 py-2 text-sm hover:bg-slate-50">關閉</button>
      </div>
      <div class="px-5 py-4">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label class="text-sm font-medium">公司</label>
            <input id="mCompany" class="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
          </div>
          <div>
            <label class="text-sm font-medium">聯絡人</label>
            <input id="mContact" class="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
          </div>
          <div>
            <label class="text-sm font-medium">電話</label>
            <input id="mPhone" class="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
          </div>
          <div>
            <label class="text-sm font-medium">送貨地址</label>
            <input id="mAddress" class="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
          </div>
          <div class="sm:col-span-2">
            <label class="text-sm font-medium">款式</label>
            <input id="mStyle" class="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
          </div>
          <div class="sm:col-span-2">
            <label class="text-sm font-medium">尺碼表（文字）</label>
            <textarea id="mSizeChart" class="mt-1 w-full rounded-lg border px-3 py-2 text-sm" rows="3"></textarea>
          </div>
          <div class="sm:col-span-2">
            <label class="text-sm font-medium">配比（摘要，只讀）</label>
            <input id="mRatio" class="mt-1 w-full rounded-lg border px-3 py-2 text-sm" readonly />
          </div>
          <div class="sm:col-span-2">
            <label class="text-sm font-medium">交貨日</label>
            <input id="mDeliveryDate" type="date" class="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
          </div>
        </div>
        <div id="modalMsg" class="mt-3 text-sm font-medium"></div>
      </div>
      <div class="flex items-center justify-end gap-2 border-t px-5 py-4">
        <button id="confirmReorder" class="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">確認翻單</button>
      </div>
    </div>
  </div>

  <script>
    const summary = document.getElementById('summary');
    const tbody = document.getElementById('tbody');
    const adminMsg = document.getElementById('adminMsg');

    const tokenInput = document.getElementById('tokenInput');
    const saveTokenBtn = document.getElementById('saveTokenBtn');

    const fPhone = document.getElementById('fPhone');
    const fCompany = document.getElementById('fCompany');
    const fType = document.getElementById('fType');
    const fStatus = document.getElementById('fStatus');
    const fFrom = document.getElementById('fFrom');
    const fTo = document.getElementById('fTo');
    const applyFilterBtn = document.getElementById('applyFilterBtn');

    const refreshBtn = document.getElementById('refreshBtn');
    const exportBtn = document.getElementById('exportBtn');

    const modal = document.getElementById('modal');
    const closeModal = document.getElementById('closeModal');
    const confirmReorder = document.getElementById('confirmReorder');
    const modalMsg = document.getElementById('modalMsg');

    const mCompany = document.getElementById('mCompany');
    const mContact = document.getElementById('mContact');
    const mPhone = document.getElementById('mPhone');
    const mAddress = document.getElementById('mAddress');
    const mStyle = document.getElementById('mStyle');
    const mSizeChart = document.getElementById('mSizeChart');
    const mRatio = document.getElementById('mRatio');
    const mDeliveryDate = document.getElementById('mDeliveryDate');

    let currentOrders = [];
    let currentSourceOrder = null;
    let holidays = new Set();

    function token() {
      return sessionStorage.getItem('adminToken') || '';
    }

    function authHeaders() {
      const t = token();
      return t ? { Authorization: `Bearer ${t}` } : {};
    }

    function typeBadge(t) {
      if (t === 'new') return '<span class="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">新單</span>';
      return '<span class="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">翻單</span>';
    }

    function statusLabel(s) {
      const map = {
        received: '已收到',
        follow_up: '跟進中',
        confirmed: '已確認',
        production: '量產中',
        shipping: '運送中',
        done: '已完成',
        cancelled: '已取消'
      };
      return map[s] || s;
    }

    function pad(n) { return String(n).padStart(2, '0'); }
    function addDaysYmd(ymd, days) {
      const d = new Date(`${ymd}T00:00:00.000Z`);
      d.setUTCDate(d.getUTCDate() + days);
      return d.toISOString().slice(0, 10);
    }
    function isWeekend(ymd) {
      const d = new Date(`${ymd}T00:00:00.000Z`);
      const day = d.getUTCDay();
      return day === 0 || day === 6;
    }
    function addBusinessDays(startYmd, businessDays) {
      let cursor = String(startYmd);
      let left = Number(businessDays);
      while (left > 0) {
        cursor = addDaysYmd(cursor, 1);
        if (isWeekend(cursor)) continue;
        if (holidays.has(cursor)) continue;
        left -= 1;
      }
      return cursor;
    }
    function hkTodayYmd() {
      return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Hong_Kong' });
    }

    function queryString(extra) {
      const p = new URLSearchParams();
      if (fPhone.value.trim()) p.set('phone', fPhone.value.trim());
      if (fCompany.value.trim()) p.set('company', fCompany.value.trim());
      if (fType.value) p.set('orderType', fType.value);
      if (fStatus.value) p.set('status', fStatus.value);
      if (fFrom.value) p.set('from', fFrom.value);
      if (fTo.value) p.set('to', fTo.value);
      if (extra && extra.format) p.set('format', extra.format);
      return p.toString();
    }

    function render(orders) {
      currentOrders = orders;
      summary.textContent = `${orders.length} 張訂單`;
      tbody.innerHTML = '';
      orders.forEach((o) => {
        const tr = document.createElement('tr');
        tr.className = 'border-b hover:bg-slate-50';
        tr.innerHTML = `
          <td class="px-3 py-2 text-slate-700">${new Date(o.createdAt).toLocaleString('zh-HK')}</td>
          <td class="px-3 py-2">${typeBadge(o.orderType)}</td>
          <td class="px-3 py-2">
            <select data-id="${o.id}" class="statusSel w-full rounded-lg border px-2 py-1 text-xs">
              <option value="received">已收到</option>
              <option value="follow_up">跟進中</option>
              <option value="confirmed">已確認</option>
              <option value="production">量產中</option>
              <option value="shipping">運送中</option>
              <option value="done">已完成</option>
              <option value="cancelled">已取消</option>
            </select>
          </td>
          <td class="px-3 py-2 font-medium">${o.companyName}</td>
          <td class="px-3 py-2">${o.contactName}</td>
          <td class="px-3 py-2">${o.phone}</td>
          <td class="px-3 py-2">${o.styleName}</td>
          <td class="px-3 py-2 font-medium">${o.suggestedDeliveryDate}</td>
          <td class="px-3 py-2">${o.requestedDeliveryDate}</td>
          <td class="px-3 py-2 text-right">
            <button data-id="${o.id}" class="reorderBtn rounded-lg border bg-white px-3 py-1.5 text-xs font-semibold hover:bg-slate-50">翻單</button>
          </td>
        `;
        tbody.appendChild(tr);
        const sel = tr.querySelector('.statusSel');
        sel.value = o.status || 'received';
      });

      document.querySelectorAll('.statusSel').forEach((sel) => {
        sel.addEventListener('change', async () => {
          const orderId = sel.dataset.id;
          const status = sel.value;
          adminMsg.textContent = '';
          const res = await fetch('/api/admin/orders/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify({ orderId, status })
          });
          const data = await res.json().catch(() => null);
          if (!data || !data.ok) {
            adminMsg.textContent = '更新狀態失敗';
            sel.value = (currentOrders.find((x) => x.id === orderId) || {}).status || 'received';
            return;
          }
          const o = currentOrders.find((x) => x.id === orderId);
          if (o) o.status = status;
          adminMsg.textContent = `已更新狀態：${statusLabel(status)}`;
        });
      });

      document.querySelectorAll('.reorderBtn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const o = currentOrders.find((x) => x.id === btn.dataset.id);
          if (!o) return;
          currentSourceOrder = o;
          mCompany.value = o.companyName || '';
          mContact.value = o.contactName || '';
          mPhone.value = o.phone || '';
          mAddress.value = o.address || '';
          mStyle.value = o.styleName || '';
          mSizeChart.value = '';
          mRatio.value = '';
          modalMsg.textContent = '';
          const earliest = addBusinessDays(hkTodayYmd(), 17);
          mDeliveryDate.min = earliest;
          mDeliveryDate.value = earliest;
          modal.classList.remove('hidden');
          modal.classList.add('flex');
        });
      });
    }

    async function loadOrders() {
      adminMsg.textContent = '';
      const qs = queryString();
      const res = await fetch(`/api/admin/orders?${qs}`, { headers: authHeaders() });
      const data = await res.json().catch(() => null);
      if (!data || !data.ok) {
        adminMsg.textContent = '載入失敗（請確認 Token）';
        render([]);
        return;
      }
      render(data.orders || []);
    }

    saveTokenBtn.addEventListener('click', () => {
      const t = tokenInput.value.trim();
      if (!t) {
        adminMsg.textContent = '請輸入 Token';
        return;
      }
      sessionStorage.setItem('adminToken', t);
      adminMsg.textContent = 'Token 已儲存';
      loadOrders();
    });

    applyFilterBtn.addEventListener('click', loadOrders);
    refreshBtn.addEventListener('click', loadOrders);

    exportBtn.addEventListener('click', () => {
      const qs = queryString({ format: 'csv' });
      const t = token();
      if (!t) {
        adminMsg.textContent = '請先輸入 Token';
        return;
      }
      const url = `/api/admin/orders?${qs}`;
      fetch(url, { headers: authHeaders() })
        .then((r) => r.blob())
        .then((blob) => {
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = 'orders.csv';
          a.click();
          URL.revokeObjectURL(a.href);
        })
        .catch(() => {
          adminMsg.textContent = '匯出失敗';
        });
    });

    closeModal.addEventListener('click', () => {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    });

    confirmReorder.addEventListener('click', async () => {
      if (!currentSourceOrder) return;
      modalMsg.textContent = '';
      const payload = {
        orderType: 'reorder',
        companyName: mCompany.value.trim(),
        contactName: mContact.value.trim(),
        phone: mPhone.value.trim(),
        address: mAddress.value.trim(),
        styleName: mStyle.value.trim(),
        sizeChart: mSizeChart.value,
        sizeRatio: [],
        requestedDeliveryDate: mDeliveryDate.value,
        sourceOrderId: currentSourceOrder.id
      };
      const res = await fetch('/api/orders/history?phone=' + encodeURIComponent(payload.phone));
      const hist = await res.json().catch(() => null);
      const src = hist && hist.ok ? (hist.orders || []).find((x) => x.id === currentSourceOrder.id) : null;
      payload.sizeRatio = src && Array.isArray(src.sizeRatio) ? src.sizeRatio : [];
      if (!payload.sizeRatio.length) {
        modalMsg.textContent = '找唔到原訂單配比，請用客戶端翻單';
        return;
      }

      const created = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then((r) => r.json()).catch(() => null);

      if (!created || !created.ok) {
        modalMsg.textContent = '翻單失敗';
        return;
      }

      modal.classList.add('hidden');
      modal.classList.remove('flex');
      adminMsg.textContent = '已建立翻單';
      loadOrders();
    });

    async function init() {
      const r = await fetch('/data/hk-holidays/2026.json').catch(() => null);
      const list = r ? await r.json().catch(() => []) : [];
      holidays = new Set(Array.isArray(list) ? list.map(String) : []);
      const t = token();
      if (t) tokenInput.value = t;
      if (t) loadOrders();
    }

    init();
  </script>
</body>
</html>
```

---

### Task 8: 本機驗證 + Vercel 部署設定

**Files:**
- (No code) Vercel dashboard 設定

- [ ] **Step 1: 本機靜態檔檢查**

Run:

```bash
python3 -m http.server 4173
```

Browse:

- `http://localhost:4173/`
- `http://localhost:4173/admin.html`（本機測試時用 .html）

- [ ] **Step 2: Vercel 環境變數**

在 Vercel Project Settings 加：

- `ADMIN_TOKEN`：後台密碼
- `POSTGRES_URL`：由 Vercel Postgres integration 自動提供（確認已存在）

- [ ] **Step 3: 部署後驗證**

- `/` 提交新單（交貨日不可早於最早值）
- `/` 以同一電話載入歷史 → 翻單提交
- `/admin` 輸入 token → 列表可見新單/翻單 + 建議交貨日 + 狀態可更新
- `/admin` 套用 filter 後匯出 CSV

---

## Plan Self-Review

- 規格覆蓋：新單/翻單、歷史帶入、工作日+假期交期、後台 token、狀態、搜尋/篩選、匯出 CSV、一鍵翻單
- Placeholder 掃描：無 TBD/TODO
- 命名一致：`orderType`/`status`/`suggestedDeliveryDate`/`requestedDeliveryDate`
