(async function () {
  const { $, el, adminEscapeHtml: esc, adminApiGet } = window.AdminCommon;

  // 訂單狀態 → 顯示名 / 分段顏色 / badge class
  const STATUS_META = {
    pending:   { label: '待付款', color: 'var(--ad-warning-solid)', badge: 'badge-pending' },
    paid:      { label: '已付款', color: 'var(--ad-info)',         badge: 'badge-paid' },
    shipping:  { label: '派送中', color: 'var(--ad-purple)',       badge: 'badge-shipping' },
    completed: { label: '已完成', color: 'var(--ad-primary)',      badge: 'badge-completed' },
    cancelled: { label: '已取消', color: '#b7bcc4',               badge: 'badge-cancelled' },
  };
  // 分段條顯示順序（已完成 → 派送 → 已付 → 待付 → 取消）
  const STATUS_ORDER = ['completed', 'shipping', 'paid', 'pending', 'cancelled'];
  const FALLBACK_COLORS = ['#9ca3af', '#9ca3af'];

  const num = (n) => Number.isFinite(Number(n)) ? Number(n) : 0;
  const intFmt = (n) => num(n).toLocaleString('zh-HK');
  const money = (n) => 'HK$ ' + num(n).toLocaleString('zh-HK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function setText(sel, value) {
    const node = $(sel);
    if (node) node.textContent = value;
  }

  function fmtTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    const pad = (x) => String(x).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function showError(message) {
    const box = $('#dashboard-error');
    if (!box) return;
    if (!message) {
      box.classList.add('hidden');
      box.textContent = '';
    } else {
      box.classList.remove('hidden');
      box.textContent = message;
    }
  }

  // ---------- Hero + 三個大數字 ----------
  function renderHeadline(stats) {
    const s = stats || {};
    const actionable = num(s.actionable_orders ?? s.pending_orders);
    setText('#hero-actionable', intFmt(actionable));
    setText('#big-today-orders', intFmt(s.today_orders));
    setText('#big-today-revenue', money(s.today_revenue));
    setText('#big-week-revenue', money(s.week_revenue));
  }

  // ---------- 訂單狀態分段比例條 ----------
  function renderSegmentBar(breakdown) {
    const bar = $('#order-segbar');
    const legend = $('#order-seg-legend');
    const totalNode = $('#seg-total');
    if (!bar || !legend) return;
    bar.innerHTML = '';
    legend.innerHTML = '';

    const list = Array.isArray(breakdown) ? breakdown : [];
    const total = list.reduce((acc, r) => acc + num(r.count), 0);
    if (totalNode) totalNode.textContent = `共 ${intFmt(total)} 張`;

    if (!total) {
      bar.classList.add('is-empty');
      const empty = el('span', { class: 'dash-seg-empty', text: '暫時未有訂單數據' });
      bar.appendChild(empty);
      return;
    }
    bar.classList.remove('is-empty');

    const byKey = {};
    list.forEach((r) => { if (r && r.status) byKey[r.status] = num(r.count); });

    STATUS_ORDER.forEach((key) => {
      const count = byKey[key];
      if (!count) return;
      const meta = STATUS_META[key] || { label: key, color: FALLBACK_COLORS[0] };
      const pct = (count / total) * 100;

      const seg = el('span', {
        class: 'dash-seg-seg',
        title: `${meta.label} ${count}（${pct.toFixed(1)}%）`,
      });
      seg.style.width = pct + '%';
      seg.style.background = meta.color;
      bar.appendChild(seg);

      legend.appendChild(el('span', { class: 'dash-legend-item' }, [
        el('i', { style: `background:${meta.color}` }),
        document.createTextNode(`${meta.label} `),
        el('b', { text: intFmt(count) }),
        document.createTextNode(` · ${pct.toFixed(0)}%`),
      ]));
    });
  }

  // ---------- KPI 細卡 ----------
  function renderKpiGrid(stats) {
    const grid = $('#stats-grid');
    if (!grid) return;
    const s = stats || {};
    const cards = [
      { label: '總用戶', value: intFmt(s.users) },
      { label: '在售商品', value: intFmt(s.products) },
      { label: '活躍分類', value: intFmt(s.categories) },
      { label: '待處理訂單', value: intFmt(s.pending_orders) },
      { label: '本週訂單', value: intFmt(s.week_orders) },
      { label: '低庫存', value: intFmt(s.low_stock), alert: num(s.low_stock) > 0 },
    ];
    grid.innerHTML = '';
    cards.forEach((c) => {
      const card = el('div', { class: 'admin-kpi' + (c.alert ? ' is-alert' : '') });
      card.appendChild(el('div', { class: 'admin-kpi-value', text: c.value }));
      card.appendChild(el('div', { class: 'admin-kpi-label', text: c.label }));
      grid.appendChild(card);
    });
  }

  // ---------- 最新訂單 ----------
  function renderRecentOrders(orders) {
    const tbody = $('#recent-orders-tbody');
    if (!tbody) return;
    const list = Array.isArray(orders) ? orders : [];
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="py-8 text-center text-sm" style="color:var(--ad-muted)">暫時未有訂單</td></tr>';
      return;
    }
    tbody.innerHTML = list.map((o) => {
      const meta = STATUS_META[o.status] || { label: o.status || '—', badge: 'badge-cancelled' };
      const status = esc(meta.label);
      const who = esc(o.username || o.contact_name || '—');
      return `
        <tr>
          <td class="font-semibold"><a class="admin-link-btn" href="/admin/orders">#${esc(o.id)}</a></td>
          <td>${who}</td>
          <td class="font-semibold tabular-nums">${money(o.total_amount)}</td>
          <td><span class="admin-badge ${meta.badge}">${status}</span></td>
          <td class="tabular-nums" style="color:var(--ad-muted)">${fmtTime(o.created_at)}</td>
        </tr>`;
    }).join('');
  }

  async function load() {
    try {
      showError('');
      const data = await adminApiGet('/api/admin/dashboard');
      renderHeadline(data.stats);
      renderSegmentBar(data.stats && data.stats.status_breakdown);
      renderKpiGrid(data.stats);
      renderRecentOrders(data.recent_orders);
    } catch (e) {
      showError(e && e.message ? e.message : String(e));
    }
  }

  await load();
  setInterval(load, 5 * 60 * 1000);
})();
