# 香港獨立站電商後台（第二階段：MVP 可營運）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在現有 Node + Express + EJS + session 架構上落地「售後 / 手動退款 / 每日對賬 / WhatsApp（wa.me）/ ShipAny 本地物流安全化 + 可用運費」五件日常營運必備能力。

**Architecture:** 後台頁面維持 EJS + 少量原生 JS。所有資料與權限集中走 `/api/admin/*`；支付/物流 webhook 走 `/webhooks/*`。資料表/欄位用 `migrations/*.sql` 以 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` 方式補齊，向後相容。

**Tech Stack:** Node.js（node:test）、Express、EJS、Postgres(pg)、express-session(connect-pg-simple)、原生 DOM + fetch、Node crypto(HMAC)

---

## Scope Check（拆分）

Spec 內含 5 個子系統，但互相耦合（orders/payment/shipping/after-sales），仍可作為同一個「可營運 MVP」計劃執行。若要再縮範圍，優先順序：
1) migrations + returns/refunds（先止血）
2) webhook 入 payment_transactions + reconciliation（日對賬）
3) ShipAny webhook 驗證 + shipping methods available（物流落地）
4) wa.me（加速營運溝通）

---

## Files Overview（會改動/新增嘅檔案）

**DB migrations**
- Create: `migrations/2026-05-03-phase2-ops.sql`

**Raw body（webhook signature）**
- Modify: `app.js`（保存 `req.rawBody`）
- Create: `utils/webhookSignatures.js`
- Test: `test/webhook-signatures.test.js`

**售後（退貨申請）**
- Modify: `routes/logistics.js`（補 `/api/admin/returns/:id`；移除改 `orders.status='refunded'`；寫 history）
- Create: `views/admin/returns.ejs`
- Create: `public/js/admin/returns.js`

**退款（手動）**
- Create: `routes/refunds.js`
- Create: `views/admin/refunds.ejs`
- Create: `public/js/admin/refunds.js`
- Create: `utils/refundsLogic.js`（純函數：訂單 payment_status 計算）
- Test: `test/refunds-logic.test.js`

**對賬**
- Create: `routes/reconciliation.js`
- Create: `utils/reconciliation.js`（純函數：matched/missing/mismatch 分類）
- Test: `test/reconciliation.test.js`
- Create: `views/admin/reconciliation.ejs`
- Create: `public/js/admin/reconciliation.js`

**支付 webhooks → payment_transactions**
- Modify: `routes/logistics.js`（三個 webhook 寫入/更新 payment_transactions）

**本地物流（可用性 + ShipAny webhook 驗證）**
- Modify: `routes/shipping.js`（真正按 district/zone 過濾）
- Modify: `routes/logistics.js`（ShipAny webhook 驗證）
- Create: `utils/shippingAvailability.js`（純函數：計費規則）
- Test: `test/shipping-availability.test.js`

**後台導覽**
- Modify: `routes/adminPages.js`（新增 /admin/returns /admin/refunds /admin/reconciliation）
- Modify: `views/admin/layout.ejs`（新增 menu）
- Modify: `public/js/admin/orders.js`（訂單詳情加 payment_status + wa.me + ShipAny 資訊）
- Modify: `routes/orders.js`（admin order detail query 補 user.whatsapp/marketing_consent；補 ShipAny/追蹤欄位選出）

**Route 防重**
- Modify: `test/admin-route-registry.test.js`（加 returns/refunds/reconciliation routes 唯一性檢查）

---

### Task 1: DB Migration（補齊 return_requests / orders 欄位 / histories / refunds 欄位 / indexes）

**Files:**
- Create: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/migrations/2026-05-03-phase2-ops.sql`

- [ ] **Step 1: 新增 migration SQL（先寫檔）**

```sql
-- Phase 2: After-sales / Refunds / Reconciliation / ShipAny tracking fields

-- 1) return_requests (missing in current repo schema)
CREATE TABLE IF NOT EXISTS return_requests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  items JSON,
  return_method VARCHAR(50) NOT NULL,
  images JSON,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  refund_amount DECIMAL(10,2),
  tracking_number VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_return_requests_order_id ON return_requests(order_id);
CREATE INDEX IF NOT EXISTS idx_return_requests_user_id ON return_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_return_requests_status ON return_requests(status);

-- 2) order_status_histories (routes use this name)
CREATE TABLE IF NOT EXISTS order_status_histories (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL,
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_order_status_histories_order_id ON order_status_histories(order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_histories_created_at ON order_status_histories(created_at);

-- 3) orders: add missing payment/shipping fields (safe if already exists)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method_code VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_transaction_id VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipany_label_url VARCHAR(500);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_status VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_updated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS district VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_point_id INTEGER REFERENCES pickup_points(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_method_id INTEGER REFERENCES shipping_methods(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_number VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_paid_at ON orders(paid_at);

-- 4) Backfill minimal payment_status from fulfillment status (one-time)
UPDATE orders
SET payment_status = 'paid'
WHERE payment_status IS NULL
  AND status IN ('paid', 'shipping', 'completed');

UPDATE orders
SET payment_status = 'pending'
WHERE payment_status IS NULL;

-- 5) refunds: add approval/rejection fields (safe if already exists)
ALTER TABLE refunds ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE refunds ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE refunds ADD COLUMN IF NOT EXISTS rejected_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE refunds ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE refunds ADD COLUMN IF NOT EXISTS note TEXT;

-- 6) payment_transactions: ensure uniqueness and indexes for reconciliation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'uniq_payment_transactions_method_tx'
  ) THEN
    CREATE UNIQUE INDEX uniq_payment_transactions_method_tx
      ON payment_transactions(payment_method_code, transaction_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_payment_transactions_order_id ON payment_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_created_at ON payment_transactions(created_at);
```

- [ ] **Step 2: 驗證 SQL 可被 psql 接受（本地）**

Run:

```bash
psql "$DATABASE_URL" -f migrations/2026-05-03-phase2-ops.sql
```

Expected: `CREATE TABLE` / `ALTER TABLE` / `CREATE INDEX` 成功，無 syntax error。

- [ ] **Step 3: Commit**

```bash
git add migrations/2026-05-03-phase2-ops.sql
git commit -m "db: phase2 ops tables and columns"
```

---

### Task 2: 保存 raw body + ShipAny webhook 簽名驗證（可測）

