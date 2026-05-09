const fs = require('node:fs/promises');
const path = require('node:path');
const { sql } = require('./db');

let ensured = false;

async function ensureMigrations() {
  if (ensured) return;

  await sql`select pg_advisory_lock(94091234)`;
  try {
    await sql`create table if not exists schema_migrations (id text primary key, applied_at timestamptz not null default now())`;
    const applied = await sql`select id from schema_migrations`;
    const appliedSet = new Set(applied.rows.map((r) => r.id));

    const dir = path.join(process.cwd(), 'db', 'migrations');
    const entries = (await fs.readdir(dir)).filter((f) => f.endsWith('.sql')).sort();

    for (const file of entries) {
      if (appliedSet.has(file)) continue;
      const sqlText = await fs.readFile(path.join(dir, file), 'utf8');
      if (sqlText.trim()) {
        await sql.query(sqlText);
      }
      await sql`insert into schema_migrations (id) values (${file}) on conflict (id) do nothing`;
    }

    ensured = true;
  } finally {
    await sql`select pg_advisory_unlock(94091234)`;
  }
}

module.exports = { ensureMigrations };

