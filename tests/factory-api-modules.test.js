const test = require('node:test');
const assert = require('node:assert/strict');

test('factory api modules export handler functions', () => {
  const factory = require('../api/factory');
  assert.equal(typeof factory, 'function');
});

test('factory order status is restricted to production states', async () => {
  const fs = require('node:fs/promises');
  const js = await fs.readFile('api/factory.js', 'utf8');
  assert.match(js, /const FACTORY_ALLOWED_STATUS\s*=\s*\[/);
  assert.match(js, /['"]生產中['"]/);
  assert.match(js, /['"]已出貨['"]/);
  assert.match(js, /['"]已完成['"]/);
});