**Files:**
- Modify: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/app.js`
- Create: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/utils/webhookSignatures.js`
- Test: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/test/webhook-signatures.test.js`

- [ ] **Step 1: 寫 failing test（HMAC signature verify）**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

test('verifyShipanySignature: accepts valid hex hmac', () => {
  const { verifyShipanySignature } = require('../utils/webhookSignatures');
  const secret = 's3cr3t';
  const rawBody = Buffer.from('{"a":1,"b":2}', 'utf8');
  const sig = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  assert.equal(verifyShipanySignature({ secret, rawBody, headerValue: sig }), true);
});

test('verifyShipanySignature: rejects invalid signature', () => {
  const { verifyShipanySignature } = require('../utils/webhookSignatures');
  assert.equal(
    verifyShipanySignature({ secret: 's3cr3t', rawBody: Buffer.from('{"x":1}'), headerValue: 'deadbeef' }),
    false
  );
});
```

- [ ] **Step 2: 跑測試確認 fail（module 未存在）**

Run:

```bash
npm test
```

Expected: FAIL（Cannot find module `../utils/webhookSignatures`）。

- [ ] **Step 3: 新增 utils/webhookSignatures.js（最小實作）**

```js
const crypto = require('node:crypto');

function normalizeHexSignature(v) {
  const s = String(v || '').trim();
  if (!s) return '';
  if (s.startsWith('sha256=')) return s.slice('sha256='.length);
  return s;
}

function timingSafeEqualHex(aHex, bHex) {
  if (!aHex || !bHex) return false;
  const a = Buffer.from(aHex, 'hex');
  const b = Buffer.from(bHex, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function verifyShipanySignature({ secret, rawBody, headerValue }) {
  if (!secret) return false;
  if (!rawBody || !Buffer.isBuffer(rawBody)) return false;
  const provided = normalizeHexSignature(headerValue);
  if (!provided) return false;
  const expected = crypto.createHmac('sha256', String(secret)).update(rawBody).digest('hex');
  return timingSafeEqualHex(provided, expected);
}

module.exports = { verifyShipanySignature };
```

- [ ] **Step 4: 在 app.js 保存 raw body（讓 webhook 可做 HMAC）**

把：

```js
app.use(express.json());
```

改為：

```js
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  },
}));
```

- [ ] **Step 5: 跑測試確認 pass**

Run:

```bash
npm test
```

Expected: PASS（webhook-signatures 測試通過）。

- [ ] **Step 6: Commit**

```bash
git add app.js utils/webhookSignatures.js test/webhook-signatures.test.js
git commit -m "sec: capture rawBody and verify ShipAny webhook signature"
```

---

### Task 3: ShipAny webhook 驗證落地（拒絕無效簽名）

**Files:**
- Modify: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/routes/logistics.js`

- [ ] **Step 1: 寫一個 helper function（同 file 內即可）**

在 `POST /webhooks/shipany` 內加入：
- 若 `process.env.SHIPANY_WEBHOOK_SECRET` 有值：
  - 讀 `x-shipany-signature` header
  - 用 `req.rawBody` 計 HMAC（Task 2）並驗證
  - 不通過就 `403`

實作片段（直接插入到 shipany webhook handler 最開頭）：

```js
const { verifyShipanySignature } = require('../utils/webhookSignatures');

const webhookSecret = process.env.SHIPANY_WEBHOOK_SECRET;
if (webhookSecret) {
  const headerSig = req.headers['x-shipany-signature'] || req.headers['x-shipany-signature'.toUpperCase()];
  const ok = verifyShipanySignature({ secret: webhookSecret, rawBody: req.rawBody, headerValue: headerSig });
  if (!ok) return res.status(403).json({ success: false, error: 'Invalid signature' });
}
```

- [ ] **Step 2: 手動驗證（用 curl）**

Run:

```bash
node -e "const crypto=require('node:crypto'); const b=Buffer.from('{\"tracking_number\":\"TN1\",\"status\":\"in_transit\",\"updated_at\":\"2026-05-03T00:00:00Z\"}'); console.log(crypto.createHmac('sha256', process.env.SHIPANY_WEBHOOK_SECRET||'').update(b).digest('hex'))"
```

Expected: 打印出 hex signature；用呢個 signature 打：

```bash
curl -sS -X POST http://localhost:3000/webhooks/shipany \
  -H 'content-type: application/json' \
  -H "x-shipany-signature: <上面輸出>" \
  -d '{"tracking_number":"TN1","status":"in_transit","updated_at":"2026-05-03T00:00:00Z"}'
```

Expected: `{ "success": true }`（若無相關 tracking_number，仍應 success，不應 500）。

- [ ] **Step 3: Commit**

```bash
git add routes/logistics.js
git commit -m "sec: enforce ShipAny webhook signature verification"
```

---

### Task 4: 支付 webhooks 寫入 payment_transactions（對賬資料源）

**Files:**
- Modify: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/routes/logistics.js`

- [ ] **Step 1: 新增一個內部 function：upsertPaymentTransaction(pool, payload)**

直接加喺 webhooks 區段上面（同 file 內）：

```js
async function upsertPaymentTransaction(pool, { orderId, payment_method_code, transaction_id, amount, status, raw }) {
  await pool.query(`
    INSERT INTO payment_transactions
      (order_id, payment_method_code, transaction_id, amount, status, gateway_raw_response, created_at, updated_at)
    VALUES
      ($1, $2, $3, $4, $5, $6, NOW(), NOW())
    ON CONFLICT (payment_method_code, transaction_id)
    DO UPDATE SET
      order_id = EXCLUDED.order_id,
      amount = EXCLUDED.amount,
      status = EXCLUDED.status,
      gateway_raw_response = EXCLUDED.gateway_raw_response,
      updated_at = NOW()
  `, [orderId, payment_method_code, transaction_id, amount, status, raw ? JSON.stringify(raw) : null]);
}
```

- [ ] **Step 2: FPS/PayMe webhook：更新 orders 同時 upsert payment_transactions**

在 `/webhooks/fps-payme` 內：
- 用 `order_id` 直接寫入 `payment_transactions`
- `status === 'success'` → tx.status=`success`，否則 `failed`
- amount 由 body 傳入

```js
await upsertPaymentTransaction(pool, {
  orderId: order_id,
  payment_method_code: 'fps_payme',
  transaction_id,
  amount,
  status: status === 'success' ? 'success' : 'failed',
  raw: req.body,
});
```

