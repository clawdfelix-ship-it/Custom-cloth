# 全站 UI 近乎 1:1 跟 mzakka.com（含下載原站圖片資產）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 將全站所有頁面（`/`、`/products`、`/product/:id`、`/cart`、`/login`、`/register`）改到「觀感近乎 1:1」對齊 `https://mzakka.com/`：黑底白框、紅色漸層 header、黑底密集分類導覽、三欄版面（左分類/中內容/右小欄）、首頁圖像 banner 區、扁平化 footer bar；同時 UI 靜態文案維持繁中、排行榜以「最新上架」實作。

**Architecture:** 採用一份輕量 theme CSS（`public/css/mzakka-theme.css`）鎖定「復古密度/粗框/色條」外觀；EJS 結構以共用 partial（header、sidebar-left、sidebar-right、footer）保證全站一致；圖片資產以 manifest + 下載腳本落地到 `public/assets/mzakka/`，模板只引用本地路徑（唔 hotlink）；以 node:test 用「讀模板檔」方式鎖定關鍵結構，避免改到走樣。

**Tech Stack:** Node.js（CommonJS）+ Express + EJS + Tailwind（CDN）+ 自定 CSS + node:test

---

## File Structure（會改/新增）

**Create**
- `public/css/mzakka-theme.css`：mzakka 風格（黑底白框/紅漸層/黑 nav/密集字級）
- `data/mzakka-assets.manifest.json`：原站圖片資產 URL → 本地 dest 對照表（只含 mzakka.com / i.mzakka.com，排除第三方追蹤）
- `scripts/download-mzakka-assets.js`：按 manifest 下載圖片到 `public/assets/mzakka/`（支援 `--dry-run`）
- `scripts/verify-mzakka-assets.js`：驗證 manifest 內 dest 檔案是否存在（CI/本地驗收用）
- `views/partials/sidebar-left.ejs`：左欄（分類 + 會員盒 + 小 banner）
- `views/partials/sidebar-right.ejs`：右欄（最近瀏覽/小欄）
- `test/mzakka-theme-layout.test.js`：鎖定全站模板應有的 theme CSS link / wrapper / 三欄 marker / footer bar 結構

**Modify**
- `package.json`：新增 `assets:download` / `assets:verify`
- `views/partials/head.ejs`：統一載入 Tailwind、字體、theme CSS
- `views/partials/header.ejs`：紅色漸層 header + logo 圖 + 搜尋列（保持 `name="category"` + `name="q"`）
- `views/partials/sidebar.ejs`：改為轉 include `sidebar-left`（或刪除並改各頁 include 左/右 sidebar）
- `views/partials/footer.ejs`：改成「灰 link bar + 紅 18+ bar」扁平結構
- `views/index.ejs`：黑底白框 wrapper + 三欄布局 + 圖像 banner 區 + 排行榜 + 商品密集呈現
- `views/products.ejs`：同一套 wrapper + 三欄布局 + 商品卡密度更接近原站（減少圓角/陰影/大按鈕）
- `views/product.ejs`：同一套 wrapper + 三欄布局 + 商品詳情密度/區塊對齊
- `views/cart.ejs`、`views/login.ejs`、`views/register.ejs`：同一套 wrapper + 三欄布局（內容保持可用，外觀對齊）

---

### Task 1: 新增/更新「全站 1:1 結構」測試（先 RED）

**Files:**
- Create: `test/mzakka-theme-layout.test.js`

- [ ] **Step 1: 寫 failing test（鎖定 theme CSS + wrapper + 三欄 + footer bar）**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function readView(rel) {
  return fs.readFileSync(path.join(__dirname, '..', 'views', rel), 'utf8');
}

test('head partial loads mzakka theme css', () => {
  const head = readView(path.join('partials', 'head.ejs'));
  assert.match(head, /mzakka-theme\\.css/, 'head.ejs should load mzakka-theme.css');
});

