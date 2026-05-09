const test = require('node:test');
const assert = require('node:assert/strict');

test('index.html contains REF customer tabs', async () => {
  const fs = require('node:fs/promises');
  const html = await fs.readFile('index.html', 'utf8');
  assert.match(html, /id="tab-new"/);
  assert.match(html, /id="tab-repeat"/);
  assert.match(html, /id="tab-query"/);
});