- [ ] **Step 3: AlipayHK / WeChatPay：先查 order total_amount 再 upsert**

AlipayHK：
- 先 `SELECT id, total_amount FROM orders WHERE order_number=$1`
- 再用 `id/total_amount` 寫入 `payment_transactions`（payment_method_code: `alipayhk`）

WeChat：
- 同上（payment_method_code: `wechatpay_hk`）

- [ ] **Step 4: 跑測試**

Run:

```bash
npm test
```

Expected: PASS（現有測試不應受影響）。

- [ ] **Step 5: Commit**

```bash
git add routes/logistics.js
git commit -m "feat: upsert payment_transactions from payment webhooks"
```

---

### Task 5: 對賬純函數 + 單元測試（先做算法，再接 route）

**Files:**
- Create: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/utils/reconciliation.js`
- Test: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/test/reconciliation.test.js`

- [ ] **Step 1: 寫 failing test（分類 matched / missing / mismatch）**

```js
const test = require('node:test');
const assert = require('node:assert/strict');

test('reconcileDaily: classifies matched/missing/mismatch', () => {
  const { reconcileDaily } = require('../utils/reconciliation');

  const orders = [
    { id: 1, total_amount: 100, payment_status: 'paid' },
    { id: 2, total_amount: 200, payment_status: 'paid' },
    { id: 3, total_amount: 300, payment_status: 'paid' },
  ];

  const txs = [
    { order_id: 1, payment_method_code: 'fps_payme', transaction_id: 't1', amount: 100, status: 'success' },
    { order_id: 2, payment_method_code: 'fps_payme', transaction_id: 't2', amount: 199, status: 'success' },
  ];

  const out = reconcileDaily({ orders, transactions: txs });
  assert.equal(out.matched.length, 1);
  assert.equal(out.amount_mismatch.length, 1);
  assert.equal(out.missing_transaction.length, 1);
});
```

- [ ] **Step 2: 跑測試確認 fail（module 未存在）**

Run:

```bash
npm test
```

Expected: FAIL（Cannot find module `../utils/reconciliation`）。

- [ ] **Step 3: 新增 utils/reconciliation.js（最小實作）**

```js
function toNumber(n) {
  const x = Number(n);
  return Number.isFinite(x) ? x : null;
}

function reconcileDaily({ orders, transactions }) {
  const paidOrders = (orders || []).filter((o) => o && o.payment_status === 'paid');
  const successTx = (transactions || []).filter((t) => t && t.status === 'success');

  const txByOrderId = new Map();
  for (const t of successTx) {
    if (t.order_id == null) continue;
    if (!txByOrderId.has(t.order_id)) txByOrderId.set(t.order_id, []);
    txByOrderId.get(t.order_id).push(t);
  }

  const matched = [];
  const missing_transaction = [];
  const amount_mismatch = [];

  for (const o of paidOrders) {
    const txs = txByOrderId.get(o.id) || [];
    if (txs.length === 0) {
      missing_transaction.push({ order: o });
      continue;
    }
    const orderAmount = toNumber(o.total_amount);
    const ok = txs.some((t) => toNumber(t.amount) === orderAmount);
    if (ok) matched.push({ order: o, transactions: txs });
    else amount_mismatch.push({ order: o, transactions: txs });
  }

  const paidOrderIds = new Set(paidOrders.map((o) => o.id));
  const missing_order = successTx
    .filter((t) => t.order_id != null && !paidOrderIds.has(t.order_id))
    .map((t) => ({ transaction: t }));

  return { matched, missing_transaction, amount_mismatch, missing_order };
}

module.exports = { reconcileDaily };
```

- [ ] **Step 4: 跑測試確認 pass**

Run:

```bash
npm test
```

Expected: PASS（reconciliation.test.js 通過）。

- [ ] **Step 5: Commit**

```bash
git add utils/reconciliation.js test/reconciliation.test.js
git commit -m "feat: add daily reconciliation classifier"
```

---

### Task 6: Reconciliation API（/api/admin/reconciliation/daily）+ 後台頁

**Files:**
- Create: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/routes/reconciliation.js`
- Modify: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/app.js`
- Create: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/views/admin/reconciliation.ejs`
- Create: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/public/js/admin/reconciliation.js`

- [ ] **Step 1: 新增 routes/reconciliation.js**

```js
module.exports = function (app, pool) {
  const requireAdmin = require('./middleware/auth').requireAdmin;
  const { reconcileDaily } = require('../utils/reconciliation');

  app.get('/api/admin/reconciliation/daily', requireAdmin, async (req, res) => {
    try {
      const date = String(req.query.date || '').slice(0, 10);
      const method = req.query.payment_method_code ? String(req.query.payment_method_code) : null;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ error: 'date 格式必須為 YYYY-MM-DD' });
      }

      const dateStart = date + ' 00:00:00';
      const dateEnd = date + ' 23:59:59';

      const ordersParams = [dateStart, dateEnd];
      let ordersWhere = `o.payment_status = 'paid' AND COALESCE(o.paid_at, o.created_at) BETWEEN $1 AND $2`;
      if (method) {
        ordersWhere += ` AND o.payment_method_code = $3`;
        ordersParams.push(method);
      }

      const ordersResult = await pool.query(
        `SELECT o.id, o.order_number, o.total_amount, o.payment_status, o.payment_method_code, o.paid_at, o.created_at
         FROM orders o
         WHERE ${ordersWhere}
         ORDER BY COALESCE(o.paid_at, o.created_at) ASC`,
        ordersParams
      );

      const txParams = [dateStart, dateEnd];
      let txWhere = `t.status = 'success' AND t.created_at BETWEEN $1 AND $2`;
      if (method) {
        txWhere += ` AND t.payment_method_code = $3`;
        txParams.push(method);
      }

      const txResult = await pool.query(
        `SELECT t.order_id, t.payment_method_code, t.transaction_id, t.amount, t.status, t.created_at
         FROM payment_transactions t
         WHERE ${txWhere}
         ORDER BY t.created_at ASC`,
        txParams
      );

      const out = reconcileDaily({ orders: ordersResult.rows, transactions: txResult.rows });
      res.json({ date, payment_method_code: method, ...out });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });
};
```

- [ ] **Step 2: 在 app.js 載入 route**

在 routes 載入區加入：

```js
require('./routes/reconciliation')(app, pool);
```

