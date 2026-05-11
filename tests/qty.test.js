const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizeQtyToSizeRatio } = require('../src/lib/qty');

test('normalizeQtyToSizeRatio accepts sizeRatio array', () => {
  const r = normalizeQtyToSizeRatio([
    { size: '100', qty: 2 },
    { size: '110', qty: 0 }
  ]);
  assert.deepEqual(r, [
    { size: '100', qty: 2 },
    { size: '110', qty: 0 }
  ]);
});

test('normalizeQtyToSizeRatio accepts legacy fixed qty object', () => {
  const r = normalizeQtyToSizeRatio({ S: 1, M: 0, L: 2, XL: 0, '2XL': 0, '3XL': 0 });
  assert.deepEqual(r, [
    { size: 'S', qty: 1 },
    { size: 'L', qty: 2 }
  ]);
});

test('normalizeQtyToSizeRatio rejects empty total qty', () => {
  assert.throws(() => normalizeQtyToSizeRatio([{ size: 'S', qty: 0 }]), /qty empty/i);
});

