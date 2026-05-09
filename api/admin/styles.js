const { sql } = require('../../src/lib/db');
const { sendJson, readBody } = require('../../src/lib/http');
const { requireSession } = require('../../src/lib/auth');

async function requireAdmin(req, res) {
  const session = await requireSession(req);
  if (!session || session.role !== 'admin') {
    sendJson(res, 401, { ok: false, error: 'unauthorized' });
    return null;
  }
  return session;
}

module.exports = async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const session = await requireAdmin(req, res);
  if (!session) return;

  if (req.method === 'GET') {
    const cate1 = (url.searchParams.get('cate1') || '').trim();
    const cate2 = (url.searchParams.get('cate2') || '').trim();
    const r = await sql`
      select id, code, name, cate1, cate2, size_table_id, img_base64, remark, created_at
      from styles
      where (${cate1} = '' or cate1 = ${cate1})
        and (${cate2} = '' or cate2 = ${cate2})
      order by created_at desc
      limit 500
    `;
    const styles = r.rows.map((x) => ({
      id: x.id,
      code: x.code,
      name: x.name,
      cate1: x.cate1,
      cate2: x.cate2,
      sizeTableId: x.size_table_id,
      imgBase64: x.img_base64 || '',
      remark: x.remark || '',
      createdAt: x.created_at
    }));
    return sendJson(res, 200, { ok: true, styles });
  }

  if (req.method === 'POST') {
    try {
      const raw = await readBody(req);
      const body = raw ? JSON.parse(raw) : {};
      const code = typeof body.code === 'string' ? body.code.trim() : '';
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const cate1 = typeof body.cate1 === 'string' ? body.cate1.trim() : '';
      const cate2 = typeof body.cate2 === 'string' ? body.cate2.trim() : '';
      const sizeTableId = typeof body.sizeTableId === 'string' ? body.sizeTableId.trim() : '';
      const remark = typeof body.remark === 'string' ? body.remark.trim() : '';
      const imgBase64 = typeof body.imgBase64 === 'string' ? body.imgBase64.trim() : '';
      if (!code || !name || !cate1 || !cate2 || !sizeTableId) return sendJson(res, 400, { ok: false, error: 'bad_request' });
      if (imgBase64 && imgBase64.length > 700000) return sendJson(res, 400, { ok: false, error: 'image_too_large' });

      const inserted = await sql`
        insert into styles (code, name, cate1, cate2, size_table_id, img_base64, remark)
        values (${code}, ${name}, ${cate1}, ${cate2}, ${sizeTableId}::uuid, ${imgBase64 || null}, ${remark || null})
        returning id, code, name, cate1, cate2, size_table_id, img_base64, remark, created_at
      `;
      const x = inserted.rows[0];
      return sendJson(res, 200, {
        ok: true,
        style: {
          id: x.id,
          code: x.code,
          name: x.name,
          cate1: x.cate1,
          cate2: x.cate2,
          sizeTableId: x.size_table_id,
          imgBase64: x.img_base64 || '',
          remark: x.remark || '',
          createdAt: x.created_at
        }
      });
    } catch (e) {
      return sendJson(res, 400, { ok: false, error: 'bad_request' });
    }
  }

  if (req.method === 'DELETE') {
    const id = (url.searchParams.get('id') || '').trim();
    if (!id) return sendJson(res, 400, { ok: false, error: 'id_required' });
    await sql`delete from styles where id = ${id}::uuid`;
    return sendJson(res, 200, { ok: true });
  }

  return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
};