- [ ] **Step 3: 新增後台頁 reconciliation.ejs**

```ejs
<div id="admin-reconciliation" class="space-y-3">
  <div class="flex flex-wrap gap-2 items-end">
    <label class="text-sm">
      <div class="mb-1">日期</div>
      <input id="recon-date" class="admin-input" type="date" />
    </label>
    <label class="text-sm">
      <div class="mb-1">支付方式（可選）</div>
      <input id="recon-method" class="admin-input" placeholder="例如 fps_payme" />
    </label>
    <button id="recon-run" class="admin-btn">生成差異表</button>
  </div>

  <div id="recon-error" class="admin-error hidden"></div>

  <div class="admin-card">
    <div class="font-bold mb-2">結果</div>
    <div id="recon-summary" class="text-sm text-gray-700">請先選日期</div>
  </div>

  <div class="admin-grid-2">
    <div class="admin-card">
      <div class="font-bold mb-2">Missing Transaction（有訂單、無交易）</div>
      <div id="recon-missing-tx" class="text-sm"></div>
    </div>
    <div class="admin-card">
      <div class="font-bold mb-2">Amount Mismatch（金額不符）</div>
      <div id="recon-mismatch" class="text-sm"></div>
    </div>
  </div>

  <div class="admin-card">
    <div class="font-bold mb-2">Missing Order（有交易、訂單未標 paid）</div>
    <div id="recon-missing-order" class="text-sm"></div>
  </div>

  <script src="/js/admin/common.js"></script>
  <script src="/js/admin/reconciliation.js"></script>
</div>
```

- [ ] **Step 4: 新增前端 JS reconciliation.js**

```js
(async function () {
  const { $, el, adminApiRequest } = window.AdminCommon;

  const els = {
    date: $('#recon-date'),
    method: $('#recon-method'),
    run: $('#recon-run'),
    error: $('#recon-error'),
    summary: $('#recon-summary'),
    missingTx: $('#recon-missing-tx'),
    mismatch: $('#recon-mismatch'),
    missingOrder: $('#recon-missing-order'),
  };

  function setError(msg) {
    if (!msg) {
      els.error.classList.add('hidden');
      els.error.textContent = '';
      return;
    }
    els.error.classList.remove('hidden');
    els.error.textContent = msg;
  }

  function money(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return String(n ?? '');
    return 'HK$ ' + x.toFixed(2);
  }

  function renderList(container, rows, renderRow) {
    container.textContent = '';
    if (!rows || rows.length === 0) {
      container.appendChild(el('div', { class: 'text-gray-500', text: '（無）' }));
      return;
    }
    for (const r of rows) container.appendChild(renderRow(r));
  }

  async function run() {
    setError('');
    const date = els.date.value;
    if (!date) {
      setError('請先選日期');
      return;
    }
    const params = new URLSearchParams();
    params.set('date', date);
    const method = (els.method.value || '').trim();
    if (method) params.set('payment_method_code', method);

    const out = await adminApiRequest('/api/admin/reconciliation/daily?' + params.toString());
    els.summary.textContent =
      `matched=${out.matched.length} / missing_transaction=${out.missing_transaction.length} / amount_mismatch=${out.amount_mismatch.length} / missing_order=${out.missing_order.length}`;

    renderList(els.missingTx, out.missing_transaction, (x) =>
      el('div', { class: 'py-1 border-b border-gray-200', text: `訂單 #${x.order.id} 金額 ${money(x.order.total_amount)}` })
    );
    renderList(els.mismatch, out.amount_mismatch, (x) =>
      el('div', { class: 'py-1 border-b border-gray-200', text: `訂單 #${x.order.id} 訂單金額 ${money(x.order.total_amount)}（交易數：${x.transactions.length}）` })
    );
    renderList(els.missingOrder, out.missing_order, (x) =>
      el('div', { class: 'py-1 border-b border-gray-200', text: `交易 ${x.transaction.payment_method_code}:${x.transaction.transaction_id} 訂單ID=${x.transaction.order_id} 金額 ${money(x.transaction.amount)}` })
    );
  }

  const today = new Date();
  els.date.value = today.toISOString().slice(0, 10);
  els.run.addEventListener('click', () => run().catch((e) => setError(e.message)));
})();
```

- [ ] **Step 5: 跑測試**

Run:

```bash
npm test
```

Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add routes/reconciliation.js views/admin/reconciliation.ejs public/js/admin/reconciliation.js app.js
git commit -m "feat: add daily reconciliation API and admin page"
```

---

### Task 7: 退款 API（手動退款閉環）+ 純函數測試

**Files:**
- Create: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/utils/refundsLogic.js`
- Test: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/test/refunds-logic.test.js`
- Create: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/routes/refunds.js`
- Modify: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/app.js`

- [ ] **Step 1: 寫 failing test（full vs partial → payment_status）**

```js
const test = require('node:test');
const assert = require('node:assert/strict');

test('computePaymentStatusAfterRefund: full refund', () => {
  const { computePaymentStatusAfterRefund } = require('../utils/refundsLogic');
  assert.equal(computePaymentStatusAfterRefund({ orderTotal: 100, refundAmount: 100 }), 'refunded');
});

test('computePaymentStatusAfterRefund: partial refund', () => {
  const { computePaymentStatusAfterRefund } = require('../utils/refundsLogic');
  assert.equal(computePaymentStatusAfterRefund({ orderTotal: 100, refundAmount: 10 }), 'partial_refunded');
});
```

- [ ] **Step 2: 新增 utils/refundsLogic.js**

```js
function computePaymentStatusAfterRefund({ orderTotal, refundAmount }) {
  const total = Number(orderTotal);
  const refund = Number(refundAmount);
  if (!Number.isFinite(total) || !Number.isFinite(refund)) return 'partial_refunded';
  if (refund >= total) return 'refunded';
  return 'partial_refunded';
}

module.exports = { computePaymentStatusAfterRefund };
```

- [ ] **Step 3: 新增 routes/refunds.js（admin only）**

