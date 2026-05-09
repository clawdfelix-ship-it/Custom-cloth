const test = require('node:test');
const assert = require('node:assert/strict');
const { hashPassword, verifyPassword } = require('../src/lib/password');

test('hashPassword + verifyPassword roundtrip', async () => {
  const hash = await hashPassword('123456');
  assert.equal(typeof hash, 'string');
  assert.equal(await verifyPassword('123456', hash), true);
  assert.equal(await verifyPassword('wrong', hash), false);
});

