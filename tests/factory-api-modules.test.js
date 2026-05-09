const test = require('node:test');
const assert = require('node:assert/strict');

test('factory api modules export handler functions', () => {
  const orders = require('../api/factory/orders');
  const orderDetail = require('../api/factory/orders/[id]');
  const orderStatus = require('../api/factory/orders/status');
  const feedback = require('../api/factory/feedback');

  assert.equal(typeof orders, 'function');
  assert.equal(typeof orderDetail, 'function');
  assert.equal(typeof orderStatus, 'function');
  assert.equal(typeof feedback, 'function');
});

