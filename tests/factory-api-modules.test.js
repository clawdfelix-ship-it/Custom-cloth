const test = require('node:test');
const assert = require('node:assert/strict');

test('factory api modules export handler functions', () => {
  const factory = require('../api/factory');
  assert.equal(typeof factory, 'function');
});
