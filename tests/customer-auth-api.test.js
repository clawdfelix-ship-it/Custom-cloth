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

test('email lib exports sendMail', () => {
  const m = require('../src/lib/email');
  assert.equal(typeof m.sendMail, 'function');
});

test('sendMail returns email_not_configured when SMTP env missing', async () => {
  const { sendMail } = require('../src/lib/email');
  const keys = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'];
  const oldValues = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  for (const k of keys) delete process.env[k];

  const r = await sendMail({ to: 'a@b.com', subject: 'x', text: 'y' });

  for (const k of keys) {
    const v = oldValues[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  assert.deepEqual(r, { ok: false, error: 'email_not_configured' });
});

test('customer api entrypoint exists', () => {
  const handler = require('../api/customer');
  assert.equal(typeof handler, 'function');
});

test('customer api supports expected actions', async () => {
  const js = await fs.readFile('api/customer.js', 'utf8');
  assert.match(js, /action\s*===\s*['"]register['"]/);
  assert.match(js, /action\s*===\s*['"]login['"]/);
  assert.match(js, /action\s*===\s*['"]logout['"]/);
  assert.match(js, /action\s*===\s*['"]me['"]/);
  assert.match(js, /action\s*===\s*['"]requestPasswordReset['"]/);
  assert.match(js, /action\s*===\s*['"]resetPassword['"]/);
});
