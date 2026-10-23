# 全站繁體中文（方案 B）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 前台 + 後台 + 對客 API 文案 + 商品內容，一律只輸出繁體中文；未翻譯商品不可在前台曝光。

**Architecture:** 輕量 server-side i18n：以 `locales/zh-HK.json` 作字典，`res.locals.t()` 渲染 UI；商品層新增 `*_zh_hk` 欄位並以「缺翻譯即不展示」作硬性規則。

**Tech Stack:** Node.js, Express, EJS, PostgreSQL, node:test

---

## 目錄/檔案責任（會改到嘅地方）

**新增**
- `locales/zh-HK.json`：全站文案字典（繁中）
- `utils/i18n.js`：`createTranslator()`，提供 `t(key, params)`（server-side）
- `test/i18n.test.js`：`t()` 插值/缺 key 行為測試
- `test/no-non-zh-hk-ui.test.js`：掃描 EJS/JS，禁止日文/簡體/英文對客字串（紅線）
- `migrations/2026-04-28-add-zh-hk-columns.sql`：DB 新增繁中欄位（可重複執行）
- `test/product-translation-policy.test.js`：確保「未翻譯商品不展示」規則（jsonl loader + EJS sample）

**修改**
- `app.js`：掛載 `res.locals.t`；EJS 頁面 `title`/固定文案轉用 `t()`；示範商品/分類改繁中
- `views/*.ejs`：所有對客文案改成繁中（盡量 key 化）；`lang="zh-HK"`；字體改 Noto Sans TC
- `utils/productLoader.js`：支援 `*_zh_hk` 欄位 + 過濾未翻譯商品
- `routes/products.js`（以及必要時其他 routes）：只輸出 `*_zh_hk` 欄位；搜尋/過濾用繁中欄位
- `schema.sql`：補上 zh_hk 欄位（新裝 DB 一步到位）

---

## Task 1: 建立 server-side i18n（`t()`）基礎

**Files:**
- Create: `locales/zh-HK.json`
- Create: `utils/i18n.js`
- Create: `test/i18n.test.js`
- Modify: `app.js`

- [ ] **Step 1: 寫 failing test（`t()` 基本行為）**

```js
// test/i18n.test.js
const test = require('node:test');
const assert = require('node:assert/strict');

test('t() returns translated string', () => {
  const { createTranslator } = require('../utils/i18n');
  const t = createTranslator({
    locale: 'zh-HK',
    dict: { 'nav.login': '登入' },
  });
  assert.equal(t('nav.login'), '登入');
});

test('t() interpolates params', () => {
  const { createTranslator } = require('../utils/i18n');
  const t = createTranslator({
    locale: 'zh-HK',
    dict: { 'cart.items': '購物車（{count}）' },
  });
  assert.equal(t('cart.items', { count: 3 }), '購物車（3）');
});

test('t() returns key when missing', () => {
  const { createTranslator } = require('../utils/i18n');
  const t = createTranslator({ locale: 'zh-HK', dict: {} });
  assert.equal(t('missing.key'), 'missing.key');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npm test
```

Expected: FAIL（因為 `../utils/i18n` 未存在）

- [ ] **Step 3: 寫最少實作（`createTranslator`）**

```js
// utils/i18n.js
function createTranslator({ dict }) {
  return function t(key, params) {
    const template = Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : key;
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (m, name) => {
      if (!Object.prototype.hasOwnProperty.call(params, name)) return m;
      return String(params[name]);
    });
  };
}

module.exports = { createTranslator };
```

- [ ] **Step 4: 新增字典（先放核心 key，之後逐步補齊）**

```json
// locales/zh-HK.json
{
  "age.title": "年齡確認",
  "age.desc": "本網站包含成人用品內容。\\n你是否已年滿 18 歲？",
  "common.yes": "是",
  "common.no": "否",
  "nav.myAccount": "我的帳戶",
  "nav.faq": "常見問題",
  "nav.contact": "聯絡我們",
  "nav.searchPlaceholder": "輸入商品名稱／品牌搜尋",
  "nav.search": "搜尋",
  "nav.cart": "購物車",
  "nav.login": "登入",
  "nav.register": "註冊",
  "home.featured": "人氣推介",
  "home.viewAll": "查看全部商品 →",
  "product.badge.deal": "精選優惠",
  "product.badge.lowStock": "存貨緊張",
  "product.cta.details": "查看詳情",
  "footer.payments": "支援付款方式",
  "footer.ageRestrictionTitle": "年齡限制",
  "footer.ageRestrictionDesc": "本網站只向年滿 18 歲人士提供服務。未滿 18 歲人士請立即離開。",
  "error.invalidParams": "參數無效",
  "error.systemBusy": "系統繁忙，請稍後再試"
}
```

