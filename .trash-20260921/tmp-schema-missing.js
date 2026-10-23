const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const ROOT = '/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/Ohya2.0';

// 真實 schema 定義：合併所有 schema*.sql 嘅 CREATE TABLE IF NOT EXISTS
const schemaFiles = fs.readdirSync(ROOT).filter(f => /^schema.*\.sql$/.test(f));
const defined = new Set();
for (const f of schemaFiles) {
  const txt = fs.readFileSync(path.join(ROOT, f), 'utf8');
  for (const m of txt.matchAll(/CREATE TABLE IF NOT EXISTS\s+([a-z_][a-z0-9_]+)/gi)) {
    defined.add(m[1].toLowerCase());
  }
}

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const existing = new Set((await pool.query(
    "SELECT tablename FROM pg_tables WHERE schemaname='public'"
  )).rows.map(r => r.tablename));

  const missing = [...defined].filter(t => !existing.has(t)).sort();
  console.log('schema files:', schemaFiles.join(', '));
  console.log('defined in schema:', defined.size, '| existing in prod:', existing.size);
  console.log('\nMISSING (' + missing.length + '):');
  missing.forEach(t => console.log('  ' + t));
  await pool.end();
})();
