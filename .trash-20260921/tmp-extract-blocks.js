const fs = require('fs');
const path = require('path');

const ROOT = '/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/Ohya2.0';
const WANTED = ["abandoned_carts","admin_operation_logs","affiliate_conversions","affiliates","blog_posts",
"coupon_usages","coupons","flash_sale_products","flash_sales","member_levels","points_transactions",
"product_reviews","product_tag_assignments","product_tags","purchase_order_items","purchase_orders",
"related_products","suppliers","user_addresses","user_tag_assignments","user_tags"];

// parse a schema file into CREATE TABLE blocks keyed by name
function parseBlocks(file) {
  const txt = fs.readFileSync(file, 'utf8');
  const blocks = new Map();
  const re = /CREATE TABLE IF NOT EXISTS\s+([a-z_][a-z0-9_]+)\s*\(/gi;
  let m;
  while ((m = re.exec(txt))) {
    const name = m[1].toLowerCase();
    // find matching closing paren at column 0 (assume block ends with \n);
    const start = m.index;
    // naive: find ");" that closes block
    let depth = 0, i = txt.indexOf('(', start), end = -1;
    for (; i < txt.length; i++) {
      if (txt[i] === '(') depth++;
      else if (txt[i] === ')') { depth--; if (depth === 0) { end = i + 1; break; } }
    }
    // include trailing semicolon
    let j = end;
    while (j < txt.length && /\s/.test(txt[j])) j++;
    if (txt[j] === ';') j++;
    blocks.set(name, txt.slice(start, j));
  }
  return blocks;
}

const sqlBlocks = parseBlocks(path.join(ROOT, 'schema.sql'));
const fullBlocks = parseBlocks(path.join(ROOT, 'schema-full.sql'));

const chosen = new Map();
for (const t of WANTED) {
  const b = sqlBlocks.get(t) || fullBlocks.get(t);
  if (!b) { console.error('!! definition not found for', t); process.exit(1); }
  chosen.set(t, b);
}

// topo sort by intra-migration FK deps
const ordered = [];
const placed = new Set();
function place(t, stack = new Set()) {
  if (placed.has(t)) return;
  if (stack.has(t)) { console.error('FK cycle at', t); process.exit(1); }
  stack.add(t);
  const b = chosen.get(t);
  const deps = [...new Set([...b.matchAll(/REFERENCES\s+([a-z_][a-z0-9_]+)/gi)].map(x => x[1].toLowerCase()))]
    .filter(r => chosen.has(r));
  for (const d of deps) place(d, stack);
  placed.add(t); ordered.push(t);
}
for (const t of WANTED) place(t);

const header = `-- Migration: 補齊 admin 後台缺失表（方案 1）
-- Date: 2026-09-21
-- 原因：live Neon 一直用精簡 schema，以下 ${ordered.length} 個表代碼已引用但從未建立，
--       令供應商/採購單/優惠券/會員積分/評論等 admin 頁 500。
-- 安全：全部 CREATE TABLE IF NOT EXISTS，只建缺失表，唔掂現有數據。
BEGIN;

`;
const body = ordered.map(t => chosen.get(t).trimEnd()).join('\n\n');
const footer = '\n\nCOMMIT;\n';
const outPath = path.join(ROOT, 'migrations/2026-09-21-admin-missing-tables.sql');
fs.writeFileSync(outPath, header + body + footer);
console.log('\nWROTE', outPath);
console.log('order:', ordered.join(' \u2192 '));

// scan foreign-key references
for (const [t, b] of chosen) {
  const refs = [...b.matchAll(/REFERENCES\s+([a-z_][a-z0-9_]+)/gi)].map(x => x[1].toLowerCase());
  const uniq = [...new Set(refs)];
  const missing = uniq.filter(r => !chosen.has(r));
  console.log(t.padEnd(28), uniq.length ? ('→ ' + uniq.join(', ') + (missing.length ? '   ⚠ EXTERNAL: ' + missing.join(',') : '')) : '(no FK)');
}