```js
module.exports = function (app, pool) {
  const requireAdmin = require('./middleware/auth').requireAdmin;
  const { computePaymentStatusAfterRefund } = require('../utils/refundsLogic');

  app.get('/api/admin/refunds', requireAdmin, async (req, res) => {
    try {
      const status = req.query.status ? String(req.query.status) : null;
      const q = req.query.q ? String(req.query.q) : '';

      let where = '1=1';
      const params = [];
      if (status) {
        params.push(status);
        where += ` AND r.status = $${params.length}`;
      }
      if (q) {
        params.push(`%${q}%`);
        where += ` AND (o.order_number ILIKE $${params.length} OR o.id::text ILIKE $${params.length})`;
      }

      const result = await pool.query(
        `SELECT r.*, o.order_number, o.total_amount, o.payment_status
         FROM refunds r
         JOIN orders o ON r.order_id = o.id
         WHERE ${where}
         ORDER BY r.created_at DESC`,
        params
      );
      res.json({ refunds: result.rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  app.post('/api/admin/refunds', requireAdmin, async (req, res) => {
    try {
      const { order_id, reason, type, amount } = req.body || {};
      if (!order_id || !reason || !type || amount === undefined) {
        return res.status(400).json({ error: 'order_id / reason / type / amount 必填' });
      }
      const out = await pool.query(
        `INSERT INTO refunds (order_id, reason, amount, type, status, created_at)
         VALUES ($1, $2, $3, $4, 'pending', NOW())
         RETURNING *`,
        [order_id, reason, amount, type]
      );
      await pool.query(
        `INSERT INTO order_status_histories (order_id, status, notes, created_by)
         VALUES ($1, 'refund_requested', $2, $3)`,
        [order_id, `退款申請：${type} ${amount}`, req.user.id]
      );
      res.json({ success: true, refund: out.rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  app.post('/api/admin/refunds/:id/approve', requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const r = await pool.query(
        `UPDATE refunds
         SET status='approved', approved_by=$1, approved_at=NOW()
         WHERE id=$2
         RETURNING *`,
        [req.user.id, id]
      );
      if (r.rows.length === 0) return res.status(404).json({ error: '退款單不存在' });
      await pool.query(
        `INSERT INTO order_status_histories (order_id, status, notes, created_by)
         VALUES ($1, 'refund_approved', $2, $3)`,
        [r.rows[0].order_id, `退款已批准：${r.rows[0].amount}`, req.user.id]
      );
      res.json({ success: true, refund: r.rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  app.post('/api/admin/refunds/:id/reject', requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const note = req.body && req.body.note ? String(req.body.note) : '';
      if (!note) return res.status(400).json({ error: 'note 必填' });
      const r = await pool.query(
        `UPDATE refunds
         SET status='rejected', rejected_by=$1, rejected_at=NOW(), note=$2
         WHERE id=$3
         RETURNING *`,
        [req.user.id, note, id]
      );
      if (r.rows.length === 0) return res.status(404).json({ error: '退款單不存在' });
      await pool.query(
        `INSERT INTO order_status_histories (order_id, status, notes, created_by)
         VALUES ($1, 'refund_rejected', $2, $3)`,
        [r.rows[0].order_id, `退款被拒絕：${note}`, req.user.id]
      );
      res.json({ success: true, refund: r.rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  app.post('/api/admin/refunds/:id/complete', requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { refund_transaction_id, payment_transaction_id, note } = req.body || {};
      if (!refund_transaction_id) return res.status(400).json({ error: 'refund_transaction_id 必填' });

      const r = await pool.query(`SELECT * FROM refunds WHERE id=$1`, [id]);
      if (r.rows.length === 0) return res.status(404).json({ error: '退款單不存在' });
      const refund = r.rows[0];

      const o = await pool.query(`SELECT id, total_amount FROM orders WHERE id=$1`, [refund.order_id]);
      if (o.rows.length === 0) return res.status(404).json({ error: '訂單不存在' });
      const order = o.rows[0];

      const paymentStatus = computePaymentStatusAfterRefund({ orderTotal: order.total_amount, refundAmount: refund.amount });

      await pool.query(
        `UPDATE refunds
         SET status='completed', refund_transaction_id=$1, payment_transaction_id=$2,
             processed_by=$3, processed_at=NOW(), note=COALESCE($4, note)
         WHERE id=$5`,
        [refund_transaction_id, payment_transaction_id || null, req.user.id, note || null, id]
      );

      await pool.query(
        `UPDATE orders SET payment_status=$1, updated_at=NOW() WHERE id=$2`,
        [paymentStatus, refund.order_id]
      );

      await pool.query(
        `INSERT INTO order_status_histories (order_id, status, notes, created_by)
         VALUES ($1, 'refund_completed', $2, $3)`,
        [refund.order_id, `退款完成：${refund.amount}（憑證：${refund_transaction_id}）`, req.user.id]
      );

      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });
};
```

- [ ] **Step 4: 在 app.js 載入 routes/refunds**

```js
require('./routes/refunds')(app, pool);
```

- [ ] **Step 5: 跑測試**

Run:

```bash
npm test
```

Expected: PASS（refunds-logic 測試通過）。

- [ ] **Step 6: Commit**

```bash
git add utils/refundsLogic.js test/refunds-logic.test.js routes/refunds.js app.js
git commit -m "feat: add manual refunds admin API"
```

---

### Task 8: 售後（returns）API 修正 + 後台頁

**Files:**
- Modify: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/routes/logistics.js`
- Create: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/views/admin/returns.ejs`
- Create: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/public/js/admin/returns.js`

- [ ] **Step 1: 補 `/api/admin/returns/:id`**

在 returns 區段新增：

```js
app.get('/api/admin/returns/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const r = await pool.query(
      `SELECT r.*, o.order_number, o.total_amount, o.payment_status, u.username, u.whatsapp, u.marketing_consent
       FROM return_requests r
       JOIN orders o ON r.order_id = o.id
       JOIN users u ON r.user_id = u.id
       WHERE r.id = $1`,
      [id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: '售後單不存在' });
    res.json({ return_request: r.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服務器錯誤' });
  }
});
```

- [ ] **Step 2: 移除「approved 就改 orders.status='refunded'」**

刪走：

```js
if (status === 'approved') {
  ... UPDATE orders SET status='refunded' ...
}
```

改為：只寫 `order_status_histories` 留痕（例如 `return_status:<status>`）。

```js
await pool.query(
  `INSERT INTO order_status_histories (order_id, status, notes, created_by)
   SELECT order_id, $1, $2, $3 FROM return_requests WHERE id = $4`,
  [`return_${status}`, admin_note || null, req.user.id, id]
);
```

- [ ] **Step 3: 新增 returns 後台頁（returns.ejs）**

```ejs
<div id="admin-returns" class="space-y-3">
  <div class="flex flex-wrap gap-2 items-end">
    <label class="text-sm">
      <div class="mb-1">狀態</div>
      <select id="returns-status" class="admin-input">
        <option value="">全部</option>
        <option value="pending">待審批</option>
        <option value="approved">已批准</option>
        <option value="in_transit">退回中</option>
        <option value="received">已收貨</option>
        <option value="inspected">已驗貨</option>
        <option value="refunded">已退款</option>
        <option value="rejected">已拒絕</option>
      </select>
    </label>
    <button id="returns-refresh" class="admin-btn">刷新</button>
  </div>

  <div id="returns-error" class="admin-error hidden"></div>

  <div class="admin-grid-2">
    <div class="admin-card">
      <table class="admin-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>訂單</th>
            <th>客戶</th>
            <th>狀態</th>
            <th>建立時間</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="returns-tbody"></tbody>
      </table>
    </div>
    <div class="admin-card">
      <div class="font-bold mb-2">售後詳情</div>
      <div id="return-detail" class="text-sm text-gray-700">請喺左邊揀一張售後單</div>
    </div>
  </div>

  <script src="/js/admin/common.js"></script>
  <script src="/js/admin/returns.js"></script>
