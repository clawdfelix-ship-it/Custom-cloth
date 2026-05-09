const test = require('node:test');
const assert = require('node:assert/strict');

test('public orders api modules export handler functions', () => {
  const createOrder = require('../api/public/orders');
  const history = require('../api/public/orders/history');
  const status = require('../api/public/orders/status');
  assert.equal(typeof createOrder, 'function');
  assert.equal(typeof history, 'function');
  assert.equal(typeof status, 'function');
});

