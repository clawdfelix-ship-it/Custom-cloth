const { sql } = require('@vercel/postgres');

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });

  const url = new URL(req.url, 'http://localhost');
  const phone = (url.searchParams.get('phone') || '').trim();
  if (!phone) return sendJson(res, 400, { ok: false, error: 'phone_required' });

  try {
    const result = await sql`
      select id, created_at, order_type, style_name, size_chart, size_ratio, requested_delivery_date, suggested_delivery_date
      from orders
      where phone = ${phone}
      order by created_at desc
      limit 50
    `;

    const orders = result.rows.map((r) => ({
      id: r.id,
      createdAt: r.created_at,
      orderType: r.order_type,
      styleName: r.style_name,
      sizeChart: r.size_chart || '',
      sizeRatio: r.size_ratio || [],
      requestedDeliveryDate: String(r.requested_delivery_date),
      suggestedDeliveryDate: String(r.suggested_delivery_date)
    }));

    return sendJson(res, 200, { ok: true, orders });
  } catch (e) {
    return sendJson(res, 500, { ok: false, error: 'server_error' });
  }
};

