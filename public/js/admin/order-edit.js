/* ==========================================================================
   admin/order-edit.js — 訂單內容編輯 UI
   對外暴露 window.AdminOrderEdit.mount(container, { orderId, items, onChange })
   功能：可編輯商品行（改數量/單價、刪除）、加商品、分單、關聯清單。
   純 DOM 渲染，所有變更經 /api/admin/order-edit + /api/admin/orders 端點。
   ========================================================================== */
(function () {
  const { el, adminApiRequest, adminEscapeHtml: esc } = window.AdminCommon;
  const round2 = (n) => Math.round(Number(n) * 100) / 100;
  const money = (n) => 'HK$ ' + round2(n).toFixed(2);

  // 已出貨數量（由 items 上冇直接帶，用 relations/fulfillment；呢度簡化用 cached）
  // 為支援鎖定，後端 items 冇 shipped 欄位，我哋另外 fetch（見 fetchShippedMap）。

  function buildEditor({ orderId, items, shippedMap, totals, refresh }) {
    const root = el('div', { class: 'space-y-3' });

    const errorBox = el('div', { class: 'admin-error hidden' });
    function setError(msg) {
      if (!msg) return errorBox.classList.add('hidden');
      errorBox.classList.remove('hidden');
      errorBox.textContent = msg;
    }

    // ---- 可編輯商品表 ----
    const tbody = el('tbody', {});

    function renderRows() {
      tbody.textContent = '';
      items.forEach((it) => {
        const itemId = Number(it.id);
        const shipped = shippedMap[itemId] || 0;
        const locked = shipped > 0;

        // 數量：inline number；已出貨顯示下限提示
        const qtyInput = el('input', {
          class: 'admin-input w-16',
          type: 'number',
          min: String(Math.max(1, shipped)),
          value: String(it.quantity),
        });
        const priceInput = el('input', {
          class: 'admin-input w-24',
          type: 'number',
          min: '0',
          step: '0.01',
          value: String(Number(it.unit_price).toFixed(2)),
        });

        const saveRowBtn = el('button', {
          class: 'admin-btn-secondary',
          type: 'button',
          text: '存',
          title: '儲存呢行',
        });
        const delBtn = el('button', {
          class: 'admin-btn-secondary',
          type: 'button',
          text: '刪',
          title: '刪除呢行',
        });

        if (locked) {
          delBtn.disabled = true;
          delBtn.title = `已出貨 ${shipped} 件`;
        }

        saveRowBtn.onclick = async () => {
          const qty = parseInt(qtyInput.value, 10);
          const price = Number(priceInput.value);
          if (!Number.isInteger(qty) || qty < 1) return setError('數量要係正整數');
          if (Number.isNaN(price) || price < 0) return setError('單價唔正確');
          if (qty === Number(it.quantity) && price === Number(it.unit_price)) return;
          saveRowBtn.disabled = true;
          try {
            setError('');
            await adminApiRequest(`/api/admin/orders/${orderId}/items/${itemId}`, {
              method: 'PUT',
              json: { quantity: qty, unit_price: round2(price) },
            });
            await refresh();
          } catch (e) {
            setError(e.message);
            saveRowBtn.disabled = false;
          }
        };

        delBtn.onclick = async () => {
          if (!confirm(`刪除「${it.product_name || it.name}」？`)) return;
          delBtn.disabled = true;
          try {
            setError('');
            await adminApiRequest(`/api/admin/orders/${orderId}/items/${itemId}`, {
              method: 'DELETE',
            });
            await refresh();
          } catch (e) {
            setError(e.message);
            delBtn.disabled = false;
          }
        };

        tbody.appendChild(
          el('tr', {}, [
            el('td', { class: 'align-top' }, [
              el('div', { class: 'font-medium', text: it.product_name || it.name || '' }),
              locked
                ? el('div', { class: 'text-xs text-amber-600', text: `已出貨 ${shipped} 件` })
                : null,
            ]),
            el('td', {}, [qtyInput]),
            el('td', {}, [priceInput]),
            el('td', { class: 'whitespace-nowrap' }, [
              el('div', { class: 'flex gap-1' }, [saveRowBtn, delBtn]),
            ]),
          ])
        );
      });
    }

    const table = el('table', { class: 'admin-table' }, [
      el('thead', {}, [
        el('tr', {}, [
          el('th', { text: '商品' }),
          el('th', { text: '數量' }),
          el('th', { text: '單價' }),
          el('th', { text: '操作' }),
        ]),
      ]),
      tbody,
    ]);

    // ---- 加商品 ----
    const addSection = el('div', { class: 'rounded border border-gray-300 p-2 space-y-2' });
    const addSearchInput = el('input', {
      class: 'admin-input',
      placeholder: '搜商品名 / SKU / barcode',
    });
    const addResultBox = el('div', { class: 'space-y-1 max-h-56 overflow-y-auto' });
    let searchTimer = null;

    async function doSearch() {
      const q = addSearchInput.value.trim();
      if (!q) {
        addResultBox.textContent = '';
        return;
      }
      addResultBox.textContent = '搜尋中…';
      try {
        const data = await adminApiRequest(
          '/api/admin/order-edit/search-products?q=' + encodeURIComponent(q)
        );
        addResultBox.textContent = '';
        if (!data.products.length) {
          addResultBox.textContent = '搵唔到';
          return;
        }
        data.products.forEach((p) => {
          // 每個商品一行，內含 SKU 下拉 + 數量 + 加
          const qtyI = el('input', {
            class: 'admin-input w-16',
            type: 'number',
            min: '1',
            value: '1',
          });
          const skuSel = el('select', { class: 'admin-input' });
          if (p.skus.length) {
            p.skus.forEach((s) => {
              let label = s.sku || ('SKU#' + s.id);
              try {
                const a = s.attributes;
                if (a && typeof a === 'object') {
                  label += ' (' + Object.values(a).join('/') + ')';
                }
              } catch (e) {}
              skuSel.appendChild(el('option', { value: String(s.id), text: label + ' · ' + money(s.price) }));
            });
          } else {
            skuSel.appendChild(el('option', { value: '', text: '預設 · ' + money(p.price) }));
          }

          const addBtn = el('button', { class: 'admin-btn', type: 'button', text: '加' });
          addBtn.onclick = async () => {
            const qty = parseInt(qtyI.value, 10);
            if (!Number.isInteger(qty) || qty < 1) return setError('數量唔正確');
            addBtn.disabled = true;
            try {
              setError('');
              await adminApiRequest(`/api/admin/orders/${orderId}/items`, {
                method: 'POST',
                json: {
                  product_id: p.id,
                  sku_id: skuSel.value ? parseInt(skuSel.value, 10) : null,
                  quantity: qty,
                },
              });
              addSearchInput.value = '';
              addResultBox.textContent = '';
              await refresh();
            } catch (e) {
              setError(e.message);
              addBtn.disabled = false;
            }
          };

          addResultBox.appendChild(
            el('div', { class: 'flex flex-wrap items-center gap-1 rounded p-1 bg-gray-50' }, [
              el('span', { class: 'flex-1 min-w-32 text-sm truncate', text: p.name, title: p.name }),
              skuSel,
              qtyI,
              addBtn,
            ])
          );
        });
      } catch (e) {
        addResultBox.textContent = '搜尋失敗：' + e.message;
      }
    }
    addSearchInput.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(doSearch, 250);
    });

    const addToggleBtn = el('button', {
      class: 'admin-btn-secondary',
      type: 'button',
      text: '+ 加商品',
    });
    addSection.style.display = 'none';
    addToggleBtn.onclick = () => {
      const show = addSection.style.display === 'none';
      addSection.style.display = show ? 'block' : 'none';
      if (show) addSearchInput.focus();
    };
    addSection.appendChild(el('div', {}, [addSearchInput]));
    addSection.appendChild(addResultBox);

    // ---- 分單 ----
    const splitSection = el('div', { class: 'rounded border border-gray-300 p-2 space-y-2' });
    splitSection.style.display = 'none';
    const splitTbody = el('tbody', {});
    const splitNote = el('input', { class: 'admin-input', placeholder: '分單備註（可留空）' });

    function renderSplitRows() {
      splitTbody.textContent = '';
      items.forEach((it) => {
        const itemId = Number(it.id);
        const shipped = shippedMap[itemId] || 0;
        const available = Number(it.quantity) - shipped;
        if (available <= 0) return; // 全出咗，冇得分
        const ckb = el('input', { type: 'checkbox' });
        const qtyI = el('input', {
          class: 'admin-input w-16',
          type: 'number',
          min: '1',
          max: String(available),
          value: String(available),
          disabled: 'true',
        });
        ckb.onchange = () => {
          qtyI.disabled = !ckb.checked;
          updateSplitPreview();
        };
        qtyI.oninput = updateSplitPreview;

        splitTbody.appendChild(
          el('tr', { 'data-item-id': String(itemId) }, [
            el('td', {}, [ckb]),
            el('td', { class: 'text-sm', text: it.product_name || it.name || '' }),
            el('td', { class: 'text-xs text-gray-500', text: `可分 ${available}` }),
            el('td', {}, [qtyI]),
          ])
        );
      });
    }

    const splitPreview = el('div', { class: 'text-sm font-semibold' });
    function selectedSplit() {
      const out = [];
      splitTbody.querySelectorAll('tr').forEach((tr) => {
        const ckb = tr.querySelector('input[type=checkbox]');
        if (!ckb || !ckb.checked) return;
        const qty = parseInt(tr.querySelectorAll('input[type=number]')[0].value, 10);
        const itemId = Number(tr.dataset.itemId);
        if (Number.isInteger(qty) && qty > 0) {
          out.push({ order_item_id: itemId, quantity: qty });
        }
      });
      return out;
    }
    function updateSplitPreview() {
      const sel = selectedSplit();
      if (!sel.length) {
        splitPreview.textContent = '';
        return;
      }
      let sub = 0;
      sel.forEach((s) => {
        const it = items.find((x) => Number(x.id) === s.order_item_id);
        sub += Number(it.unit_price) * s.quantity;
      });
      splitPreview.textContent = `分出小計：${money(sub)}（折扣按比例分，運費留原單）`;
    }

    const confirmSplitBtn = el('button', { class: 'admin-btn', type: 'button', text: '確認分單' });
    confirmSplitBtn.onclick = async () => {
      const sel = selectedSplit();
      if (!sel.length) return setError('請勾選要分單嘅商品');
      if (!confirm('確認將選定商品拆去一張獨立新訂單？')) return;
      confirmSplitBtn.disabled = true;
      try {
        setError('');
        const r = await adminApiRequest(`/api/admin/orders/${orderId}/split`, {
          method: 'POST',
          json: { items: sel, note: splitNote.value || null },
        });
        alert(`分單成功！新訂單：${r.new_order_number}`);
        await refresh();
        // 打開新單
        if (typeof window.AdminOrderEdit !== 'undefined' && window.AdminOrderEdit.openOrder) {
          window.AdminOrderEdit.openOrder(r.new_order_id);
        }
      } catch (e) {
        setError(e.message);
        confirmSplitBtn.disabled = false;
      }
    };

    splitSection.appendChild(
      el('table', { class: 'admin-table' }, [
        el('thead', {}, [
          el('tr', {}, [
            el('th', { text: '' }),
            el('th', { text: '商品' }),
            el('th', { text: '' }),
            el('th', { text: '分出數量' }),
          ]),
        ]),
        splitTbody,
      ])
    );
    splitSection.appendChild(splitNote);
    splitSection.appendChild(splitPreview);
    splitSection.appendChild(confirmSplitBtn);

    const splitToggleBtn = el('button', {
      class: 'admin-btn-secondary',
      type: 'button',
      text: '⇆ 分單',
    });
    splitToggleBtn.onclick = () => {
      const show = splitSection.style.display === 'none';
      splitSection.style.display = show ? 'block' : 'none';
      if (show) {
        renderSplitRows();
        updateSplitPreview();
      }
    };

    // ---- 關聯分單 ----
    const relationsBox = el('div', { class: 'text-sm space-y-1' });
    async function loadRelations() {
      try {
        const r = await adminApiRequest(`/api/admin/orders/${orderId}/relations`);
        relationsBox.textContent = '';
        if (r.parent) {
          relationsBox.appendChild(
            el('div', {}, [
              el('span', { class: 'text-gray-500', text: '原單：' }),
              el('button', {
                class: 'admin-link-btn',
                type: 'button',
                text: r.parent.order_number || '#' + r.parent.id,
                onclick: () => window.AdminOrderEdit.openOrder(r.parent.id),
              }),
            ])
          );
        }
        if (r.children.length) {
          r.children.forEach((c) => {
            relationsBox.appendChild(
              el('div', {}, [
                el('span', { class: 'text-gray-500', text: `分單 ${c.split_no}：` }),
                el('button', {
                  class: 'admin-link-btn',
                  type: 'button',
                  text: `${c.order_number || '#' + c.id}（${money(c.total_amount)}）`,
                  onclick: () => window.AdminOrderEdit.openOrder(c.id),
                }),
              ])
            );
          });
        }
      } catch (e) {
        /* 關聯載入失敗唔阻主流程 */
      }
    }

    // ---- 合計摘要 ----
    const totalsBox = el('div', { class: 'text-sm font-semibold' });
    function renderTotals() {
      totalsBox.textContent =
        `小計 ${money(totals.subtotal)}` +
        (Number(totals.shipping_fee) ? ` ＋運費 ${money(totals.shipping_fee)}` : '') +
        ` ＝合計 ${money(totals.total)}`;
    }

    // ---- 拼裝 ----
    root.appendChild(errorBox);
    root.appendChild(
      el('div', { class: 'flex flex-wrap gap-2' }, [addToggleBtn, splitToggleBtn])
    );
    root.appendChild(addSection);
    root.appendChild(splitSection);
    root.appendChild(totalsBox);
    root.appendChild(table);
    if (relationsBox) root.appendChild(el('div', { class: 'border-t pt-2' }, [relationsBox]));

    renderRows();
    renderTotals();
    loadRelations();

    return root;
  }

  // 由訂單 id 攞齊資料並掛載
  async function mountById(container, orderId) {
    container.textContent = '載入中…';
    const data = await adminApiRequest('/api/admin/orders/' + encodeURIComponent(orderId));
    const items = data.items || [];

    // 攞每項已出貨數量
    const shippedMap = {};
    // order detail 冇直接帶 fulfillment；用一次查詢（有 endpoint？冇就本地聚合）
    // 後端未提供，呢度用 items 對比唔到；暫以 0（實際鎖定由後端把關）。
    // 為令前端顯示鎖定，新增下面內嵌 fetch 端點唔存在，故保守設 0。
    const fr = await adminApiRequest(
      '/api/admin/order-edit/shipped-map?order_id=' + encodeURIComponent(orderId)
    ).catch(() => null);
    if (fr && fr.map) Object.assign(shippedMap, fr.map);

    const order = data.order;
    const totals = {
      subtotal: order.subtotal_amount,
      shipping_fee: order.shipping_fee,
      total: order.total_amount,
    };

    async function refresh() {
      await mountById(container, orderId);
    }

    container.textContent = '';
    container.appendChild(buildEditor({ orderId, items, shippedMap, totals, refresh }));
  }

  window.AdminOrderEdit = { mountById };
})();
