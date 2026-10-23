(async function () {
  const { $, el, adminApiRequest } = window.AdminCommon;

  const els = {
    threshold: $('#ls-threshold'),
    refresh: $('#ls-refresh'),
    exportBtn: $('#ls-export'),
    error: $('#ls-error'),
    tbody: $('#ls-tbody'),
  };

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

  function parseThreshold() {
    const raw = els.threshold ? String(els.threshold.value || '').trim() : '';
    const n = parseInt(raw, 10);
    if (!Number.isInteger(n) || n < 0) return 5;
    return n;
  }

  function renderRows(rows) {
    if (!els.tbody) return;
    els.tbody.textContent = '';
    for (const r of rows || []) {
      const updatedAt = r.updated_at ? new Date(r.updated_at) : null;
      const updatedLabel = updatedAt && !Number.isNaN(updatedAt.getTime()) ? updatedAt.toLocaleString('zh-HK') : '';

      const jump = el('a', {
        class: 'admin-link-btn',
        href: `/admin/inventory?sku_id=${encodeURIComponent(String(r.sku_id))}`,
        text: '去庫存中心',
      });

      const tr = el('tr', {}, [
        el('td', { text: r.product_name || '' }),
        el('td', { text: r.sku || `#${r.sku_id}` }),
        el('td', { text: r.barcode || '' }),
        el('td', { text: String(r.stock ?? 0) }),
        el('td', { text: updatedLabel }),
        el('td', {}, [jump]),
      ]);
      els.tbody.appendChild(tr);
    }
  }

  async function load() {
    setError('');
    const threshold = parseThreshold();
    if (els.threshold) els.threshold.value = String(threshold);
    const params = new URLSearchParams({ threshold: String(threshold) });
    const data = await adminApiRequest('/api/admin/low-stock/skus?' + params.toString());
    renderRows(data.skus || []);
  }

  if (els.refresh) els.refresh.addEventListener('click', () => load().catch((e) => setError(e.message)));
  if (els.exportBtn) {
    els.exportBtn.addEventListener('click', () => {
      const threshold = parseThreshold();
      const params = new URLSearchParams({ threshold: String(threshold) });
      window.location.href = '/api/admin/low-stock/skus/export.csv?' + params.toString();
    });
  }

  try {
    await load();
  } catch (e) {
    setError(e && e.message ? e.message : String(e));
  }
})();

