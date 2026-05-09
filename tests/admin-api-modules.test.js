const test = require('node:test');
const assert = require('node:assert/strict');

test('admin api modules export handler functions', () => {
  const admin = require('../api/admin');
  assert.equal(typeof admin, 'function');
});
