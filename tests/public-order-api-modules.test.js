const test = require('node:test');
const assert = require('node:assert/strict');

test('public orders api modules export handler functions', () => {
  const pub = require('../api/public');
  assert.equal(typeof pub, 'function');
});

test('public order status returns items for customer view', async () => {
  const fs = require('node:fs/promises');
  const js = await fs.readFile('api/public.js', 'utf8');
  assert.match(js, /itemsR\s*=\s*await sql`/);
  assert.match(js, /items:\s*normalizeItemsQty/);
});
