# 尺碼表「貼表格」輸入（Admin）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 後台新增尺碼表時，支援直接貼 Excel/Sheets 表格，系統自動解析並預覽，再提交到現有 `/api/admin/size-tables`。

**Architecture:** 只改前端 `admin.html`（靜態頁），新增「貼表格」解析與預覽 UI；後端 API 唔改。解析做成純函數，並用 node test 覆蓋 TSV/CSV/表頭映射。

**Tech Stack:** 靜態 HTML + Vanilla JS；Node.js `node:test`。

---

## Files Impact

**Create**
- `src/lib/size-table-parse.js`（純函數 parser，node 測試用）
- `tests/size-table-parse.test.js`

**Modify**
- `admin.html`（尺碼表 tab UI + 解析/預覽 + submit）

---

### Task 1: 加入純函數 parser（TSV/CSV + 表頭映射）

**Files:**
- Create: `src/lib/size-table-parse.js`
- Test: `tests/size-table-parse.test.js`

- [ ] **Step 1: 寫 failing tests（TSV with header / TSV without header / CSV with header）**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseSizeTableText } = require('../src/lib/size-table-parse');

test('parse TSV with header', () => {
  const tsv = [
    'EU\\tCHEST\\tWAIST\\tLENGTH\\tCHINA SIZE\\tSUGGESTED HEIGHT',
    'S\\t88-91\\t74-77\\t66\\t170/88A\\t168-173cm',
    'M\\t92-95\\t78-81\\t69\\t175/92A\\t173-178cm'
  ].join('\\n');
  const r = parseSizeTableText(tsv, { header: true });
  assert.equal(r.ok, true);
  assert.equal(r.rows.length, 2);
  assert.deepEqual(r.rows[0], { eu: 'S', chest: '88-91', waist: '74-77', length: '66', china: '170/88A', height: '168-173cm' });
});

test('parse TSV without header uses fixed columns', () => {
  const tsv = [
    'S\\t88-91\\t74-77\\t66\\t170/88A\\t168-173cm',
    'M\\t92-95\\t78-81\\t69\\t175/92A\\t173-178cm'
  ].join('\\n');
  const r = parseSizeTableText(tsv, { header: false });
  assert.equal(r.ok, true);
  assert.equal(r.rows.length, 2);
  assert.equal(r.rows[1].china, '175/92A');
});

test('parse CSV with header', () => {
  const csv = [
    'EU,CHEST,WAIST,LENGTH,CHINA,SUGGESTED HEIGHT',
    'S,88-91,74-77,66,170/88A,168-173cm'
  ].join('\\n');
  const r = parseSizeTableText(csv, { header: true });
  assert.equal(r.ok, true);
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].eu, 'S');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test tests/size-table-parse.test.js
```

Expected: FAIL（module not found）

- [ ] **Step 3: 寫 minimal implementation（parseSizeTableText）**

```js
function normalizeHeader(s) {
  return String(s || '').trim().toUpperCase();
}

function detectDelimiter(text) {
  if (text.includes('\t')) return '\t';
  if (text.includes(',')) return ',';
  return '';
}

