const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');

test('zenex brand css exists and defines core tokens', async () => {
  const css = await fs.readFile('assets/zenex.css', 'utf8');
  assert.match(css, /--zenex-brand-500/);
  assert.match(css, /--zenex-border/);
  assert.match(css, /\.zenex-btn/);
  assert.match(css, /\.zenex-input/);
  assert.match(css, /\.zenex-card/);
});
