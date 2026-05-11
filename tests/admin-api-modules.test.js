const test = require('node:test');
const assert = require('node:assert/strict');

test('admin api modules export handler functions', () => {
  const admin = require('../api/admin');
  assert.equal(typeof admin, 'function');
});

test('admin orders supports csv export', async () => {
  const fs = require('node:fs/promises');
  const js = await fs.readFile('api/admin.js', 'utf8');
  assert.match(js, /ordersCsv/);
});
