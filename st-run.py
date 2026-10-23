#!/usr/bin/env python3
import subprocess, pathlib, os

proj = pathlib.Path.home() / ".openclaw/workspace-coding-qwen/Ohya2.0"
dburl = next(l.split("=",1)[1].strip().strip('"') for l in (proj/".vercel/.env.production.local").read_text().splitlines() if l.startswith("DATABASE_URL="))

node = r"""
const { getPool } = require('./utils/getPool');
(async () => {
  const pool = getPool();
  // status distribution of new tree
  const s = await pool.query(`
    SELECT status, count(*)::int n FROM categories
     WHERE slug LIKE 'mzakka-cat-real-%' GROUP BY status`);
  console.log('NEWTREE STATUS', JSON.stringify(s.rows));
  // categories that are actually active + would appear in menu (limit 500 ordered)
  const active = await pool.query(`SELECT count(*)::int n FROM categories WHERE status='active'`);
  console.log('ACTIVE TOTAL (whole table)', JSON.stringify(active.rows));
  await pool.end();
})().catch(e=>{console.error('ERR',e);process.exit(1);});
"""
tmp=proj/"_st.js"; tmp.write_text(node)
env=dict(os.environ); env["DATABASE_URL"]=dburl
r=subprocess.run(["node","_st.js"],cwd=proj,env=env,capture_output=True,text=True)
print(r.stdout); print(r.stderr[-200:])
