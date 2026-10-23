(async function () {
  const { $, el, adminApiRequest } = window.AdminCommon;

  const els = {
    userId: $('#af-user-id'),
    code: $('#af-code'),
    commissionRate: $('#af-commission-rate'),
    status: $('#af-status'),
    save: $('#af-save'),
    reset: $('#af-reset'),
    filter: $('#af-filter'),
    error: $('#af-error'),
    tbody: $('#af-tbody'),
    create: $('#af-create'),
    modal: $('#af-modal'),
    modalClose: $('#af-modal-close'),
    modalTitle: $('#af-modal-title'),
  };

  function openModal() {
    if (!els.modal) return;
    if (els.modalTitle) els.modalTitle.textContent = '新增聯盟會員（KOL）';
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
    if (els.userId) els.userId.value = '';
    if (els.code) els.code.value = '';
    if (els.commissionRate) els.commissionRate.value = '';
    if (els.status) els.status.value = 'pending';
  }

  function statusLabel(s) {
    if (s === 'active') return '啟用';
    if (s === 'suspended') return '暫停';
    if (s === 'pending') return '待審核';
    return s || '';
  }

  function isoToDisplay(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    const pad = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  async function loadAffiliates() {
    setError('');
    let path = '/api/admin/affiliates';
    if (els.filter && els.filter.value) {
      path += '?status=' + encodeURIComponent(els.filter.value);
    }
    const data = await adminApiRequest(path);
    const rows = data.affiliates || [];
    if (!els.tbody) return;
    els.tbody.textContent = '';

    for (const a of rows) {
      const userLabel = [a.username, a.email].filter(Boolean).join(' / ') || ('用戶 #' + a.user_id);

      els.tbody.appendChild(el('tr', {}, [
        el('td', { text: a.code || '' }),
        el('td', { text: userLabel }),
        el('td', { text: (a.commission_rate != null ? a.commission_rate : '') + '%' }),
        el('td', { text: String(a.total_conversions != null ? a.total_conversions : 0) }),
        el('td', { text: 'HK$' + String(a.total_commission != null ? a.total_commission : '0') }),
        el('td', { text: 'HK$' + String(a.paid_commission != null ? a.paid_commission : '0') }),
        el('td', { text: statusLabel(a.status) }),
        el('td', { text: isoToDisplay(a.created_at) }),
      ]));
    }
  }

  async function saveAffiliate() {
    setError('');
    const userIdRaw = els.userId ? String(els.userId.value || '').trim() : '';
    const user_id = userIdRaw === '' ? null : Number(userIdRaw);
    const code = els.code ? String(els.code.value || '').trim() : '';
    const commissionRateRaw = els.commissionRate ? String(els.commissionRate.value || '').trim() : '';
    const commission_rate = commissionRateRaw === '' ? null : Number(commissionRateRaw);
    const status = els.status ? els.status.value : 'pending';

    if (user_id === null || !Number.isInteger(user_id) || user_id <= 0) {
      setError('用戶 ID 必填');
      return;
    }
    if (!code) {
      setError('聯盟追蹤碼必填');
      return;
    }
    if (commission_rate === null || !Number.isFinite(commission_rate) || commission_rate < 0) {
      setError('佣金百分比必填（唔細過 0）');
      return;
    }

    await adminApiRequest('/api/admin/affiliates', {
      method: 'POST',
      json: { user_id, code, commission_rate, status },
    });
    clearForm();
    closeModal();
    await loadAffiliates();
  }

  if (els.reset) els.reset.addEventListener('click', () => clearForm());
  if (els.save) els.save.addEventListener('click', () => saveAffiliate().catch((e) => setError(e.message)));
  if (els.filter) els.filter.addEventListener('change', () => {
    loadAffiliates().catch((e) => setError(e.message));
  });
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
    await loadAffiliates();
  } catch (e) {
    setError(e && e.message ? e.message : String(e));
  }
})();
