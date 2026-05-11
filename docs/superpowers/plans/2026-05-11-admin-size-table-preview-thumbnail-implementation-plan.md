# 後台尺碼表列表 Preview 縮圖（SVG）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 後台 `/admin` 尺碼表列表每行顯示由 data 即時生成的 preview 縮圖（顯示全部行），點擊可彈出放大預覽。

**Architecture:** 僅改 `admin.html`。將 `sizeTable.data` 轉換成 SVG（data URI）輸出縮圖與放大圖。欄位動態（seat/china/height 視乎存在）。不新增 DB 欄位、不上傳 blob。

**Tech Stack:** Vanilla JS + SVG data URI；Node.js `node:test`（用字串/regex smoke）。

---

## Files Impact

**Modify**
- `admin.html`
- `tests/admin-html.test.js`

---

### Task 1: Admin 尺碼表列表加 Preview 欄位（TDD）

**Files:**
- Modify: `tests/admin-html.test.js`
- Modify: `admin.html`

- [ ] **Step 1: 先寫 failing test（確保 sizes table 有 Preview 欄/元素）**

在 `tests/admin-html.test.js` 加一個 test，先假設會有：
- table header 文字 `Preview`
- 每行 preview `<img>` 有固定 class 或 `data-*`（例如 `data-size-preview`）
- modal container（例如 `id="sizePreviewModal"`）

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');

test('admin.html contains size table preview thumbnail UI', async () => {
  const html = await fs.readFile('admin.html', 'utf8');
  assert.match(html, />\\s*Preview\\s*</);
  assert.match(html, /id=\"sizePreviewModal\"/);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test tests/admin-html.test.js
```

Expected: FAIL（未有 Preview / modal）

- [ ] **Step 3: 修改 `admin.html`（table header + modal skeleton）**
  - `tab-sizes` 的 table header 增加 `<th>Preview</th>`
  - 加一個 modal（hidden）：
    - `id="sizePreviewModal"`
    - 內含標題（name/id）+ close button + preview 容器（放大 `<img>`）

- [ ] **Step 4: Run test to verify it passes**

```bash
node --test tests/admin-html.test.js
```

Expected: PASS

---

### Task 2: SVG 生成（thumbnail / modal）+ 動態欄位

**Files:**
- Modify: `admin.html`

- [ ] **Step 1: 在 `admin.html` 加 `buildSizeTableSvg(rows, opts)`**
  - Input：rows array（每行至少 eu）
  - 欄位決定：
    - base：eu/length/chest/waist
    - +seat（有 seat 任一行有值）
    - +china（有 china 任一行有值）
    - +height（有 height 任一行有值）
  - opts：`{ variant: 'thumb' | 'modal' }`
  - 產生 SVG string（含 `<rect>` grid + `<text>`），再 encode 成 data URI

- [ ] **Step 2: 在 `loadSizes()` 填充 Preview 欄位**
  - `tr.innerHTML` 加多一格 `<td>`
  - 對每個 sizeTable：
    - `const src = buildSizeTableSvg(st.data, { variant: 'thumb' })`
    - render `<img class="size-preview-thumb" src="...">`
    - click 時開 modal，並用 `variant:'modal'` 生成放大圖

- [ ] **Step 3: 處理空 data**
  - rows 無資料或缺 eu：td 顯示 `無資料`

---

### Task 3: 手動驗收（本地 / production）

- [ ] **Step 1: 本地打開 `admin.html`**
  - 進入尺碼表 tab → 載入尺碼表
  - 確認每行有縮圖，點擊會彈出放大圖
  - 確認 `足球服 ADULT (cm)` 會顯示 臀圍

- [ ] **Step 2: Run full test suite**

```bash
npm test
```

Expected: PASS

---

### Task 4: Commit & Push

```bash
git add admin.html tests/admin-html.test.js docs/superpowers/plans/2026-05-11-admin-size-table-preview-thumbnail-implementation-plan.md
git commit -m "feat: add size table preview thumbnails in admin"
git push
```

