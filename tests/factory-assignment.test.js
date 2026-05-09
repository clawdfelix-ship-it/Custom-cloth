const test = require('node:test');
const assert = require('node:assert/strict');

test('vercel rewrites include assignFactory endpoint', async () => {
  const fs = require('node:fs/promises');
  const raw = await fs.readFile('vercel.json', 'utf8');
  const cfg = JSON.parse(raw);
  const rewrites = cfg.rewrites || [];
  const found = rewrites.some((r) => r.source === '/api/admin/orders/assign-factory');
  assert.equal(found, true);
});

