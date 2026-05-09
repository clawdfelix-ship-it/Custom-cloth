const test = require('node:test');
const assert = require('node:assert/strict');

test('shouldBlockLogin blocks at 5 failures', () => {
  const { shouldBlockLogin } = require('../src/lib/rate-limit');
  assert.equal(shouldBlockLogin(4), false);
  assert.equal(shouldBlockLogin(5), true);
});

