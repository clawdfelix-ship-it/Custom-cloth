const test = require('node:test');
const assert = require('node:assert/strict');
const { newToken } = require('../src/lib/auth');

test('newToken returns hex string', () => {
  const t = newToken();
  assert.equal(typeof t, 'string');
  assert.ok(/^[0-9a-f]+$/i.test(t));
  assert.ok(t.length >= 32);
});

