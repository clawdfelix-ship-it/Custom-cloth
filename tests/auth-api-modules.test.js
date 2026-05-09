const test = require('node:test');
const assert = require('node:assert/strict');

test('auth api modules export handler functions', () => {
  const login = require('../api/auth/login');
  const logout = require('../api/auth/logout');
  assert.equal(typeof login, 'function');
  assert.equal(typeof logout, 'function');
});

