(async function () {
  const { $, el, adminApiRequest } = window.AdminCommon;

  const els = {
    warehouse: $('#inv-warehouse'),
    productId: $('#inv-product-id'),
    skuId: $('#inv-sku-id'),
    from: $('#inv-from'),
    to: $('#inv-to'),
    refresh: $('#inv-refresh'),
    error: $('#inv-error'),
    tbody: $('#inv-tbody'),
    prev: $('#inv-prev'),
    next: $('#inv-next'),
    page: $('#inv-page'),

    levelsCard: $('#inv-levels-card'),
    levelsRefresh: $('#inv-levels-refresh'),
    levelsMeta: $('#inv-levels-meta'),
    levelsTbody: $('#inv-levels-tbody'),

    adjustOpen: $('#inv-adjust-open'),
    adjustModal: $('#inv-adjust-modal'),
    skuQ: $('#inv-sku-q'),
    skuSelect: $('#inv-sku-select'),
    delta: $('#inv-delta'),
    warehouseModal: $('#inv-warehouse-modal'),
    note: $('#inv-note'),
    confirm: $('#inv-confirm'),
    cancel: $('#inv-cancel'),
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

  function buildOptions(select, options, includeEmpty, emptyLabel) {
    if (!select) return;
    select.textContent = '';
    if (includeEmpty) select.appendChild(el('option', { value: '', text: emptyLabel || '全部' }));
    for (const o of options) {
      select.appendChild(el('option', { value: String(o.value), text: o.text }));
    }
  }

  let warehouses = [];
  let currentPage = 1;
  let pageSize = 50;
  let total = 0;

  function setLevelsMeta(msg) {
    if (!els.levelsMeta) return;
    els.levelsMeta.textContent = msg || '';
  }

  function renderLevels(data) {
    if (els.levelsTbody) els.levelsTbody.textContent = '';
    if (!data || !data.sku) {
      setLevelsMeta('請輸入 SKU ID 或在「調整庫存」選擇 SKU');
      return;
    }

    const sku = data.sku;
    const skuIdLabel = sku.id ? `#${sku.id}` : '';
    const skuCodeLabel = sku.sku ? `SKU:${sku.sku}` : 'SKU:—';
    const barcodeLabel = sku.barcode ? `Barcode:${sku.barcode}` : 'Barcode:—';
    const totalStockLabel = typeof sku.stock !== 'undefined' ? `總庫存:${sku.stock}` : '總庫存:—';
    setLevelsMeta(`SKU ${skuIdLabel}（${skuCodeLabel} / ${barcodeLabel} / ${totalStockLabel}）`);

    if (!els.levelsTbody) return;
    const levels = data.levels || [];
    for (const it of levels) {
      const whLabel = it.warehouse_name ? String(it.warehouse_name) : (it.warehouse_id ? `#${it.warehouse_id}` : '');
      const stockLabel = typeof it.stock !== 'undefined' ? String(it.stock) : '';
      const isDefaultLabel = it.is_default ? '是' : '否';
      const statusLabel = it.is_active === false ? '停用' : '啟用';
      els.levelsTbody.appendChild(
        el('tr', {}, [
          el('td', { text: whLabel }),
          el('td', { text: stockLabel }),
          el('td', { text: isDefaultLabel }),
          el('td', { text: statusLabel }),
        ])
      );
    }
  }

  function getCurrentSkuIdForLevels() {
    const sid = (els.skuId && String(els.skuId.value || '').trim()) || '';
    if (sid) {
      const skuId = Number(sid);
      if (Number.isInteger(skuId) && skuId > 0) return skuId;
    }
    const sid2 = (els.skuSelect && String(els.skuSelect.value || '').trim()) || '';
    if (sid2) {
      const skuId = Number(sid2);
      if (Number.isInteger(skuId) && skuId > 0) return skuId;
    }
    return null;
  }

  async function loadLevelsBySkuId(skuId) {
    if (!els.levelsCard) return;
    if (!skuId) {
      renderLevels(null);
      return;
    }
    const params = new URLSearchParams({ sku_id: String(skuId) });
    const data = await adminApiRequest('/api/admin/inventory/levels?' + params.toString());
    renderLevels(data);
  }

  async function loadLevelsFromCurrentInputs() {
    const skuId = getCurrentSkuIdForLevels();
    await loadLevelsBySkuId(skuId);
  }

  async function loadWarehouses() {
    const data = await adminApiRequest('/api/admin/warehouses');
    warehouses = data.warehouses || [];
    const opts = warehouses.map((w) => ({ value: w.id, text: w.name || `#${w.id}` }));
    buildOptions(els.warehouse, opts, true, '全部');
    buildOptions(els.warehouseModal, opts, true, '自動（預設倉庫）');
  }

  function buildTransactionsQuery(page) {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('page_size', String(pageSize));

    const wid = (els.warehouse && els.warehouse.value) || '';
    const pid = (els.productId && els.productId.value) || '';
    const sid = (els.skuId && els.skuId.value) || '';
    const from = (els.from && els.from.value) || '';
    const to = (els.to && els.to.value) || '';
    if (wid) params.set('warehouse_id', wid);
    if (pid.trim()) params.set('product_id', pid.trim());
    if (sid.trim()) params.set('sku_id', sid.trim());
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return params.toString();
  }

  function renderPagination() {
    const maxPage = Math.max(1, Math.ceil(total / pageSize));
    if (els.page) els.page.textContent = `第 ${currentPage} 頁 / 共 ${maxPage} 頁（${total} 筆）`;
    if (els.prev) els.prev.disabled = currentPage <= 1;
    if (els.next) els.next.disabled = currentPage >= maxPage;
  }

  function renderTransactions(rows) {
    if (!els.tbody) return;
    els.tbody.textContent = '';
    for (const it of rows || []) {
      const createdAt = it.created_at ? new Date(it.created_at) : null;
      const timeLabel = createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt.toLocaleString('zh-HK') : '';
      const productLabel = it.product_name ? String(it.product_name) : (it.product_id ? `#${it.product_id}` : '');
      const skuLabel = it.sku_id ? `#${it.sku_id}` : '';
      const whLabel = it.warehouse_name ? String(it.warehouse_name) : (it.warehouse_id ? `#${it.warehouse_id}` : '');
      const noteLabel = it.note ? String(it.note) : '';

      const tr = el('tr', {}, [
        el('td', { text: timeLabel }),
        el('td', { text: productLabel }),
        el('td', { text: skuLabel }),
        el('td', { text: whLabel }),
        el('td', { text: it.type ? String(it.type) : '' }),
        el('td', { text: typeof it.quantity !== 'undefined' ? String(it.quantity) : '' }),
        el('td', { text: typeof it.previous_stock !== 'undefined' ? String(it.previous_stock) : '' }),
        el('td', { text: typeof it.new_stock !== 'undefined' ? String(it.new_stock) : '' }),
        el('td', { text: noteLabel }),
      ]);
      els.tbody.appendChild(tr);
    }
  }

  async function loadTransactions(page) {
    setError('');
    currentPage = page;
    const qs = buildTransactionsQuery(page);
    const data = await adminApiRequest('/api/admin/inventory/transactions?' + qs);
    const rows = data.transactions || [];
    total = (data.pagination && Number(data.pagination.total)) || 0;
    pageSize = (data.pagination && Number(data.pagination.page_size)) || pageSize;
    renderTransactions(rows);
    renderPagination();
  }

  function openAdjustModal() {
    if (!els.adjustModal) return;
    els.adjustModal.classList.remove('hidden');
    if (els.skuQ) els.skuQ.value = '';
    if (els.skuSelect) els.skuSelect.textContent = '';
    if (els.delta) els.delta.value = '';
    if (els.note) els.note.value = '';
    if (els.warehouseModal) els.warehouseModal.value = '';
    if (els.skuQ) els.skuQ.focus();
  }

  function closeAdjustModal() {
    if (!els.adjustModal) return;
    els.adjustModal.classList.add('hidden');
  }

  let skuSearchTimer = null;
  async function searchSkus(q) {
    const query = String(q || '').trim();
    if (!query) {
      if (els.skuSelect) els.skuSelect.textContent = '';
      return;
    }
    const params = new URLSearchParams({ q: query, limit: '20' });
    const data = await adminApiRequest('/api/admin/inventory/skus?' + params.toString());
    const skus = data.skus || [];
    if (!els.skuSelect) return;
    els.skuSelect.textContent = '';
    for (const s of skus) {
      const label = `${s.product_name || ''} | ${s.sku || ''} | #${s.id} | 庫存:${typeof s.stock !== 'undefined' ? s.stock : 0}`;
      els.skuSelect.appendChild(el('option', { value: String(s.id), text: label }));
    }
  }

  async function confirmAdjust() {
    setError('');
    const skuId = els.skuSelect ? Number(els.skuSelect.value) : NaN;
    if (!Number.isInteger(skuId) || skuId <= 0) {
      setError('請先選擇 SKU');
      return;
    }
    const deltaRaw = els.delta ? String(els.delta.value || '').trim() : '';
    const delta = parseInt(deltaRaw, 10);
    if (!Number.isInteger(delta) || delta === 0) {
      setError('delta 不正確');
      return;
    }
    const note = els.note ? (String(els.note.value || '').trim() || null) : null;
    const warehouseId = els.warehouseModal && els.warehouseModal.value ? Number(els.warehouseModal.value) : null;

    try {
      await adminApiRequest('/api/admin/inventory/adjust', {
        method: 'POST',
        json: {
          sku_id: skuId,
          delta,
          note,
          warehouse_id: warehouseId || undefined,
        }
      });
      closeAdjustModal();
      await loadTransactions(1);
      await loadLevelsBySkuId(skuId);
    } catch (e) {
      setError(e && e.message ? e.message : String(e));
    }
  }

  if (els.refresh) {
    els.refresh.addEventListener('click', () => {
      Promise.resolve()
        .then(() => loadTransactions(1))
        .then(() => loadLevelsFromCurrentInputs())
        .catch((e) => setError(e.message));
    });
  }
  if (els.prev) els.prev.addEventListener('click', () => loadTransactions(Math.max(1, currentPage - 1)).catch((e) => setError(e.message)));
  if (els.next) els.next.addEventListener('click', () => loadTransactions(currentPage + 1).catch((e) => setError(e.message)));

  if (els.adjustOpen) els.adjustOpen.addEventListener('click', () => openAdjustModal());
  if (els.cancel) els.cancel.addEventListener('click', () => closeAdjustModal());
  if (els.confirm) els.confirm.addEventListener('click', () => confirmAdjust());

  if (els.levelsRefresh) {
    els.levelsRefresh.addEventListener('click', () => {
      loadLevelsFromCurrentInputs().catch((e) => setError(e.message));
    });
  }

  if (els.skuId) {
    els.skuId.addEventListener('change', () => {
      loadLevelsFromCurrentInputs().catch((e) => setError(e.message));
    });
  }

  if (els.skuSelect) {
    els.skuSelect.addEventListener('change', () => {
      loadLevelsFromCurrentInputs().catch((e) => setError(e.message));
    });
  }

  if (els.skuQ) {
    els.skuQ.addEventListener('input', () => {
      if (skuSearchTimer) clearTimeout(skuSearchTimer);
      skuSearchTimer = setTimeout(() => {
        searchSkus(els.skuQ.value).catch((e) => setError(e.message));
      }, 250);
    });
    els.skuQ.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        if (skuSearchTimer) clearTimeout(skuSearchTimer);
        searchSkus(els.skuQ.value).catch((e) => setError(e.message));
      }
    });
  }

  try {
    await loadWarehouses();
    await loadTransactions(1);
    await loadLevelsFromCurrentInputs();
  } catch (e) {
    setError(e && e.message ? e.message : String(e));
  }
})();
