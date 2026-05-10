const test = require('node:test');
const assert = require('node:assert/strict');

test('vercel rewrites include blob upload endpoints', async () => {
  const fs = require('node:fs/promises');
  const raw = await fs.readFile('vercel.json', 'utf8');
  const cfg = JSON.parse(raw);
  const rewrites = cfg.rewrites || [];
  const hasAdmin = rewrites.some((r) => r.source === '/api/admin/upload');
  const hasFactory = rewrites.some((r) => r.source === '/api/factory/upload');
  assert.equal(hasAdmin, true);
  assert.equal(hasFactory, true);
});

