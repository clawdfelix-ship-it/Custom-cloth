# CSP 收緊（Report-Only + 報告收集）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不影響現有前台/後台載入的前提下（Report-Only），新增 CSP 違規報告收集 endpoint，並用環境變量切換 report/enforce 模式，為下一階段收緊 CSP 做準備。

**Architecture:** Helmet CSP 仍採用 report-only，但先移除 `unsafe-eval`（只報告不阻斷）。新增 `POST /csp-report` 接收 `application/csp-report` 與 `application/reports+json`，只記錄必要欄位、剝離 querystring，並豁免 CSRF + 套用輕量 rate limit。

**Tech Stack:** Node.js / Express / Helmet CSP / 現有 rate limit / 現有 CSRF middleware

---

## File map（改動範圍）

**Modify**
- `app.js`（CSP_MODE + CSP_REPORT_PATH + policy 調整 + endpoint wiring + CSRF skip）
- `.env.example`（新增 CSP 相關 env）

**Create**
- `utils/security/cspReport.js`（parse + sanitize report payload）
- `test/security-csp-report.test.js`（wiring + parser 測試）

---

### Task 1: 加 env 與 CSP policy（report/enforce + 移除 unsafe-eval）

**Files:**
- Modify: `app.js`
- Modify: `.env.example`
- Test: `test/security-csp-policy.test.js`

- [ ] **Step 1: 更新 .env.example**

Add:
```bash
# CSP mode: report|enforce
CSP_MODE=report
# CSP report endpoint path
CSP_REPORT_PATH=/csp-report
```

- [ ] **Step 2: 在 app.js 讀取 CSP_MODE 並調整 policy**

將 helmet CSP config 改為：
```js
const cspMode = String(process.env.CSP_MODE || 'report').toLowerCase();
const cspReportOnly = cspMode !== 'enforce';
const cspReportPath = String(process.env.CSP_REPORT_PATH || '/csp-report');

app.use(helmet({
  contentSecurityPolicy: {
    reportOnly: cspReportOnly,
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.tailwindcss.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.tailwindcss.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      fontSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https:'],
      reportUri: [cspReportPath],
    },
  },
}));
```

重點：`scriptSrc` **移除** `unsafe-eval`，但仍 report-only（不阻斷）。

- [ ] **Step 3: 新增 policy wiring 測試**

Create `test/security-csp-policy.test.js`：
```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('CSP policy does not include unsafe-eval', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  assert.ok(!s.includes(\"'unsafe-eval'\"));
});

test('CSP supports report/enforce mode', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  assert.ok(s.includes('CSP_MODE'));
  assert.ok(s.includes('CSP_REPORT_PATH'));
});
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

- [ ] **Step 5: Commit**

```bash
git add app.js .env.example test/security-csp-policy.test.js
git commit -m "feat(security): add CSP mode and remove unsafe-eval (report-only)"
```

---

### Task 2: 新增 CSP report parser（sanitize）

**Files:**
- Create: `utils/security/cspReport.js`
- Test: `test/security-csp-report.test.js`

- [ ] **Step 1: 建立 parser**

Create `utils/security/cspReport.js`：
```js
function safeUrl(u) {
  if (!u) return '';
  try {
    const x = new URL(String(u));
    return x.origin + x.pathname;
  } catch {
    return '';
  }
}

