# 香港獨立站電商後台（MVP 可營運版）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把現有 `/admin/*` 後台由「JSON viewer」升級成可日常營運嘅 MVP（可管理商品/分類/訂單/會員），同時先解決 `/api/admin/*` 路由重複衝突，確保行為一致。

**Architecture:** 繼續用 Node + Express + EJS + session。後台頁面 EJS 只 render layout + 容器，資料同操作一律走 `/api/admin/*`；前端用少量原生 JS（無額外框架）渲染表格與表單。

**Tech Stack:** Node.js (node:test)、Express、EJS、Postgres(pg)、express-session(connect-pg-simple)、原生 DOM + fetch

---

## Scope Check（拆分）

完整「Full Ops Backoffice」包含售後工單、退款審批、對賬、棄單召回、WhatsApp 整合、地址校驗、物流承運商整合等多個獨立子系統。為確保每次交付都可用可測，本計劃只做 **MVP 可營運版（商品/分類/訂單/會員 + 基礎工具）**。

後續第二階段（售後/退款/對賬/通知/本地物流）會另寫一份 plan。

---

## 目標行為（完成後你應該做到）

- 管理員登入後台後，可以：
  - 睇到訂單列表、入去睇訂單詳情、更新訂單狀態、填入物流單號。
  - 新增/編輯/上下架商品、調整庫存、上傳主圖。
  - 新增/編輯/停用分類。
  - 睇會員列表、建立會員/管理員、凍結/黑名單、重設密碼。
- `/api/admin/users`、`/api/admin/products/low-stock`、`/api/admin/products/export/csv` 不再重複定義（避免命中錯版本）。

---

## File Structure（會改動/新增嘅檔案）

**Modify（路由衝突修正）**
- `routes/auth.js`：移除重複嘅 `GET /api/admin/users`
- `routes/admin.js`：移除重複嘅 users CRUD，同移除 products low-stock/export（交由 `routes/members.js` / `routes/products-full.js`）

**Modify（後台頁面渲染）**
- `views/admin/orders.ejs`
- `views/admin/products.ejs`
- `views/admin/categories.ejs`
- `views/admin/users.ejs`
- `public/js/admin/common.js`
- `public/js/admin/orders.js`
- `public/js/admin/products.js`
- `public/js/admin/categories.js`
- `public/js/admin/users.js`
- （視需要）`public/css/admin.css`（只做必要樣式補齊）

**Add（測試：避免將來再引入重複路由）**
- `test/admin-route-registry.test.js`

---

### Task 1: 建立「路由註冊防重」測試（先寫 failing test）

**Files:**
- Create: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/test/admin-route-registry.test.js`

- [ ] **Step 1: 寫 failing test，驗證 auth.js/admin.js 唔可以再註冊 `/api/admin/users`**

```js
const test = require('node:test');
const assert = require('node:assert/strict');

function createRouteCapturingApp() {
  const routes = [];
  const record = (method) => (path) => routes.push({ method, path });
  return {
    routes,
    get: record('GET'),
    post: record('POST'),
    put: record('PUT'),
    delete: record('DELETE'),
    use: () => {},
  };
}

function count(routes, method, path) {
  return routes.filter((r) => r.method === method && r.path === path).length;
}

test('admin routes: /api/admin/users must only be registered by members.js', async () => {
  const app = createRouteCapturingApp();

  const authRoutes = require('../routes/auth');
  const adminRoutes = require('../routes/admin');
  const membersRoutes = require('../routes/members');

  const fakePool = { query: async () => ({ rows: [] }), connect: async () => ({ query: async () => ({ rows: [] }), release: () => {} }) };
  const noop = () => {};
  const fakeBcrypt = { hash: async () => '$2a$10$fake', compare: async () => true };
  const fakeUpload = { single: () => (req, res, next) => next() };

  authRoutes(app, fakePool, noop, noop, fakeBcrypt);
  adminRoutes(app, fakePool, noop, fakeUpload);
  membersRoutes(app, fakePool);

  assert.equal(count(app.routes, 'GET', '/api/admin/users'), 1);
  assert.equal(count(app.routes, 'POST', '/api/admin/users'), 1);
  assert.equal(count(app.routes, 'PUT', '/api/admin/users/:id'), 1);
  assert.equal(count(app.routes, 'POST', '/api/admin/users/:id/password'), 1);
});

test('admin routes: products low-stock/export must only be registered once', async () => {
  const app = createRouteCapturingApp();
  const productsFullRoutes = require('../routes/products-full');
  const adminRoutes = require('../routes/admin');

  const fakePool = { query: async () => ({ rows: [] }) };
  const noop = () => {};
  const fakeUpload = { single: () => (req, res, next) => next() };

  adminRoutes(app, fakePool, noop, fakeUpload);
  productsFullRoutes(app, fakePool);

  assert.equal(count(app.routes, 'GET', '/api/admin/products/low-stock'), 1);
  assert.equal(count(app.routes, 'GET', '/api/admin/products/export/csv'), 1);
});
```

- [ ] **Step 2: 跑測試，確認會 fail（因為而家重複註冊）**

Run:

```bash
npm test
```

Expected: FAIL（`/api/admin/users` 或 `low-stock/export` 註冊次數唔等於 1）。

---

### Task 2: 移除重複 admin users 路由（令 Task 1 測試 pass）

**Files:**
- Modify: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/routes/auth.js`
- Modify: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/routes/admin.js`

- [ ] **Step 1: 在 auth.js 移除 `GET /api/admin/users`**

要刪走整段（由 `// List users (admin only)` 開始）：

