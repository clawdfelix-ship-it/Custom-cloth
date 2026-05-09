const test = require('node:test');
const assert = require('node:assert/strict');
const { generateLookupCode } = require('../src/lib/lookup-code');

test('generateLookupCode returns short code', () => {
  const c = generateLookupCode();
  assert.equal(typeof c, 'string');
  assert.ok(/^[0-9a-f]+$/i.test(c));
  assert.equal(c.length, 8);
});

