const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const ROOT = '/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/Ohya2.0';
const dir = path.join(ROOT, 'routes');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));

// 真實 table refs：FROM/JOIN/INTO/UPDATE 後面嘅標識符，排除子查詢括號、別名、函數、保留字
const STOP = new Set(['select','where','group','order','set','values','all','app','return','of','environment','stored','json_array_elements_text','jsonb_array_elements','unnest','generate_series','lateral']);
const refs = new Set();
for (const f of files) {
  const txt = fs.readFileSync(path.join(dir, f), 'utf8');
  for (const m of txt.matchAll(/(?:FROM|JOIN|INTO|UPDATE)\s+([a-z_][a-z0-9_]+)/gi)) {
    const t = m[1].toLowerCase();
    if (!STOP.has(t)) refs.add(t);
  }
}

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const existing = new Set((await pool.query(
    "SELECT tablename FROM pg_tables WHERE schemaname='public'"
  )).rows.map(r => r.tablename));
  const missing = [...refs].filter(t => !existing.has(t)).sort();
  console.log(JSON.stringify(missing, null, 0));
  console.log('count:', missing.length);
  await pool.end();
})();
