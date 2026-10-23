(async function () {
  const { $, el, adminApiRequest } = window.AdminCommon;

  const els = {
    name: $('#wh-name'),
    address: $('#wh-address'),
    contactName: $('#wh-contact-name'),
    contactPhone: $('#wh-contact-phone'),
    isDefault: $('#wh-is-default'),
    create: $('#wh-create'),
    save: $('#wh-save'),
    reset: $('#wh-reset'),
    refresh: $('#wh-refresh'),
    error: $('#wh-error'),
    tbody: $('#wh-tbody'),
    modal: $('#wh-modal'),
    modalClose: $('#wh-modal-close'),
    modalTitle: $('#wh-modal-title'),
  };

  function openModal() {
    if (!els.modal) return;
    if (els.modalTitle) els.modalTitle.textContent = '新增倉庫';
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

  function clearForm() {
    if (els.name) els.name.value = '';
    if (els.address) els.address.value = '';
    if (els.contactName) els.contactName.value = '';
    if (els.contactPhone) els.contactPhone.value = '';
    if (els.isDefault) els.isDefault.checked = false;
  }

  async function loadWarehouses() {
    setError('');
    const data = await adminApiRequest('/api/admin/warehouses?include_inactive=1');
    const rows = data.warehouses || [];
    if (!els.tbody) return;
    els.tbody.textContent = '';

    for (const w of rows) {
      const isActive = w.is_active !== false;
      const isDefault = w.is_default === true;

      const statusLabel = isActive ? '啟用' : '停用';
      const defaultLabel = isDefault ? '預設' : '';

      const toggleBtn = el('button', {
        class: 'admin-link-btn',
        type: 'button',
        text: isActive ? '停用' : '啟用',
        onclick: async () => {
          try {
            setError('');
            await adminApiRequest('/api/admin/warehouses/' + encodeURIComponent(String(w.id)), {
              method: 'PUT',
              json: { is_active: !isActive }
            });
            await loadWarehouses();
          } catch (e) {
            setError(e && e.message ? e.message : String(e));
          }
        }
      });

      const makeDefaultBtn = el('button', {
        class: 'admin-link-btn',
        type: 'button',
        text: '設為預設',
        onclick: async () => {
          try {
            setError('');
            await adminApiRequest('/api/admin/warehouses/' + encodeURIComponent(String(w.id)) + '/make-default', {
              method: 'POST',
              json: {}
            });
            await loadWarehouses();
          } catch (e) {
            setError(e && e.message ? e.message : String(e));
          }
        }
      });
      makeDefaultBtn.disabled = !isActive || isDefault;

      const tr = el('tr', {}, [
        el('td', { text: w.name || '' }),
        el('td', { text: w.address || '' }),
        el('td', { text: w.contact_name || '' }),
        el('td', { text: w.contact_phone || '' }),
        el('td', { text: statusLabel }),
        el('td', { text: defaultLabel }),
        el('td', {}, [makeDefaultBtn, el('span', { text: ' ' }), toggleBtn]),
      ]);
      els.tbody.appendChild(tr);
    }
  }

  async function createWarehouse() {
    setError('');
    const name = els.name ? String(els.name.value || '').trim() : '';
    if (!name) {
      setError('倉庫名必填');
      return;
    }
    const payload = {
      name,
      address: els.address ? (String(els.address.value || '').trim() || null) : null,
      contact_name: els.contactName ? (String(els.contactName.value || '').trim() || null) : null,
      contact_phone: els.contactPhone ? (String(els.contactPhone.value || '').trim() || null) : null,
      is_default: els.isDefault ? Boolean(els.isDefault.checked) : false,
    };
    await adminApiRequest('/api/admin/warehouses', { method: 'POST', json: payload });
    clearForm();
    await loadWarehouses();
    closeModal();
  }

  if (els.refresh) els.refresh.addEventListener('click', () => loadWarehouses().catch((e) => setError(e.message)));
  if (els.create) els.create.addEventListener('click', () => { clearForm(); openModal(); });
  if (els.save) els.save.addEventListener('click', () => createWarehouse().catch((e) => setError(e.message)));
  if (els.reset) els.reset.addEventListener('click', () => clearForm());
  if (els.modalClose) els.modalClose.addEventListener('click', closeModal);
  if (els.modal) els.modal.addEventListener('mousedown', (e) => {
    if (e.target === els.modal) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && els.modal && !els.modal.classList.contains('hidden')) closeModal();
  });

  try {
    await loadWarehouses();
  } catch (e) {
    setError(e && e.message ? e.message : String(e));
  }
})();
