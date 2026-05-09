const { sql } = require('@vercel/postgres');
const { toCsv } = require('../../src/lib/csv');
const { getBearerToken } = require('../../src/lib/auth');

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function unauthorized(res) {
  return sendJson(res, 401, { ok: false, error: 'unauthorized' });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });

  const token = getBearerToken(req.headers.authorization);
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) return unauthorized(res);

  const url = new URL(req.url, 'http://localhost');
  const phone = (url.searchParams.get('phone') || '').trim();
  const company = (url.searchParams.get('company') || '').trim();
  const orderType = (url.searchParams.get('orderType') || '').trim();
  const status = (url.searchParams.get('status') || '').trim();
  const from = (url.searchParams.get('from') || '').trim();
  const to = (url.searchParams.get('to') || '').trim();
  const format = (url.searchParams.get('format') || '').trim();

  try {
    const result = await sql`
      select id, created_at, order_type, status, company_name, contact_name, phone, address, style_name,
        requested_delivery_date, suggested_delivery_date, source_order_id
      from orders
      where
        (${phone} = '' or phone = ${phone})
        and (${company} = '' or company_name ilike ${'%' + company + '%'})
        and (${orderType} = '' or order_type = ${orderType})
        and (${status} = '' or status = ${status})
        and (${from} = '' or created_at >= ${from}::date)
        and (${to} = '' or created_at < (${to}::date + interval '1 day'))
      order by created_at desc
      limit 500
    `;

    const orders = result.rows.map((r) => ({
      id: r.id,
      createdAt: r.created_at,
      orderType: r.order_type,
      status: r.status,
      companyName: r.company_name,
      contactName: r.contact_name,
      phone: r.phone,
      address: r.address,
      styleName: r.style_name,
      requestedDeliveryDate: String(r.requested_delivery_date),
      suggestedDeliveryDate: String(r.suggested_delivery_date),
      sourceOrderId: r.source_order_id
    }));

    if (format === 'csv') {
      const csv = toCsv(orders, [
        { key: 'createdAt', header: 'createdAt' },
        { key: 'orderType', header: 'orderType' },
        { key: 'status', header: 'status' },
        { key: 'companyName', header: 'companyName' },
        { key: 'contactName', header: 'contactName' },
        { key: 'phone', header: 'phone' },
        { key: 'address', header: 'address' },
        { key: 'styleName', header: 'styleName' },
        { key: 'suggestedDeliveryDate', header: 'suggestedDeliveryDate' },
        { key: 'requestedDeliveryDate', header: 'requestedDeliveryDate' },
        { key: 'sourceOrderId', header: 'sourceOrderId' }
      ]);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="orders.csv"');
      return res.end(csv);
    }

    return sendJson(res, 200, { ok: true, orders });
  } catch (e) {
    return sendJson(res, 500, { ok: false, error: 'server_error' });
  }
};

