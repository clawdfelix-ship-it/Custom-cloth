const test = require('node:test');
const assert = require('node:assert/strict');

test('migration adds customer provided order item fields', async () => {
  const fs = require('node:fs/promises');
  const txt = await fs.readFile('db/migrations/202605111000_customer_provided_item.sql', 'utf8');
  assert.match(txt, /alter table order_items add column if not exists custom_text/i);
  assert.match(txt, /alter table order_items add column if not exists custom_attachments/i);
});

