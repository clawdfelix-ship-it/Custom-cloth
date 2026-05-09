const test = require('node:test');
const assert = require('node:assert/strict');
const { requiredQtyJson } = require('../src/lib/validation');

test('requiredQtyJson validates and normalizes 6-size qty', () => {
  const out = requiredQtyJson({ S: 1, M: 2, L: 0, XL: 0, '2XL': 0, '3XL': 0 });
  assert.deepEqual(out, { S: 1, M: 2, L: 0, XL: 0, '2XL': 0, '3XL': 0 });
});

test('requiredQtyJson rejects empty total qty', () => {
  assert.throws(() => requiredQtyJson({ S: 0, M: 0, L: 0, XL: 0, '2XL': 0, '3XL': 0 }), /qty empty/);
});

