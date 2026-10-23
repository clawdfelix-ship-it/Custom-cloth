(async function () {
  const { $, el, adminApiRequest } = window.AdminCommon;

  const els = {
    supplier: $('#po-supplier'),
    eta: $('#po-eta'),
    notes: $('#po-notes'),
    items: $('#po-items'),
    itemsToggle: $('#po-items-toggle'),
    itemsBox: $('#po-items-box'),
    skuSearch: $('#po-sku-search'),
    skuResults: $('#po-sku-results'),
    createItems: $('#po-create-items'),
    create: $('#po-create'),
    error: $('#po-error'),
    tbody: $('#po-tbody'),
    detail: $('#po-detail'),
    manualToggle: $('#po-manual-toggle'),
    manualBox: $('#po-manual-box'),
    modal: $('#po-modal'),
    modalClose: $('#po-modal-close'),
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
    if (!els.error) return;
    if (!msg) {
      els.error.classList.add('hidden');
      els.error.textContent = '';
      return;
    }
    els.error.classList.remove('hidden');
    els.error.textContent = msg;
  }

  function money(n) {
    if (n === null || n === undefined) return '';
    const x = Number(n);
    if (Number.isNaN(x)) return String(n);
    return 'HK$ ' + x.toFixed(2);
  }

  function buildOptions(select, options, includeEmpty, emptyLabel) {
    if (!select) return;
    select.textContent = '';
    if (includeEmpty) select.appendChild(el('option', { value: '', text: emptyLabel || '請選擇' }));
    for (const o of options) select.appendChild(el('option', { value: String(o.value), text: o.text }));
  }

  function parseItemsTextarea() {
    const raw = els.items ? String(els.items.value || '') : '';
    const lines = raw.split('\n').map((s) => s.trim()).filter(Boolean);
    const items = [];
    for (const line of lines) {
      const parts = line.split(',').map((s) => s.trim());
      const skuId = Number(parts[0]);
      const qty = parseInt(parts[1], 10);
      const cost = Number(parts[2]);
      if (!Number.isInteger(skuId) || skuId <= 0) throw new Error('items sku_id 不正確');
      if (!Number.isInteger(qty) || qty <= 0) throw new Error('items quantity 不正確');
      if (!Number.isFinite(cost) || cost < 0) throw new Error('items cost_price 不正確');
      items.push({ sku_id: skuId, quantity: qty, cost_price: cost });
    }
    return items;
  }

  function parseReceiveLines(textareaEl) {
    const raw = textareaEl ? String(textareaEl.value || '') : '';
    const lines = raw.split('\n').map((s) => s.trim()).filter(Boolean);
    const out = [];
    for (const line of lines) {
      const parts = line.split(',').map((s) => s.trim());
      const skuId = Number(parts[0]);
      const qty = parseInt(parts[1], 10);
      const note = parts.slice(2).join(',').trim();
      if (!Number.isInteger(skuId) || skuId <= 0) throw new Error('收貨 sku_id 不正確');
      if (!Number.isInteger(qty) || qty <= 0) throw new Error('收貨 quantity 不正確');
      out.push({ sku_id: skuId, quantity: qty, note: note || null });
    }
    return out;
  }

  function getWarehouseOptions() {
    return warehouses
      .filter((w) => w.is_active !== false)
      .map((w) => ({ value: w.id, text: (w.is_default ? '（預設）' : '') + (w.name || `#${w.id}`) }));
  }

  function buildInventoryLink(skuId) {
    if (!skuId) return null;
    return '/admin/inventory?sku_id=' + encodeURIComponent(String(skuId));
  }

  function toPositiveIntOrNull(v) {
    const n = parseInt(String(v || '').trim() || '0', 10);
    if (!Number.isInteger(n) || n <= 0) return null;
    return n;
  }

  function toNonNegativeNumberOrNull(v) {
    const x = Number(String(v || '').trim());
    if (!Number.isFinite(x) || x < 0) return null;
    return x;
  }

  function wireNumericInput(input, { clearZeroOnFocus = false } = {}) {
    if (!input) return;
    input.addEventListener('focus', () => {
      if (clearZeroOnFocus && String(input.value || '').trim() === '0') input.value = '';
      if (typeof input.select === 'function') input.select();
    });
    input.addEventListener('wheel', (e) => {
      if (document.activeElement !== input) return;
      e.preventDefault();
      input.blur();
    }, { passive: false });
  }

  let suppliers = [];
  let warehouses = [];
  let currentPoId = null;
  let createItems = [];

  async function loadSuppliers() {
    const data = await adminApiRequest('/api/admin/suppliers');
    suppliers = (data.suppliers || []).filter((s) => s.is_active !== false);
    const opts = suppliers.map((s) => ({ value: s.id, text: s.name || `#${s.id}` }));
    buildOptions(els.supplier, opts, true, '請選擇供應商');
  }

  async function loadWarehouses() {
    try {
      const data = await adminApiRequest('/api/admin/warehouses');
      warehouses = data.warehouses || [];
    } catch (e) {
      warehouses = [];
    }
  }

  async function loadPurchaseOrders() {
    setError('');
    const params = new URLSearchParams({ page: '1', page_size: '50' });
    const data = await adminApiRequest('/api/admin/purchase-orders?' + params.toString());
    const rows = data.purchase_orders || [];
    if (!els.tbody) return;
    els.tbody.textContent = '';

    for (const po of rows) {
      const openBtn = el('button', {
        class: 'admin-link-btn',
        type: 'button',
        text: '打開',
        onclick: () => openPurchaseOrder(po.id),
      });
      const eta = po.expected_arrival_date ? String(po.expected_arrival_date) : '';
      els.tbody.appendChild(el('tr', {}, [
        el('td', { text: po.po_number || `#${po.id}` }),
        el('td', { text: po.supplier_name || '' }),
        el('td', { text: po.status || '' }),
        el('td', { text: money(po.total_amount) }),
        el('td', { text: eta }),
        el('td', {}, [openBtn]),
      ]));
    }
  }

  function renderCreateItems() {
    if (!els.createItems) return;
    els.createItems.textContent = '';

    if (!createItems || createItems.length === 0) {
      els.createItems.appendChild(el('div', { class: 'text-sm text-gray-600', text: '尚未加入 items' }));
      return;
    }

    const tbody = el('tbody', {});
    for (const it of createItems) {
      const qtyInput = el('input', { class: 'admin-input', type: 'number', step: '1', min: '1', value: String(it.quantity || 1) });
      const costInput = el('input', { class: 'admin-input', type: 'number', step: '0.01', min: '0', value: String(it.cost_price ?? 0) });
      const removeBtn = el('button', {
        class: 'admin-link-btn',
        type: 'button',
        text: '移除',
        onclick: () => {
          createItems = createItems.filter((x) => x.sku_id !== it.sku_id);
          renderCreateItems();
        }
      });

      wireNumericInput(qtyInput);
      wireNumericInput(costInput, { clearZeroOnFocus: true });
      qtyInput.addEventListener('input', () => {
        const n = toPositiveIntOrNull(qtyInput.value);
        it.quantity = n || 1;
      });
      costInput.addEventListener('input', () => {
        const x = toNonNegativeNumberOrNull(costInput.value);
        it.cost_price = x === null ? 0 : x;
      });

      const skuLabel = [it.sku, it.barcode].filter(Boolean).join(' / ');
      tbody.appendChild(el('tr', {}, [
        el('td', { text: it.product_name || '' }),
        el('td', { text: it.sku_id ? `#${it.sku_id}${skuLabel ? ' | ' + skuLabel : ''}` : '' }),
        el('td', {}, [qtyInput]),
        el('td', {}, [costInput]),
        el('td', {}, [removeBtn]),
      ]));
    }

    els.createItems.appendChild(el('table', { class: 'admin-table mt-2' }, [
      el('thead', {}, [el('tr', {}, [
        el('th', { text: '商品' }),
        el('th', { text: 'SKU' }),
        el('th', { text: '數量' }),
        el('th', { text: '成本價' }),
        el('th', { text: '' }),
      ])]),
      tbody,
    ]));
  }

  function hideSkuResults() {
    if (!els.skuResults) return;
    els.skuResults.classList.add('hidden');
    els.skuResults.textContent = '';
  }

  function renderSkuResults(skus) {
    if (!els.skuResults) return;
    els.skuResults.textContent = '';
    if (!skus || skus.length === 0) {
      hideSkuResults();
      return;
    }
    els.skuResults.classList.remove('hidden');
    for (const s of skus) {
      const labelParts = [
        s.product_name || '',
        s.sku ? `SKU:${s.sku}` : null,
        s.barcode ? `條碼:${s.barcode}` : null,
        typeof s.stock !== 'undefined' ? `庫存:${s.stock}` : null,
        typeof s.cost_price !== 'undefined' ? `成本:${money(s.cost_price)}` : null,
        s.id ? `#${s.id}` : null,
      ].filter(Boolean);
      const btn = el('button', {
        type: 'button',
        class: 'w-full text-left px-2 py-2 hover:bg-gray-50',
        text: labelParts.join(' | '),
        onclick: () => {
          const skuId = Number(s.id);
          if (!Number.isInteger(skuId) || skuId <= 0) return;
          const existing = createItems.find((x) => x.sku_id === skuId);
          if (existing) {
            existing.quantity = Number(existing.quantity || 0) + 1;
          } else {
            const cost = toNonNegativeNumberOrNull(s.cost_price);
            createItems.push({
              sku_id: skuId,
              sku: s.sku || null,
              barcode: s.barcode || null,
              product_name: s.product_name || '',
              quantity: 1,
              cost_price: cost === null ? 0 : cost,
            });
          }
          renderCreateItems();
          if (els.skuSearch) els.skuSearch.value = '';
          hideSkuResults();
        }
      });
      els.skuResults.appendChild(btn);
    }
  }

  let skuSearchTimer = null;
  let skuSearchSeq = 0;
  async function searchSkusForCreate(q) {
    const query = String(q || '').trim();
    if (!query) {
      hideSkuResults();
      return;
    }
    const seq = ++skuSearchSeq;
    const params = new URLSearchParams({ q: query, limit: '20' });
    const data = await adminApiRequest('/api/admin/inventory/skus?' + params.toString());
    if (seq !== skuSearchSeq) return;
    renderSkuResults(data.skus || []);
  }

  async function createPurchaseOrder() {
    setError('');
    const supplierId = els.supplier ? Number(els.supplier.value) : NaN;
    if (!Number.isInteger(supplierId) || supplierId <= 0) {
      setError('請先選擇供應商');
      return;
    }
    let items = [];
    if (createItems && createItems.length > 0) {
      for (const it of createItems) {
        const skuId = Number(it.sku_id);
        const qty = toPositiveIntOrNull(it.quantity);
        const cost = toNonNegativeNumberOrNull(it.cost_price);
        if (!Number.isInteger(skuId) || skuId <= 0) throw new Error('items sku_id 不正確');
        if (!qty) throw new Error('items quantity 不正確');
        if (cost === null) throw new Error('items cost_price 不正確');
        items.push({ sku_id: skuId, quantity: qty, cost_price: cost });
      }
    } else {
      items = parseItemsTextarea();
    }
    if (!items || items.length === 0) {
      setError('請加入 items');
      return;
    }
    const payload = {
      supplier_id: supplierId,
      expected_arrival_date: els.eta ? (String(els.eta.value || '').trim() || null) : null,
      notes: els.notes ? (String(els.notes.value || '').trim() || null) : null,
      items,
    };
    const r = await adminApiRequest('/api/admin/purchase-orders', { method: 'POST', json: payload });
    if (els.items) els.items.value = '';
    createItems = [];
    renderCreateItems();
    await loadPurchaseOrders();
    if (r && r.purchase_order_id) await openPurchaseOrder(r.purchase_order_id);
  }

  function renderPoDetail(po, items) {
    if (!els.detail) return;
    els.detail.textContent = '';
    if (!po) {
      els.detail.textContent = '請先喺上面揀一張採購單';
      return;
    }

    const statusSelect = el('select', { class: 'admin-input' }, [
      el('option', { value: 'draft', text: 'draft' }),
      el('option', { value: 'ordered', text: 'ordered' }),
      el('option', { value: 'received', text: 'received' }),
      el('option', { value: 'cancelled', text: 'cancelled' }),
    ]);
    statusSelect.value = po.status || 'draft';

    const setReceivedBtn = el('button', {
      class: 'admin-btn-secondary',
      type: 'button',
      text: '設為 received',
      onclick: async () => {
        setReceivedBtn.disabled = true;
        try {
          await adminApiRequest('/api/admin/purchase-orders/' + encodeURIComponent(String(po.id)) + '/status', {
            method: 'PUT',
            json: { status: 'received' }
          });
          await loadPurchaseOrders();
          await openPurchaseOrder(po.id);
        } catch (e) {
          setError(e && e.message ? e.message : String(e));
        } finally {
          setReceivedBtn.disabled = false;
        }
      }
    });

    const saveStatusBtn = el('button', {
      class: 'admin-btn-secondary',
      type: 'button',
      text: '更新狀態',
      onclick: async () => {
        saveStatusBtn.disabled = true;
        try {
          await adminApiRequest('/api/admin/purchase-orders/' + encodeURIComponent(String(po.id)) + '/status', {
            method: 'PUT',
            json: { status: statusSelect.value }
          });
          await loadPurchaseOrders();
          await openPurchaseOrder(po.id);
        } catch (e) {
          setError(e && e.message ? e.message : String(e));
        } finally {
          saveStatusBtn.disabled = false;
        }
      }
    });

    const whSelect = el('select', { class: 'admin-input' }, []);
    const whOpts = getWarehouseOptions();
    buildOptions(whSelect, whOpts, true, '自動（預設倉庫）');

    const receiveModel = (items || []).map((it) => {
      const qty = Number(it.quantity || 0);
      const recv = Number(it.received_quantity || 0);
      const remaining = Math.max(0, qty - recv);
      return {
        sku_id: it.sku_id ? Number(it.sku_id) : null,
        product_name: it.product_name || '',
        quantity: qty,
        received: recv,
        remaining,
        cost_price: it.cost_price,
        receive_input: null,
        note_input: null,
      };
    });

    const receivingTbody = el('tbody', {});
    for (const row of receiveModel) {
      const skuLink = row.sku_id ? el('a', { class: 'admin-link-btn', href: buildInventoryLink(row.sku_id), text: `#${row.sku_id}` }) : el('span', { text: '' });
      const recvInput = el('input', { class: 'admin-input', type: 'number', inputmode: 'numeric', step: '1', min: '0', max: String(row.remaining), value: '', placeholder: '0' });
      const noteInput = el('input', { class: 'admin-input', placeholder: '備註（可選）' });
      row.receive_input = recvInput;
      row.note_input = noteInput;
      wireNumericInput(recvInput, { clearZeroOnFocus: true });

      receivingTbody.appendChild(el('tr', {}, [
        el('td', { text: row.product_name || '' }),
        el('td', {}, [skuLink]),
        el('td', { text: String(row.quantity) }),
        el('td', { text: String(row.received) }),
        el('td', { text: String(row.remaining) }),
        el('td', { text: money(row.cost_price) }),
        el('td', {}, [recvInput]),
        el('td', {}, [noteInput]),
      ]));
    }

    const receivingTable = el('table', { class: 'admin-table mt-2' }, [
      el('thead', {}, [el('tr', {}, [
        el('th', { text: '商品' }),
        el('th', { text: 'SKU' }),
        el('th', { text: '採購' }),
        el('th', { text: '已收' }),
        el('th', { text: '未收' }),
        el('th', { text: '成本' }),
        el('th', { text: '本次收貨' }),
        el('th', { text: '備註' }),
      ])]),
      receivingTbody,
    ]);

    const fillRemainingBtn = el('button', {
      class: 'admin-btn-secondary',
      type: 'button',
      text: '填滿未收',
      onclick: () => {
        for (const row of receiveModel) {
          if (!row.receive_input) continue;
          const n = Math.max(0, Number(row.remaining || 0));
          row.receive_input.value = n > 0 ? String(n) : '0';
        }
      }
    });

    const submitReceivingBtn = el('button', {
      class: 'admin-btn',
      type: 'button',
      text: '提交收貨入庫',
      onclick: async () => {
        submitReceivingBtn.disabled = true;
        try {
          setError('');
          const lines = [];
          for (const row of receiveModel) {
            const skuId = row.sku_id;
            const qty = row.receive_input ? parseInt(String(row.receive_input.value || '').trim() || '0', 10) : 0;
            const note = row.note_input ? (String(row.note_input.value || '').trim() || null) : null;
            if (!Number.isInteger(qty) || qty < 0) throw new Error('本次收貨數量不正確');
            if (qty === 0) continue;
            if (qty > row.remaining) throw new Error(`SKU #${skuId} 收貨數量超過未收`);
            lines.push({ sku_id: skuId, quantity: qty, note });
          }
          if (lines.length === 0) {
            setError('請輸入本次收貨數量');
            return;
          }

          const payload = { lines };
          if (whSelect.value) payload.warehouse_id = Number(whSelect.value);
          await adminApiRequest('/api/admin/purchase-orders/' + encodeURIComponent(String(po.id)) + '/receive', {
            method: 'POST',
            json: payload
          });
          await loadPurchaseOrders();
          await openPurchaseOrder(po.id);
        } catch (e) {
          setError(e && e.message ? e.message : String(e));
        } finally {
          submitReceivingBtn.disabled = false;
        }
      }
    });

    const allReceived = receiveModel.length > 0 && receiveModel.every((r) => Number(r.remaining || 0) === 0);
    setReceivedBtn.disabled = !allReceived;

    els.detail.appendChild(el('div', { class: 'space-y-2' }, [
      el('div', { class: 'font-bold', text: po.po_number ? `採購單 ${po.po_number}` : `採購單 #${po.id}` }),
      el('div', { text: po.supplier_name ? `供應商：${po.supplier_name}` : '' }),
      el('div', { text: `狀態：${po.status || ''}` }),
      el('div', { text: `金額：${money(po.total_amount)}` }),
      el('div', { class: 'grid gap-2' }, [
        el('label', { class: 'text-sm' }, [el('div', { class: 'mb-1', text: '狀態' }), statusSelect]),
        el('div', { class: 'flex gap-2 flex-wrap' }, [saveStatusBtn, setReceivedBtn]),
      ]),
      el('label', { class: 'text-sm block' }, [el('div', { class: 'mb-1', text: '倉庫（可選）' }), whSelect]),
      el('div', { class: 'flex gap-2 flex-wrap' }, [fillRemainingBtn, submitReceivingBtn]),
      receivingTable,
    ]));

    if (els.manualBox) {
      els.manualBox.textContent = '';
      const receiveLines = el('textarea', { class: 'admin-input w-full', rows: '4', placeholder: '每行：sku_id,quantity,備註(可選)' }, []);
      const manualBtn = el('button', {
        class: 'admin-btn-secondary',
        type: 'button',
        text: '手動提交（進階）',
        onclick: async () => {
          manualBtn.disabled = true;
          try {
            setError('');
            const lines = parseReceiveLines(receiveLines);
            const payload = { lines };
            if (whSelect.value) payload.warehouse_id = Number(whSelect.value);
            await adminApiRequest('/api/admin/purchase-orders/' + encodeURIComponent(String(po.id)) + '/receive', {
              method: 'POST',
              json: payload
            });
            receiveLines.value = '';
            await loadPurchaseOrders();
            await openPurchaseOrder(po.id);
          } catch (e) {
            setError(e && e.message ? e.message : String(e));
          } finally {
            manualBtn.disabled = false;
          }
        }
      });
      els.manualBox.appendChild(el('div', { class: 'space-y-2' }, [
        el('div', { class: 'text-sm text-gray-700', text: '手動輸入（每行：sku_id,quantity,備註）' }),
        receiveLines,
        manualBtn,
      ]));
    }
  }

  async function openPurchaseOrder(id) {
    setError('');
    currentPoId = id;
    openModal();
    if (els.detail) els.detail.textContent = '載入中…';
    const data = await adminApiRequest('/api/admin/purchase-orders/' + encodeURIComponent(String(id)));
    renderPoDetail(data.purchase_order, data.items || []);
  }

  if (els.modalClose) els.modalClose.addEventListener('click', closeModal);
  if (els.modal) els.modal.addEventListener('mousedown', (e) => {
    if (e.target === els.modal) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && els.modal && !els.modal.classList.contains('hidden')) closeModal();
  });
  if (els.create) els.create.addEventListener('click', () => createPurchaseOrder().catch((e) => setError(e.message)));
  if (els.manualToggle && els.manualBox) {
    els.manualToggle.addEventListener('click', () => {
      els.manualBox.classList.toggle('hidden');
    });
  }
  if (els.itemsToggle && els.itemsBox) {
    els.itemsToggle.addEventListener('click', () => {
      els.itemsBox.classList.toggle('hidden');
    });
  }
  if (els.skuSearch) {
    els.skuSearch.addEventListener('input', () => {
      if (skuSearchTimer) clearTimeout(skuSearchTimer);
      skuSearchTimer = setTimeout(() => {
        searchSkusForCreate(els.skuSearch.value).catch((e) => setError(e.message));
      }, 300);
    });
  }
  document.addEventListener('click', (ev) => {
    if (!els.skuResults) return;
    const t = ev.target;
    if (!t) return;
    if (els.skuResults.contains(t)) return;
    if (els.skuSearch && els.skuSearch.contains(t)) return;
    hideSkuResults();
  });

  try {
    await loadSuppliers();
    await loadWarehouses();
    await loadPurchaseOrders();
    renderCreateItems();
    if (currentPoId) await openPurchaseOrder(currentPoId);
  } catch (e) {
    setError(e && e.message ? e.message : String(e));
  }
})();
