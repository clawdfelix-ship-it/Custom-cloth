const test = require('node:test');
const assert = require('node:assert/strict');

test('migration adds cate3/cate4 to styles and orders', async () => {
  const fs = require('node:fs/promises');
  const sql = await fs.readFile('db/migrations/202605111200_styles_orders_cate3_cate4.sql', 'utf8');
  assert.match(sql, /alter table styles add column if not exists cate3/i);
  assert.match(sql, /alter table styles add column if not exists cate4/i);
  assert.match(sql, /alter table orders add column if not exists cate3/i);
  assert.match(sql, /alter table orders add column if not exists cate4/i);
});

test('public jersey category constants exist', async () => {
  const fs = require('node:fs/promises');
  const js = await fs.readFile('api/public.js', 'utf8');
  assert.match(js, /const JERSEY_CATE2\s*=\s*['"]球衣['"]/);
  assert.match(js, /const JERSEY_CATE3\s*=\s*\[/);
  assert.match(js, /const JERSEY_CATE4\s*=\s*\[/);
});

test('public styles requires cate3/cate4 for jersey', async () => {
  const fs = require('node:fs/promises');
  const js = await fs.readFile('api/public.js', 'utf8');
  assert.match(js, /if\s*\(\s*cate2\s*===\s*JERSEY_CATE2\s*\)/);
  assert.match(js, /requiredJerseyEnum\([^)]*cate3/i);
  assert.match(js, /requiredJerseyEnum\([^)]*cate4/i);
});

test('public createOrder persists cate3/cate4', async () => {
  const fs = require('node:fs/promises');
  const js = await fs.readFile('api/public.js', 'utf8');
  assert.match(js, /insert into orders[\s\S]*cate3[\s\S]*cate4/i);
});
