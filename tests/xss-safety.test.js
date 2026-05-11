const test = require('node:test');
const assert = require('node:assert/strict');

test('admin and client html include escapeHtml helper', async () => {
  const fs = require('node:fs/promises');
  const admin = await fs.readFile('admin.html', 'utf8');
  const index = await fs.readFile('index.html', 'utf8');
  assert.match(admin, /function\s+escapeHtml\s*\(/);
  assert.match(index, /function\s+escapeHtml\s*\(/);
});

