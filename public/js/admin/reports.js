(async function () {
  const { $, el, adminApiRequest, createSegmented } = window.AdminCommon;

  const els = {
    start: $('#rp-start'),
    end: $('#rp-end'),
    group: $('#rp-group'),
    groupWrap: $('#rp-group-wrap'),
    rangeSeg: $('#rp-range-seg'),
    refresh: $('#rp-refresh'),
    exportBtn: $('#rp-export'),
    error: $('#rp-error'),
    tabs: document.querySelectorAll('[data-tab]'),
    panels: {
      sales: $('#rp-panel-sales'),
      top: $('#rp-panel-top'),
      customers: $('#rp-panel-customers'),
      inventory: $('#rp-panel-inventory'),
      coupons: $('#rp-panel-coupons'),
      tax: $('#rp-panel-tax'),
    },
    overview: $('#rp-overview'),
    salesChart: $('#rp-sales-chart'),
    salesTbody: $('#rp-sales-tbody'),
    topTbody: $('#rp-top-tbody'),
    customerSummary: $('#rp-customer-summary'),
    newCustTbody: $('#rp-new-cust-tbody'),
    topCustTbody: $('#rp-top-cust-tbody'),
    invLow: $('#rp-inv-low'),
    invSearch: $('#rp-inv-search'),
    invSummary: $('#rp-inv-summary'),
    invTbody: $('#rp-inv-tbody'),
    invPageInfo: $('#rp-inv-page-info'),
    invPrev: $('#rp-inv-prev'),
    invNext: $('#rp-inv-next'),
    couponTbody: $('#rp-coupon-tbody'),
    taxMonth: $('#rp-tax-month'),
    taxYear: $('#rp-tax-year'),
    taxSearch: $('#rp-tax-search'),
    taxExport: $('#rp-tax-export'),
    taxSummary: $('#rp-tax-summary'),
    taxTbody: $('#rp-tax-tbody'),
  };

  const INV_PAGE_SIZE = 50;
  const invState = { page: 1, total: 0 };
  let activeTab = 'sales';

  // ---------- 共用小工具 ----------

  function setError(msg) {
    if (!els.error) return;
    if (!msg) {
      els.error.classList.add('hidden');
      els.error.textContent = '';
      return;
    }
    els.error.classList.remove('hidden');
    els.error.textContent = msg;
  }

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function toYmd(d) {
    const x = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(x.getTime())) return '';
    return `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}`;
  }

  function addDays(d, days) {
    const x = new Date(d);
    x.setDate(x.getDate() + Number(days || 0));
    return x;
  }

  function parseGroupBy(raw) {
    const v = String(raw || '').trim();
    if (v === 'day' || v === 'week' || v === 'month') return v;
    return 'day';
  }

  function getRangeFromInputs() {
    const now = new Date();
    const defaultEnd = toYmd(now);
    const defaultStart = toYmd(addDays(now, -29));

    let start = (els.start && els.start.value) ? String(els.start.value) : '';
    let end = (els.end && els.end.value) ? String(els.end.value) : '';
    if (!start) start = defaultStart;
    if (!end) end = defaultEnd;

    if (start && end) {
      const s = new Date(start);
      const e = new Date(end);
      if (!Number.isNaN(s.getTime()) && !Number.isNaN(e.getTime()) && s.getTime() > e.getTime()) {
        const tmp = start;
        start = end;
        end = tmp;
      }
    }
    if (els.start) els.start.value = start;
    if (els.end) els.end.value = end;
    return { start, end };
  }

  function setRangeLastDays(days) {
    const now = new Date();
    const end = toYmd(now);
    const start = toYmd(addDays(now, -(Number(days) - 1)));
    if (els.start) els.start.value = start;
    if (els.end) els.end.value = end;
  }

  function moneyHKD(n) {
    const x = Number(n);
    if (Number.isNaN(x)) return 'HK$ 0.00';
    return 'HK$ ' + x.toFixed(2);
  }

  function moneyOrDash(n) {
    if (n === null || n === undefined || n === '') return '—';
    const x = Number(n);
    if (Number.isNaN(x)) return '—';
    return 'HK$ ' + x.toFixed(2);
  }

  function numberInt(n) {
    const x = Number(n);
    if (Number.isNaN(x)) return 0;
    return Math.trunc(x);
  }

  function summaryCard(title, value) {
    return el('div', { class: 'border border-gray-200 rounded p-2 bg-white' }, [
      el('div', { class: 'text-xs text-gray-500', text: title }),
      el('div', { class: 'font-black tabular-nums', text: value }),
    ]);
  }

  function tdNum(value) {
    return el('td', { class: 'text-right tabular-nums', text: value });
  }

  // ---------- 分頁切換 ----------

  function setActiveTabStyles(name) {
    els.tabs.forEach((btn) => {
      const on = btn.getAttribute('data-tab') === name;
      btn.classList.toggle('border-black', on);
      btn.classList.toggle('font-bold', on);
      btn.classList.toggle('border-transparent', !on);
      btn.classList.toggle('text-gray-600', !on);
    });
  }

  function showPanel(name) {
    for (const [key, panel] of Object.entries(els.panels)) {
      if (!panel) continue;
      panel.classList.toggle('hidden', key !== name);
    }
  }

  async function switchTab(name) {
    if (!els.panels[name]) return;
    activeTab = name;
    setActiveTabStyles(name);
    showPanel(name);
    if (els.groupWrap) els.groupWrap.classList.toggle('hidden', name !== 'sales');
    await loadActiveTab();
  }

  async function loadActiveTab() {
    setError('');
    try {
      if (activeTab === 'sales') await loadSales();
      else if (activeTab === 'top') await loadTopProducts();
      else if (activeTab === 'customers') await loadCustomers();
      else if (activeTab === 'inventory') await loadInventory();
      else if (activeTab === 'coupons') await loadCoupons();
      else if (activeTab === 'tax') await loadTax();
    } catch (e) {
      setError(e && e.message ? e.message : String(e));
    }
  }

  // ---------- 銷售 ----------

  function renderOverview(data) {
    if (!els.overview) return;
    els.overview.textContent = '';
    const d = data || {};
    const items = [
      { title: '今日訂單', value: String(numberInt(d.today && d.today.orders)) },
      { title: '今日銷售額', value: moneyHKD(d.today && d.today.sales) },
      { title: '昨日訂單', value: String(numberInt(d.yesterday && d.yesterday.orders)) },
      { title: '昨日銷售額', value: moneyHKD(d.yesterday && d.yesterday.sales) },
      { title: '7日訂單', value: String(numberInt(d.seven_days && d.seven_days.orders)) },
      { title: '7日銷售額', value: moneyHKD(d.seven_days && d.seven_days.sales) },
      { title: '客戶數', value: String(numberInt(d.total && d.total.customers)) },
      { title: '活躍商品', value: String(numberInt(d.total && d.total.active_products)) },
    ];
    for (const it of items) els.overview.appendChild(summaryCard(it.title, it.value));
  }

  function renderSalesTable(rows) {
    if (!els.salesTbody) return;
    els.salesTbody.textContent = '';
    for (const r of rows || []) {
      els.salesTbody.appendChild(el('tr', {}, [
        el('td', { text: r.date_group !== undefined ? String(r.date_group) : '' }),
        tdNum(r.order_count !== undefined ? String(r.order_count) : ''),
        tdNum(moneyHKD(r.total_sales)),
        tdNum(r.customer_count !== undefined ? String(r.customer_count) : ''),
        tdNum(moneyHKD(r.avg_order_value)),
      ]));
    }
  }

  function renderSalesChart(rows) {
    if (!els.salesChart) return;
    els.salesChart.textContent = '';
    const points = (rows || [])
      .map((r) => ({ x: String(r.date_group ?? ''), y: Number(r.total_sales) }))
      .filter((p) => p.x && !Number.isNaN(p.y));
    if (points.length < 2) return;

    const width = 720;
    const height = 180;
    const pad = 12;
    const ys = points.map((p) => p.y);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const span = Math.max(1e-9, maxY - minY);

    const coords = points
      .slice()
      .reverse()
      .map((p, idx, arr) => {
        const x = pad + (idx * (width - pad * 2)) / Math.max(1, arr.length - 1);
        const y = pad + ((maxY - p.y) * (height - pad * 2)) / span;
        return { x, y };
      });

    const poly = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
    const svgNS = 'http://www.w3.org/2000/svg';
    function svgEl(tag, attrs = {}, children = []) {
      const node = document.createElementNS(svgNS, tag);
      for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
      for (const c of children) {
        if (c === null || c === undefined) continue;
        node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      }
      return node;
    }

    const svg = svgEl('svg', { width: String(width), height: String(height), viewBox: `0 0 ${width} ${height}` }, [
      svgEl('rect', { x: '0', y: '0', width: String(width), height: String(height), fill: '#fff' }),
      svgEl('polyline', { fill: 'none', stroke: '#111', 'stroke-width': '2', points: poly }),
      svgEl('circle', { cx: String(coords[0].x), cy: String(coords[0].y), r: '3', fill: '#111' }),
      svgEl('circle', { cx: String(coords[coords.length - 1].x), cy: String(coords[coords.length - 1].y), r: '3', fill: '#111' }),
    ]);
    els.salesChart.appendChild(svg);
  }

  async function loadSales() {
    const { start, end } = getRangeFromInputs();
    const groupBy = parseGroupBy(els.group ? els.group.value : 'day');
    if (els.group) els.group.value = groupBy;

    const salesParams = new URLSearchParams({ start_date: start, end_date: end, group_by: groupBy });
    const results = await Promise.allSettled([
      adminApiRequest('/api/admin/dashboard/overview'),
      adminApiRequest('/api/admin/reports/sales-by-date?' + salesParams.toString()),
    ]);

    const [overview, sales] = results;
    if (overview.status === 'fulfilled') {
      renderOverview(overview.value);
    } else {
      setError(overview.reason && overview.reason.message ? overview.reason.message : String(overview.reason));
    }
    if (sales.status === 'fulfilled') {
      const rows = (sales.value && sales.value.data) ? sales.value.data : [];
      renderSalesChart(rows);
      renderSalesTable(rows);
    } else {
      setError(sales.reason && sales.reason.message ? sales.reason.message : String(sales.reason));
    }
  }

  // ---------- 熱賣商品 ----------

  function renderTopProducts(rows) {
    if (!els.topTbody) return;
    els.topTbody.textContent = '';
    for (const r of rows || []) {
      const name = r.name ? String(r.name) : (r.id ? `#${r.id}` : '');
      els.topTbody.appendChild(el('tr', {}, [
        el('td', { text: name }),
        tdNum(r.total_quantity !== undefined ? String(r.total_quantity) : ''),
        tdNum(moneyHKD(r.total_revenue)),
      ]));
    }
  }

  async function loadTopProducts() {
    const { start, end } = getRangeFromInputs();
    const params = new URLSearchParams({ start_date: start, end_date: end, limit: '20' });
    const data = await adminApiRequest('/api/admin/reports/top-products?' + params.toString());
    renderTopProducts(data.products || []);
  }

  // ---------- 客戶 ----------

  function renderCustomerSummary(s) {
    if (!els.customerSummary) return;
    els.customerSummary.textContent = '';
    els.customerSummary.appendChild(summaryCard('客戶總數', String(numberInt(s && s.total_customers))));
    els.customerSummary.appendChild(summaryCard('30 日內活躍', String(numberInt(s && s.active_30d))));
  }

  function renderNewCustomers(rows) {
    if (!els.newCustTbody) return;
    els.newCustTbody.textContent = '';
    for (const r of rows || []) {
      els.newCustTbody.appendChild(el('tr', {}, [
        el('td', { text: r.day !== undefined ? String(r.day) : '' }),
        tdNum(r.count !== undefined ? String(r.count) : ''),
      ]));
    }
  }

  function renderTopCustomers(rows) {
    if (!els.topCustTbody) return;
    els.topCustTbody.textContent = '';
    for (const r of rows || []) {
      els.topCustTbody.appendChild(el('tr', {}, [
        el('td', { text: r.username || (r.id ? '#' + r.id : '') }),
        el('td', { text: r.email || '—' }),
        el('td', { text: r.phone || '—' }),
        tdNum(r.order_count !== undefined ? String(r.order_count) : '0'),
        tdNum(moneyHKD(r.total_spent)),
      ]));
    }
  }

  async function loadCustomers() {
    const { start, end } = getRangeFromInputs();
    const params = new URLSearchParams({ start_date: start, end_date: end });
    const data = await adminApiRequest('/api/admin/reports/customers?' + params.toString());
    renderCustomerSummary(data.summary);
    renderNewCustomers(data.new_customers_by_day || []);
    renderTopCustomers(data.top_customers || []);
  }

  // ---------- 庫存 ----------

  function renderInventorySummary(totalValue, rowCount) {
    if (!els.invSummary) return;
    els.invSummary.textContent = '';
    els.invSummary.appendChild(summaryCard('本頁商品數', String(numberInt(rowCount))));
    els.invSummary.appendChild(summaryCard('庫存總成本（全部商品）', moneyHKD(totalValue)));
  }

  function renderInventory(rows) {
    if (!els.invTbody) return;
    els.invTbody.textContent = '';
    for (const r of rows || []) {
      els.invTbody.appendChild(el('tr', {}, [
        el('td', { text: r.name || (r.id ? '#' + r.id : '') }),
        tdNum(moneyOrDash(r.price)),
        tdNum(moneyOrDash(r.cost_price)),
        tdNum(r.total_stock !== undefined ? String(r.total_stock) : '0'),
        tdNum(moneyOrDash(r.total_cost)),
      ]));
    }
  }

  function renderInventoryPagination() {
    if (els.invPageInfo) {
      els.invPageInfo.textContent = `第 ${invState.page} 頁，共 ${invState.total} 個商品`;
    }
    if (els.invPrev) els.invPrev.disabled = invState.page <= 1;
    if (els.invNext) els.invNext.disabled = invState.page * INV_PAGE_SIZE >= invState.total;
  }

  async function loadInventory() {
    const params = new URLSearchParams({
      page: String(invState.page),
      page_size: String(INV_PAGE_SIZE),
      low_stock_only: els.invLow && els.invLow.checked ? 'true' : 'false',
    });
    const data = await adminApiRequest('/api/admin/reports/inventory?' + params.toString());
    invState.total = numberInt(data.pagination && data.pagination.total);
    invState.page = numberInt(data.pagination && data.pagination.page) || invState.page;
    const rows = data.products || [];
    renderInventory(rows);
    renderInventorySummary(data.total_inventory_value, rows.length);
    renderInventoryPagination();
  }

  // ---------- 優惠券 ----------

  function couponTypeLabel(t) {
    if (t === 'percent') return '百分比折扣';
    if (t === 'fixed') return '固定金額';
    return String(t || '');
  }

  function couponValue(r) {
    const x = Number(r.value);
    if (Number.isNaN(x)) return '—';
    if (r.type === 'percent') return x.toFixed(2) + '%';
    return 'HK$ ' + x.toFixed(2);
  }

  function renderCoupons(rows) {
    if (!els.couponTbody) return;
    els.couponTbody.textContent = '';
    for (const r of rows || []) {
      els.couponTbody.appendChild(el('tr', {}, [
        el('td', { text: r.code || '' }),
        el('td', { text: couponTypeLabel(r.type) }),
        tdNum(couponValue(r)),
        tdNum(r.used_count !== undefined ? String(r.used_count) : '0'),
        tdNum(moneyHKD(r.total_order_value)),
      ]));
    }
  }

  async function loadCoupons() {
    const data = await adminApiRequest('/api/admin/reports/coupons');
    renderCoupons(data.coupons || []);
  }

  // ---------- 稅務 ----------

  function getTaxParams() {
    const month = els.taxMonth ? String(els.taxMonth.value || '').trim() : '';
    const year = els.taxYear ? String(els.taxYear.value || '').trim() : '';
    const params = new URLSearchParams();
    if (month) params.set('month', month);
    if (year) params.set('year', year);
    return { month, year, params };
  }

  function renderTaxSummary(s) {
    if (!els.taxSummary) return;
    els.taxSummary.textContent = '';
    const items = [
      { title: '訂單總數', value: String(numberInt(s && s.total_orders)) },
      { title: '商品金額', value: moneyHKD(s && s.subtotal) },
      { title: '運費', value: moneyHKD(s && s.shipping) },
      { title: '總額', value: moneyHKD(s && s.total) },
    ];
    for (const it of items) els.taxSummary.appendChild(summaryCard(it.title, it.value));
  }

  function renderTax(rows) {
    if (!els.taxTbody) return;
    els.taxTbody.textContent = '';
    for (const r of rows || []) {
      els.taxTbody.appendChild(el('tr', {}, [
        el('td', { text: r.date !== undefined ? String(r.date) : '' }),
        tdNum(r.order_count !== undefined ? String(r.order_count) : ''),
        tdNum(moneyHKD(r.subtotal)),
        tdNum(moneyHKD(r.shipping)),
        tdNum(moneyHKD(r.total)),
        tdNum(r.customers !== undefined ? String(r.customers) : ''),
      ]));
    }
  }

  async function loadTax() {
    const { month, year, params } = getTaxParams();
    if (!month && !year) {
      setError('請輸入月份或年份');
      if (els.taxTbody) els.taxTbody.textContent = '';
      return;
    }
    const data = await adminApiRequest('/api/admin/reports/tax?' + params.toString());
    renderTax(data.by_date || []);
    renderTaxSummary(data.summary);
  }

  function exportTaxCsv() {
    const { month, year, params } = getTaxParams();
    if (!month && !year) {
      setError('請先輸入月份或年份');
      return;
    }
    window.location.href = '/api/admin/reports/tax/export/csv?' + params.toString();
  }

  // ---------- 訂單 CSV ----------

  function exportOrdersCsv() {
    const { start, end } = getRangeFromInputs();
    const params = new URLSearchParams({ start_date: start, end_date: end });
    window.location.href = '/api/admin/reports/export-orders/csv?' + params.toString();
  }

  // ---------- 事件 ----------

  els.tabs.forEach((btn) => {
    btn.addEventListener('click', () => {
      const name = btn.getAttribute('data-tab');
      switchTab(name).catch((e) => setError(e.message));
    });
  });

  if (els.rangeSeg) {
    const seg = createSegmented([
      { value: '7', text: '最近 7 日' },
      { value: '30', text: '最近 30 日' },
      { value: '90', text: '最近 90 日' },
    ], '30', (v) => { setRangeLastDays(Number(v)); loadActiveTab(); });
    els.rangeSeg.appendChild(seg.root);
    setRangeLastDays(30); // 預設 30 日
  }
  if (els.refresh) els.refresh.addEventListener('click', () => loadActiveTab());
  if (els.exportBtn) els.exportBtn.addEventListener('click', () => exportOrdersCsv());

  if (els.invSearch) els.invSearch.addEventListener('click', () => { invState.page = 1; loadActiveTab(); });
  if (els.invLow) els.invLow.addEventListener('change', () => { invState.page = 1; loadActiveTab(); });
  if (els.invPrev) els.invPrev.addEventListener('click', () => { if (invState.page > 1) { invState.page--; loadActiveTab(); } });
  if (els.invNext) els.invNext.addEventListener('click', () => { if (invState.page * INV_PAGE_SIZE < invState.total) { invState.page++; loadActiveTab(); } });

  if (els.taxSearch) els.taxSearch.addEventListener('click', () => loadActiveTab());
  if (els.taxExport) els.taxExport.addEventListener('click', () => exportTaxCsv());

  // ---------- 初始 ----------

  try {
    setRangeLastDays(30);
    if (els.taxMonth) {
      const now = new Date();
      els.taxMonth.value = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
    }
    await switchTab('sales');
  } catch (e) {
    setError(e && e.message ? e.message : String(e));
  }
})();