</div>
```

- [ ] **Step 4: 新增 returns.js（列表＋詳情＋改狀態＋一鍵建立退款）**

```js
(async function () {
  const { $, el, adminApiRequest } = window.AdminCommon;

  const els = {
    status: $('#returns-status'),
    refresh: $('#returns-refresh'),
    error: $('#returns-error'),
    tbody: $('#returns-tbody'),
    detail: $('#return-detail'),
  };

  function setError(msg) {
    if (!msg) {
      els.error.classList.add('hidden');
      els.error.textContent = '';
      return;
    }
    els.error.classList.remove('hidden');
    els.error.textContent = msg;
  }

  const statusLabel = {
    pending: '待審批',
    approved: '已批准',
    in_transit: '退回中',
    received: '已收貨',
    inspected: '已驗貨',
    refunded: '已退款',
    rejected: '已拒絕',
  };

  async function loadList() {
    setError('');
    els.tbody.textContent = '';
    els.detail.textContent = '請喺左邊揀一張售後單';
    const params = new URLSearchParams();
    if (els.status.value) params.set('status', els.status.value);
    const data = await adminApiRequest('/api/admin/returns?' + params.toString());
    const rows = data.returns || [];
    for (const r of rows) {
      els.tbody.appendChild(el('tr', {}, [
        el('td', { text: String(r.id) }),
        el('td', { text: r.order_number || String(r.order_id) }),
        el('td', { text: r.username || '' }),
        el('td', { text: statusLabel[r.status] || r.status }),
        el('td', { text: r.created_at ? String(r.created_at) : '' }),
        el('td', {}, [el('button', { class: 'admin-link-btn', text: '打開', onclick: () => openDetail(r.id) })]),
      ]));
    }
  }

  async function openDetail(id) {
    setError('');
    els.detail.textContent = '載入中…';
    const data = await adminApiRequest('/api/admin/returns/' + encodeURIComponent(id));
    const rr = data.return_request;

    const statusSel = el('select', { class: 'admin-input' }, Object.entries(statusLabel).map(([k, v]) => el('option', { value: k, text: v })));
    statusSel.value = rr.status;

    const adminNote = el('textarea', { class: 'admin-input w-full', rows: '3' }, []);
    adminNote.value = rr.admin_note || '';

    const refundAmount = el('input', { class: 'admin-input w-full', type: 'number', step: '0.01', value: rr.refund_amount || '' });
    const tracking = el('input', { class: 'admin-input w-full', value: rr.tracking_number || '', placeholder: '退貨單號（可選）' });

    const saveBtn = el('button', {
      class: 'admin-btn',
      text: '更新售後狀態',
      onclick: async () => {
        saveBtn.disabled = true;
        try {
          await adminApiRequest('/api/admin/returns/' + encodeURIComponent(id) + '/status', {
            method: 'PUT',
            json: {
              status: statusSel.value,
              admin_note: adminNote.value || null,
              refund_amount: refundAmount.value || null,
              tracking_number: tracking.value || null,
            },
          });
          await loadList();
          await openDetail(id);
        } catch (e) {
          setError(e.message);
        } finally {
          saveBtn.disabled = false;
        }
      },
    });

    const createRefundBtn = el('button', {
      class: 'admin-btn-secondary',
      text: '建立退款單',
      onclick: async () => {
        const amount = Number(refundAmount.value || rr.refund_amount || rr.total_amount || 0);
        const reason = rr.reason || '售後退款';
        await adminApiRequest('/api/admin/refunds', {
          method: 'POST',
          json: { order_id: rr.order_id, reason, type: amount >= Number(rr.total_amount) ? 'full' : 'partial', amount },
        });
        alert('已建立退款單，請到「退款」頁審批/完成');
      },
    });

    els.detail.textContent = '';
    els.detail.appendChild(el('div', { class: 'space-y-2' }, [
      el('div', { class: 'font-bold', text: `售後 #${rr.id}` }),
      el('div', { text: `訂單：${rr.order_number || rr.order_id}／客戶：${rr.username || ''}` }),
      el('div', { text: `原因：${rr.reason || ''}` }),
      el('div', { text: `狀態：${statusLabel[rr.status] || rr.status}` }),
      el('label', { class: 'text-sm block' }, [el('div', { class: 'mb-1', text: '狀態' }), statusSel]),
      el('label', { class: 'text-sm block' }, [el('div', { class: 'mb-1', text: '退款金額（可選）' }), refundAmount]),
      el('label', { class: 'text-sm block' }, [el('div', { class: 'mb-1', text: '退貨單號（可選）' }), tracking]),
      el('label', { class: 'text-sm block' }, [el('div', { class: 'mb-1', text: '內部備註' }), adminNote]),
      el('div', { class: 'flex gap-2' }, [saveBtn, createRefundBtn]),
    ]));
  }

  els.refresh.addEventListener('click', () => loadList().catch((e) => setError(e.message)));
  els.status.addEventListener('change', () => loadList().catch((e) => setError(e.message)));

  try {
    await loadList();
  } catch (e) {
    setError(e.message);
  }
})();
```

- [ ] **Step 5: 跑測試**

Run:

```bash
npm test
```

Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add routes/logistics.js views/admin/returns.ejs public/js/admin/returns.js
git commit -m "feat: returns admin detail and UI; stop mutating orders.status"
```

