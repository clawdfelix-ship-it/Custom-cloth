(async function () {
  // 後端合約（routes/members.js，user_tags 表 id/name/description/color/created_at）：
  //   GET  /api/admin/user-tags        → { tags:[...] }
  //   POST /api/admin/user-tags        body: { name, description, color }
  // Route 冇提供 update / delete / assignment 端點，呢頁只做新增同列表。
  const { $, el, adminApiRequest } = window.AdminCommon;

  const els = {
    name: $('#ut-name'),
    color: $('#ut-color'),
    colorText: $('#ut-color-text'),
    description: $('#ut-description'),
    save: $('#ut-save'),
    reset: $('#ut-reset'),
    refresh: $('#ut-refresh'),
    create: $('#ut-create'),
    error: $('#ut-error'),
    tbody: $('#ut-tbody'),
    modal: $('#ut-modal'),
    modalClose: $('#ut-modal-close'),
    modalTitle: $('#ut-modal-title'),
  };

  function openModal() {
    if (!els.modal) return;
    if (els.modalTitle) els.modalTitle.textContent = '新增用戶標籤';
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
      els.error.classList.remove('whitespace-pre-line');
      els.error.textContent = '';
      return;
    }
    els.error.classList.remove('hidden');
    els.error.classList.add('whitespace-pre-line');
    els.error.textContent = msg;
  }

  function clearForm() {
    if (els.name) els.name.value = '';
    if (els.color) els.color.value = '#4f46e5';
    if (els.colorText) els.colorText.value = '';
    if (els.description) els.description.value = '';
  }

  // color 欄位係 VARCHAR(20)，接受 hex 或顏色名；文字框優先
  function readColor() {
    const fromText = els.colorText ? String(els.colorText.value || '').trim() : '';
    if (fromText) return fromText.slice(0, 20);
    return els.color ? String(els.color.value || '').trim() : null;
  }

  function formatTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    const pad = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  // 判斷個顏色字串可唔可以直接做 CSS 顏色
  function colorSwatch(color) {
    if (!color) return el('span', { text: '—' });
    const chip = el('span', {
        class: 'inline-block h-4 w-4 rounded border border-black/20 align-middle',
        title: color,
      });
    chip.style.backgroundColor = color;
    return el('span', {}, [chip, el('span', { text: ' ' + color })]);
  }

  async function loadTags() {
    setError('');
    const data = await adminApiRequest('/api/admin/user-tags');
    const rows = data.tags || [];

    if (!els.tbody) return;
    els.tbody.textContent = '';
    for (const t of rows) {
      els.tbody.appendChild(el('tr', {}, [
        el('td', { text: t.name || '' }),
        el('td', { text: t.description || '—' }),
        el('td', {}, [colorSwatch(t.color)]),
        el('td', { text: formatTime(t.created_at) }),
      ]));
    }
  }

  async function saveTag() {
    setError('');
    const name = els.name ? String(els.name.value || '').trim() : '';
    if (!name) {
      setError('標籤名稱必填');
      return;
    }
    const payload = {
      name: name.slice(0, 50),
      description: els.description ? (String(els.description.value || '').trim() || null) : null,
      color: readColor(),
    };
    await adminApiRequest('/api/admin/user-tags', { method: 'POST', json: payload });
    clearForm();
    await loadTags();
    closeModal();
  }

  if (els.save) els.save.addEventListener('click', () => saveTag().catch((e) => setError(e.message)));
  if (els.reset) els.reset.addEventListener('click', () => clearForm());
  if (els.create) els.create.addEventListener('click', () => { clearForm(); openModal(); });
  if (els.refresh) els.refresh.addEventListener('click', () => {
    loadTags().catch((e) => setError(e && e.message ? e.message : String(e)));
  });
  if (els.modalClose) els.modalClose.addEventListener('click', closeModal);
  if (els.modal) els.modal.addEventListener('mousedown', (e) => {
    if (e.target === els.modal) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && els.modal && !els.modal.classList.contains('hidden')) closeModal();
  });

  try {
    clearForm();
    await loadTags();
  } catch (e) {
    setError(e && e.message ? e.message : String(e));
  }
})();
