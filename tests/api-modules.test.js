const test = require('node:test');
const assert = require('node:assert/strict');

test('api modules export handler functions', () => {
  const orders = require('../api/orders');
  const history = require('../api/orders/history');
  const adminOrders = require('../api/admin/orders');
  const status = require('../api/admin/orders/status');

  assert.equal(typeof orders, 'function');
  assert.equal(typeof history, 'function');
  assert.equal(typeof adminOrders, 'function');
  assert.equal(typeof status, 'function');
});