- [ ] **Step 5: 將 `t()` 掛到 EJS（`res.locals.t`）**

在 `app.js` 加入：
```js
const fs = require('fs');
const { createTranslator } = require('./utils/i18n');

const dictZhHK = JSON.parse(fs.readFileSync(path.join(__dirname, 'locales', 'zh-HK.json'), 'utf8'));

app.use((req, res, next) => {
  res.locals.t = createTranslator({ locale: 'zh-HK', dict: dictZhHK });
  next();
});
```

- [ ] **Step 6: Run tests to verify GREEN**

Run:
```bash
npm test
```
Expected: PASS（`test/i18n.test.js` 全綠）

- [ ] **Step 7: Commit**

```bash
git add locales/zh-HK.json utils/i18n.js test/i18n.test.js app.js
git commit -m "feat: add zh-hk i18n helper"
```

---

## Task 2: 加「禁止非繁中 UI 字串」護欄（先紅再綠）

**Files:**
- Create: `test/no-non-zh-hk-ui.test.js`
- Modify: `views/index.ejs`
- Modify: `views/products.ejs`
- Modify: `views/product.ejs`
- Modify: `views/cart.ejs`
- Modify: `views/login.ejs`
- Modify: `views/register.ejs`

- [ ] **Step 1: 寫 failing test（掃描 EJS 禁止日文關鍵字）**

```js
// test/no-non-zh-hk-ui.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function read(p) {
  return fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
}

const FORBIDDEN = [
  '年齢確認',
  'ログイン',
  '検索',
  'はい',
  'いいえ',
  'お届け',
  'おすすめ商品',
  'プライバシーポリシー',
  'All rights reserved'
];

test('no forbidden non-zh-hk UI strings in views', () => {
  const files = [
    'views/index.ejs',
    'views/products.ejs',
    'views/product.ejs',
    'views/cart.ejs',
    'views/login.ejs',
    'views/register.ejs'
  ];
  for (const f of files) {
    const content = read(f);
    for (const word of FORBIDDEN) {
      assert.equal(
        content.includes(word),
        false,
        `${f} contains forbidden string: ${word}`
      );
    }
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npm test
```
Expected: FAIL（現時 `views/index.ejs` 等大量日文）

- [ ] **Step 3: 逐個 EJS 改成繁中（以 `t()` 為主）**

### 3.1 `views/index.ejs` 必做改動（節錄）

把：
```ejs
<html lang="ja">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&display=swap" rel="stylesheet">
```
改成：
```ejs
<html lang="zh-HK">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700;900&display=swap" rel="stylesheet">
```

把年齡確認區塊日文硬字改成：
```ejs
<h2 class="text-2xl font-bold mb-4"><%= t('age.title') %></h2>
<p class="text-gray-600 mb-6 whitespace-pre-line"><%= t('age.desc') %></p>
<button ...><%= t('common.yes') %></button>
<button ...><%= t('common.no') %></button>
```

把 header 內文案改成：
```ejs
<input type="text" placeholder="<%= t('nav.searchPlaceholder') %>" ...>
<button ...><%= t('nav.search') %></button>
<span><%= t('nav.cart') %></span>
<a href="/login" ...><%= t('nav.login') %></a>
<a href="/register" ...><%= t('nav.register') %></a>
```

把 footer 年齡限制/付款方式改成：
```ejs
<p class="text-red-400 font-bold text-sm mb-1">🔞 <%= t('footer.ageRestrictionTitle') %></p>
<p class="text-xs text-gray-400"><%= t('footer.ageRestrictionDesc') %></p>
<p class="text-xs text-gray-500 mb-3"><%= t('footer.payments') %></p>
<p>© 2026 M-ZAKKA. 版權所有。</p>
```

