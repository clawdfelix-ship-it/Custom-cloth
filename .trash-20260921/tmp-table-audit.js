const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const ROOT = '/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/Ohya2.0';
const files = ['routes/admin.js','routes/admin-settings.js','routes/logistics.js','routes/products-full.js',
  'routes/reports.js','routes/refunds.js','routes/reconciliation.js','routes/brands.js','routes/marketing.js',
  'routes/shipping.js','routes/members.js','routes/mzakka-sync.js'];

// crude: find FROM/JOIN/INTO/UPDATE table names
const refs = new Set();
for (const f of files) {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) continue;
  const txt = fs.readFileSync(p, 'utf8');
  for (const m of txt.matchAll(/(?:FROM|JOIN|INTO|UPDATE)\s+([a-z_][a-z0-9_]+)/gi)) {
    const t = m[1].toLowerCase();
    if (!['select','where','group','order','set','values'].includes(t)) refs.add(t);
  }
}

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const existing = new Set((await pool.query(
    "SELECT tablename FROM pg_tables WHERE schemaname='public'"
  )).rows.map(r => r.tablename));

  const missing = [...refs].filter(t => !existing.has(t)).sort();
  console.log('referenced tables:', refs.size, '| existing:', existing.size);
  console.log('\n❌ MISSING TABLES (' + missing.length + '):');
  missing.forEach(t => console.log('  ' + t));
  await pool.end();
})();
