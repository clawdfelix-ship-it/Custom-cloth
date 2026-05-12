const assert = require('node:assert/strict');

async function j(res) {
  const data = await res.json().catch(() => null);
  return data;
}

function ymd(d) {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

async function postJson(url, body, headers) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(headers || {}) },
    body: JSON.stringify(body || {})
  });
}

async function get(url, headers) {
  return fetch(url, { headers: headers || {} });
}

async function main() {
  const base = String(process.env.BASE_URL || '').replace(/\/$/, '');
  if (!base) throw new Error('BASE_URL required');

  const out = [];
  const step = async (name, fn) => {
    try {
      const r = await fn();
      out.push({ name, ok: true, details: r || '' });
    } catch (e) {
      out.push({ name, ok: false, details: String(e && e.message ? e.message : e) });
    }
  };

  const now = Date.now();
  const email = `qa+${now}@example.com`;
  const pwd = `Qa_${now}_Pwd`;
  const companyName = `QA TEST ${now}`;
  const contactName = 'QA';
  const phone = `9${String(now).slice(-7)}`.slice(0, 8);
  const address = 'QA Address';

  let customerToken = '';
  let orderSn = '';
  let lookupCode = '';

  await step('Customer register', async () => {
    const res = await postJson(`${base}/api/customer?action=register`, { email, password: pwd, companyName, contactName, phone, address });
    const data = await j(res);
    assert.equal(res.status, 200);
    assert.equal(!!data && data.ok, true);
    assert.equal(typeof data.token, 'string');
    customerToken = data.token;
  });

  await step('Customer me', async () => {
    const res = await get(`${base}/api/customer?action=me`, { Authorization: `Bearer ${customerToken}` });
    const data = await j(res);
    assert.equal(res.status, 200);
    assert.equal(!!data && data.ok, true);
    assert.equal(data.customer.email, email);
  });

  let cate1 = '';
  let cate2 = '';
  await step('Public categories', async () => {
    const res = await get(`${base}/api/public/categories`);
    const data = await j(res);
    assert.equal(res.status, 200);
    assert.equal(!!data && data.ok, true);
    assert.equal(Array.isArray(data.cate1), true);
    cate1 = data.cate1.find((x) => typeof x === 'string' && x.trim()) || '';
    const map = data.cate2ByCate1 || {};
    const list = Array.isArray(map[cate1]) ? map[cate1] : [];
    cate2 = list.find((x) => typeof x === 'string' && x.trim() && x !== '球衣') || list[0] || '';
    assert.equal(!!cate1, true);
    assert.equal(!!cate2, true);
  });

  let styleId = '';
  await step('Public styles', async () => {
    const qs = new URLSearchParams();
    qs.set('cate1', cate1);
    qs.set('cate2', cate2);
    const res = await get(`${base}/api/public/styles?${qs.toString()}`);
    const data = await j(res);
    assert.equal(res.status, 200);
    assert.equal(!!data && data.ok, true);
    const styles = Array.isArray(data.styles) ? data.styles : [];
    assert.equal(styles.length > 0, true);
    styleId = styles[0].id;
    assert.equal(!!styleId, true);
  });

  await step('Create order (requires auth)', async () => {
    const reqDate = ymd(new Date(Date.now() + 1000 * 60 * 60 * 24 * 60));
    const res = await postJson(
      `${base}/api/public/orders`,
      {
        mode: 'new',
        cate1,
        cate2,
        cate3: '',
        cate4: '',
        companyName,
        contactName,
        phone,
        address,
        requestedDeliveryDate: reqDate,
        sourceOrderId: null,
        items: [{ styleId, qty: [{ size: 'M', qty: 1 }] }]
      },
      { Authorization: `Bearer ${customerToken}` }
    );
    const data = await j(res);
    assert.equal(res.status, 200);
    assert.equal(!!data && data.ok, true);
    orderSn = data.orderSn;
    lookupCode = data.lookupCode;
    assert.equal(typeof orderSn, 'string');
    assert.equal(typeof lookupCode, 'string');
  });

  await step('Create order without auth should 401', async () => {
    const reqDate = ymd(new Date(Date.now() + 1000 * 60 * 60 * 24 * 60));
    const res = await postJson(`${base}/api/public/orders`, { mode: 'new', cate1, cate2, companyName, phone, address, requestedDeliveryDate: reqDate, items: [{ styleId, qty: [{ size: 'M', qty: 1 }] }] });
    assert.equal(res.status, 401);
  });

  await step('Order history', async () => {
    const res = await get(`${base}/api/public/orders/history`, { Authorization: `Bearer ${customerToken}` });
    const data = await j(res);
    assert.equal(res.status, 200);
    assert.equal(!!data && data.ok, true);
    const orders = Array.isArray(data.orders) ? data.orders : [];
    assert.equal(orders.some((o) => o && o.orderSn === orderSn), true);
  });

  await step('Order status', async () => {
    const qs = new URLSearchParams();
    qs.set('orderSn', orderSn);
    qs.set('lookupCode', lookupCode);
    const res = await get(`${base}/api/public/orders/status?${qs.toString()}`, { Authorization: `Bearer ${customerToken}` });
    const data = await j(res);
    assert.equal(res.status, 200);
    assert.equal(!!data && data.ok, true);
    assert.equal(data.order.orderSn, orderSn);
  });

  await step('Password reset request (may require SMTP env)', async () => {
    const res = await postJson(`${base}/api/customer?action=requestPasswordReset`, { email });
    const data = await j(res);
    assert.equal(!!data, true);
    if (data.ok) return;
    assert.equal(data.error === 'email_not_configured' || data.error === 'base_url_not_configured', true);
  });

  await step('Customer logout', async () => {
    const res = await postJson(`${base}/api/customer?action=logout`, null, { Authorization: `Bearer ${customerToken}` });
    const data = await j(res);
    assert.equal(res.status, 200);
    assert.equal(!!data && data.ok, true);
  });

  const adminAcc = String(process.env.ADMIN_ACC || '');
  const adminPwd = String(process.env.ADMIN_PWD || '');
  let adminToken = '';
  if (adminAcc && adminPwd) {
    await step('Admin login', async () => {
      const res = await postJson(`${base}/api/auth?action=login`, { acc: adminAcc, pwd: adminPwd });
      const data = await j(res);
      assert.equal(res.status, 200);
      assert.equal(!!data && data.ok, true);
      adminToken = data.token;
      assert.equal(typeof adminToken, 'string');
    });

    await step('Admin orders list', async () => {
      const res = await get(`${base}/api/admin?action=orders`, { Authorization: `Bearer ${adminToken}` });
      const data = await j(res);
      assert.equal(res.status, 200);
      assert.equal(!!data && data.ok, true);
      assert.equal(Array.isArray(data.orders), true);
    });

    await step('Admin logout', async () => {
      const res = await postJson(`${base}/api/auth?action=logout`, null, { Authorization: `Bearer ${adminToken}` });
      const data = await j(res);
      assert.equal(res.status, 200);
      assert.equal(!!data && data.ok, true);
    });
  } else {
    out.push({ name: 'Admin tests', ok: false, details: 'ADMIN_ACC/ADMIN_PWD missing' });
  }

  const factoryAcc = String(process.env.FACTORY_ACC || '');
  const factoryPwd = String(process.env.FACTORY_PWD || '');
  let factoryToken = '';
  if (factoryAcc && factoryPwd) {
    await step('Factory login', async () => {
      const res = await postJson(`${base}/api/auth?action=login`, { acc: factoryAcc, pwd: factoryPwd });
      const data = await j(res);
      assert.equal(res.status, 200);
      assert.equal(!!data && data.ok, true);
      factoryToken = data.token;
      assert.equal(typeof factoryToken, 'string');
    });

    await step('Factory orders list', async () => {
      const res = await get(`${base}/api/factory?action=orders`, { Authorization: `Bearer ${factoryToken}` });
      const data = await j(res);
      assert.equal(res.status, 200);
      assert.equal(!!data && data.ok, true);
      assert.equal(Array.isArray(data.orders), true);
    });

    await step('Factory logout', async () => {
      const res = await postJson(`${base}/api/auth?action=logout`, null, { Authorization: `Bearer ${factoryToken}` });
      const data = await j(res);
      assert.equal(res.status, 200);
      assert.equal(!!data && data.ok, true);
    });
  } else {
    out.push({ name: 'Factory tests', ok: false, details: 'FACTORY_ACC/FACTORY_PWD missing' });
  }

  const failed = out.filter((x) => !x.ok);
  const passed = out.filter((x) => x.ok);
  process.stdout.write(
    JSON.stringify(
      {
        base,
        created: { email, companyName, orderSn, lookupCode },
        passed: passed.map((x) => x.name),
        failed
      },
      null,
      2
    ) + '\n'
  );
  if (failed.length) process.exitCode = 1;
}

main().catch((e) => {
  process.stderr.write(String(e && e.stack ? e.stack : e) + '\n');
  process.exitCode = 1;
});

