const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');

test('public createOrder/history require customer session', async () => {
  const js = await fs.readFile('api/public.js', 'utf8');
  assert.match(js, /requireCustomerSession/);
  assert.match(js, /await requireCustomerSession/);
  assert.doesNotMatch(js, /insert into customers/);
  assert.match(js, /where o\.customer_id/);
});

