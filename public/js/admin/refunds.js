(async function () {
  const { $, el, adminApiRequest } = window.AdminCommon;

  const els = {
    status: $('#refunds-status'),
    q: $('#refunds-q'),
    refresh: $('#refunds-refresh'),
    error: $('#refunds-error'),
    tbody: $('#refunds-tbody'),
    detail: $('#refund-detail'),
    modal: $('#refund-modal'),
    modalClose: $('#refund-modal-close'),
  };

  function openModal() {
    if (!els.modal) return;
    els.modal.classList.remove('hidden');
    els.modal.classList.add('flex');
  }

  function closeModal() {
    if (!els.modal) return;
    els.modal.classList.add('hidden');
    els.modal.classList.remove('flex');
  }

  function setError(msg) {
    if (!msg) {
      els.error.classList.add('hidden');
      els.error.textContent = '';
      return;
    }
    els.error.classList.remove('hidden');
    els.error.textContent = msg;
  }

  const statusLabel = { pending: '待審批', approved: '已批准', processing: '處理中', completed: '已完成', rejected: '已拒絕' };

  async function loadList() {
    setError('');
    els.tbody.textContent = '';
    els.detail.textContent = '請喺列表揀一張退款單';
    const params = new URLSearchParams();
    if (els.status.value) params.set('status', els.status.value);
    const q = (els.q.value || '').trim();
    if (q) params.set('q', q);
    const data = await adminApiRequest('/api/admin/refunds?' + params.toString());
    const rows = data.refunds || [];
    for (const r of rows) {
      els.tbody.appendChild(el('tr', {}, [
        el('td', { text: String(r.id) }),
        el('td', { text: r.order_number || String(r.order_id) }),
        el('td', { text: 'HK$ ' + Number(r.amount).toFixed(2) }),
        el('td', { text: statusLabel[r.status] || r.status }),
        el('td', {}, [el('button', { class: 'admin-link-btn', text: '打開', onclick: () => openDetail(r) })]),
      ]));
    }
  }

  async function openDetail(r) {
    openModal();
    els.detail.textContent = '';
    const approveBtn = el('button', {
      class: 'admin-btn',
      text: '批准',
      onclick: async () => {
        approveBtn.disabled = true;
        try {
          await adminApiRequest('/api/admin/refunds/' + r.id + '/approve', { method: 'POST', json: {} });
          await loadList();
        } catch (e) {
          setError(e.message);
        } finally {
          approveBtn.disabled = false;
        }
      },
    });
    const rejectBtn = el('button', {
      class: 'admin-btn-secondary',
      text: '拒絕',
      onclick: async () => {
        const note = prompt('拒絕原因（必填）');
        if (!note) return;
        await adminApiRequest('/api/admin/refunds/' + r.id + '/reject', { method: 'POST', json: { note } });
        await loadList();
      },
    });
    const completeBtn = el('button', {
      class: 'admin-btn',
      text: '完成退款',
      onclick: async () => {
        const tx = prompt('輸入退款憑證/交易號（必填）');
        if (!tx) return;
        await adminApiRequest('/api/admin/refunds/' + r.id + '/complete', { method: 'POST', json: { refund_transaction_id: tx } });
        await loadList();
      },
    });

    els.detail.appendChild(el('div', { class: 'space-y-2' }, [
      el('div', { class: 'font-bold', text: `退款 #${r.id}` }),
      el('div', { text: `訂單：${r.order_number || r.order_id}` }),
      el('div', { text: `金額：HK$ ${Number(r.amount).toFixed(2)}／狀態：${statusLabel[r.status] || r.status}` }),
      el('div', { class: 'flex gap-2' }, [approveBtn, rejectBtn, completeBtn]),
    ]));
  }

  if (els.modalClose) els.modalClose.addEventListener('click', closeModal);
  if (els.modal) els.modal.addEventListener('mousedown', (e) => {
    if (e.target === els.modal) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && els.modal && !els.modal.classList.contains('hidden')) closeModal();
  });
  els.refresh.addEventListener('click', () => loadList().catch((e) => setError(e.message)));
  els.status.addEventListener('change', () => loadList().catch((e) => setError(e.message)));
  els.q.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') loadList().catch((e) => setError(e.message));
  });

  await loadList();
})();

