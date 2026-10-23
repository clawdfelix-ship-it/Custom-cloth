(async function () {
  const { $, el, adminApiRequest } = window.AdminCommon;

  const els = {
    id: $('#pm-id'),
    name: $('#pm-name'),
    code: $('#pm-code'),
    provider: $('#pm-provider'),
    feePercent: $('#pm-fee-percent'),
    feeFixed: $('#pm-fee-fixed'),
    sort: $('#pm-sort'),
    qrImage: $('#pm-qr-image'),
    instructions: $('#pm-instructions'),
    active: $('#pm-active'),
    save: $('#pm-save'),
    reset: $('#pm-reset'),
    error: $('#pm-error'),
    tbody: $('#pm-tbody'),
    create: $('#pm-create'),
    modal: $('#pm-modal'),
    modalClose: $('#pm-modal-close'),
    modalTitle: $('#pm-modal-title'),
  };

  function openModal(isNew) {
    if (!els.modal) return;
    if (els.modalTitle) els.modalTitle.textContent = isNew ? '新增支付方式' : '編輯支付方式';
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

  function toNumberOrNull(raw) {
    const v = String(raw == null ? '' : raw).trim();
    if (!v) return null;
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
  }

  function moneyHKD(n) {
    if (n === null || n === undefined || n === '') return '—';
    const x = Number(n);
    if (Number.isNaN(x)) return '—';
    return 'HK$ ' + x.toFixed(2);
  }

  function percent(n) {
    if (n === null || n === undefined || n === '') return '—';
    const x = Number(n);
    if (Number.isNaN(x)) return '—';
    return x.toFixed(2) + '%';
  }

  function clearForm() {
    if (els.id) els.id.value = '';
    if (els.name) els.name.value = '';
    if (els.code) els.code.value = '';
    if (els.provider) els.provider.value = '';
    if (els.feePercent) els.feePercent.value = '';
    if (els.feeFixed) els.feeFixed.value = '';
    if (els.sort) els.sort.value = '0';
    if (els.qrImage) els.qrImage.value = '';
    if (els.instructions) els.instructions.value = '';
    if (els.active) els.active.checked = true;
  }

  function readForm() {
    const idRaw = els.id ? String(els.id.value || '').trim() : '';
    const id = idRaw ? Number(idRaw) : null;
    const payload = {
      name: els.name ? String(els.name.value || '').trim() : '',
      code: els.code ? String(els.code.value || '').trim() : '',
      provider: els.provider ? (String(els.provider.value || '').trim() || null) : null,
      fee_percent: toNumberOrNull(els.feePercent && els.feePercent.value),
      fee_fixed: toNumberOrNull(els.feeFixed && els.feeFixed.value),
      instructions: els.instructions ? (String(els.instructions.value || '').trim() || null) : null,
      qr_code_image: els.qrImage ? (String(els.qrImage.value || '').trim() || null) : null,
      sort_order: toNumberOrNull(els.sort && els.sort.value) || 0,
      is_active: els.active ? Boolean(els.active.checked) : true,
    };
    return { id: Number.isInteger(id) && id > 0 ? id : null, payload };
  }

  function fillForm(p) {
    if (els.id) els.id.value = p && p.id ? String(p.id) : '';
    if (els.name) els.name.value = p && p.name ? String(p.name) : '';
    if (els.code) els.code.value = p && p.code ? String(p.code) : '';
    if (els.provider) els.provider.value = p && p.provider ? String(p.provider) : '';
    if (els.feePercent) els.feePercent.value = p && p.fee_percent !== null && p.fee_percent !== undefined ? String(p.fee_percent) : '';
    if (els.feeFixed) els.feeFixed.value = p && p.fee_fixed !== null && p.fee_fixed !== undefined ? String(p.fee_fixed) : '';
    if (els.sort) els.sort.value = p && p.sort_order !== null && p.sort_order !== undefined ? String(p.sort_order) : '0';
    if (els.qrImage) els.qrImage.value = p && p.qr_code_image ? String(p.qr_code_image) : '';
    if (els.instructions) els.instructions.value = p && p.instructions ? String(p.instructions) : '';
    if (els.active) els.active.checked = p ? (p.is_active !== false) : true;
  }

  async function loadMethods() {
    setError('');
    const data = await adminApiRequest('/api/admin/payment-methods');
    const rows = data.payment_methods || [];
    if (!els.tbody) return;
    els.tbody.textContent = '';

    for (const p of rows) {
      const isActive = p.is_active !== false;

      const editBtn = el('button', {
        class: 'admin-link-btn',
        type: 'button',
        text: '編輯',
        onclick: () => { fillForm(p); openModal(false); },
      });

      const toggleBtn = el('button', {
        class: 'admin-link-btn',
        type: 'button',
        text: isActive ? '停用' : '啟用',
        onclick: async () => {
          try {
            setError('');
            await adminApiRequest('/api/admin/payment-methods/' + encodeURIComponent(String(p.id)), {
              method: 'PUT',
              json: {
                name: p.name,
                code: p.code,
                provider: p.provider || null,
                fee_percent: p.fee_percent === null || p.fee_percent === undefined ? null : Number(p.fee_percent),
                fee_fixed: p.fee_fixed === null || p.fee_fixed === undefined ? null : Number(p.fee_fixed),
                instructions: p.instructions || null,
                qr_code_image: p.qr_code_image || null,
                sort_order: Number(p.sort_order || 0),
                is_active: !isActive,
              },
            });
            await loadMethods();
          } catch (e) {
            setError(e && e.message ? e.message : String(e));
          }
        },
      });

      const deleteBtn = el('button', {
        class: 'admin-link-btn',
        type: 'button',
        text: '刪除',
        onclick: async () => {
          if (!window.confirm('確定刪除支付方式「' + p.name + '」？')) return;
          try {
            setError('');
            await adminApiRequest('/api/admin/payment-methods/' + encodeURIComponent(String(p.id)), { method: 'DELETE' });
            await loadMethods();
          } catch (e) {
            setError(e && e.message ? e.message : String(e));
          }
        },
      });

      els.tbody.appendChild(el('tr', {}, [
        el('td', { text: p.name || '' }),
        el('td', { text: p.code || '' }),
        el('td', { text: p.provider || '—' }),
        el('td', { class: 'text-right tabular-nums', text: percent(p.fee_percent) }),
        el('td', { class: 'text-right tabular-nums', text: moneyHKD(p.fee_fixed) }),
        el('td', { class: 'text-right tabular-nums', text: String(p.sort_order || 0) }),
        el('td', { text: isActive ? '啟用' : '停用' }),
        el('td', {}, [editBtn, el('span', { text: ' ' }), toggleBtn, el('span', { text: ' ' }), deleteBtn]),
      ]));
    }
  }

  async function saveMethod() {
    setError('');
    const { id, payload } = readForm();
    if (!payload.name) { setError('支付方式名稱必填'); return; }
    if (!payload.code) { setError('代碼必填'); return; }

    if (id) {
      await adminApiRequest('/api/admin/payment-methods/' + encodeURIComponent(String(id)), { method: 'PUT', json: payload });
    } else {
      await adminApiRequest('/api/admin/payment-methods', { method: 'POST', json: payload });
    }
    clearForm();
    await loadMethods();
    closeModal();
  }

  if (els.reset) els.reset.addEventListener('click', () => clearForm());
  if (els.save) els.save.addEventListener('click', () => saveMethod().catch((e) => setError(e.message)));
  if (els.create) els.create.addEventListener('click', () => { clearForm(); openModal(true); });
  if (els.modalClose) els.modalClose.addEventListener('click', closeModal);
  if (els.modal) els.modal.addEventListener('mousedown', (e) => {
    if (e.target === els.modal) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && els.modal && !els.modal.classList.contains('hidden')) closeModal();
  });

  try {
    clearForm();
    await loadMethods();
  } catch (e) {
    setError(e && e.message ? e.message : String(e));
  }
})();
