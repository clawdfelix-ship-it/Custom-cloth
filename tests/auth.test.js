const test = require('node:test');
const assert = require('node:assert/strict');
const { getBearerToken } = require('../src/lib/auth');

test('getBearerToken extracts token', () => {
  assert.equal(getBearerToken('Bearer abc'), 'abc');
});

test('getBearerToken returns empty string when invalid', () => {
  assert.equal(getBearerToken('Basic abc'), '');
  assert.equal(getBearerToken(''), '');
});

