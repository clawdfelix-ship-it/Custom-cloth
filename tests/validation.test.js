const test = require('node:test');
const assert = require('node:assert/strict');
const { requiredSizeRatio } = require('../src/lib/validation');

test('requiredSizeRatio normalizes and validates', () => {
  const out = requiredSizeRatio([{ size: 'M', qty: 2 }]);
  assert.deepEqual(out, [{ size: 'M', qty: 2 }]);
});