function splitLines(text) {
  return String(text || '')
    .replace(/\\r\\n/g, '\\n')
    .replace(/\\r/g, '\\n')
    .split('\\n')
    .map((x) => x.trim())
    .filter((x) => x);
}

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '\"') {
      if (inQ && line[i + 1] === '\"') {
        cur += '\"';
        i++;
      } else {
        inQ = !inQ;
      }
      continue;
    }
    if (!inQ && ch === ',') {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function splitRow(line, delim) {
  if (delim === ',') return parseCsvLine(line);
  return line.split(delim).map((x) => String(x || '').trim());
}

function mapHeaderToKey(h) {
  const x = normalizeHeader(h);
  const map = {
    EU: 'eu',
    'EU SIZE': 'eu',
    SIZE: 'eu',
    '國際尺碼': 'eu',
    '國際尺碼(EU)': 'eu',
    '尺碼': 'eu',

    CHEST: 'chest',
    '胸圍': 'chest',
    '胸圍(CM)': 'chest',
    '胸圍CM': 'chest',

    WAIST: 'waist',
    '腰圍': 'waist',
    '腰圍(CM)': 'waist',
    '腰圍CM': 'waist',

    LENGTH: 'length',
    '衣長': 'length',
    '衣長(CM)': 'length',
    '衣長CM': 'length',

    CHINA: 'china',
    'CHINA SIZE': 'china',
    '中國尺碼': 'china',
    '中國尺碼(HEIGHT/CHEST)': 'china',

    HEIGHT: 'height',
    'SUGGESTED HEIGHT': 'height',
    '適用身高範圍': 'height'
  };
  return map[x] || '';
}

function parseSizeTableText(text, opts) {
  const header = !!(opts && opts.header);
  const lines = splitLines(text);
  if (!lines.length) return { ok: false, error: 'empty', rows: [], mapping: null };

  const delim = detectDelimiter(lines[0]);
  if (!delim) return { ok: false, error: 'delimiter', rows: [], mapping: null };

  const matrix = lines.map((ln) => splitRow(ln, delim));
  const mapping = { eu: -1, chest: -1, waist: -1, length: -1, china: -1, height: -1 };

  let start = 0;
  if (header) {
    const heads = matrix[0];
    heads.forEach((h, idx) => {
      const k = mapHeaderToKey(h);
      if (k && mapping[k] === -1) mapping[k] = idx;
    });
    start = 1;
  } else {
    mapping.eu = 0;
    mapping.chest = 1;
    mapping.waist = 2;
    mapping.length = 3;
    mapping.china = 4;
    mapping.height = 5;
  }

  const need = Object.entries(mapping).filter(([, idx]) => idx < 0).map(([k]) => k);
  if (need.length) return { ok: false, error: 'missing_columns', rows: [], mapping };

  const rows = [];
  for (let i = start; i < matrix.length; i++) {
    const r = matrix[i];
    const get = (k) => String(r[mapping[k]] || '').trim();
    const eu = get('eu');
    if (!eu) continue;
    rows.push({ eu, chest: get('chest'), waist: get('waist'), length: get('length'), china: get('china'), height: get('height') });
  }

  if (!rows.length) return { ok: false, error: 'no_rows', rows: [], mapping };
  return { ok: true, error: '', rows, mapping };
}

module.exports = { parseSizeTableText };
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
node --test tests/size-table-parse.test.js
```

Expected: PASS

- [ ] **Step 5: Run full test suite**

Run:

```bash
npm test
```

Expected: PASS

---

### Task 2: Admin UI 加入「貼表格」模式 + 預覽

**Files:**
- Modify: `admin.html`

- [ ] **Step 1: 加 UI 元件（mode 切換、貼表格 textarea、checkbox、預覽區、貼入範例）**
- [ ] **Step 2: 加事件處理（預覽、提交）**
  - 預覽：呼叫 parser → render table → 記住 parsedRows
  - 提交：`POST /api/admin/size-tables` with `{ name, data: parsedRows }`
  - 解析失敗：顯示錯誤（empty / delimiter / missing_columns / no_rows）
- [ ] **Step 3: JSON 模式保留現有流程**
- [ ] **Step 4: 更新「貼入範例」內容（用 LEIGHTON POLO 個格式）**

---

### Task 3: 測試覆蓋（UI smoke）

**Files:**
- Modify: `tests/admin-html.test.js`（或新增一個 test file）

- [ ] **Step 1: 加一個 test 確保 admin.html 包含貼表格輸入元素**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');

test('admin.html contains size table paste mode inputs', async () => {
  const raw = await fs.readFile('admin.html', 'utf8');
  assert.ok(raw.includes('貼表格'));
  assert.ok(raw.includes('id=\"sizePaste\"') || raw.includes(\"id='sizePaste'\"));
});
```

- [ ] **Step 2: Run full test suite**

Run:

```bash
npm test
```

Expected: PASS

---

### Task 4: 手動驗收（Production）

- [ ] **Step 1: 用 Google Sheets 建一個 6 欄表（含表頭），copy 貼入後台「貼表格」**
- [ ] **Step 2: 按「預覽」確認表格正確**
- [ ] **Step 3: 按「新增尺碼表」**
- [ ] **Step 4: 去客戶端落單頁揀到用呢個尺碼表嘅款式，預覽表格顯示正常**

---

### Task 5: Commit（可選）

```bash
git add admin.html src/lib/size-table-parse.js tests/size-table-parse.test.js tests/*.test.js
git commit -m "feat: paste-to-import size tables"
git push
```