### 3.2 其他頁面（products/product/cart/login/register）
- 同樣策略：所有對客硬字 → `t('...')` 或直接繁中（但優先用字典，方便統一）
- `lang="zh-HK"`、字體改 Noto Sans TC
- 所有按鈕/提示/標籤/頁面 title 改繁中

- [ ] **Step 4: Run tests to verify GREEN**

Run:
```bash
npm test
```
Expected: PASS（`no-non-zh-hk-ui.test.js` 全綠）

- [ ] **Step 5: Commit**

```bash
git add views/*.ejs test/no-non-zh-hk-ui.test.js locales/zh-HK.json
git commit -m "feat: convert storefront UI to zh-hk"
```

---

## Task 3: 商品示範資料（EJS sample）改成繁中，避免前台出現原文

**Files:**
- Modify: `app.js`
- Create: `test/product-translation-policy.test.js`

- [ ] **Step 1: 寫 failing test（禁止 app.js sample 內含日文關鍵字）**

```js
// test/product-translation-policy.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('no Japanese strings in app.js sample products/categories', () => {
  const content = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const forbidden = ['メンズケア', 'アクセサリー', 'プレミアム', 'アドバンス', '新規登録', 'ログイン'];
  for (const w of forbidden) assert.equal(content.includes(w), false, `app.js contains ${w}`);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npm test
```
Expected: FAIL（`app.js` 目前 sample products/categories 有日文）

- [ ] **Step 3: 改 `getSampleProducts()` / `getSampleCategories()` 內容為繁中**

方向：
- `getSampleProducts()`：把 `name/category/description` 全部改成繁中（至少 8 件示範商品）
- `getSampleCategories()`：分類名全部繁中（例如「男士護理」「護理配件」「進階系列」「頂級系列」「優惠套裝」等）

- [ ] **Step 4: Run tests to verify GREEN**

Run:
```bash
npm test
```
Expected: PASS（`product-translation-policy.test.js` 全綠）

- [ ] **Step 5: Commit**

```bash
git add app.js test/product-translation-policy.test.js
git commit -m "feat: zh-hk sample products for storefront"
```

---

## Task 4: jsonl loader 支援 `*_zh_hk` + 未翻譯商品不展示

**Files:**
- Modify: `utils/productLoader.js`
- Create: `test/productLoader.zh-hk.test.js`
- (Optional) Create: `test/fixtures/products.zh-hk.jsonl`

- [ ] **Step 1: 寫 failing test（缺 `_zh_hk` 就唔應該出現在列表）**

```js
// test/productLoader.zh-hk.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('productLoader filters out products missing zh_hk fields', () => {
  const fixture = [
    JSON.stringify({ name: '日文名', category: 'メンズケア', description: '日文描述' }),
    JSON.stringify({ name_zh_hk: '繁中名', category_zh_hk: '男士護理', description_zh_hk: '繁中描述', images: [] })
  ].join('\n');

  const filePath = path.join(__dirname, 'fixtures.tmp.jsonl');
  fs.writeFileSync(filePath, fixture, 'utf8');

  const { loadProductsFromFile } = require('../utils/productLoader');
  const { products } = loadProductsFromFile(filePath);

  assert.equal(products.length, 1);
  assert.equal(products[0].name, '繁中名');
  assert.equal(products[0].category, '男士護理');
  assert.equal(products[0].description, '繁中描述');

  fs.unlinkSync(filePath);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npm test
```
Expected: FAIL（`loadProductsFromFile` 未存在）

- [ ] **Step 3: 重構 `utils/productLoader.js`（最少改動）**

要求：
- 加一個純函數 `loadProductsFromFile(filePath)`，回傳 `{ products, categories }`
- 解析時只取 `name_zh_hk/category_zh_hk/description_zh_hk`
- 缺任何必要欄位即 filter 掉（確保前台不露出原文）
- 保留現有 export API，但改為用新函數初始化

- [ ] **Step 4: Run tests to verify GREEN**

Run:
```bash
npm test
```
Expected: PASS（`productLoader.zh-hk.test.js` 全綠）

- [ ] **Step 5: Commit**

```bash
git add utils/productLoader.js test/productLoader.zh-hk.test.js
git commit -m "feat: enforce zh-hk product translations in loader"
```

---

