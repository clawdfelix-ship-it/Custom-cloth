const test = require('node:test');
const assert = require('node:assert/strict');

test('api entrypoints export handler functions', () => {
  const auth = require('../api/auth');
  const pub = require('../api/public');
  const admin = require('../api/admin');
  const factory = require('../api/factory');

  assert.equal(typeof auth, 'function');
  assert.equal(typeof pub, 'function');
  assert.equal(typeof admin, 'function');
  assert.equal(typeof factory, 'function');
});