test('index uses black-body + white framed wrapper markers', () => {
  const html = readView('index.ejs');
  assert.match(html, /class=\\\"[^\\\"]*mz-body[^\\\"]*\\\"/, 'index.ejs should include mz-body on <body>');
  assert.match(html, /id=\\\"mz-wrapper\\\"/, 'index.ejs should include #mz-wrapper');
});

test('all key pages include left+right sidebar partials', () => {
  const pages = ['index.ejs', 'products.ejs', 'product.ejs', 'cart.ejs', 'login.ejs', 'register.ejs'];
  for (const p of pages) {
    const html = readView(p);
    assert.match(html, /include\\('partials\\/sidebar-left'\\)/, `${p} should include sidebar-left`);
    assert.match(html, /include\\('partials\\/sidebar-right'\\)/, `${p} should include sidebar-right`);
  }
});

test('footer renders flat link bar + age 18 bar markers', () => {
  const footer = readView(path.join('partials', 'footer.ejs'));
  assert.match(footer, /id=\\\"mz-footer-links\\\"/, 'footer should include #mz-footer-links');
  assert.match(footer, /id=\\\"mz-footer-18\\\"/, 'footer should include #mz-footer-18');
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:
```bash
npm test
```
Expected: FAIL（未有 theme css link / marker / 新 partial）

---

### Task 2: 加入 theme CSS（先建立最小骨架，令 Task 1 轉 GREEN 一部份）

**Files:**
- Create: `public/css/mzakka-theme.css`
- Modify: `views/partials/head.ejs`

- [ ] **Step 1: 新增 `public/css/mzakka-theme.css`（只放最小必要 class）**

```css
.mz-body { background: #000; color: #000; }
.mz-wrapper { background: #fff; border: 2px solid #000; }
.mz-topbar { background: #f3f4f6; border-bottom: 1px solid #d1d5db; }
.mz-header { background: linear-gradient(#b91c1c, #7f1d1d); color: #fff; }
.mz-nav { background: #000; color: #fff; }
.mz-nav a { color: #fff; }
.mz-sidebar-title { background: #f3f4f6; border-bottom: 1px solid #d1d5db; }
.mz-footer-links { background: #e5e7eb; color: #111827; }
.mz-footer-18 { background: #7f1d1d; color: #fff; }
```

- [ ] **Step 2: 在 `views/partials/head.ejs` 加入 theme CSS link**

把以下 `<link>` 加到 Tailwind script 之後、Google font 之前或之後都可：

```html
  <link rel="stylesheet" href="/css/mzakka-theme.css">
```

- [ ] **Step 3: Run tests（Task 1 第一條應該轉綠）**

Run:
```bash
npm test
```
Expected: `head partial loads mzakka theme css` PASS

---

### Task 3: 建立左右側欄 partial（先做結構 marker，令 Task 1 轉 GREEN）

**Files:**
- Create: `views/partials/sidebar-left.ejs`
- Create: `views/partials/sidebar-right.ejs`

- [ ] **Step 1: 新增 `sidebar-left.ejs`（分類 + 會員盒 + 小 banner 區塊）**

```ejs
<aside id="wrap_left" class="lg:w-56 flex-shrink-0">
  <div class="mz-box border border-gray-300 bg-white mb-3">
    <div class="mz-sidebar-title px-3 py-2 text-xs font-black">【商品分類】</div>
    <ul class="divide-y divide-gray-200">
      <% (categories || []).forEach(cat => { %>
        <li>
          <a href="/products?category=<%= encodeURIComponent(cat.name) %>&page=1" class="block px-3 py-2 text-xs hover:bg-gray-100">
            <%= cat.name %> <span class="text-gray-400">(<%= cat.count %>)</span>
          </a>
        </li>
      <% }) %>
    </ul>
  </div>

  <div class="mz-box border border-gray-300 bg-white mb-3">
    <div class="mz-sidebar-title px-3 py-2 text-xs font-black">【會員】</div>
    <div class="p-3 text-xs">
      <% if (user) { %>
        <div class="mb-2">已登入</div>
        <a class="underline" href="/logout">登出</a>
      <% } else { %>
        <div class="flex gap-2">
          <a class="underline" href="/login"><%= t('nav.login') %></a>
          <a class="underline" href="/register"><%= t('nav.register') %></a>
        </div>
      <% } %>
    </div>
  </div>

  <div class="mz-box border border-gray-300 bg-white">
    <div class="mz-sidebar-title px-3 py-2 text-xs font-black">【公告】</div>
    <div class="p-2 space-y-2">
      <a href="/products?page=1" class="block border border-gray-200">
        <img src="/assets/mzakka/banners/214x78.jpg" alt="活動" class="w-full">
      </a>
      <a href="/products?page=1" class="block border border-gray-200">
        <img src="/assets/mzakka/banners/M_zakka_214x78.jpg" alt="活動" class="w-full">
      </a>
    </div>
  </div>
</aside>
```

- [ ] **Step 2: 新增 `sidebar-right.ejs`（最近瀏覽盒）**

```ejs
<aside id="wrap_right" class="lg:w-56 flex-shrink-0">
  <div class="mz-box border border-gray-300 bg-white mb-3">
    <div class="mz-sidebar-title px-3 py-2 text-xs font-black">【最近瀏覽】</div>
    <div class="p-3 text-xs text-gray-600">
      <div id="mz-recently-viewed-empty">暫時未有</div>
      <ul id="mz-recently-viewed" class="hidden space-y-2"></ul>
    </div>
  </div>
  <div class="mz-box border border-gray-300 bg-white">
    <div class="mz-sidebar-title px-3 py-2 text-xs font-black">【推薦】</div>
    <div class="p-2">
      <a href="/products?page=1" class="block border border-gray-200">
        <img src="/assets/mzakka/banners/214_78(1).png" alt="推薦" class="w-full">
      </a>
    </div>
  </div>
</aside>
```

- [ ] **Step 3: Run tests（Task 1 仍未全綠，但為下一步鋪路）**

Run:
```bash
npm test
```
Expected: 仍 FAIL（頁面未 include 新 sidebar）

---

### Task 4: 把 6 個主要頁面改成同一套 wrapper + include 左右欄（令 Task 1 轉 GREEN）

**Files:**
- Modify: `views/index.ejs`
- Modify: `views/products.ejs`
- Modify: `views/product.ejs`
- Modify: `views/cart.ejs`
- Modify: `views/login.ejs`
- Modify: `views/register.ejs`

- [ ] **Step 1: 每頁 `<body>` 加 `mz-body`**

例（index）：
```html
<body class="mz-body min-h-screen">
```

- [ ] **Step 2: 每頁 wrapper 改成帶 id + class**

例（index）：
```html
<div id="mz-wrapper" class="mz-wrapper max-w-7xl mx-auto px-2 mt-3 mb-5">
  <div class="flex gap-3 flex-col lg:flex-row">
    <%- include('partials/sidebar-left') %>
    <div id="wrap_center" class="flex-1 min-w-0">…</div>
    <%- include('partials/sidebar-right') %>
  </div>
</div>
```

- [ ] **Step 3: Run tests to verify GREEN**

Run:
```bash
npm test
```
Expected: `test/mzakka-theme-layout.test.js` 轉綠（結構 marker 鎖定完成）

---

### Task 5: 圖片資產 manifest + 下載/驗證腳本（不影響模板測試，但支持「1:1 外觀」）

**Files:**
- Create: `data/mzakka-assets.manifest.json`
- Create: `scripts/download-mzakka-assets.js`
- Create: `scripts/verify-mzakka-assets.js`
- Modify: `package.json`
- Test: `test/mzakka-assets-scripts.test.js`（新增）

- [ ] **Step 1: 新增 manifest（只保留 mzakka.com / i.mzakka.com，排除第三方）**

建立 `data/mzakka-assets.manifest.json`：

```json
[
  { "url": "https://mzakka.com/images/bg_menu.gif", "dest": "public/assets/mzakka/ui/bg_menu.gif" },
  { "url": "https://mzakka.com/images/bg_footer.2019012400.gif", "dest": "public/assets/mzakka/ui/bg_footer.2019012400.gif" },
  { "url": "https://mzakka.com/images/logo_18.gif", "dest": "public/assets/mzakka/ui/logo_18.gif" },
  { "url": "https://mzakka.com/images/h2_leftmenu01.gif", "dest": "public/assets/mzakka/ui/h2_leftmenu01.gif" },
  { "url": "https://mzakka.com/images/h2_leftmenu02.gif", "dest": "public/assets/mzakka/ui/h2_leftmenu02.gif" },
  { "url": "https://mzakka.com/images/h2_leftmenu05.gif", "dest": "public/assets/mzakka/ui/h2_leftmenu05.gif" },
  { "url": "https://mzakka.com/images/h2_right01.gif", "dest": "public/assets/mzakka/ui/h2_right01.gif" },
  { "url": "https://mzakka.com/images/h2_right02.gif", "dest": "public/assets/mzakka/ui/h2_right02.gif" },
  { "url": "https://mzakka.com/images/btn_entry.gif", "dest": "public/assets/mzakka/ui/btn_entry.gif" },
  { "url": "https://mzakka.com/js/images/controls.png", "dest": "public/assets/mzakka/ui/controls.png" },
  { "url": "https://mzakka.com/js/images/bx_loader.gif", "dest": "public/assets/mzakka/ui/bx_loader.gif" },

  { "url": "https://i.mzakka.com/free/214x78.jpg", "dest": "public/assets/mzakka/banners/214x78.jpg" },
  { "url": "https://i.mzakka.com/free/M_zakka_214x78.jpg", "dest": "public/assets/mzakka/banners/M_zakka_214x78.jpg" },
  { "url": "https://i.mzakka.com/free/214_78(1).png", "dest": "public/assets/mzakka/banners/214_78(1).png" },
  { "url": "https://i.mzakka.com/free/banner_M-ZAKKA_GODSA001.jpg", "dest": "public/assets/mzakka/banners/banner_M-ZAKKA_GODSA001.jpg" },
  { "url": "https://i.mzakka.com/free/banner_M-ZAKKA_GODSR011.jpg", "dest": "public/assets/mzakka/banners/banner_M-ZAKKA_GODSR011.jpg" },
  { "url": "https://i.mzakka.com/free/banner_M-ZAKKA_GODSR011.jpg", "dest": "public/assets/mzakka/banners/banner_M-ZAKKA_GODSR011.jpg" },
  { "url": "https://i.mzakka.com/free/UHTP-018_214-78.jpg", "dest": "public/assets/mzakka/banners/UHTP-018_214-78.jpg" },
  { "url": "https://i.mzakka.com/free/UHTP-151_214-78.jpg", "dest": "public/assets/mzakka/banners/UHTP-151_214-78.jpg" },
  { "url": "https://i.mzakka.com/free/UHTP-185_214-78.jpg", "dest": "public/assets/mzakka/banners/UHTP-185_214-78.jpg" },
  { "url": "https://i.mzakka.com/free/UHTP-202_214-78.jpg", "dest": "public/assets/mzakka/banners/UHTP-202_214-78.jpg" },
  { "url": "https://i.mzakka.com/free/M-zakka214_78.png", "dest": "public/assets/mzakka/banners/M-zakka214_78.png" },
  { "url": "https://i.mzakka.com/free/M-zakka_214x78.png", "dest": "public/assets/mzakka/banners/M-zakka_214x78.png" },
  { "url": "https://i.mzakka.com/free/M-ZAKKA_bnrcoolp16.jpg", "dest": "public/assets/mzakka/banners/M-ZAKKA_bnrcoolp16.jpg" },
  { "url": "https://i.mzakka.com/free/M-ZAKKA_COOLP33.jpg", "dest": "public/assets/mzakka/banners/M-ZAKKA_COOLP33.jpg" }
]
```

- [ ] **Step 2: 新增下載腳本（支援 `--dry-run`）**

`scripts/download-mzakka-assets.js`：

```js
const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');

function parseArgs(argv) {
  const out = { manifest: 'data/mzakka-assets.manifest.json', dryRun: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--manifest') out.manifest = argv[++i];
  }
  return out;
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        resolve(get(res.headers.location));
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} ${url}`));
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

async function main() {
  const args = parseArgs(process.argv);
  const manifestPath = path.isAbsolute(args.manifest) ? args.manifest : path.join(process.cwd(), args.manifest);
  const entries = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  for (const e of entries) {
    const destAbs = path.isAbsolute(e.dest) ? e.dest : path.join(process.cwd(), e.dest);
    if (args.dryRun) {
      process.stdout.write(`DRY ${e.url} -> ${e.dest}\n`);
      continue;
    }
    if (fs.existsSync(destAbs)) continue;
    ensureDir(destAbs);
    const buf = await get(e.url);
    fs.writeFileSync(destAbs, buf);
    process.stdout.write(`OK ${e.url} -> ${e.dest} (${buf.length})\n`);
  }
}

if (require.main === module) {
  main().catch((e) => {
    process.stderr.write(String(e && e.stack ? e.stack : e) + '\n');
    process.exit(1);
  });
}

module.exports = { parseArgs };
```

- [ ] **Step 3: 新增驗證腳本**

`scripts/verify-mzakka-assets.js`：

```js
const fs = require('node:fs');
const path = require('node:path');

function main() {
  const manifest = path.join(process.cwd(), 'data/mzakka-assets.manifest.json');
  const entries = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  const missing = [];
  for (const e of entries) {
    const destAbs = path.isAbsolute(e.dest) ? e.dest : path.join(process.cwd(), e.dest);
    if (!fs.existsSync(destAbs)) missing.push(e.dest);
  }
  if (missing.length) {
    process.stderr.write(`Missing assets:\\n${missing.join('\\n')}\\n`);
    process.exit(2);
  }
  process.stdout.write(`OK assets ${entries.length}\\n`);
}

if (require.main === module) main();
```

- [ ] **Step 4: 加入 npm scripts**

在 `package.json` 的 `scripts` 增加：

```json
{
  "assets:download": "node scripts/download-mzakka-assets.js",
  "assets:verify": "node scripts/verify-mzakka-assets.js"
}
```

- [ ] **Step 5: 為 scripts 加最小測試（保證 dry-run 可用）**

新增 `test/mzakka-assets-scripts.test.js`：

```js
const test = require('node:test');
const assert = require('node:assert/strict');

test('download assets script: parses args', () => {
  const { parseArgs } = require('../scripts/download-mzakka-assets');
  const out = parseArgs(['node', 'x', '--dry-run', '--manifest', 'data/x.json']);
  assert.equal(out.dryRun, true);
  assert.equal(out.manifest, 'data/x.json');
});
```

- [ ] **Step 6: Run tests**

Run:
```bash
npm test
```
Expected: PASS

- [ ] **Step 7: 下載資產（手動驗收前必做一次）**

Run:
```bash
npm run assets:download
npm run assets:verify
```
Expected: `OK assets ...`

---

### Task 6: Header / Nav / Footer 做到「觀感 1:1」並維持繁中（視覺對照）

**Files:**
- Modify: `views/partials/header.ejs`
- Modify: `views/partials/footer.ejs`
- Modify: `public/css/mzakka-theme.css`

- [ ] **Step 1: Header 改成紅漸層 + logo 圖（同時保留 OHYA2.0 文字以通過現有測試）**
- [ ] **Step 2: Nav 改成黑底密集可換行（由 categories 生成）**
- [ ] **Step 3: Footer 改成 `#mz-footer-links` + `#mz-footer-18` 兩條 bar**
- [ ] **Step 4: Run tests**

Run:
```bash
npm test
```
Expected: PASS（含 `logo.test.js`、`views do not contain Japanese UI strings`）

---

### Task 7: 首頁 Banner/排行榜/商品密度對齊（視覺對照）

**Files:**
- Modify: `views/index.ejs`
- Modify: `public/css/mzakka-theme.css`
- (Optional) Modify: `app.js`（如要補 banner data source）

- [ ] **Step 1: Banner 區改用本地資產（`/assets/mzakka/banners/...`）做主大圖 + 側小圖 + 活動圖長列**
- [ ] **Step 2: 排行榜區塊改成更密集（字級/行距/分隔）**
- [ ] **Step 3: 商品 grid 由「現代卡片」改成「密集復古」**
- [ ] **Step 4: Run tests**

Run:
```bash
npm test
```
Expected: PASS

---

### Task 8: 其他頁面一致化（products/product/cart/login/register）

**Files:**
- Modify: `views/products.ejs`
- Modify: `views/product.ejs`
- Modify: `views/cart.ejs`
- Modify: `views/login.ejs`
- Modify: `views/register.ejs`
- Modify: `public/css/mzakka-theme.css`

- [ ] **Step 1: 統一黑底白框 wrapper + 三欄**
- [ ] **Step 2: 調整商品列表/詳情頁密度（減少圓角/陰影/大按鈕，字級貼近 mzakka）**
- [ ] **Step 3: 最近瀏覽（JS）把 product page 近期商品記入 localStorage，右欄顯示（如要 1:1 更似）**
- [ ] **Step 4: Run tests**

Run:
```bash
npm test
```
Expected: PASS

---

## 手動驗收清單（完成後做一次）

- [ ] 開 `http://localhost:3001/`（或 `PORT=3001 npm start`）：黑底白框、header 紅漸層、nav 黑底密集、三欄完整
- [ ] 開 `/products?page=1`：左分類可點、右欄存在、內容密度接近 mzakka
- [ ] 開 `/product/:id`：右欄「最近瀏覽」可顯示
- [ ] 開 `/cart`、`/login`、`/register`：外框/三欄/頁首頁尾一致

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-03-mzakka-fullsite-ui-1to1.md`. Two execution options:

1. Subagent-Driven (recommended) — I dispatch a fresh subagent per task, review between tasks
2. Inline Execution — Execute tasks in this session with checkpoints

Which approach?
