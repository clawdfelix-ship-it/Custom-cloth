(async function () {
  const { $, el, adminApiRequest } = window.AdminCommon;

  const els = {
    date: $('#recon-date'),
    method: $('#recon-method'),
    run: $('#recon-run'),
    error: $('#recon-error'),
    summary: $('#recon-summary'),
    missingTx: $('#recon-missing-tx'),
    mismatch: $('#recon-mismatch'),
    missingOrder: $('#recon-missing-order'),
  };

  function setError(msg) {
    if (!msg) {
      els.error.classList.add('hidden');
      els.error.textContent = '';
      return;
    }
    els.error.classList.remove('hidden');
    els.error.textContent = msg;
  }

  function money(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return String(n ?? '');
    return 'HK$ ' + x.toFixed(2);
  }

  function renderList(container, rows, renderRow) {
    container.textContent = '';
    if (!rows || rows.length === 0) {
      container.appendChild(el('div', { class: 'text-gray-500', text: '（無）' }));
      return;
    }
    for (const r of rows) container.appendChild(renderRow(r));
  }

  async function run() {
    setError('');
    const date = els.date.value;
    if (!date) {
      setError('請先選日期');
      return;
    }
    const params = new URLSearchParams();
    params.set('date', date);
    const method = (els.method.value || '').trim();
    if (method) params.set('payment_method_code', method);

    const out = await adminApiRequest('/api/admin/reconciliation/daily?' + params.toString());
    els.summary.textContent =
      `matched=${out.matched.length} / missing_transaction=${out.missing_transaction.length} / amount_mismatch=${out.amount_mismatch.length} / missing_order=${out.missing_order.length}`;

    renderList(els.missingTx, out.missing_transaction, (x) =>
      el('div', { class: 'py-1 border-b border-gray-200', text: `訂單 #${x.order.id} 金額 ${money(x.order.total_amount)}` })
    );
    renderList(els.mismatch, out.amount_mismatch, (x) =>
      el('div', { class: 'py-1 border-b border-gray-200', text: `訂單 #${x.order.id} 訂單金額 ${money(x.order.total_amount)}（交易數：${x.transactions.length}）` })
    );
    renderList(els.missingOrder, out.missing_order, (x) =>
      el('div', { class: 'py-1 border-b border-gray-200', text: `交易 ${x.transaction.payment_method_code}:${x.transaction.transaction_id} 訂單ID=${x.transaction.order_id} 金額 ${money(x.transaction.amount)}` })
    );
  }

  const today = new Date();
  els.date.value = today.toISOString().slice(0, 10);
  els.run.addEventListener('click', () => run().catch((e) => setError(e.message)));
})();

