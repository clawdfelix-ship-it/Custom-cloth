const test = require('node:test');
const assert = require('node:assert/strict');

test('public api modules export handler functions', () => {
  const pub = require('../api/public');
  assert.equal(typeof pub, 'function');
});
