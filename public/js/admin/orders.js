(async function () {
  const { $, el, adminApiRequest, createSegmented, showSuccess } = window.AdminCommon;

  const els = {
    q: $('#orders-q'),
    status: $('#orders-status'),
    refresh: $('#orders-refresh'),
    bulkShipany: $('#orders-bulk-shipany'),
    selectAll: $('#orders-select-all'),
    bulkResult: $('#orders-bulk-result'),
    error: $('#orders-error'),
    tbody: $('#orders-tbody'),
    detail: $('#order-detail'),
    modal: $('#order-modal'),
    modalClose: $('#order-modal-close'),
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

  function money(n) {
    if (n === null || n === undefined) return '';
    const x = Number(n);
    if (Number.isNaN(x)) return String(n);
    return 'HK$ ' + x.toFixed(2);
  }

  const statusLabel = {
    pending: '待付款',
    paid: '已付款',
    shipping: '派送中',
    completed: '已完成',
    cancelled: '已取消',
  };

  const statusBadge = {
    pending: 'admin-badge badge-pending',
    paid: 'admin-badge badge-paid',
    shipping: 'admin-badge badge-shipping',
    completed: 'admin-badge badge-completed',
    cancelled: 'admin-badge badge-cancelled',
  };

  // ---- Timeline（同 lib/orderTimeline.js 一致，前端可由 order 物件即算）----
  function buildOrderTimeline(order) {
    const status = String(order.status || '');
    const payment = String(order.payment_status || 'pending');
    const isCancelled = status === 'cancelled';
    const paidDone = !!order.paid_at || payment === 'paid';
    const shippedDone = !!order.shipped_at || ['shipped','shipping','delivered','completed'].includes(status);
    const deliveredDone = !!order.delivered_at || ['delivered','completed'].includes(status);

    const steps = [
      { label: '已下單', st: 'done', time: fmtTime(order.created_at) },
      { label: '已付款', st: paidDone ? 'done' : 'pending', time: paidDone ? (fmtTime(order.paid_at) || '已確認收款') : '等待付款 / 核實' },
      { label: '已出貨', st: shippedDone ? (deliveredDone ? 'done' : 'current') : 'pending', time: shippedDone ? (fmtTime(order.shipped_at) || '配送中') : '未出貨' },
      { label: '已送達', st: deliveredDone ? 'done' : (shippedDone ? 'current' : 'pending'), time: deliveredDone ? (fmtTime(order.delivered_at) || '已完成') : (shippedDone ? '等待送達' : '未送達') },
    ];
    if (isCancelled) steps.forEach((s, i) => { s.st = 'cancelled'; s.time = i === 0 ? fmtTime(order.created_at) : '訂單已取消'; });

    const ul = el('ul', { class: 'admin-timeline' }, steps.map((s) =>
      el('li', { class: 'tl-item ' + s.st }, [
        el('span', { class: 'tl-dot' }),
        el('div', { class: 'tl-label', text: s.label }),
        el('div', { class: 'tl-time', text: s.time || '' }),
      ])
    ));
    return el('div', { class: 'space-y-2' }, [
      el('div', { class: 'font-bold text-sm', text: '訂單進度' + (isCancelled ? '（已取消）' : '') }),
      ul,
    ]);
  }

  function fmtTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    const pad = (x) => String(x).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function toWaE164(hkNumber) {
    const digits = String(hkNumber || '').replace(/[^\d]/g, '');
    if (!digits) return null;
    if (digits.startsWith('852')) return digits;
    if (digits.length === 8) return '852' + digits;
    return digits;
  }

  function buildWaLink(numberE164, text) {
    if (!numberE164) return null;
    return 'https://wa.me/' + encodeURIComponent(numberE164) + '?text=' + encodeURIComponent(text || '');
  }

  function pickFirstArray(obj, paths) {
    for (const p of paths) {
      const parts = String(p).split('.');
      let cur = obj;
      for (const k of parts) {
        if (!cur || typeof cur !== 'object') { cur = null; break; }
        cur = cur[k];
      }
      if (Array.isArray(cur)) return cur;
    }
    return null;
  }

  function toText(v) {
    if (v === null || v === undefined) return '';
    return typeof v === 'string' ? v : JSON.stringify(v);
  }

  function truncateText(s, maxLen) {
    const t = String(s || '');
    const n = Number(maxLen) || 0;
    if (n > 0 && t.length > n) return t.slice(0, n) + '…';
    return t;
  }

  let selectedIds = new Set();
  let currentOrders = [];
  let orderCacheById = new Map();

  function setBulkButtonEnabled() {
    if (!els.bulkShipany) return;
    els.bulkShipany.disabled = selectedIds.size === 0;
  }

  function setSelectAllChecked() {
    if (!els.selectAll) return;
    if (!currentOrders || currentOrders.length === 0) {
      els.selectAll.checked = false;
      els.selectAll.indeterminate = false;
      return;
    }
    const selectedCount = currentOrders.filter((o) => selectedIds.has(Number(o.id))).length;
    els.selectAll.checked = selectedCount === currentOrders.length;
    els.selectAll.indeterminate = selectedCount > 0 && selectedCount < currentOrders.length;
  }

  function showBulkResult(contentEl) {
    if (!els.bulkResult) return;
    if (!contentEl) {
      els.bulkResult.classList.add('hidden');
      els.bulkResult.textContent = '';
      return;
    }
    els.bulkResult.classList.remove('hidden');
    els.bulkResult.textContent = '';
    els.bulkResult.appendChild(contentEl);
  }

  function buildGenerateLabelPayloadFromListOrder(o) {
    return {
      order_id: o.id,
      recipient_name: o.recipient_name || o.username || '',
      recipient_phone: o.recipient_phone || o.phone || o.whatsapp || '',
      recipient_address: o.recipient_address || o.address || '',
      district: o.district || '',
      service_type: o.service_type || 'sf_express',
      weight: o.weight || 1,
    };
  }

  async function bulkGenerateShipanyLabels() {
    setError('');
    const ids = Array.from(selectedIds.values()).map((x) => Number(x)).filter((x) => Number.isInteger(x) && x > 0);
    const uniqueIds = Array.from(new Set(ids));
    if (uniqueIds.length === 0) return;

    if (els.bulkShipany) els.bulkShipany.disabled = true;

    const results = []; // { id, status:'success'|'skip'|'fail', message }
    let done = 0;

    const progressText = el('div', { class: 'text-sm text-gray-700', text: '' });
    const tbody = el('tbody', {});
    const table = el('table', { class: 'admin-table mt-2' }, [
      el('thead', {}, [el('tr', {}, [
        el('th', { text: '訂單' }),
        el('th', { text: '結果' }),
        el('th', { text: '訊息' }),
      ])]),
      tbody,
    ]);
    const box = el('div', { class: 'space-y-2' }, [
      el('div', { class: 'font-bold', text: '批量生成 ShipAny 面單' }),
      progressText,
      table,
    ]);
    showBulkResult(box);

    function renderProgress() {
      progressText.textContent = `已完成 ${done}/${uniqueIds.length}`;
    }
    function appendRow(r) {
      tbody.appendChild(el('tr', {}, [
        el('td', { text: `#${r.id}` }),
        el('td', { text: r.status }),
        el('td', { text: r.message || '' }),
      ]));
    }
    renderProgress();

    for (const id of uniqueIds) {
      const o = orderCacheById.get(id);
      try {
        if (!o) {
          results.push({ id, status: 'fail', message: '訂單不在目前列表' });
          appendRow(results[results.length - 1]);
          continue;
        }
        if (o.tracking_number || o.shipany_label_url) {
          results.push({ id, status: 'skip', message: '已存在 tracking/面單，已跳過' });
          appendRow(results[results.length - 1]);
          continue;
        }
        const payload = buildGenerateLabelPayloadFromListOrder(o);
        await adminApiRequest('/api/admin/shipany/generate-label', { method: 'POST', json: payload });
        results.push({ id, status: 'success', message: '已生成' });
        appendRow(results[results.length - 1]);
      } catch (e) {
        results.push({ id, status: 'fail', message: e && e.message ? e.message : String(e) });
        appendRow(results[results.length - 1]);
      } finally {
        done += 1;
        renderProgress();
      }
    }

    await loadOrders({ clearSelection: true, keepBulkResult: true });
    setBulkButtonEnabled();
    const okCount = results.filter(r => r.status === 'success').length;
    if (okCount > 0) showSuccess(document.getElementById('orders-toolbar') || els.tbody.parentNode, `已生成 ${okCount} 張面單`, 2600);
  }

  async function loadOrders(options) {
    const clearSelection = !options || options.clearSelection !== false;
    const keepBulkResult = !!(options && options.keepBulkResult);
    setError('');
    els.tbody.textContent = '';
    els.detail.textContent = '請喺左邊揀一張訂單';
    if (clearSelection) selectedIds = new Set();
    currentOrders = [];
    orderCacheById = new Map();
    if (!keepBulkResult) showBulkResult(null);

    const q = (els.q.value || '').trim();
    const status = els.status.value;

    const params = new URLSearchParams();
    if (q) params.set('search', q);
    if (status) params.set('status', status);

    const data = await adminApiRequest('/api/admin/orders?' + params.toString());
    const orders = data.orders || [];
    currentOrders = orders;
    for (const o of orders) orderCacheById.set(Number(o.id), o);

    for (const o of orders) {
      const id = Number(o.id);
      const checkbox = el('input', {
        type: 'checkbox',
        'data-order-id': String(id),
        checked: selectedIds.has(id),
        onchange: () => {
          if (checkbox.checked) { selectedIds.add(id); tr.classList.add('is-selected'); }
          else { selectedIds.delete(id); tr.classList.remove('is-selected'); }
          setBulkButtonEnabled();
          setSelectAllChecked();
        },
      });
      const tr = el('tr', {}, [
        el('td', {}, [checkbox]),
        el('td', { class: 'font-semibold' }, [
          el('button', { class: 'admin-link-btn', text: '#' + id, onclick: () => openOrder(o.id) }),
        ]),
        el('td', { text: o.username || '' }),
        el('td', { class: 'font-semibold tabular-nums', text: money(o.total_amount) }),
        el('td', {}, [
          el('span', { class: statusBadge[o.status] || 'admin-badge badge-inactive', text: statusLabel[o.status] || o.status }),
        ]),
        el('td', { class: 'text-gray-500 tabular-nums whitespace-nowrap', text: fmtTime(o.created_at) }),
        el('td', {}, [
          el('button', {
            class: 'admin-link-btn',
            text: '打開',
            onclick: () => openOrder(o.id),
          }),
        ]),
      ]);
      if (selectedIds.has(id)) tr.classList.add('is-selected');
      els.tbody.appendChild(tr);
    }

    setBulkButtonEnabled();
    setSelectAllChecked();
  }

  async function openOrder(id) {
    setError('');
    openModal();
    els.detail.textContent = '載入中…';
    const data = await adminApiRequest('/api/admin/orders/' + encodeURIComponent(id));
    const order = data.order;
    const items = data.items || [];

    const statusSelect = el('select', { class: 'admin-input', id: 'order-status' }, [
      el('option', { value: 'pending', text: '待付款' }),
      el('option', { value: 'paid', text: '已付款' }),
      el('option', { value: 'shipping', text: '派送中' }),
      el('option', { value: 'completed', text: '已完成' }),
      el('option', { value: 'cancelled', text: '已取消' }),
    ]);
    statusSelect.value = order.status;

    const trackingInput = el('input', {
      class: 'admin-input',
      id: 'order-tracking',
      value: order.tracking_number || '',
      placeholder: '物流單號（可留空）',
    });

    const shipanyBtn = el('button', {
      class: 'admin-btn-secondary',
      text: '生成 ShipAny 面單',
      type: 'button',
      onclick: async () => {
        shipanyBtn.disabled = true;
        try {
          await adminApiRequest('/api/admin/shipany/generate-label', {
            method: 'POST',
            json: {
              order_id: order.id,
              recipient_name: order.recipient_name || order.username || '',
              recipient_phone: order.recipient_phone || order.phone || order.whatsapp || '',
              recipient_address: order.recipient_address || order.address || '',
              district: order.district || '',
              service_type: order.service_type || 'sf_express',
              weight: order.weight || 1,
            },
          });
          await loadOrders();
          await openOrder(id);
        } catch (e) {
          setError(e && e.message ? e.message : String(e));
        } finally {
          shipanyBtn.disabled = false;
        }
      },
    });

    const saveBtn = el('button', {
      class: 'admin-btn',
      text: '更新狀態',
      onclick: async () => {
        saveBtn.disabled = true;
        try {
          await adminApiRequest('/api/admin/orders/' + encodeURIComponent(id) + '/status', {
            method: 'PUT',
            json: { status: statusSelect.value, tracking_number: trackingInput.value || null },
          });
          await loadOrders();
          await openOrder(id);
        } catch (e) {
          setError(e && e.message ? e.message : String(e));
        } finally {
          saveBtn.disabled = false;
        }
      },
    });

    const paymentStatusText = order.payment_status ? String(order.payment_status) : '';
    const shipanyLabelUrl = order.shipany_label_url ? String(order.shipany_label_url) : '';
    const trackingStatus = order.tracking_status ? String(order.tracking_status) : '';
    const trackingUpdatedAtText = order.tracking_updated_at ? String(order.tracking_updated_at) : '';

    const trackingMetaText = el('div', { class: 'text-sm text-gray-700', text: 'Tracking：未刷新' });
    const trackingTbody = el('tbody', {});
    const refreshTrackingBtn = el('button', {
      class: 'admin-btn-secondary',
      text: '刷新 tracking',
      type: 'button',
      onclick: async () => {
        refreshTrackingBtn.disabled = true;
        trackingMetaText.textContent = 'Tracking：載入中…';
        trackingTbody.textContent = '';
        try {
          const r = await adminApiRequest('/api/admin/orders/' + encodeURIComponent(id) + '/tracking');
          const events = pickFirstArray(r, ['events', 'tracking.events', 'data.events', 'result.events']) || [];

          const metaTrackingNumber =
            (r && (r.tracking_number || r.trackingNumber)) ||
            (r && r.data && (r.data.tracking_number || r.data.trackingNumber)) ||
            order.tracking_number ||
            '';
          const metaStatus =
            (r && (r.status || r.tracking_status)) ||
            (r && r.data && (r.data.status || r.data.tracking_status)) ||
            trackingStatus ||
            '';
          const metaUpdatedAt =
            (r && (r.updated_at || r.tracking_updated_at)) ||
            (r && r.data && (r.data.updated_at || r.data.tracking_updated_at)) ||
            trackingUpdatedAtText ||
            '';

          const metaParts = [];
          if (metaTrackingNumber) metaParts.push(`單號：${metaTrackingNumber}`);
          if (metaStatus) metaParts.push(`狀態：${metaStatus}`);
          if (metaUpdatedAt) metaParts.push(`更新：${metaUpdatedAt}`);
          trackingMetaText.textContent = metaParts.length > 0 ? `Tracking：${metaParts.join(' / ')}` : 'Tracking：已刷新';

          if (events.length > 0) {
            for (const ev of events) {
              const time = ev && (ev.timestamp || ev.time || ev.datetime || ev.created_at || ev.date || '');
              const location = ev && (ev.location || ev.facility || ev.station || ev.place || '');
              const status = ev && (ev.status || ev.description || ev.message || ev.state || '');
              const remark = ev && (ev.remark || ev.note || ev.details || '');
              trackingTbody.appendChild(el('tr', {}, [
                el('td', { text: toText(time) }),
                el('td', { text: toText(location) }),
                el('td', { text: toText(status) }),
                el('td', { text: toText(remark) }),
              ]));
            }
          } else {
            const msg = truncateText(toText((r && (r.message || r.error)) || r), 300);
            trackingTbody.appendChild(el('tr', {}, [
              el('td', { text: '' }),
              el('td', { text: '' }),
              el('td', { text: metaStatus || '' }),
              el('td', { text: msg }),
            ]));
          }
        } catch (e) {
          trackingMetaText.textContent = 'Tracking：刷新失敗';
          setError(e && e.message ? e.message : String(e));
        } finally {
          refreshTrackingBtn.disabled = false;
        }
      },
    });

    const trackingTable = el('table', { class: 'admin-table mt-2' }, [
      el('thead', {}, [
        el('tr', {}, [
          el('th', { text: '時間' }),
          el('th', { text: '地點' }),
          el('th', { text: '狀態' }),
          el('th', { text: '備註' }),
        ]),
      ]),
      trackingTbody,
    ]);

    const waE164 = order.marketing_consent ? toWaE164(order.whatsapp) : null;
    const waPayMsg = `你好，我哋係 OHYA2.0。\n你嘅訂單 #${order.id} 目前狀態：${statusLabel[order.status] || order.status}\n如已付款可忽略，多謝。`;
    const waShipMsg = `你好，我哋係 OHYA2.0。\n你嘅訂單 #${order.id} 已安排出貨。\n物流單號：${order.tracking_number || '(未提供)'}\n多謝支持。`;
    const waAfterSalesMsg = `你好，我哋係 OHYA2.0。\n關於訂單 #${order.id} 售後/退款需要協助？\n請回覆原因同相片（如有），我哋會跟進。`;

    const waLinks = waE164
      ? {
          pay: buildWaLink(waE164, waPayMsg),
          ship: buildWaLink(waE164, waShipMsg),
          after: buildWaLink(waE164, waAfterSalesMsg),
        }
      : null;

    const itemsTable = el('table', { class: 'admin-table mt-2' }, [
      el('thead', {}, [
        el('tr', {}, [el('th', { text: '商品' }), el('th', { text: '數量' }), el('th', { text: '單價' })]),
      ]),
      el('tbody', {}, items.map((it) =>
        el('tr', {}, [
          el('td', { text: it.name || it.product_name || '' }),
          el('td', { text: String(it.quantity || 0) }),
          el('td', { class: 'tabular-nums', text: money(it.unit_price) }),
        ])
      )),
    ]);

    // ---- 入數證明審批區 ----
    const proofImg = el('img', {
      class: 'mt-2 max-h-80 rounded-lg border border-ink-600 bg-ink-800',
      alt: '入數證明',
    });
    proofImg.style.display = 'none';
    const proofMsg = el('div', { class: 'text-sm text-gray-500 mt-1', text: '' });
    const reasonInput = el('input', { class: 'admin-input mt-2', placeholder: '駁回原因（可留空）' });
    reasonInput.style.display = 'none';

    const approveBtn = el('button', { class: 'admin-btn', text: '確認收款', type: 'button' });
    const rejectToggle = el('button', { class: 'admin-btn-secondary', text: '駁回', type: 'button' });
    const rejectConfirm = el('button', { class: 'admin-btn', text: '確認駁回', type: 'button' });
    rejectConfirm.style.display = 'none';

    const proofBox = el('div', { class: 'space-y-2 rounded-lg border border-ink-600 p-3' }, [
      el('div', { class: 'font-bold', text: '入數證明' }),
      proofMsg, proofImg,
      el('div', { class: 'flex flex-wrap gap-2 mt-2' }, [approveBtn, rejectToggle]),
      reasonInput, rejectConfirm,
    ]);

    async function loadProof(){
      try {
        const st = String(order.payment_status || '');
        if (st === 'paid') {
          proofMsg.textContent = '✓ 已確認收款';
          approveBtn.style.display='none'; rejectToggle.style.display='none';
          proofImg.style.display='block'; proofImg.src='/api/admin/orders/'+order.id+'/proof/image?ts='+Date.now();
          return;
        }
        if (st !== 'proof_pending') {
          proofMsg.textContent = '買家尚未上傳憑證';
          approveBtn.style.display='none'; rejectToggle.style.display='none';
          return;
        }
        proofMsg.textContent = '等待審核';
        proofImg.style.display='block';
        proofImg.src='/api/admin/orders/'+order.id+'/proof/image?ts='+Date.now();
      } catch(e){ proofMsg.textContent='載入失敗'; }
    }

    approveBtn.onclick = async () => {
      approveBtn.disabled=true;
      try {
        await adminApiRequest('/api/admin/orders/'+order.id+'/proof/approve', {method:'POST', json:{}});
        await loadOrders(); await openOrder(order.id);
      } catch(e){ setError(e.message||String(e)); approveBtn.disabled=false; }
    };
    rejectToggle.onclick = () => {
      reasonInput.style.display='block'; rejectConfirm.style.display='inline-block'; rejectToggle.style.display='none';
    };
    rejectConfirm.onclick = async () => {
      rejectConfirm.disabled=true;
      try {
        await adminApiRequest('/api/admin/orders/'+order.id+'/proof/reject', {method:'POST', json:{reason:reasonInput.value||''}});
        await loadOrders(); await openOrder(order.id);
      } catch(e){ setError(e.message||String(e)); rejectConfirm.disabled=false; }
    };

    const timelineBox = el('div', { class: 'rounded-lg border border-gray-200 bg-gray-50/60 p-3' }, [
      buildOrderTimeline(order),
    ]);

    els.detail.textContent = '';
    els.detail.appendChild(el('div', { class: 'space-y-2' }, [
      el('div', { class: 'font-bold', text: `訂單 #${order.id}` }),
      timelineBox,
      el('div', { text: `客戶：${order.username || ''} ${order.contact ? '(' + order.contact + ')' : ''}` }),
      el('div', { text: `金額：${money(order.total_amount)}` }),
      el('div', { text: `狀態：${statusLabel[order.status] || order.status}` }),
      el('div', { text: paymentStatusText ? `付款狀態：${paymentStatusText}` : '付款狀態：' }),
      el('div', { class: 'grid gap-2' }, [
        el('label', { class: 'text-sm' }, [el('div', { class: 'mb-1', text: '狀態' }), statusSelect]),
        el('label', { class: 'text-sm' }, [el('div', { class: 'mb-1', text: '物流單號' }), trackingInput]),
        saveBtn,
        shipanyBtn,
        refreshTrackingBtn,
      ]),
      el('div', { class: 'space-y-2' }, [
        el('div', { class: 'font-bold', text: 'ShipAny 出貨' }),
        shipanyLabelUrl
          ? el('div', {}, [
              el('a', { href: shipanyLabelUrl, target: '_blank', class: 'underline', text: 'ShipAny 面單連結' }),
            ])
          : el('div', { text: 'ShipAny 面單：' }),
        el('div', { text: trackingStatus ? `物流狀態：${trackingStatus}` : '物流狀態：' }),
        el('div', { text: trackingUpdatedAtText ? `最後更新：${trackingUpdatedAtText}` : '最後更新：' }),
        trackingMetaText,
        trackingTable,
      ]),
      waLinks
        ? el('div', { class: 'flex gap-2 flex-wrap' }, [
            el('a', { href: waLinks.pay, target: '_blank', class: 'admin-btn-secondary', text: 'WhatsApp 付款提醒' }),
            el('a', { href: waLinks.ship, target: '_blank', class: 'admin-btn-secondary', text: 'WhatsApp 出貨通知' }),
            el('a', { href: waLinks.after, target: '_blank', class: 'admin-btn-secondary', text: 'WhatsApp 售後通知' }),
          ])
        : el('div', { class: 'text-sm text-gray-500', text: 'WhatsApp：客戶未綁定或未同意通知' }),
      proofBox,
      el('div', { class: 'font-bold mt-3', text: '商品清單（可編輯）' }),
      el('div', { id: 'order-items-edit-host' }, [el('div', { class: 'text-gray-400', text: '載入編輯器…' })]),
    ]));

    // 掛載可編輯商品模組
    try {
      const host = document.getElementById('order-items-edit-host');
      if (host && window.AdminOrderEdit && window.AdminOrderEdit.mountById) {
        window.AdminOrderEdit.openOrder = (newId) => openOrder(Number(newId));
        await window.AdminOrderEdit.mountById(host, order.id);
      }
    } catch (e) {
      const host = document.getElementById('order-items-edit-host');
      if (host) host.textContent = '編輯器載入失敗：' + (e.message || String(e));
    }

    // 彈窗已喺頂部，唔使再捲頁

    loadProof();
  }

  if (els.modalClose) els.modalClose.addEventListener('click', closeModal);
  if (els.modal) els.modal.addEventListener('mousedown', (e) => {
    if (e.target === els.modal) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && els.modal && !els.modal.classList.contains('hidden')) closeModal();
  });
  els.refresh.addEventListener('click', () => loadOrders().catch((e) => setError(e.message)));
  els.q.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') loadOrders().catch((e) => setError(e.message));
  });
  els.status.addEventListener('change', () => loadOrders().catch((e) => setError(e.message)));
  if (els.selectAll) {
    els.selectAll.addEventListener('change', () => {
      const shouldSelect = !!els.selectAll.checked;
      for (const o of currentOrders) {
        const id = Number(o.id);
        if (shouldSelect) selectedIds.add(id);
        else selectedIds.delete(id);
      }
      if (els.tbody) {
        const inputs = els.tbody.querySelectorAll('input[type="checkbox"][data-order-id]');
        for (const inp of inputs) inp.checked = shouldSelect;
      }
      setBulkButtonEnabled();
      setSelectAllChecked();
    });
  }
  if (els.bulkShipany) {
    els.bulkShipany.addEventListener('click', () => bulkGenerateShipanyLabels().catch((e) => setError(e.message)));
  }

  // 將狀態 <select> 升級做 Segmented control；隱藏 select 保留同步 value，其他代碼照用
  function upgradeStatusFilter() {
    const opts = Array.from(els.status.options).map((o) => ({ value: o.value, text: o.textContent }));
    const seg = createSegmented(opts, els.status.value, (v) => {
      els.status.value = v;
      els.status.dispatchEvent(new Event('change', { bubbles: true }));
    });
    els.status.classList.add('hidden');
    els.status.parentNode.insertBefore(seg.root, els.status.nextSibling);
  }

  try {
    upgradeStatusFilter();
    await loadOrders();
  } catch (e) {
    setError(e && e.message ? e.message : String(e));
  }
})();