---

### Task 9: Shipping methods available 真正按 district/zone 過濾 + 計費（可測）

**Files:**
- Create: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/utils/shippingAvailability.js`
- Test: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/test/shipping-availability.test.js`
- Modify: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/routes/shipping.js`

- [ ] **Step 1: 寫 failing test（free shipping threshold / min order）**

```js
const test = require('node:test');
const assert = require('node:assert/strict');

test('computeShippingFee: applies free shipping threshold', () => {
  const { computeShippingFee } = require('../utils/shippingAvailability');
  assert.equal(computeShippingFee({ shipping_fee: 20, free_shipping_threshold: 100, min_order_amount: null }, 100), 0);
});

test('computeShippingFee: blocks under min order', () => {
  const { computeShippingFee } = require('../utils/shippingAvailability');
  assert.equal(computeShippingFee({ shipping_fee: 20, free_shipping_threshold: null, min_order_amount: 200 }, 100), null);
});
```

- [ ] **Step 2: 新增 utils/shippingAvailability.js**

```js
function computeShippingFee(method, totalAmount) {
  const total = Number(totalAmount);
  const fee = Number(method.shipping_fee);
  const min = method.min_order_amount === null || method.min_order_amount === undefined ? null : Number(method.min_order_amount);
  const free = method.free_shipping_threshold === null || method.free_shipping_threshold === undefined ? null : Number(method.free_shipping_threshold);

  if (min !== null && Number.isFinite(min) && Number.isFinite(total) && total < min) return null;
  if (free !== null && Number.isFinite(free) && Number.isFinite(total) && total >= free) return 0;
  return Number.isFinite(fee) ? fee : null;
}

module.exports = { computeShippingFee };
```

- [ ] **Step 3: 修改 routes/shipping.js：用 zone.districts JSON 過濾**

把 `/api/shipping/methods/available` SQL 改成：
- 若有 `district`：只回 `shipping_zones.districts` 包含該 district 嘅 methods
- 無 district：回全部 active

SQL 片段（district 有值時）：

```sql
WHERE sm.is_active = true
  AND EXISTS (
    SELECT 1
    FROM json_array_elements_text(sz.districts) d
    WHERE d = $1
  )
```

然後用 `computeShippingFee(method, total_amount)` 計 `calculated_fee`。

- [ ] **Step 4: 跑測試**

Run:

```bash
npm test
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add utils/shippingAvailability.js test/shipping-availability.test.js routes/shipping.js
git commit -m "feat: filter shipping methods by district zone and compute fee"
```

---

### Task 10: 後台頁面與導覽整合（returns/refunds/reconciliation + orders wa.me）

**Files:**
- Modify: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/routes/adminPages.js`
- Modify: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/views/admin/layout.ejs`
- Create: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/views/admin/refunds.ejs`
- Create: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/public/js/admin/refunds.js`
- Modify: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/views/admin/orders.ejs`（如需）
- Modify: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/public/js/admin/orders.js`
- Modify: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/routes/orders.js`
- Modify: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/test/admin-route-registry.test.js`

- [ ] **Step 1: adminPages.js 加三個新頁**

新增：

```js
app.get('/admin/returns', requireAdminPage(), (req, res) => {
  res.render('admin/layout', { title: '售後管理', active: 'returns', content: 'returns' });
});
app.get('/admin/refunds', requireAdminPage(), (req, res) => {
  res.render('admin/layout', { title: '退款管理', active: 'refunds', content: 'refunds' });
});
app.get('/admin/reconciliation', requireAdminPage(), (req, res) => {
  res.render('admin/layout', { title: '對賬', active: 'reconciliation', content: 'reconciliation' });
});
```

- [ ] **Step 2: layout.ejs menu 加三條 link**

在 sidebar 加：

```ejs
<a class="admin-link <%= active==='returns' ? 'active' : '' %>" href="/admin/returns">售後</a>
<a class="admin-link <%= active==='refunds' ? 'active' : '' %>" href="/admin/refunds">退款</a>
<a class="admin-link <%= active==='reconciliation' ? 'active' : '' %>" href="/admin/reconciliation">對賬</a>
```

- [ ] **Step 3: 新增 refunds.ejs + refunds.js（列表 + 建立/審批/完成）**

`views/admin/refunds.ejs`：

```ejs
<div id="admin-refunds" class="space-y-3">
  <div class="flex flex-wrap gap-2 items-end">
    <label class="text-sm">
      <div class="mb-1">狀態</div>
      <select id="refunds-status" class="admin-input">
        <option value="">全部</option>
        <option value="pending">待審批</option>
        <option value="approved">已批准</option>
        <option value="completed">已完成</option>
        <option value="rejected">已拒絕</option>
      </select>
    </label>
    <label class="text-sm">
      <div class="mb-1">搜尋（訂單號/ID）</div>
      <input id="refunds-q" class="admin-input" placeholder="例如：HK2026... / 123" />
    </label>
    <button id="refunds-refresh" class="admin-btn">刷新</button>
  </div>

  <div id="refunds-error" class="admin-error hidden"></div>

  <div class="admin-grid-2">
    <div class="admin-card">
      <table class="admin-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>訂單</th>
            <th>金額</th>
            <th>狀態</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="refunds-tbody"></tbody>
      </table>
    </div>
    <div class="admin-card">
      <div class="font-bold mb-2">退款操作</div>
      <div id="refund-detail" class="text-sm text-gray-700">請喺左邊揀一張退款單</div>
    </div>
  </div>

  <script src="/js/admin/common.js"></script>
  <script src="/js/admin/refunds.js"></script>
