(async function () {
  const { $, el, adminApiRequest } = window.AdminCommon;

  const els = {
    id: $('#sm-id'),
    name: $('#sm-name'),
    type: $('#sm-type'),
    zone: $('#sm-zone'),
    provider: $('#sm-provider'),
    fee: $('#sm-fee'),
    freeThreshold: $('#sm-free-threshold'),
    sort: $('#sm-sort'),
    active: $('#sm-active'),
    save: $('#sm-save'),
    reset: $('#sm-reset'),
    error: $('#sm-error'),
    tbody: $('#sm-tbody'),
    create: $('#sm-create'),
    modal: $('#sm-modal'),
    modalClose: $('#sm-modal-close'),
    modalTitle: $('#sm-modal-title'),
  };

  function openModal(isNew) {
    if (!els.modal) return;
    if (els.modalTitle) els.modalTitle.textContent = isNew ? '新增運送方式' : '編輯運送方式';
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

  const TYPE_LABELS = {
    courier: '速遞',
    pickup: '智能櫃自取',
    self_pickup: '店舖自取',
  };

  function typeLabel(t) {
    return TYPE_LABELS[t] || String(t || '');
  }

  function moneyHKD(n) {
    if (n === null || n === undefined || n === '') return '—';
    const x = Number(n);
    if (Number.isNaN(x)) return '—';
    return 'HK$ ' + x.toFixed(2);
  }

  function clearForm() {
    if (els.id) els.id.value = '';
    if (els.name) els.name.value = '';
    if (els.type) els.type.value = 'courier';
    if (els.zone) els.zone.value = '';
    if (els.provider) els.provider.value = '';
    if (els.fee) els.fee.value = '';
    if (els.freeThreshold) els.freeThreshold.value = '';
    if (els.sort) els.sort.value = '0';
    if (els.active) els.active.checked = true;
  }

  function readForm() {
    const idRaw = els.id ? String(els.id.value || '').trim() : '';
    const id = idRaw ? Number(idRaw) : null;
    const payload = {
      name: els.name ? String(els.name.value || '').trim() : '',
      type: els.type ? String(els.type.value || 'courier') : 'courier',
      zone_id: els.zone && els.zone.value ? Number(els.zone.value) : null,
      provider: els.provider ? (String(els.provider.value || '').trim() || null) : null,
      shipping_fee: toNumberOrNull(els.fee && els.fee.value),
      free_shipping_threshold: toNumberOrNull(els.freeThreshold && els.freeThreshold.value),
      sort_order: toNumberOrNull(els.sort && els.sort.value) || 0,
      is_active: els.active ? Boolean(els.active.checked) : true,
    };
    return { id: Number.isInteger(id) && id > 0 ? id : null, payload };
  }

  function fillForm(m) {
    if (els.id) els.id.value = m && m.id ? String(m.id) : '';
    if (els.name) els.name.value = m && m.name ? String(m.name) : '';
    if (els.type) els.type.value = m && m.type ? String(m.type) : 'courier';
    if (els.zone) els.zone.value = m && m.zone_id ? String(m.zone_id) : '';
    if (els.provider) els.provider.value = m && m.provider ? String(m.provider) : '';
    if (els.fee) els.fee.value = m && m.shipping_fee !== null && m.shipping_fee !== undefined ? String(m.shipping_fee) : '';
    if (els.freeThreshold) els.freeThreshold.value = m && m.free_shipping_threshold !== null && m.free_shipping_threshold !== undefined ? String(m.free_shipping_threshold) : '';
    if (els.sort) els.sort.value = m && m.sort_order !== null && m.sort_order !== undefined ? String(m.sort_order) : '0';
    if (els.active) els.active.checked = m ? (m.is_active !== false) : true;
  }

  async function loadZones() {
    if (!els.zone) return;
    const data = await adminApiRequest('/api/shipping/zones');
    const current = els.zone.value;
    els.zone.textContent = '';
    els.zone.appendChild(el('option', { value: '', text: '（不限區域）' }));
    for (const z of data.zones || []) {
      els.zone.appendChild(el('option', { value: String(z.id), text: z.name || ('#' + z.id) }));
    }
    els.zone.value = current;
  }

  async function loadMethods() {
    setError('');
    const data = await adminApiRequest('/api/admin/shipping/methods');
    const rows = data.shipping_methods || [];
    if (!els.tbody) return;
    els.tbody.textContent = '';

    for (const m of rows) {
      const isActive = m.is_active !== false;

      const editBtn = el('button', {
        class: 'admin-link-btn',
        type: 'button',
        text: '編輯',
        onclick: () => { fillForm(m); openModal(false); },
      });

      const toggleBtn = el('button', {
        class: 'admin-link-btn',
        type: 'button',
        text: isActive ? '停用' : '啟用',
        onclick: async () => {
          try {
            setError('');
            await adminApiRequest('/api/admin/shipping/methods/' + encodeURIComponent(String(m.id)), {
              method: 'PUT',
              json: {
                name: m.name,
                type: m.type,
                zone_id: m.zone_id || null,
                provider: m.provider || null,
                shipping_fee: Number(m.shipping_fee),
                free_shipping_threshold: m.free_shipping_threshold === null || m.free_shipping_threshold === undefined
                  ? null : Number(m.free_shipping_threshold),
                sort_order: Number(m.sort_order || 0),
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
          if (!window.confirm('確定刪除運送方式「' + m.name + '」？')) return;
          try {
            setError('');
            await adminApiRequest('/api/admin/shipping/methods/' + encodeURIComponent(String(m.id)), { method: 'DELETE' });
            await loadMethods();
          } catch (e) {
            setError(e && e.message ? e.message : String(e));
          }
        },
      });

      els.tbody.appendChild(el('tr', {}, [
        el('td', { text: m.name || '' }),
        el('td', { text: typeLabel(m.type) }),
        el('td', { text: m.zone_name || '—' }),
        el('td', { text: m.provider || '—' }),
        el('td', { class: 'text-right tabular-nums', text: moneyHKD(m.shipping_fee) }),
        el('td', { class: 'text-right tabular-nums', text: moneyHKD(m.free_shipping_threshold) }),
        el('td', { class: 'text-right tabular-nums', text: String(m.sort_order || 0) }),
        el('td', { text: isActive ? '啟用' : '停用' }),
        el('td', {}, [editBtn, el('span', { text: ' ' }), toggleBtn, el('span', { text: ' ' }), deleteBtn]),
      ]));
    }
  }

  async function saveMethod() {
    setError('');
    const { id, payload } = readForm();
    if (!payload.name) {
      setError('方式名稱必填');
      return;
    }
    if (payload.shipping_fee === null) {
      setError('請輸入運費');
      return;
    }
    if (id) {
      await adminApiRequest('/api/admin/shipping/methods/' + encodeURIComponent(String(id)), { method: 'PUT', json: payload });
    } else {
      await adminApiRequest('/api/admin/shipping/methods', { method: 'POST', json: payload });
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
    await loadZones();
    await loadMethods();
  } catch (e) {
    setError(e && e.message ? e.message : String(e));
  }
})();
