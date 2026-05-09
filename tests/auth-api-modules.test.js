const test = require('node:test');
const assert = require('node:assert/strict');

test('auth api modules export handler functions', () => {
  const auth = require('../api/auth');
  assert.equal(typeof auth, 'function');
});
