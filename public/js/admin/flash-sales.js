(async function () {
  const { $, el, adminApiRequest } = window.AdminCommon;

  const els = {
    name: $('#fs-name'),
    description: $('#fs-description'),
    startsAt: $('#fs-starts-at'),
    endsAt: $('#fs-ends-at'),
    addRow: $('#fs-add-row'),
    rows: $('#fs-rows'),
    save: $('#fs-save'),
    reset: $('#fs-reset'),
    error: $('#fs-error'),
    tbody: $('#fs-tbody'),
    create: $('#fs-create'),
    modal: $('#fs-modal'),
    modalClose: $('#fs-modal-close'),
    modalTitle: $('#fs-modal-title'),
  };

  function openModal() {
    if (!els.modal) return;
    if (els.modalTitle) els.modalTitle.textContent = '新增閃購活動';
    els.modal.classList.remove('hidden');
    els.modal.classList.add('flex');
  }
  function closeModal() {
    if (!els.modal) return;
    els.modal.classList.add('hidden');
    els.modal.classList.remove('flex');
  }

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

  // datetime-local -> ISO
  function localInputToIso(input) {
    if (!input) return null;
    const v = String(input.value || '').trim();
    if (!v) return null;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  function isoToDisplay(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    const pad = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function addProductRow(values) {
    if (!els.rows) return null;
    const v = values || {};
    const tr = el('tr');

    function cell(inputEl) {
      const td = el('td');
      td.appendChild(inputEl);
      tr.appendChild(td);
    }

    const mkInput = (val, placeholder) => {
      const i = el('input', {
        class: 'admin-input',
        type: 'number',
        step: '0.01',
        min: '0',
        placeholder: placeholder || '',
      });
      if (val !== undefined && val !== null) i.value = String(val);
      return i;
    };

    const productId = mkInput(v.product_id, '商品 ID');
    productId.step = '1';
    const salePrice = mkInput(v.sale_price, '閃購價');
    const originalPrice = mkInput(v.original_price, '原價');
    const stockLimit = mkInput(v.stock_limit, '可空');
    stockLimit.step = '1';
    const sortOrder = mkInput(v.sort_order || 0, '0');
    sortOrder.step = '1';

    cell(productId);
    cell(salePrice);
    cell(originalPrice);
    cell(stockLimit);
    cell(sortOrder);

    const removeBtn = el('button', {
      class: 'admin-link-btn',
      type: 'button',
      text: '移除',
      onclick: () => tr.remove(),
    });
    const actionTd = el('td');
    actionTd.appendChild(removeBtn);
    tr.appendChild(actionTd);

    tr._fields = { productId, salePrice, originalPrice, stockLimit, sortOrder };
    els.rows.appendChild(tr);
    return tr;
  }

  function clearForm() {
    if (els.name) els.name.value = '';
    if (els.description) els.description.value = '';
    if (els.startsAt) els.startsAt.value = '';
    if (els.endsAt) els.endsAt.value = '';
    if (els.rows) els.rows.textContent = '';
    addProductRow();
  }

  function readProducts() {
    if (!els.rows) return [];
    const products = [];
    const trs = els.rows.querySelectorAll('tr');
    trs.forEach((tr) => {
      const f = tr._fields;
      if (!f) return;
      const productId = Number(String(f.productId.value || '').trim());
      const salePrice = Number(String(f.salePrice.value || '').trim());
      const originalPrice = Number(String(f.originalPrice.value || '').trim());
      if (!Number.isFinite(productId) || productId <= 0) return;
      if (!Number.isFinite(salePrice) || salePrice < 0) return;
      if (!Number.isFinite(originalPrice) || originalPrice < 0) return;

      const stockRaw = String(f.stockLimit.value || '').trim();
      const stockLimit = stockRaw === '' ? null : Number(stockRaw);
      const sortRaw = String(f.sortOrder.value || '').trim();
      const sortOrder = sortRaw === '' ? 0 : Number(sortRaw);

      products.push({
        product_id: productId,
        sale_price: salePrice,
        original_price: originalPrice,
        stock_limit: stockLimit === null || !Number.isFinite(stockLimit) ? null : stockLimit,
        sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
      });
    });
    return products;
  }

  function statusLabel(fs) {
    const now = new Date();
    const start = fs.starts_at ? new Date(fs.starts_at) : null;
    const end = fs.ends_at ? new Date(fs.ends_at) : null;
    if (fs.is_active === false) return '已停用';
    if (start && start > now) return '未開始';
    if (end && end < now) return '已完結';
    return '進行中';
  }

  async function loadFlashSales() {
    setError('');
    const data = await adminApiRequest('/api/admin/flash-sales');
    const rows = data.flash_sales || [];
    if (!els.tbody) return;
    els.tbody.textContent = '';

    for (const fs of rows) {
      els.tbody.appendChild(el('tr', {}, [
        el('td', { text: fs.name || '' }),
        el('td', { text: isoToDisplay(fs.starts_at) }),
        el('td', { text: isoToDisplay(fs.ends_at) }),
        el('td', { text: statusLabel(fs) }),
        el('td', { text: isoToDisplay(fs.created_at) }),
      ]));
    }
  }

  async function saveFlashSale() {
    setError('');
    const name = els.name ? String(els.name.value || '').trim() : '';
    if (!name) {
      setError('活動名稱必填');
      return;
    }
    const startsAt = localInputToIso(els.startsAt);
    const endsAt = localInputToIso(els.endsAt);
    if (!startsAt || !endsAt) {
      setError('開始同結束時間必填');
      return;
    }
    if (new Date(endsAt) <= new Date(startsAt)) {
      setError('結束時間要遲過開始時間');
      return;
    }
    const products = readProducts();
    if (products.length === 0) {
      setError('最少要加一個有效商品（商品 ID、閃購價、原價都要填）');
      return;
    }

    await adminApiRequest('/api/admin/flash-sales', {
      method: 'POST',
      json: {
        name,
        description: els.description ? (String(els.description.value || '').trim() || null) : null,
        starts_at: startsAt,
        ends_at: endsAt,
        products,
      },
    });
    clearForm();
    closeModal();
    await loadFlashSales();
  }

  if (els.addRow) els.addRow.addEventListener('click', () => addProductRow());
  if (els.reset) els.reset.addEventListener('click', () => clearForm());
  if (els.save) els.save.addEventListener('click', () => saveFlashSale().catch((e) => setError(e.message)));
  if (els.create) els.create.addEventListener('click', () => { clearForm(); openModal(); });
  if (els.modalClose) els.modalClose.addEventListener('click', closeModal);
  if (els.modal) els.modal.addEventListener('mousedown', (e) => {
    if (e.target === els.modal) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && els.modal && !els.modal.classList.contains('hidden')) closeModal();
  });

  try {
    clearForm();
    await loadFlashSales();
  } catch (e) {
    setError(e && e.message ? e.message : String(e));
  }
})();
