const test = require('node:test');
const assert = require('node:assert/strict');

test('schema.sql contains required tables', async () => {
  const fs = require('node:fs/promises');
  const sql = await fs.readFile('db/schema.sql', 'utf8');
  for (const t of ['users', 'sessions', 'size_tables', 'styles', 'customers', 'orders', 'order_items', 'feedback']) {
    assert.match(sql, new RegExp(`create table if not exists\\s+${t}\\b`, 'i'));
  }
});