```js
// List users (admin only)
app.get('/api/admin/users', requireAdmin, async (req, res) => {
  ...
});
```

- [ ] **Step 2: 在 admin.js 移除 users CRUD（交由 members.js 做唯一版本）**

要刪走以下 endpoints：

```js
app.get('/api/admin/users/:id', ...)
app.put('/api/admin/users/:id', ...)
app.delete('/api/admin/users/:id', ...)
app.post('/api/admin/users', ...)
app.post('/api/admin/users/:id/password', ...)
```

保留 `GET /api/admin/dashboard` 同 `POST /api/admin/upload`（仍由 admin.js 負責）。

- [ ] **Step 3: 跑測試，確認 Task 1 變 PASS**

Run:

```bash
npm test
```

Expected: PASS（`admin-route-registry.test.js` 兩個測試都過）。

---

### Task 3: 移除 products low-stock/export 重複路由（令行為一致）

**Files:**
- Modify: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/routes/admin.js`

- [ ] **Step 1: 在 admin.js 移除以下 endpoints（交由 products-full.js 唯一提供）**

```js
app.get('/api/admin/products/low-stock', ...)
app.get('/api/admin/products/export/csv', ...)
```

- [ ] **Step 2: 跑測試**

Run:

```bash
npm test
```

Expected: PASS。

---

### Task 4: 升級 AdminCommon（統一 fetch、錯誤訊息、DOM helper）

**Files:**
- Modify: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/public/js/admin/common.js`

- [ ] **Step 1: 用以下內容取代 common.js（保留向後相容 `adminApiGet`）**

```js
function adminEscapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function adminRenderJson(el, data) {
  if (!el) return;
  el.textContent = JSON.stringify(data, null, 2);
}

async function adminApiRequest(path, { method = 'GET', json, formData } = {}) {
  const init = { method, headers: { Accept: 'application/json' } };
  if (json !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(json);
  }
  if (formData) {
    init.body = formData;
  }

  const r = await fetch(path, init);
  const isJson = (r.headers.get('content-type') || '').includes('application/json');
  const body = isJson ? await r.json() : await r.text();
  if (!r.ok) {
    const msg = typeof body === 'string' ? body : (body && body.error ? body.error : JSON.stringify(body));
    const e = new Error(`HTTP ${r.status}: ${msg}`);
    e.status = r.status;
    e.body = body;
    throw e;
  }
  return body;
}

async function adminApiGet(path) {
  return adminApiRequest(path, { method: 'GET' });
}

function $(sel) {
  return document.querySelector(sel);
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else node.setAttribute(k, v);
  }
  for (const c of children) {
    if (c === null || c === undefined) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

window.AdminCommon = {
  $,
  el,
  adminEscapeHtml,
  adminRenderJson,
  adminApiGet,
  adminApiRequest,
};
```

- [ ] **Step 2: 手動驗證 admin 頁仍可載入**

Run:

```bash
npm run dev
```

Expected: 打開 `/admin/login` 可以正常見到頁面，Console 無 JS error。

---

### Task 5: 訂單頁（可操作 UI：列表＋詳情＋改狀態＋物流單號）

**Files:**
- Modify: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/views/admin/orders.ejs`
- Modify: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/public/js/admin/orders.js`

- [ ] **Step 1: 更新 orders.ejs，加上工具列＋表格容器＋詳情容器**

```ejs
<div id="admin-orders" class="space-y-3">
  <div class="flex gap-2 items-end">
    <label class="text-sm">
      <div class="mb-1">搜尋（訂單號/用戶）</div>
      <input id="orders-q" class="admin-input" placeholder="例如：1001 / felix" />
    </label>
    <label class="text-sm">
      <div class="mb-1">狀態</div>
      <select id="orders-status" class="admin-input">
        <option value="">全部</option>
        <option value="pending">待付款</option>
        <option value="paid">已付款</option>
        <option value="shipping">派送中</option>
        <option value="completed">已完成</option>
        <option value="cancelled">已取消</option>
      </select>
    </label>
    <button id="orders-refresh" class="admin-btn">刷新</button>
  </div>

  <div class="admin-grid-2">
    <div>
      <div id="orders-error" class="admin-error hidden"></div>
      <div class="admin-card">
        <table class="admin-table" id="orders-table">
          <thead>
            <tr>
              <th>訂單號</th>
              <th>客戶</th>
              <th>金額</th>
              <th>狀態</th>
              <th>建立時間</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="orders-tbody"></tbody>
        </table>
      </div>
    </div>
    <div>
      <div class="admin-card">
        <div class="font-bold mb-2">訂單詳情</div>
        <div id="order-detail" class="text-sm text-gray-700">請喺左邊揀一張訂單</div>
      </div>
    </div>
  </div>

  <script src="/js/admin/common.js"></script>
  <script src="/js/admin/orders.js"></script>
</div>
```

