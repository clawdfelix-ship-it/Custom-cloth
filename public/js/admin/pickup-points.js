(async function () {
  const { $, el, adminApiRequest } = window.AdminCommon;

  const els = {
    id: $('#pp-id'),
    name: $('#pp-name'),
    address: $('#pp-address'),
    district: $('#pp-district'),
    provider: $('#pp-provider'),
    lat: $('#pp-lat'),
    lng: $('#pp-lng'),
    save: $('#pp-save'),
    reset: $('#pp-reset'),
    error: $('#pp-error'),
    filterDistrict: $('#pp-filter-district'),
    filterProvider: $('#pp-filter-provider'),
    search: $('#pp-search'),
    tbody: $('#pp-tbody'),
    pageInfo: $('#pp-page-info'),
    prev: $('#pp-prev'),
    next: $('#pp-next'),
    create: $('#pp-create'),
    modal: $('#pp-modal'),
    modalClose: $('#pp-modal-close'),
    modalTitle: $('#pp-modal-title'),
  };

  function openModal(isNew) {
    if (!els.modal) return;
    if (els.modalTitle) els.modalTitle.textContent = isNew ? '新增提貨點' : '編輯提貨點';
    els.modal.classList.remove('hidden');
    els.modal.classList.add('flex');
  }
  function closeModal() {
    if (!els.modal) return;
    els.modal.classList.add('hidden');
    els.modal.classList.remove('flex');
  }

  const PAGE_SIZE = 50;
  let allDistricts = [];
  let state = { page: 1, total: 0 };

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

  function coord(n) {
    if (n === null || n === undefined || n === '') return '—';
    const x = Number(n);
    if (Number.isNaN(x)) return '—';
    return x.toFixed(6);
  }

  function clearForm() {
    if (els.id) els.id.value = '';
    if (els.name) els.name.value = '';
    if (els.address) els.address.value = '';
    if (els.district) els.district.value = allDistricts[0] || '';
    if (els.provider) els.provider.value = '';
    if (els.lat) els.lat.value = '';
    if (els.lng) els.lng.value = '';
  }

  function toNumberOrNull(raw) {
    const v = String(raw == null ? '' : raw).trim();
    if (!v) return null;
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
  }

  function readForm() {
    const idRaw = els.id ? String(els.id.value || '').trim() : '';
    const id = idRaw ? Number(idRaw) : null;
    const payload = {
      name: els.name ? String(els.name.value || '').trim() : '',
      address: els.address ? String(els.address.value || '').trim() : '',
      district: els.district ? String(els.district.value || '').trim() : '',
      provider: els.provider ? String(els.provider.value || '').trim() : '',
      latitude: toNumberOrNull(els.lat && els.lat.value),
      longitude: toNumberOrNull(els.lng && els.lng.value),
    };
    return { id: Number.isInteger(id) && id > 0 ? id : null, payload };
  }

  function fillForm(p) {
    if (els.id) els.id.value = p && p.id ? String(p.id) : '';
    if (els.name) els.name.value = p && p.name ? String(p.name) : '';
    if (els.address) els.address.value = p && p.address ? String(p.address) : '';
    if (els.district) els.district.value = p && p.district ? String(p.district) : '';
    if (els.provider) els.provider.value = p && p.provider ? String(p.provider) : '';
    if (els.lat) els.lat.value = p && p.latitude !== null && p.latitude !== undefined ? String(p.latitude) : '';
    if (els.lng) els.lng.value = p && p.longitude !== null && p.longitude !== undefined ? String(p.longitude) : '';
  }

  async function loadDistrictList() {
    const data = await adminApiRequest('/api/hong-kong/district-list');
    allDistricts = data.all || [];

    if (els.district) {
      const cur = els.district.value;
      els.district.textContent = '';
      for (const d of allDistricts) els.district.appendChild(el('option', { value: d, text: d }));
      els.district.value = cur || allDistricts[0] || '';
    }
    if (els.filterDistrict) {
      const cur = els.filterDistrict.value;
      els.filterDistrict.textContent = '';
      els.filterDistrict.appendChild(el('option', { value: '', text: '全部地區' }));
      for (const d of allDistricts) els.filterDistrict.appendChild(el('option', { value: d, text: d }));
      els.filterDistrict.value = cur || '';
    }
  }

  async function loadPickupPoints() {
    setError('');
    const params = new URLSearchParams({
      page: String(state.page),
      page_size: String(PAGE_SIZE),
    });
    const district = els.filterDistrict ? String(els.filterDistrict.value || '') : '';
    const provider = els.filterProvider ? String(els.filterProvider.value || '').trim() : '';
    if (district) params.set('district', district);
    if (provider) params.set('provider', provider);

    const data = await adminApiRequest('/api/admin/pickup-points?' + params.toString());
    const rows = data.pickup_points || [];
    if (data.pagination) {
      state.total = Number(data.pagination.total || 0);
      state.page = Number(data.pagination.page || state.page);
    }

    if (!els.tbody) return;
    els.tbody.textContent = '';

    for (const p of rows) {
      const editBtn = el('button', {
        class: 'admin-link-btn',
        type: 'button',
        text: '編輯',
        onclick: () => { fillForm(p); openModal(false); },
      });

      const deleteBtn = el('button', {
        class: 'admin-link-btn',
        type: 'button',
        text: '刪除',
        onclick: async () => {
          if (!window.confirm('確定停用提貨點「' + p.name + '」？（只會設為唔啟用，唔會真刪）')) return;
          try {
            setError('');
            await adminApiRequest('/api/admin/pickup-points/' + encodeURIComponent(String(p.id)), { method: 'DELETE' });
            await loadPickupPoints();
          } catch (e) {
            setError(e && e.message ? e.message : String(e));
          }
        },
      });

      els.tbody.appendChild(el('tr', {}, [
        el('td', { text: p.name || '' }),
        el('td', { text: p.address || '' }),
        el('td', { text: p.district || '' }),
        el('td', { text: p.provider || '' }),
        el('td', { class: 'text-right tabular-nums', text: coord(p.latitude) }),
        el('td', { class: 'text-right tabular-nums', text: coord(p.longitude) }),
        el('td', {}, [editBtn, el('span', { text: ' ' }), deleteBtn]),
      ]));
    }

    renderPagination();
  }

  function renderPagination() {
    if (els.pageInfo) {
      const start = state.total === 0 ? 0 : (state.page - 1) * PAGE_SIZE + 1;
      const end = Math.min(state.total, state.page * PAGE_SIZE);
      els.pageInfo.textContent = `第 ${start}–${end} 項，共 ${state.total} 項（第 ${state.page} 頁）`;
    }
    if (els.prev) els.prev.disabled = state.page <= 1;
    if (els.next) els.next.disabled = state.page * PAGE_SIZE >= state.total;
  }

  async function savePoint() {
    setError('');
    const { id, payload } = readForm();
    if (!payload.name) { setError('點位名稱必填'); return; }
    if (!payload.address) { setError('地址必填'); return; }
    if (!payload.district) { setError('請選擇地區'); return; }
    if (!payload.provider) { setError('服務商代碼必填'); return; }

    if (id) {
      payload.is_active = true;
      await adminApiRequest('/api/admin/pickup-points/' + encodeURIComponent(String(id)), { method: 'PUT', json: payload });
    } else {
      await adminApiRequest('/api/admin/pickup-points', { method: 'POST', json: payload });
    }
    clearForm();
    state.page = 1;
    await loadPickupPoints();
    closeModal();
  }

  if (els.reset) els.reset.addEventListener('click', () => clearForm());
  if (els.save) els.save.addEventListener('click', () => savePoint().catch((e) => setError(e.message)));
  if (els.create) els.create.addEventListener('click', () => { clearForm(); openModal(true); });
  if (els.modalClose) els.modalClose.addEventListener('click', closeModal);
  if (els.modal) els.modal.addEventListener('mousedown', (e) => {
    if (e.target === els.modal) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && els.modal && !els.modal.classList.contains('hidden')) closeModal();
  });
  if (els.search) els.search.addEventListener('click', () => { state.page = 1; loadPickupPoints().catch((e) => setError(e.message)); });
  if (els.filterProvider) els.filterProvider.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') { state.page = 1; loadPickupPoints().catch((e) => setError(e.message)); }
  });
  if (els.filterDistrict) els.filterDistrict.addEventListener('change', () => { state.page = 1; loadPickupPoints().catch((e) => setError(e.message)); });
  if (els.prev) els.prev.addEventListener('click', () => { if (state.page > 1) { state.page--; loadPickupPoints().catch((e) => setError(e.message)); } });
  if (els.next) els.next.addEventListener('click', () => { if (state.page * PAGE_SIZE < state.total) { state.page++; loadPickupPoints().catch((e) => setError(e.message)); } });

  try {
    await loadDistrictList();
    clearForm();
    state.page = 1;
    await loadPickupPoints();
  } catch (e) {
    setError(e && e.message ? e.message : String(e));
  }
})();
