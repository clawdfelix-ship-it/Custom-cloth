const test = require('node:test');
const assert = require('node:assert/strict');

test('audit exports audit()', () => {
  const { audit } = require('../src/lib/audit');
  assert.equal(typeof audit, 'function');
});