</div>
```

`public/js/admin/refunds.js`：

```js
(async function () {
  const { $, el, adminApiRequest } = window.AdminCommon;

  const els = {
    status: $('#refunds-status'),
    q: $('#refunds-q'),
    refresh: $('#refunds-refresh'),
    error: $('#refunds-error'),
    tbody: $('#refunds-tbody'),
    detail: $('#refund-detail'),
  };

  function setError(msg) {
    if (!msg) {
      els.error.classList.add('hidden');
      els.error.textContent = '';
      return;
    }
    els.error.classList.remove('hidden');
    els.error.textContent = msg;
  }

  const statusLabel = { pending: '待審批', approved: '已批准', processing: '處理中', completed: '已完成', rejected: '已拒絕' };

  async function loadList() {
    setError('');
    els.tbody.textContent = '';
    els.detail.textContent = '請喺左邊揀一張退款單';
    const params = new URLSearchParams();
    if (els.status.value) params.set('status', els.status.value);
    const q = (els.q.value || '').trim();
    if (q) params.set('q', q);
    const data = await adminApiRequest('/api/admin/refunds?' + params.toString());
    const rows = data.refunds || [];
    for (const r of rows) {
      els.tbody.appendChild(el('tr', {}, [
        el('td', { text: String(r.id) }),
        el('td', { text: r.order_number || String(r.order_id) }),
        el('td', { text: 'HK$ ' + Number(r.amount).toFixed(2) }),
        el('td', { text: statusLabel[r.status] || r.status }),
        el('td', {}, [el('button', { class: 'admin-link-btn', text: '打開', onclick: () => openDetail(r) })]),
      ]));
    }
  }

  async function openDetail(r) {
    els.detail.textContent = '';
    const approveBtn = el('button', { class: 'admin-btn', text: '批准', onclick: async () => {
      approveBtn.disabled = true;
      try { await adminApiRequest('/api/admin/refunds/' + r.id + '/approve', { method: 'POST', json: {} }); await loadList(); } finally { approveBtn.disabled = false; }
    }});
    const rejectBtn = el('button', { class: 'admin-btn-secondary', text: '拒絕', onclick: async () => {
      const note = prompt('拒絕原因（必填）'); if (!note) return;
      await adminApiRequest('/api/admin/refunds/' + r.id + '/reject', { method: 'POST', json: { note } }); await loadList();
    }});
    const completeBtn = el('button', { class: 'admin-btn', text: '完成退款', onclick: async () => {
      const tx = prompt('輸入退款憑證/交易號（必填）'); if (!tx) return;
      await adminApiRequest('/api/admin/refunds/' + r.id + '/complete', { method: 'POST', json: { refund_transaction_id: tx } }); await loadList();
    }});

    els.detail.appendChild(el('div', { class: 'space-y-2' }, [
      el('div', { class: 'font-bold', text: `退款 #${r.id}` }),
      el('div', { text: `訂單：${r.order_number || r.order_id}` }),
      el('div', { text: `金額：HK$ ${Number(r.amount).toFixed(2)}／狀態：${statusLabel[r.status] || r.status}` }),
      el('div', { class: 'flex gap-2' }, [approveBtn, rejectBtn, completeBtn]),
    ]));
  }

  els.refresh.addEventListener('click', () => loadList().catch((e) => setError(e.message)));
  els.status.addEventListener('change', () => loadList().catch((e) => setError(e.message)));
  els.q.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') loadList().catch((e) => setError(e.message)); });

  await loadList();
})();
```

- [ ] **Step 4: orders.js 訂單詳情加 payment_status + wa.me + ShipAny**

修改 `public/js/admin/orders.js` `openOrder()` render 區：
- 顯示 `order.payment_status`（若無就顯示空）
- 生成 WhatsApp wa.me link（需要 order 詳情 query 有 `whatsapp` + `marketing_consent`）
- 顯示 ShipAny label URL（`shipany_label_url`）與 tracking_status（如有）

wa.me helper（放在 orders.js 內）：

```js
function toWaE164(hkNumber) {
  const digits = String(hkNumber || '').replace(/[^\d]/g, '');
  if (!digits) return null;
  if (digits.startsWith('852')) return digits;
  if (digits.length === 8) return '852' + digits;
  return digits;
}
function buildWaLink(numberE164, text) {
  if (!numberE164) return null;
  return 'https://wa.me/' + encodeURIComponent(numberE164) + '?text=' + encodeURIComponent(text || '');
}
```

付款提醒文字（例）：

```js
const msgPay = `你好，我哋係 OHYA2.0。\n你嘅訂單 #${order.id} 目前狀態：${statusLabel[order.status] || order.status}\n如已付款可忽略，多謝。`;
```

- [ ] **Step 5: orders admin detail API 補欄位（whatsapp/consent/shipany/tracking/payment_status）**

修改 `routes/orders.js` `GET /api/admin/orders/:id` query：
- `SELECT o.*, u.username, u.contact, u.whatsapp, u.marketing_consent`
- 確保包含 `o.payment_status, o.shipany_label_url, o.tracking_status, o.tracking_updated_at`

- [ ] **Step 6: 更新 admin-route-registry.test.js（防重）**

新增以下 unique 檢查（同模式 count）：
- `GET /api/admin/refunds` 只能一次（routes/refunds.js）
- `GET /api/admin/reconciliation/daily` 只能一次（routes/reconciliation.js）
- `GET /api/admin/returns` 仍然一次（routes/logistics.js）

- [ ] **Step 7: 跑測試 + 手動驗證**

Run:

```bash
npm test
npm run dev
```

Expected:
- `/admin/returns` 可用（列表/詳情/改狀態/建立退款單）
- `/admin/refunds` 可用（批准/拒絕/完成退款）
- `/admin/reconciliation` 可用（生成差異表）
- `/admin/orders` 詳情顯示 payment_status、ShipAny、WhatsApp wa.me 按鈕

- [ ] **Step 8: Commit**

```bash
git add routes/adminPages.js views/admin/layout.ejs views/admin/refunds.ejs public/js/admin/refunds.js public/js/admin/orders.js routes/orders.js test/admin-route-registry.test.js
git commit -m "feat: phase2 admin pages and order whatsapp/shipany panels"
```

---

## Spec Coverage Self-Review

- Spec: return_requests 缺表 → Task 1 建表；Task 8 補 admin detail 與 UI。
- Spec: refunds 手動閉環 → Task 7 API + payment_status 更新 + history。
- Spec: payment_transactions 對賬源 → Task 1 unique/index；Task 4 webhook upsert。
- Spec: reconciliation daily endpoint + UI → Task 5/6。
- Spec: ShipAny webhook 驗證 → Task 2/3（rawBody + HMAC）。
- Spec: shipping methods available 按 district/zone → Task 9。
- Spec: wa.me → Task 10（orders 詳情 panel）。

Placeholder scan：已避免 TBD/TODO；webhook signature scheme 固定為 `HMAC_SHA256(secret, rawBody)` hex 並支持 `sha256=` 前綴。