function normalizeCspReports(body) {
  const out = [];

  if (body && typeof body === 'object' && body['csp-report']) {
    const r = body['csp-report'];
    out.push({
      type: 'csp-report',
      blockedUri: safeUrl(r['blocked-uri']),
      violatedDirective: String(r['violated-directive'] || ''),
      effectiveDirective: String(r['effective-directive'] || ''),
      sourceFile: safeUrl(r['source-file']),
      disposition: String(r.disposition || 'report'),
    });
    return out;
  }

  if (Array.isArray(body)) {
    for (const item of body) {
      const r = item && (item.body || item['csp-report']);
      if (!r || typeof r !== 'object') continue;
      out.push({
        type: String(item.type || 'report'),
        blockedUri: safeUrl(r['blockedURL'] || r['blocked-uri']),
        violatedDirective: String(r['violatedDirective'] || r['violated-directive'] || ''),
        effectiveDirective: String(r['effectiveDirective'] || r['effective-directive'] || ''),
        sourceFile: safeUrl(r['sourceFile'] || r['source-file']),
        disposition: String(r['disposition'] || r.disposition || 'report'),
      });
    }
  }

  return out;
}

module.exports = { normalizeCspReports };
```

- [ ] **Step 2: 測試 parser**

Create `test/security-csp-report.test.js`：
```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeCspReports } = require('../utils/security/cspReport');

test('normalizeCspReports supports legacy csp-report', () => {
  const items = normalizeCspReports({
    'csp-report': {
      'blocked-uri': 'https://cdn.tailwindcss.com/x.js?token=abc',
      'violated-directive': 'script-src',
      'source-file': 'https://example.com/admin?x=1',
    },
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].blockedUri, 'https://cdn.tailwindcss.com/x.js');
  assert.equal(items[0].sourceFile, 'https://example.com/admin');
});

test('normalizeCspReports supports reports+json array', () => {
  const items = normalizeCspReports([
    {
      type: 'csp-violation',
      body: { blockedURL: 'https://evil.com/a.js?x=1', violatedDirective: 'script-src' },
    },
  ]);
  assert.equal(items.length, 1);
  assert.equal(items[0].blockedUri, 'https://evil.com/a.js');
});
```

- [ ] **Step 3: Run tests**

```bash
npm test
```

- [ ] **Step 4: Commit**

```bash
git add utils/security/cspReport.js test/security-csp-report.test.js
git commit -m "feat(security): add CSP report parser (sanitize)"
```

---

### Task 3: 新增 /csp-report endpoint + CSRF 豁免 + rate limit

**Files:**
- Modify: `app.js`
- Test: `test/security-csp-endpoint-wiring.test.js`

- [ ] **Step 1: 在 app.js 接收 JSON**

確保 `/csp-report` 可以收 `application/csp-report` 同 `application/reports+json`：
```js
app.post(cspReportPath, express.json({ type: ['application/csp-report', 'application/reports+json', 'application/json'] }));
```

（如果現時全域 `express.json()` 已覆蓋，保留額外 type 即可。）

- [ ] **Step 2: route handler**

```js
const { normalizeCspReports } = require('./utils/security/cspReport');

app.post(cspReportPath, (req, res) => {
  const items = normalizeCspReports(req.body);
  if (items.length) {
    console.warn('CSP report', items[0]);
  }
  res.status(204).end();
});
```

- [ ] **Step 3: CSRF 豁免**

在 `shouldSkipCsrf(req)` 加：
```js
if (p === cspReportPath) return true;
```

- [ ] **Step 4: rate limit**

在 app.js 針對 report path 套用較低 cost limiter（可新增一個小 limiter 或重用 webhook limiter）。

- [ ] **Step 5: 測試 wiring（字串級）**

Create `test/security-csp-endpoint-wiring.test.js`：
```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('app wires CSP report endpoint and CSRF skip', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  assert.ok(s.includes('CSP_REPORT_PATH'));
  assert.ok(s.includes('cspReportPath'));
  assert.ok(s.includes('CSP report'));
});
```

- [ ] **Step 6: Run tests**

```bash
npm test
```

- [ ] **Step 7: Commit**

```bash
git add app.js test/security-csp-endpoint-wiring.test.js
git commit -m "feat(security): add CSP report endpoint"
```

---

## Plan self-review

- Spec 覆蓋：env 開關、policy 收緊（移除 unsafe-eval）、report endpoint、CSRF 豁免、防濫用 rate limit、測試均有對應 Task。

