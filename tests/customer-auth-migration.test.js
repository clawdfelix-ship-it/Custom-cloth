const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');

test('schema.sql contains customer auth columns and tables', async () => {
  const raw = await fs.readFile('db/schema.sql', 'utf8');
  assert.match(raw, /create table if not exists customers/i);
  assert.match(raw, /email text/i);
  assert.match(raw, /pwd_hash text/i);
  assert.match(raw, /address text/i);
  assert.match(raw, /is_registered boolean/i);
  assert.match(raw, /create table if not exists customer_sessions/i);
  assert.match(raw, /create table if not exists customer_password_resets/i);
});
