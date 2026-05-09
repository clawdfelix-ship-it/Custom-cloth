const test = require('node:test');
const assert = require('node:assert/strict');
const { generateOrderSn } = require('../src/lib/order-sn');

test('generateOrderSn formats with ORD prefix', () => {
  const sn = generateOrderSn(new Date('2026-05-09T10:20:30.000Z'));
  assert.match(sn, /^ORD\d{14}-[0-9a-f]{6}$/);
});

