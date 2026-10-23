(async function () {
  const { $, el, adminApiRequest } = window.AdminCommon;

  const els = {
    status: $('#returns-status'),
    refresh: $('#returns-refresh'),
    error: $('#returns-error'),
    tbody: $('#returns-tbody'),
    detail: $('#return-detail'),
    modal: $('#return-modal'),
    modalClose: $('#return-modal-close'),
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

  const statusLabel = {
    pending: '待審批',
    approved: '已批准',
    in_transit: '退回中',
    received: '已收貨',
    inspected: '已驗貨',
    refunded: '已退款',
    rejected: '已拒絕',
  };

  async function loadList() {
    setError('');
    els.tbody.textContent = '';
    els.detail.textContent = '請喺列表揀一張售後單';
    const params = new URLSearchParams();
    if (els.status.value) params.set('status', els.status.value);
    const data = await adminApiRequest('/api/admin/returns?' + params.toString());
    const rows = data.returns || [];
    for (const r of rows) {
      els.tbody.appendChild(el('tr', {}, [
        el('td', { text: String(r.id) }),
        el('td', { text: r.order_number || String(r.order_id) }),
        el('td', { text: r.username || '' }),
        el('td', { text: statusLabel[r.status] || r.status }),
        el('td', { text: r.created_at ? String(r.created_at) : '' }),
        el('td', {}, [el('button', { class: 'admin-link-btn', text: '打開', onclick: () => openDetail(r.id) })]),
      ]));
    }
  }

  async function openDetail(id) {
    setError('');
    openModal();
    els.detail.textContent = '載入中…';
    const data = await adminApiRequest('/api/admin/returns/' + encodeURIComponent(id));
    const rr = data.return_request;

    const statusSel = el('select', { class: 'admin-input' }, Object.entries(statusLabel).map(([k, v]) => el('option', { value: k, text: v })));
    statusSel.value = rr.status;

    const adminNote = el('textarea', { class: 'admin-input w-full', rows: '3' }, []);
    adminNote.value = rr.admin_note || '';

    const refundAmount = el('input', { class: 'admin-input w-full', type: 'number', step: '0.01', value: rr.refund_amount || '' });
    const tracking = el('input', { class: 'admin-input w-full', value: rr.tracking_number || '', placeholder: '退貨單號（可選）' });

    const saveBtn = el('button', {
      class: 'admin-btn',
      text: '更新售後狀態',
      onclick: async () => {
        saveBtn.disabled = true;
        try {
          await adminApiRequest('/api/admin/returns/' + encodeURIComponent(id) + '/status', {
            method: 'PUT',
            json: {
              status: statusSel.value,
              admin_note: adminNote.value || null,
              refund_amount: refundAmount.value || null,
              tracking_number: tracking.value || null,
            },
          });
          await loadList();
          await openDetail(id);
        } catch (e) {
          setError(e.message);
        } finally {
          saveBtn.disabled = false;
        }
      },
    });

    const createRefundBtn = el('button', {
      class: 'admin-btn-secondary',
      text: '建立退款單',
      onclick: async () => {
        const amount = Number(refundAmount.value || rr.refund_amount || rr.total_amount || 0);
        const reason = rr.reason || '售後退款';
        await adminApiRequest('/api/admin/refunds', {
          method: 'POST',
          json: { order_id: rr.order_id, reason, type: amount >= Number(rr.total_amount) ? 'full' : 'partial', amount },
        });
        alert('已建立退款單，請到「退款」頁審批/完成');
      },
    });

    els.detail.textContent = '';
    els.detail.appendChild(el('div', { class: 'space-y-2' }, [
      el('div', { class: 'font-bold', text: `售後 #${rr.id}` }),
      el('div', { text: `訂單：${rr.order_number || rr.order_id}／客戶：${rr.username || ''}` }),
      el('div', { text: `原因：${rr.reason || ''}` }),
      el('div', { text: `狀態：${statusLabel[rr.status] || rr.status}` }),
      el('label', { class: 'text-sm block' }, [el('div', { class: 'mb-1', text: '狀態' }), statusSel]),
      el('label', { class: 'text-sm block' }, [el('div', { class: 'mb-1', text: '退款金額（可選）' }), refundAmount]),
      el('label', { class: 'text-sm block' }, [el('div', { class: 'mb-1', text: '退貨單號（可選）' }), tracking]),
      el('label', { class: 'text-sm block' }, [el('div', { class: 'mb-1', text: '內部備註' }), adminNote]),
      el('div', { class: 'flex gap-2' }, [saveBtn, createRefundBtn]),
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

  try {
    await loadList();
  } catch (e) {
    setError(e.message);
  }
})();

