(async function () {
  const { $, el, adminApiRequest } = window.AdminCommon;

  const els = {
    id: $('#sup-id'),
    name: $('#sup-name'),
    contactName: $('#sup-contact-name'),
    contactPhone: $('#sup-contact-phone'),
    email: $('#sup-email'),
    paymentTerms: $('#sup-payment-terms'),
    address: $('#sup-address'),
    notes: $('#sup-notes'),
    active: $('#sup-active'),
    save: $('#sup-save'),
    reset: $('#sup-reset'),
    error: $('#sup-error'),
    tbody: $('#sup-tbody'),
    create: $('#sup-create'),
    modal: $('#sup-modal'),
    modalClose: $('#sup-modal-close'),
    modalTitle: $('#sup-modal-title'),
  };

  function openModal(isNew) {
    if (!els.modal) return;
    if (els.modalTitle) els.modalTitle.textContent = isNew ? '新增供應商' : '編輯供應商';
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
    if (els.id) els.id.value = '';
    if (els.name) els.name.value = '';
    if (els.contactName) els.contactName.value = '';
    if (els.contactPhone) els.contactPhone.value = '';
    if (els.email) els.email.value = '';
    if (els.paymentTerms) els.paymentTerms.value = '';
    if (els.address) els.address.value = '';
    if (els.notes) els.notes.value = '';
    if (els.active) els.active.checked = true;
  }

  function readForm() {
    const idRaw = els.id ? String(els.id.value || '').trim() : '';
    const id = idRaw ? Number(idRaw) : null;
    const name = els.name ? String(els.name.value || '').trim() : '';
    const payload = {
      name,
      contact_name: els.contactName ? (String(els.contactName.value || '').trim() || null) : null,
      contact_phone: els.contactPhone ? (String(els.contactPhone.value || '').trim() || null) : null,
      email: els.email ? (String(els.email.value || '').trim() || null) : null,
      payment_terms: els.paymentTerms ? (String(els.paymentTerms.value || '').trim() || null) : null,
      address: els.address ? (String(els.address.value || '').trim() || null) : null,
      notes: els.notes ? (String(els.notes.value || '').trim() || null) : null,
      is_active: els.active ? Boolean(els.active.checked) : true,
    };
    return { id: Number.isInteger(id) && id > 0 ? id : null, payload };
  }

  function fillForm(s) {
    if (els.id) els.id.value = s && s.id ? String(s.id) : '';
    if (els.name) els.name.value = s && s.name ? String(s.name) : '';
    if (els.contactName) els.contactName.value = s && s.contact_name ? String(s.contact_name) : '';
    if (els.contactPhone) els.contactPhone.value = s && s.contact_phone ? String(s.contact_phone) : '';
    if (els.email) els.email.value = s && s.email ? String(s.email) : '';
    if (els.paymentTerms) els.paymentTerms.value = s && s.payment_terms ? String(s.payment_terms) : '';
    if (els.address) els.address.value = s && s.address ? String(s.address) : '';
    if (els.notes) els.notes.value = s && s.notes ? String(s.notes) : '';
    if (els.active) els.active.checked = s ? (s.is_active !== false) : true;
  }

  async function loadSuppliers() {
    setError('');
    const data = await adminApiRequest('/api/admin/suppliers');
    const rows = data.suppliers || [];
    if (!els.tbody) return;
    els.tbody.textContent = '';

    for (const s of rows) {
      const isActive = s.is_active !== false;

      const editBtn = el('button', {
        class: 'admin-link-btn',
        type: 'button',
        text: '編輯',
        onclick: () => { fillForm(s); openModal(false); },
      });

      const toggleBtn = el('button', {
        class: 'admin-link-btn',
        type: 'button',
        text: isActive ? '停用' : '啟用',
        onclick: async () => {
          try {
            setError('');
            await adminApiRequest('/api/admin/suppliers/' + encodeURIComponent(String(s.id)), {
              method: 'PUT',
              json: {
                name: s.name,
                contact_name: s.contact_name || null,
                contact_phone: s.contact_phone || null,
                email: s.email || null,
                address: s.address || null,
                payment_terms: s.payment_terms || null,
                notes: s.notes || null,
                is_active: !isActive,
              }
            });
            await loadSuppliers();
          } catch (e) {
            setError(e && e.message ? e.message : String(e));
          }
        },
      });

      const contactLabel = [s.contact_name, s.contact_phone].filter(Boolean).join(' / ');
      const statusLabel = isActive ? '啟用' : '停用';

      els.tbody.appendChild(el('tr', {}, [
        el('td', { text: s.name || '' }),
        el('td', { text: contactLabel }),
        el('td', { text: s.email || '' }),
        el('td', { text: statusLabel }),
        el('td', {}, [editBtn, el('span', { text: ' ' }), toggleBtn]),
      ]));
    }
  }

  async function saveSupplier() {
    setError('');
    const { id, payload } = readForm();
    if (!payload.name) {
      setError('供應商名稱必填');
      return;
    }
    if (id) {
      await adminApiRequest('/api/admin/suppliers/' + encodeURIComponent(String(id)), { method: 'PUT', json: payload });
    } else {
      await adminApiRequest('/api/admin/suppliers', { method: 'POST', json: payload });
    }
    clearForm();
    await loadSuppliers();
    closeModal();
  }

  if (els.reset) els.reset.addEventListener('click', () => clearForm());
  if (els.save) els.save.addEventListener('click', () => saveSupplier().catch((e) => setError(e.message)));
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
    await loadSuppliers();
  } catch (e) {
    setError(e && e.message ? e.message : String(e));
  }
})();
