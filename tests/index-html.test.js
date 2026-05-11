const test = require('node:test');
const assert = require('node:assert/strict');

test('index.html contains REF customer tabs', async () => {
  const fs = require('node:fs/promises');
  const html = await fs.readFile('index.html', 'utf8');
  assert.match(html, /id="tab-new"/);
  assert.match(html, /id="tab-repeat"/);
  assert.match(html, /id="tab-query"/);
});

test('index.html loads categories dynamically', async () => {
  const fs = require('node:fs/promises');
  const html = await fs.readFile('index.html', 'utf8');
  assert.match(html, /\/api\/public\/categories/);
});

test('index.html size table preview hides empty measurement columns', async () => {
  const fs = require('node:fs/promises');
  const html = await fs.readFile('index.html', 'utf8');
  assert.match(html, /const hasLength = rows\.some/);
  assert.match(html, /const hasChest = rows\.some/);
  assert.match(html, /const hasWaist = rows\.some/);
});

test('index.html shows delivery date cutoff hint', async () => {
  const fs = require('node:fs/promises');
  const html = await fs.readFile('index.html', 'utf8');
  assert.match(html, /今天16:00前確認訂單細節後計算出的最快交貨日/);
});

test('index.html includes jersey cate3/cate4 selectors', async () => {
  const fs = require('node:fs/promises');
  const html = await fs.readFile('index.html', 'utf8');
  assert.match(html, /id="cate3"/);
  assert.match(html, /id="cate4"/);
});

test('index.html supports copying lookup code and link', async () => {
  const fs = require('node:fs/promises');
  const html = await fs.readFile('index.html', 'utf8');
  assert.match(html, /copyLookupCode/);
  assert.match(html, /copyLookupLink/);
});

test('repeat mode can prefill category and delivery date', async () => {
  const fs = require('node:fs/promises');
  const html = await fs.readFile('index.html', 'utf8');
  assert.match(html, /function selectHistoryOrder/);
  assert.match(html, /cate3/);
  assert.match(html, /cate4/);
});

test('index.html includes zenex brand css and header', async () => {
  const fs = require('node:fs/promises');
  const html = await fs.readFile('index.html', 'utf8');
  assert.match(html, /\/assets\/zenex\.css/);
  assert.match(html, /ZENEX-SPORTS/);
});

test('index.html includes customer auth ui and reset mode', async () => {
  const fs = require('node:fs/promises');
  const html = await fs.readFile('index.html', 'utf8');
  assert.match(html, /customerLogin/);
  assert.match(html, /customerRegister/);
  assert.match(html, /customerToken/);
  assert.match(html, /mode=reset/);
});
