const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');

test('login page exists and contains customer auth UI', async () => {
  const html = await fs.readFile('login.html', 'utf8');
  assert.match(html, /ZENEX-SPORTS/);
  assert.match(html, /customerLoginEmail/);
  assert.match(html, /customerRegisterEmail/);
  assert.match(html, /customerForgotEmail/);
  assert.match(html, /searchParams\.get\('mode'\)/);
  assert.match(html, /['"]reset['"]/);
});
