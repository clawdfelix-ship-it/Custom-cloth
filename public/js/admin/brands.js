(async function () {
  const { $, el, adminApiRequest } = window.AdminCommon;

  const els = {
    id: $('#brand-id'),
    name: $('#brand-name'),
    slug: $('#brand-slug'),
    imageUrl: $('#brand-image-url'),
    website: $('#brand-website'),
    description: $('#brand-description'),
    sortOrder: $('#brand-sort-order'),
    active: $('#brand-active'),
    save: $('#brand-save'),
    reset: $('#brand-reset'),
    error: $('#brand-error'),
    tbody: $('#brand-tbody'),
    create: $('#brand-create'),
    modal: $('#brand-modal'),
    modalClose: $('#brand-modal-close'),
    modalTitle: $('#brand-modal-title'),
  };

  function openModal(isNew) {
    if (!els.modal) return;
    if (els.modalTitle) els.modalTitle.textContent = isNew ? '新增品牌' : '編輯品牌';
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
    if (els.slug) els.slug.value = '';
    if (els.imageUrl) els.imageUrl.value = '';
    if (els.website) els.website.value = '';
    if (els.description) els.description.value = '';
    if (els.sortOrder) els.sortOrder.value = '0';
    if (els.active) els.active.checked = true;
  }

  function readForm() {
    const idRaw = els.id ? String(els.id.value || '').trim() : '';
    const id = idRaw ? Number(idRaw) : null;
    const name = els.name ? String(els.name.value || '').trim() : '';
    const slug = els.slug ? String(els.slug.value || '').trim() : '';
    const sortRaw = els.sortOrder ? String(els.sortOrder.value || '').trim() : '';
    const sortOrder = sortRaw === '' ? 0 : parseInt(sortRaw, 10);
    const payload = {
      name,
      slug,
      description: els.description ? (String(els.description.value || '').trim() || null) : null,
      image_url: els.imageUrl ? (String(els.imageUrl.value || '').trim() || null) : null,
      website: els.website ? (String(els.website.value || '').trim() || null) : null,
      sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
      is_active: els.active ? Boolean(els.active.checked) : true,
    };
    return { id: Number.isInteger(id) && id > 0 ? id : null, payload };
  }

  function fillForm(b) {
    if (els.id) els.id.value = b && b.id ? String(b.id) : '';
    if (els.name) els.name.value = b && b.name ? String(b.name) : '';
    if (els.slug) els.slug.value = b && b.slug ? String(b.slug) : '';
    if (els.imageUrl) els.imageUrl.value = b && b.image_url ? String(b.image_url) : '';
    if (els.website) els.website.value = b && b.website ? String(b.website) : '';
    if (els.description) els.description.value = b && b.description ? String(b.description) : '';
    if (els.sortOrder) els.sortOrder.value = b && b.sort_order !== undefined && b.sort_order !== null ? String(b.sort_order) : '0';
    if (els.active) els.active.checked = b ? (b.is_active !== false) : true;
  }

  async function loadBrands() {
    setError('');
    const data = await adminApiRequest('/api/admin/brands');
    const rows = data.brands || [];
    if (!els.tbody) return;
    els.tbody.textContent = '';

    for (const b of rows) {
      const isActive = b.is_active !== false;

      const editBtn = el('button', {
        class: 'admin-link-btn',
        type: 'button',
        text: '編輯',
        onclick: () => { fillForm(b); openModal(false); },
      });

      const toggleBtn = el('button', {
        class: 'admin-link-btn',
        type: 'button',
        text: isActive ? '停用' : '啟用',
        onclick: async () => {
          try {
            setError('');
            await adminApiRequest('/api/admin/brands/' + encodeURIComponent(String(b.id)), {
              method: 'PUT',
              json: {
                name: b.name,
                slug: b.slug,
                description: b.description || null,
                image_url: b.image_url || null,
                website: b.website || null,
                sort_order: Number.isFinite(Number(b.sort_order)) ? Number(b.sort_order) : 0,
                is_active: !isActive,
              },
            });
            await loadBrands();
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
          if (!confirm('確定刪除品牌「' + b.name + '」？（品牌仲有產品會刪唔到）')) return;
          try {
            setError('');
            await adminApiRequest('/api/admin/brands/' + encodeURIComponent(String(b.id)), {
              method: 'DELETE',
            });
            await loadBrands();
          } catch (e) {
            setError(e && e.message ? e.message : String(e));
          }
        },
      });

      const nameCell = el('div', { class: 'flex items-center gap-2' });
      if (b.image_url) {
        nameCell.appendChild(el('img', {
          src: String(b.image_url),
          alt: '',
          style: 'width:32px;height:32px;border-radius:6px;object-fit:cover;background:#f3f4f6;',
        }));
      }
      nameCell.appendChild(el('span', { class: 'font-bold', text: b.name || '' }));

      const statusBadge = el('span', {
        class: 'admin-badge ' + (isActive ? 'badge-active' : 'badge-inactive'),
        text: isActive ? '啟用' : '停用',
      });

      els.tbody.appendChild(el('tr', {}, [
        el('td', {}, [nameCell]),
        el('td', { text: b.slug || '' }),
        el('td', { text: String(b.product_count !== undefined ? b.product_count : 0) }),
        el('td', { text: String(b.sort_order ?? 0) }),
        el('td', {}, [statusBadge]),
        el('td', {}, [editBtn, el('span', { text: ' ' }), toggleBtn, el('span', { text: ' ' }), deleteBtn]),
      ]));
    }
  }

  async function saveBrand() {
    setError('');
    const { id, payload } = readForm();
    if (!payload.name) {
      setError('品牌名稱必填');
      return;
    }
    if (!payload.slug) {
      setError('Slug 必填（例如 brand-name）');
      return;
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(payload.slug)) {
      setError('Slug 只可以用細寫英文、數字同減號，例如 my-brand');
      return;
    }
    if (els.save) els.save.disabled = true;
    try {
      if (id) {
        await adminApiRequest('/api/admin/brands/' + encodeURIComponent(String(id)), { method: 'PUT', json: payload });
      } else {
        await adminApiRequest('/api/admin/brands', { method: 'POST', json: payload });
      }
      clearForm();
      await loadBrands();
      closeModal();
    } finally {
      if (els.save) els.save.disabled = false;
    }
  }

  if (els.reset) els.reset.addEventListener('click', () => clearForm());
  if (els.save) els.save.addEventListener('click', () => saveBrand().catch((e) => setError(e.message)));
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
    await loadBrands();
  } catch (e) {
    setError(e && e.message ? e.message : String(e));
  }
})();
