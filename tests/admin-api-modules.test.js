const test = require('node:test');
const assert = require('node:assert/strict');

test('admin api modules export handler functions', () => {
  const users = require('../api/admin/users');
  const sizeTables = require('../api/admin/size-tables');
  const styles = require('../api/admin/styles');
  const orders = require('../api/admin/orders');
  const orderStatus = require('../api/admin/orders/status');
  const orderCopy = require('../api/admin/orders/copy');
  const feedback = require('../api/admin/feedback');
  const feedbackStatus = require('../api/admin/feedback/status');

  assert.equal(typeof users, 'function');
  assert.equal(typeof sizeTables, 'function');
  assert.equal(typeof styles, 'function');
  assert.equal(typeof orders, 'function');
  assert.equal(typeof orderStatus, 'function');
  assert.equal(typeof orderCopy, 'function');
  assert.equal(typeof feedback, 'function');
  assert.equal(typeof feedbackStatus, 'function');
});

