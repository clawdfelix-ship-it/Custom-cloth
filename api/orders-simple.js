const { sql } = require('../src/lib/db');
const { sendJson } = require('../src/lib/http');
const { requireAdmin } = require('../src/lib/auth');
const { requiredYmd } = require('../src/lib/validation');

module.exports = async function(req, res, url) {
  const session = await requireAdmin(req, res);
  if (!session) return;
  if (req.method !== 'GET') return sendJson(res, 405, { ok: false });

  const orderSn = (url.searchParams.get('orderSn') || '').trim();
  const companyName = (url.searchParams.get('companyName') || '').trim();
  const phone = (url.searchParams.get('phone') || '').trim();
  const status = (url.searchParams.get('status') || '').trim();
  const createdFrom = (url.searchParams.get('createdFrom') || '').trim();
  const createdTo = (url.searchParams.get('createdTo') || '').trim();

  if (createdFrom || createdTo) {
    try {
      if (createdFrom) requiredYmd(createdFrom, 'createdFrom');
      if (createdTo) requiredYmd(createdTo, 'createdTo');
    } catch (e) {
      return sendJson(res, 400, { ok: false, error: 'bad_request' });
    }
  }

  // Simple query - no date filter if empty
  let r;
  if (!createdFrom && !createdTo && !orderSn && !companyName && !phone && !status) {
    // No filters - return all recent orders
    r = await sql`select id, order_sn, create_time, cust_name, cust_phone, status from orders order by create_time desc limit 50`;
  } else {
    // With filters - build dynamically
    const conditions = [];
    const values = [];
    if (orderSn) { conditions.push('order_sn = $' + (values.length+1)); values.push(orderSn); }
    if (companyName) { conditions.push('cust_name ilike $' + (values.length+1)); values.push('%'+companyName+'%'); }
    if (phone) { conditions.push('cust_phone = $' + (values.length+1)); values.push(phone); }
    if (status) { conditions.push('status = $' + (values.length+1)); values.push(status); }
    if (createdFrom) { conditions.push('create_time >= $' + (values.length+1)); values.push(createdFrom); }
    if (createdTo) { conditions.push('create_time < $' + (values.length+1) + '::date + interval \'1 day\''); values.push(createdTo); }
    const where = conditions.join(' and ');
    const q = 'select id, order_sn, create_time, cust_name, cust_phone, status from orders where ' + where + ' order by create_time desc limit 50';
    r = await sql.query(q, values);
  }

  const orders = r.rows.map(x => ({
    id: x.id, orderSn: x.order_sn, createdAt: x.create_time,
    companyName: x.cust_name, phone: x.cust_phone, status: x.status
  }));
  return sendJson(res, 200, { ok: true, orders });
};