- [ ] **Step 2: 用以下內容取代 orders.js（支援查看/改狀態/填物流單號）**

```js
(async function () {
  const { $, el, adminApiRequest } = window.AdminCommon;

  const els = {
    q: $('#orders-q'),
    status: $('#orders-status'),
    refresh: $('#orders-refresh'),
    error: $('#orders-error'),
    tbody: $('#orders-tbody'),
    detail: $('#order-detail'),
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
    if (n === null || n === undefined) return '';
    const x = Number(n);
    if (Number.isNaN(x)) return String(n);
    return 'HK$ ' + x.toFixed(2);
  }

  const statusLabel = {
    pending: '待付款',
    paid: '已付款',
    shipping: '派送中',
    completed: '已完成',
    cancelled: '已取消',
  };

  async function loadOrders() {
    setError('');
    els.tbody.textContent = '';
    els.detail.textContent = '請喺左邊揀一張訂單';

    const q = (els.q.value || '').trim();
    const status = els.status.value;

    const params = new URLSearchParams();
    if (q) params.set('search', q);
    if (status) params.set('status', status);

    const data = await adminApiRequest('/api/admin/orders?' + params.toString());
    const orders = data.orders || [];

    for (const o of orders) {
      const tr = el('tr', {}, [
        el('td', { text: String(o.id) }),
        el('td', { text: o.username || '' }),
        el('td', { text: money(o.total_amount) }),
        el('td', { text: statusLabel[o.status] || o.status }),
        el('td', { text: o.created_at ? String(o.created_at) : '' }),
        el('td', {}, [
          el('button', {
            class: 'admin-link-btn',
            text: '打開',
            onclick: () => openOrder(o.id),
          }),
        ]),
      ]);
      els.tbody.appendChild(tr);
    }
  }

  async function openOrder(id) {
    setError('');
    els.detail.textContent = '載入中…';
    const data = await adminApiRequest('/api/admin/orders/' + encodeURIComponent(id));
    const order = data.order;
    const items = data.items || [];

    const statusSelect = el('select', { class: 'admin-input', id: 'order-status' }, [
      el('option', { value: 'pending', text: '待付款' }),
      el('option', { value: 'paid', text: '已付款' }),
      el('option', { value: 'shipping', text: '派送中' }),
      el('option', { value: 'completed', text: '已完成' }),
      el('option', { value: 'cancelled', text: '已取消' }),
    ]);
    statusSelect.value = order.status;

    const trackingInput = el('input', {
      class: 'admin-input',
      id: 'order-tracking',
      value: order.tracking_number || '',
      placeholder: '物流單號（可留空）',
    });

    const saveBtn = el('button', {
      class: 'admin-btn',
      text: '更新狀態',
      onclick: async () => {
        saveBtn.disabled = true;
        try {
          await adminApiRequest('/api/admin/orders/' + encodeURIComponent(id) + '/status', {
            method: 'PUT',
            json: { status: statusSelect.value, tracking_number: trackingInput.value || null },
          });
          await loadOrders();
          await openOrder(id);
        } catch (e) {
          setError(e && e.message ? e.message : String(e));
        } finally {
          saveBtn.disabled = false;
        }
      },
    });

    const itemsTable = el('table', { class: 'admin-table mt-2' }, [
      el('thead', {}, [
        el('tr', {}, [el('th', { text: '商品' }), el('th', { text: '數量' }), el('th', { text: '單價' })]),
      ]),
      el('tbody', {}, items.map((it) =>
        el('tr', {}, [
          el('td', { text: it.name || '' }),
          el('td', { text: String(it.quantity || 0) }),
          el('td', { text: money(it.price) }),
        ])
      )),
    ]);

    els.detail.textContent = '';
    els.detail.appendChild(el('div', { class: 'space-y-2' }, [
      el('div', { class: 'font-bold', text: `訂單 #${order.id}` }),
      el('div', { text: `客戶：${order.username || ''} ${order.contact ? '(' + order.contact + ')' : ''}` }),
      el('div', { text: `金額：${money(order.total_amount)}` }),
      el('div', { text: `狀態：${statusLabel[order.status] || order.status}` }),
      el('div', { class: 'grid gap-2', }, [
        el('label', { class: 'text-sm' }, [el('div', { class: 'mb-1', text: '狀態' }), statusSelect]),
        el('label', { class: 'text-sm' }, [el('div', { class: 'mb-1', text: '物流單號' }), trackingInput]),
        saveBtn,
      ]),
      el('div', { class: 'font-bold mt-3', text: '商品清單' }),
      itemsTable,
    ]));
  }

  els.refresh.addEventListener('click', () => loadOrders().catch((e) => setError(e.message)));
  els.q.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') loadOrders().catch((e) => setError(e.message));
  });
  els.status.addEventListener('change', () => loadOrders().catch((e) => setError(e.message)));

  try {
    await loadOrders();
  } catch (e) {
    setError(e && e.message ? e.message : String(e));
  }
})();
```

- [ ] **Step 3: 手動驗證**

Run:

```bash
npm run dev
```

Expected:
- `/admin/orders` 顯示訂單表格
- 點「打開」顯示詳情
- 更新狀態會成功（並刷新列表）

---

### Task 6: 商品頁（列表＋新增/編輯＋上下架＋上傳圖片）

**Files:**
- Modify: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/views/admin/products.ejs`
- Modify: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/public/js/admin/products.js`
- Modify (optional): `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/public/css/admin.css`

- [ ] **Step 1: 更新 products.ejs（工具列＋表格＋表單區）**

```ejs
<div id="admin-products" class="space-y-3">
  <div class="flex flex-wrap gap-2 items-end">
    <label class="text-sm">
      <div class="mb-1">搜尋</div>
      <input id="products-search" class="admin-input" placeholder="商品名/描述" />
    </label>
    <label class="text-sm">
      <div class="mb-1">分類</div>
      <select id="products-category" class="admin-input"></select>
    </label>
    <button id="products-refresh" class="admin-btn">刷新</button>
    <button id="products-new" class="admin-btn">新增商品</button>
  </div>

  <div id="products-error" class="admin-error hidden"></div>

  <div class="admin-grid-2">
    <div class="admin-card">
      <table class="admin-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>商品</th>
            <th>分類</th>
            <th>庫存</th>
            <th>狀態</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="products-tbody"></tbody>
      </table>
    </div>
    <div class="admin-card">
      <div class="font-bold mb-2">商品編輯</div>
      <form id="product-form" class="space-y-2">
        <input type="hidden" id="product-id" />
        <label class="text-sm block">
          <div class="mb-1">名稱</div>
          <input id="product-name" class="admin-input w-full" required />
        </label>
        <label class="text-sm block">
          <div class="mb-1">Slug</div>
          <input id="product-slug" class="admin-input w-full" />
        </label>
        <label class="text-sm block">
          <div class="mb-1">分類</div>
          <select id="product-category" class="admin-input w-full"></select>
        </label>
        <div class="grid grid-cols-2 gap-2">
          <label class="text-sm block">
            <div class="mb-1">售價</div>
            <input id="product-price" class="admin-input w-full" type="number" step="0.01" required />
          </label>
          <label class="text-sm block">
            <div class="mb-1">原價（可選）</div>
            <input id="product-original-price" class="admin-input w-full" type="number" step="0.01" />
          </label>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <label class="text-sm block">
            <div class="mb-1">庫存</div>
            <input id="product-stock" class="admin-input w-full" type="number" step="1" />
          </label>
          <label class="text-sm block">
            <div class="mb-1">狀態</div>
            <select id="product-status" class="admin-input w-full">
              <option value="active">上架</option>
              <option value="inactive">下架</option>
            </select>
          </label>
        </div>
        <label class="text-sm block">
          <div class="mb-1">主圖 URL（或上傳）</div>
          <input id="product-image-url" class="admin-input w-full" placeholder="/images/xxx.jpg 或 https://..." />
        </label>
        <label class="text-sm block">
          <div class="mb-1">上傳主圖</div>
          <input id="product-image-file" class="admin-input w-full" type="file" accept="image/*" />
        </label>
        <label class="text-sm block">
          <div class="mb-1">簡短描述（繁中）</div>
          <textarea id="product-short-desc" class="admin-input w-full" rows="2"></textarea>
        </label>
        <label class="text-sm block">
          <div class="mb-1">詳細描述（繁中）</div>
          <textarea id="product-desc" class="admin-input w-full" rows="5"></textarea>
        </label>
        <div class="flex gap-2">
          <button id="product-save" class="admin-btn" type="submit">儲存</button>
          <button id="product-reset" class="admin-btn-secondary" type="button">清空</button>
        </div>
      </form>
    </div>
  </div>

  <script src="/js/admin/common.js"></script>
  <script src="/js/admin/products.js"></script>
