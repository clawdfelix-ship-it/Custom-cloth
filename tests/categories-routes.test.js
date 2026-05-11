const test = require('node:test');
const assert = require('node:assert/strict');

test('vercel rewrites include public categories endpoint', async () => {
  const fs = require('node:fs/promises');
  const raw = await fs.readFile('vercel.json', 'utf8');
  const cfg = JSON.parse(raw);
  const rewrites = cfg.rewrites || [];
  const has = rewrites.some((r) => r.source === '/api/public/categories');
  assert.equal(has, true);
});

