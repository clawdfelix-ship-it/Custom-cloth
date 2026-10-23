
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