</div>
```

- [ ] **Step 2: 用以下內容取代 products.js（支援列表＋編輯表單＋上傳）**

```js
(async function () {
  const { $, el, adminApiRequest } = window.AdminCommon;

  const els = {
    search: $('#products-search'),
    categoryFilter: $('#products-category'),
    refresh: $('#products-refresh'),
    newBtn: $('#products-new'),
    error: $('#products-error'),
    tbody: $('#products-tbody'),

    form: $('#product-form'),
    id: $('#product-id'),
    name: $('#product-name'),
    slug: $('#product-slug'),
    category: $('#product-category'),
    price: $('#product-price'),
    originalPrice: $('#product-original-price'),
    stock: $('#product-stock'),
    status: $('#product-status'),
    imageUrl: $('#product-image-url'),
    imageFile: $('#product-image-file'),
    shortDesc: $('#product-short-desc'),
    desc: $('#product-desc'),
    reset: $('#product-reset'),
    save: $('#product-save'),
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

  let categories = [];

  async function loadCategories() {
    const data = await adminApiRequest('/api/admin/categories');
    categories = data.categories || [];

    const buildOptions = (select, includeAll) => {
      select.textContent = '';
      if (includeAll) select.appendChild(el('option', { value: '', text: '全部' }));
      for (const c of categories) {
        select.appendChild(el('option', { value: String(c.id), text: c.name_zh_hk || c.name }));
      }
    };

    buildOptions(els.categoryFilter, true);
    buildOptions(els.category, false);
  }

  async function loadProducts() {
    setError('');
    els.tbody.textContent = '';

    const params = new URLSearchParams();
    const search = (els.search.value || '').trim();
    const categoryId = els.categoryFilter.value;
    if (search) params.set('search', search);
    if (categoryId) params.set('category_id', categoryId);

    const data = await adminApiRequest('/api/admin/products?' + params.toString());
    const products = data.products || [];

    for (const p of products) {
      const tr = el('tr', {}, [
        el('td', { text: String(p.id) }),
        el('td', { text: p.name_zh_hk || p.name || '' }),
        el('td', { text: p.category_name || '' }),
        el('td', { text: String(p.stock ?? '') }),
        el('td', { text: p.status === 'active' ? '上架' : '下架' }),
        el('td', {}, [
          el('button', { class: 'admin-link-btn', text: '編輯', onclick: () => fillForm(p) }),
        ]),
      ]);
      els.tbody.appendChild(tr);
    }
  }

  function fillForm(p) {
    els.id.value = p.id ? String(p.id) : '';
    els.name.value = p.name_zh_hk || p.name || '';
    els.slug.value = p.slug || '';
    els.category.value = p.category_id ? String(p.category_id) : (categories[0] ? String(categories[0].id) : '');
    els.price.value = p.price ?? '';
    els.originalPrice.value = p.original_price ?? '';
    els.stock.value = p.stock ?? 0;
    els.status.value = p.status || 'active';
    els.imageUrl.value = p.image_url || '';
    els.imageFile.value = '';
    els.shortDesc.value = p.short_description_zh_hk || '';
    els.desc.value = p.description_zh_hk || p.description || '';
  }

  function clearForm() {
    fillForm({
      id: '',
      name: '',
      slug: '',
      category_id: categories[0] ? categories[0].id : '',
      price: '',
      original_price: '',
      stock: 0,
      status: 'active',
      image_url: '',
      short_description_zh_hk: '',
      description_zh_hk: '',
    });
  }

  async function uploadImageIfNeeded() {
    const file = els.imageFile.files && els.imageFile.files[0];
    if (!file) return null;
    const fd = new FormData();
    fd.append('image', file);
    const out = await adminApiRequest('/api/admin/upload', { method: 'POST', formData: fd });
    return out && out.url ? out.url : null;
  }

  els.form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    setError('');
    els.save.disabled = true;
    try {
      const uploadedUrl = await uploadImageIfNeeded();
      const image_url = uploadedUrl || (els.imageUrl.value || '').trim() || null;

      const payload = {
        name: els.name.value.trim(),
        name_zh_hk: els.name.value.trim(),
        slug: (els.slug.value || '').trim() || undefined,
        description_zh_hk: els.desc.value || null,
        short_description_zh_hk: els.shortDesc.value || null,
        description: null,
        price: els.price.value,
        original_price: els.originalPrice.value || null,
        stock: els.stock.value || 0,
        category_id: els.category.value,
        image_url,
        gallery_images: null,
        status: els.status.value,
      };

      const id = (els.id.value || '').trim();
      if (id) {
        await adminApiRequest('/api/admin/products/' + encodeURIComponent(id), { method: 'PUT', json: payload });
      } else {
        await adminApiRequest('/api/admin/products', { method: 'POST', json: payload });
      }

      await loadProducts();
      clearForm();
    } catch (e) {
      setError(e && e.message ? e.message : String(e));
    } finally {
      els.save.disabled = false;
    }
  });

  els.reset.addEventListener('click', () => clearForm());
  els.refresh.addEventListener('click', () => loadProducts().catch((e) => setError(e.message)));
  els.newBtn.addEventListener('click', () => clearForm());
  els.search.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') loadProducts().catch((e) => setError(e.message));
  });
  els.categoryFilter.addEventListener('change', () => loadProducts().catch((e) => setError(e.message)));

  try {
    await loadCategories();
    await loadProducts();
    clearForm();
  } catch (e) {
    setError(e && e.message ? e.message : String(e));
  }
})();
```

- [ ] **Step 3: 如 admin.css 未有以下 class，補齊最少樣式**

```css
.admin-input { border: 1px solid #d1d5db; padding: 6px 8px; background: #fff; }
.admin-btn { border: 1px solid #111827; background: #111827; color: #fff; padding: 6px 10px; }
.admin-btn-secondary { border: 1px solid #6b7280; background: #fff; color: #111827; padding: 6px 10px; }
.admin-card { border: 1px solid #e5e7eb; padding: 10px; background: #fff; }
.admin-table { width: 100%; border-collapse: collapse; }
.admin-table th, .admin-table td { border-bottom: 1px solid #e5e7eb; padding: 8px; text-align: left; vertical-align: top; }
.admin-error { border: 1px solid #ef4444; background: #fef2f2; color: #991b1b; padding: 8px; }
.admin-link-btn { text-decoration: underline; font-size: 12px; }
.admin-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
@media (max-width: 900px) { .admin-grid-2 { grid-template-columns: 1fr; } }
```

- [ ] **Step 4: 手動驗證**

Expected:
- `/admin/products` 顯示商品列表
- 編輯後儲存成功
- 新增商品成功
- 上傳圖片成功（`/api/admin/upload` 回傳 `/images/...`）

---

### Task 7: 分類頁（列表＋新增/編輯/刪除）

**Files:**
- Modify: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/views/admin/categories.ejs`
- Modify: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/public/js/admin/categories.js`

- [ ] **Step 1: 更新 categories.ejs**

```ejs
<div id="admin-categories" class="space-y-3">
  <div class="flex gap-2">
    <button id="categories-refresh" class="admin-btn">刷新</button>
    <button id="categories-new" class="admin-btn">新增分類</button>
  </div>

  <div id="categories-error" class="admin-error hidden"></div>

  <div class="admin-grid-2">
    <div class="admin-card">
      <table class="admin-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>分類</th>
            <th>Slug</th>
            <th>排序</th>
            <th>狀態</th>
            <th>商品數</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="categories-tbody"></tbody>
      </table>
    </div>
    <div class="admin-card">
      <div class="font-bold mb-2">分類編輯</div>
      <form id="category-form" class="space-y-2">
        <input type="hidden" id="category-id" />
        <label class="text-sm block">
          <div class="mb-1">名稱</div>
          <input id="category-name" class="admin-input w-full" required />
        </label>
        <label class="text-sm block">
          <div class="mb-1">Slug</div>
          <input id="category-slug" class="admin-input w-full" />
        </label>
        <label class="text-sm block">
          <div class="mb-1">排序</div>
          <input id="category-sort" class="admin-input w-full" type="number" step="1" />
        </label>
        <label class="text-sm block">
          <div class="mb-1">狀態</div>
          <select id="category-status" class="admin-input w-full">
            <option value="active">啟用</option>
            <option value="inactive">停用</option>
          </select>
        </label>
        <div class="flex gap-2">
          <button id="category-save" class="admin-btn" type="submit">儲存</button>
          <button id="category-reset" class="admin-btn-secondary" type="button">清空</button>
        </div>
      </form>
    </div>
  </div>

  <script src="/js/admin/common.js"></script>
  <script src="/js/admin/categories.js"></script>
</div>
```

- [ ] **Step 2: 用以下內容取代 categories.js**

```js
(async function () {
  const { $, el, adminApiRequest } = window.AdminCommon;

  const els = {
    refresh: $('#categories-refresh'),
    newBtn: $('#categories-new'),
    error: $('#categories-error'),
    tbody: $('#categories-tbody'),

    form: $('#category-form'),
    id: $('#category-id'),
    name: $('#category-name'),
    slug: $('#category-slug'),
    sort: $('#category-sort'),
    status: $('#category-status'),
    reset: $('#category-reset'),
    save: $('#category-save'),
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

  let categories = [];

  function fillForm(c) {
    els.id.value = c && c.id ? String(c.id) : '';
    els.name.value = c && (c.name_zh_hk || c.name) ? (c.name_zh_hk || c.name) : '';
    els.slug.value = c && c.slug ? c.slug : '';
    els.sort.value = c && c.sort_order !== undefined ? String(c.sort_order) : '0';
    els.status.value = c && c.status ? c.status : 'active';
  }

  function clearForm() {
    fillForm({ id: '', name: '', slug: '', sort_order: 0, status: 'active' });
  }

  async function loadCategories() {
    setError('');
    els.tbody.textContent = '';
    const data = await adminApiRequest('/api/admin/categories');
    categories = data.categories || [];
    for (const c of categories) {
      const tr = el('tr', {}, [
        el('td', { text: String(c.id) }),
        el('td', { text: c.name_zh_hk || c.name || '' }),
        el('td', { text: c.slug || '' }),
        el('td', { text: String(c.sort_order ?? 0) }),
        el('td', { text: c.status === 'active' ? '啟用' : '停用' }),
        el('td', { text: String(c.product_count ?? '') }),
        el('td', {}, [
          el('button', { class: 'admin-link-btn', text: '編輯', onclick: () => fillForm(c) }),
          el('span', { text: ' ' }),
          el('button', {
            class: 'admin-link-btn',
            text: '刪除',
            onclick: async () => {
              if (!confirm('確定刪除？（分類底下有商品會刪唔到）')) return;
              try {
                await adminApiRequest('/api/admin/categories/' + encodeURIComponent(c.id), { method: 'DELETE' });
                await loadCategories();
                clearForm();
              } catch (e) {
                setError(e && e.message ? e.message : String(e));
              }
            },
          }),
        ]),
      ]);
      els.tbody.appendChild(tr);
    }
  }

  els.form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    setError('');
    els.save.disabled = true;
    try {
      const payload = {
        name: els.name.value.trim(),
        slug: (els.slug.value || '').trim() || undefined,
        sort_order: parseInt(els.sort.value || '0', 10),
        status: els.status.value,
      };
      const id = (els.id.value || '').trim();
      if (id) {
        await adminApiRequest('/api/admin/categories/' + encodeURIComponent(id), { method: 'PUT', json: payload });
      } else {
        await adminApiRequest('/api/admin/categories', { method: 'POST', json: payload });
      }
      await loadCategories();
      clearForm();
    } catch (e) {
      setError(e && e.message ? e.message : String(e));
    } finally {
      els.save.disabled = false;
    }
  });

  els.reset.addEventListener('click', () => clearForm());
  els.refresh.addEventListener('click', () => loadCategories().catch((e) => setError(e.message)));
  els.newBtn.addEventListener('click', () => clearForm());

  try {
    await loadCategories();
    clearForm();
  } catch (e) {
    setError(e && e.message ? e.message : String(e));
  }
})();
```

- [ ] **Step 3: 手動驗證**

Expected:
- `/admin/categories` 顯示分類列表
- 可新增/編輯/停用
- 刪除分類：若有商品會收到 API 錯誤提示

---

### Task 8: 用戶頁（列表＋建立會員/管理員＋凍結/黑名單＋重設密碼）

**Files:**
- Modify: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/views/admin/users.ejs`
- Modify: `/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/public/js/admin/users.js`

- [ ] **Step 1: 更新 users.ejs**

```ejs
<div id="admin-users" class="space-y-3">
  <div class="flex flex-wrap gap-2 items-end">
    <label class="text-sm">
      <div class="mb-1">搜尋（用戶名/電郵/電話）</div>
      <input id="users-search" class="admin-input" placeholder="例如：felix / 9xxxxxxx" />
    </label>
    <button id="users-refresh" class="admin-btn">刷新</button>
    <button id="users-new" class="admin-btn">新增用戶</button>
  </div>

  <div id="users-error" class="admin-error hidden"></div>

  <div class="admin-grid-2">
    <div class="admin-card">
      <table class="admin-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>用戶名</th>
            <th>電郵</th>
            <th>電話</th>
            <th>狀態</th>
            <th>管理員</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="users-tbody"></tbody>
      </table>
    </div>
    <div class="admin-card">
      <div class="font-bold mb-2">用戶編輯</div>
      <form id="user-form" class="space-y-2">
        <input type="hidden" id="user-id" />
        <label class="text-sm block">
          <div class="mb-1">用戶名</div>
          <input id="user-username" class="admin-input w-full" required />
        </label>
        <label class="text-sm block">
          <div class="mb-1">電郵</div>
          <input id="user-email" class="admin-input w-full" />
        </label>
        <label class="text-sm block">
          <div class="mb-1">電話</div>
          <input id="user-phone" class="admin-input w-full" />
        </label>
        <label class="text-sm block">
          <div class="mb-1">WhatsApp</div>
          <input id="user-whatsapp" class="admin-input w-full" />
        </label>
        <div class="grid grid-cols-2 gap-2">
          <label class="text-sm block">
            <div class="mb-1">啟用</div>
            <select id="user-active" class="admin-input w-full">
              <option value="true">是</option>
              <option value="false">否</option>
            </select>
          </label>
          <label class="text-sm block">
            <div class="mb-1">黑名單</div>
            <select id="user-blacklisted" class="admin-input w-full">
              <option value="false">否</option>
              <option value="true">是</option>
            </select>
          </label>
        </div>
        <label class="text-sm block">
          <div class="mb-1">管理員</div>
          <select id="user-admin" class="admin-input w-full">
            <option value="false">否</option>
            <option value="true">是</option>
          </select>
        </label>
        <label class="text-sm block" id="user-password-wrap">
          <div class="mb-1">密碼（新用戶必填）</div>
          <input id="user-password" class="admin-input w-full" type="password" />
        </label>
        <div class="flex gap-2">
          <button id="user-save" class="admin-btn" type="submit">儲存</button>
          <button id="user-reset" class="admin-btn-secondary" type="button">清空</button>
          <button id="user-reset-password" class="admin-btn-secondary" type="button">重設密碼</button>
        </div>
      </form>
    </div>
  </div>

  <script src="/js/admin/common.js"></script>
  <script src="/js/admin/users.js"></script>
</div>
```

- [ ] **Step 2: 用以下內容取代 users.js（使用 members.js 嘅完整 users API）**

```js
(async function () {
  const { $, el, adminApiRequest } = window.AdminCommon;

  const els = {
    search: $('#users-search'),
    refresh: $('#users-refresh'),
    newBtn: $('#users-new'),
    error: $('#users-error'),
    tbody: $('#users-tbody'),

    form: $('#user-form'),
    id: $('#user-id'),
    username: $('#user-username'),
    email: $('#user-email'),
    phone: $('#user-phone'),
    whatsapp: $('#user-whatsapp'),
    active: $('#user-active'),
    blacklisted: $('#user-blacklisted'),
    admin: $('#user-admin'),
    passwordWrap: $('#user-password-wrap'),
    password: $('#user-password'),
    reset: $('#user-reset'),
    save: $('#user-save'),
    resetPassword: $('#user-reset-password'),
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

  let users = [];

  function fillForm(u) {
    const isNew = !u || !u.id;
    els.id.value = isNew ? '' : String(u.id);
    els.username.value = u && u.username ? u.username : '';
    els.email.value = u && u.email ? u.email : '';
    els.phone.value = u && u.phone ? u.phone : '';
    els.whatsapp.value = u && u.whatsapp ? u.whatsapp : '';
    els.active.value = String(u && u.is_active !== undefined ? !!u.is_active : true);
    els.blacklisted.value = String(u && u.is_blacklisted !== undefined ? !!u.is_blacklisted : false);
    els.admin.value = String(u && u.is_admin !== undefined ? !!u.is_admin : false);
    els.password.value = '';
    els.passwordWrap.style.display = isNew ? '' : 'none';
  }

  function clearForm() {
    fillForm({ id: '', username: '', email: '', phone: '', whatsapp: '', is_active: true, is_blacklisted: false, is_admin: false });
  }

  async function loadUsers() {
    setError('');
    els.tbody.textContent = '';
    const params = new URLSearchParams();
    const search = (els.search.value || '').trim();
    if (search) params.set('search', search);
    const data = await adminApiRequest('/api/admin/users?' + params.toString());
    users = data.users || [];

    for (const u of users) {
      const status = (u.is_blacklisted ? '黑名單' : (u.is_active ? '啟用' : '停用'));
      const tr = el('tr', {}, [
        el('td', { text: String(u.id) }),
        el('td', { text: u.username || '' }),
        el('td', { text: u.email || '' }),
        el('td', { text: u.phone || '' }),
        el('td', { text: status }),
        el('td', { text: u.is_admin ? '是' : '否' }),
        el('td', {}, [
          el('button', { class: 'admin-link-btn', text: '編輯', onclick: () => fillForm(u) }),
        ]),
      ]);
      els.tbody.appendChild(tr);
    }
  }

  els.form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    setError('');
    els.save.disabled = true;
    try {
      const id = (els.id.value || '').trim();
      if (id) {
        await adminApiRequest('/api/admin/users/' + encodeURIComponent(id), {
          method: 'PUT',
          json: {
            email: (els.email.value || '').trim() || null,
            phone: (els.phone.value || '').trim() || null,
            whatsapp: (els.whatsapp.value || '').trim() || null,
            first_name: null,
            last_name: null,
            is_active: els.active.value === 'true',
            is_blacklisted: els.blacklisted.value === 'true',
            is_admin: els.admin.value === 'true',
            member_level_id: null,
          },
        });
      } else {
        if (!els.password.value || els.password.value.length < 6) {
          throw new Error('新用戶密碼至少 6 位');
        }
        await adminApiRequest('/api/admin/users', {
          method: 'POST',
          json: {
            username: els.username.value.trim(),
            email: (els.email.value || '').trim() || null,
            phone: (els.phone.value || '').trim() || null,
            password: els.password.value,
            first_name: null,
            last_name: null,
            is_admin: els.admin.value === 'true',
            is_active: els.active.value === 'true',
          },
        });
      }

      await loadUsers();
      clearForm();
    } catch (e) {
      setError(e && e.message ? e.message : String(e));
    } finally {
      els.save.disabled = false;
    }
  });

  els.resetPassword.addEventListener('click', async () => {
    const id = (els.id.value || '').trim();
    if (!id) {
      setError('請先揀一個用戶');
      return;
    }
    const pw = prompt('輸入新密碼（至少 6 位）');
    if (!pw) return;
    try {
      await adminApiRequest('/api/admin/users/' + encodeURIComponent(id) + '/password', {
        method: 'POST',
        json: { new_password: pw },
      });
      setError('');
      alert('已重設密碼');
    } catch (e) {
      setError(e && e.message ? e.message : String(e));
    }
  });

  els.reset.addEventListener('click', () => clearForm());
  els.refresh.addEventListener('click', () => loadUsers().catch((e) => setError(e.message)));
  els.newBtn.addEventListener('click', () => clearForm());
  els.search.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') loadUsers().catch((e) => setError(e.message));
  });

  try {
    await loadUsers();
    clearForm();
  } catch (e) {
    setError(e && e.message ? e.message : String(e));
  }
})();
```

- [ ] **Step 3: 手動驗證**

Expected:
- `/admin/users` 顯示用戶列表
- 可新增用戶/管理員
- 可更新 is_active/is_blacklisted/is_admin
- 可重設密碼

---

### Task 9: 回歸驗證（測試＋基本手動流程）

**Files:**
- (No new files)

- [ ] **Step 1: 跑完整測試**

Run:

```bash
npm test
```

Expected: PASS。

- [ ] **Step 2: 手動跑一次閉環（最少）**

Expected:
- `/admin/login` → `/admin` 正常
- `/admin/products` 新增一件商品（上架）
- `/admin/orders` 對一張訂單更新到 `paid` → `shipping`，填入物流單號
- `/admin/categories` 新增分類並可停用
- `/admin/users` 新增一個普通用戶並可重設密碼

---

## 後續（第二階段會另開 plan）

- 售後工單＋退款（全額/部分）＋審批流程
- WhatsApp 通知整合（下單/付款/出貨/派送/棄單）
- 香港地址校驗＋分區運費模板＋承運商追蹤同步
- 財務對賬＋憑證歸檔（7 年留存）

