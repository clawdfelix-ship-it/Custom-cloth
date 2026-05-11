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