## Task 5: DB 層加入繁中欄位 + API 只輸出繁中

**Files:**
- Create: `migrations/2026-04-28-add-zh-hk-columns.sql`
- Modify: `schema.sql`
- Modify: `routes/products.js`
- (Optional) Modify: `routes/categories.js`, `routes/brands.js`
- Create: `test/sql-surface.test.js`

- [ ] **Step 1: 寫 failing test（routes/products.js 必須使用 zh_hk 欄位）**

```js
// test/sql-surface.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('products API queries use zh_hk fields', () => {
  const p = fs.readFileSync(path.join(__dirname, '..', 'routes', 'products.js'), 'utf8');
  assert.ok(p.includes('name_zh_hk'), 'routes/products.js must reference name_zh_hk');
  assert.ok(p.includes('description_zh_hk'), 'routes/products.js must reference description_zh_hk');
  assert.ok(p.includes('name_zh_hk') || p.includes('category_name_zh_hk'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npm test
```
Expected: FAIL（routes 仍用 `name/description`）

- [ ] **Step 3: 寫 migration（可重複執行）**

```sql
-- migrations/2026-04-28-add-zh-hk-columns.sql
ALTER TABLE products ADD COLUMN IF NOT EXISTS name_zh_hk VARCHAR(255);
ALTER TABLE products ADD COLUMN IF NOT EXISTS description_zh_hk TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS short_description_zh_hk TEXT;

ALTER TABLE categories ADD COLUMN IF NOT EXISTS name_zh_hk VARCHAR(100);
ALTER TABLE categories ADD COLUMN IF NOT EXISTS description_zh_hk TEXT;

ALTER TABLE brands ADD COLUMN IF NOT EXISTS name_zh_hk VARCHAR(100);
ALTER TABLE brands ADD COLUMN IF NOT EXISTS description_zh_hk TEXT;
```

- [ ] **Step 4: 更新 `schema.sql`（新裝 DB 直接有欄位）**

在 `CREATE TABLE ... products/categories/brands` 相應位置加入同名欄位（與 migration 一致）。

- [ ] **Step 5: 更新 `routes/products.js`（只輸出繁中 + 過濾未翻譯）**

原則：
- 搜尋：只用 `p.name_zh_hk`、`p.description_zh_hk`
- 列表：只回傳 `name_zh_hk/description_zh_hk`（如需相容，可保留 `name/description` 但前台不得使用；本階段建議直接以 zh_hk 欄位覆蓋輸出 key）
- where：加 `p.name_zh_hk IS NOT NULL AND p.description_zh_hk IS NOT NULL`
- category join：回傳 `c.name_zh_hk as category_name`

示例（節錄）：
```sql
SELECT
  p.*,
  c.name_zh_hk as category_name
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
WHERE p.status = 'active'
  AND p.name_zh_hk IS NOT NULL
  AND p.description_zh_hk IS NOT NULL
```

- [ ] **Step 6: Run tests to verify GREEN**

Run:
```bash
npm test
```
Expected: PASS（`sql-surface.test.js` 全綠）

- [ ] **Step 7: Commit**

```bash
git add migrations/2026-04-28-add-zh-hk-columns.sql schema.sql routes/products.js test/sql-surface.test.js
git commit -m "feat: add zh-hk product fields and enforce in API"
```

---

## Task 6: 上線前核對（本地）

**Files:**
- Modify:（如測試指出仍殘留日文/簡體/英文對客字）

- [ ] **Step 1: 全套測試**

Run:
```bash
npm test
```
Expected: ALL PASS

- [ ] **Step 2: 本地跑起 server 人手掃頁**

Run:
```bash
npm start
```
Check:
- `/`、`/products`、`/product/1`、`/login`、`/register`、`/cart` 全部繁中

- [ ] **Step 3: Push to GitHub（觸發 Vercel Deploy）**

```bash
git push origin master
```

---

## Task 7: Production 驗收（Vercel）

- [ ] 打開 `ohya2-0.vercel.app` 首頁/商品列表/商品詳情
- [ ] Vercel Runtime Logs：確認無 `Cannot find module`、無 Function crash
- [ ] 隨機搜尋站內文本：不應出現日文關鍵字（例如 `ログイン`、`年齢確認`、`検索`）

