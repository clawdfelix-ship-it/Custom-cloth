const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');

test('customer-auth lib exports helpers', () => {
  const m = require('../src/lib/customer-auth');
  assert.equal(typeof m.newCustomerToken, 'function');
  assert.equal(typeof m.requireCustomerSession, 'function');
});

test('requireCustomerSession queries customer_sessions join customers', async () => {
  const js = await fs.readFile('src/lib/customer-auth.js', 'utf8');
  assert.match(js, /from\s+customer_sessions\s+s/i);
  assert.match(js, /join\s+customers\s+c\s+on\s+c\.id\s*=\s*s\.customer_id/i);
  assert.match(js, /where\s+s\.token\s*=\s*\$\{/i);
});

