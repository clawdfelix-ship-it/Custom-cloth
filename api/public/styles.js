const { sql } = require('../../src/lib/db');
const { sendJson } = require('../../src/lib/http');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });

  const url = new URL(req.url, 'http://localhost');
  const cate1 = (url.searchParams.get('cate1') || '').trim();
  const cate2 = (url.searchParams.get('cate2') || '').trim();

  try {
    const r = await sql`
      select s.id, s.code, s.name, s.cate1, s.cate2, s.size_table_id, s.img_base64, s.remark, st.name as size_table_name
      from styles s
      join size_tables st on st.id = s.size_table_id
      where (${cate1} = '' or s.cate1 = ${cate1})
        and (${cate2} = '' or s.cate2 = ${cate2})
      order by s.created_at desc
      limit 200
    `;

    const styles = r.rows.map((x) => ({
      id: x.id,
      code: x.code,
      name: x.name,
      cate1: x.cate1,
      cate2: x.cate2,
      sizeTableId: x.size_table_id,
      sizeTableName: x.size_table_name,
      imgBase64: x.img_base64 || '',
      remark: x.remark || ''
    }));

    return sendJson(res, 200, { ok: true, styles });
  } catch (e) {
    return sendJson(res, 500, { ok: false, error: 'server_error' });
  }
};

