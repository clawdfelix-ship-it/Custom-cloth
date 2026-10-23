(async function () {
  const { $, el, adminApiRequest, showSuccess } = window.AdminCommon;

  const els = {
    search: $('#products-search'),
    categoryFilter: $('#products-category'),
    refresh: $('#products-refresh'),
    sync: $('#products-sync'),
    newBtn: $('#products-new'),
    error: $('#products-error'),
    syncResult: $('#products-sync-result'),
    tbody: $('#products-tbody'),
    cards: $('#products-cards'),
    empty: $('#products-empty'),

    form: $('#product-form'),
    id: $('#product-id'),
    name: $('#product-name'),
    slug: $('#product-slug'),
    parentCategory: $('#product-parent-category'),
    category: $('#product-category'),
    price: $('#product-price'),
    originalPrice: $('#product-original-price'),
    totalStock: $('#product-total-stock'),
    status: $('#product-status'),
    imageUrl: $('#product-image-url'),
    imageFile: $('#product-image-file'),
    shortDesc: $('#product-short-desc'),
    desc: $('#product-desc'),
    skuAdd: $('#sku-add'),
    skuEmptyHint: $('#sku-empty-hint'),
    skuTbody: $('#sku-tbody'),
    skuAdjustModal: $('#sku-adjust-modal'),
    skuAdjustSkuId: $('#sku-adjust-sku-id'),
    skuAdjustDelta: $('#sku-adjust-delta'),
    skuAdjustNote: $('#sku-adjust-note'),
    skuAdjustConfirm: $('#sku-adjust-confirm'),
    skuAdjustCancel: $('#sku-adjust-cancel'),
    reset: $('#product-reset'),
    save: $('#product-save'),

    modal: $('#product-modal'),
    modalClose: $('#product-modal-close'),
    modalTitle: $('#product-modal-title'),
  };

  function openModal(isNew) {
    if (!els.modal) return;
    if (els.modalTitle) els.modalTitle.textContent = isNew ? '新增商品' : '商品編輯';
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

  function setSyncResult(msg, isError) {
    if (!els.syncResult) return;
    if (!msg) {
      els.syncResult.classList.add('hidden');
      els.syncResult.textContent = '';
      els.syncResult.classList.remove('border-[#f5b9ad]', 'bg-[#ffeeeb]', 'text-[#a8250b]');
      els.syncResult.classList.add('border-[#a9e2cc]', 'bg-[#e6f7f0]', 'text-[#005c44]');
      return;
    }
    els.syncResult.classList.remove('hidden');
    els.syncResult.textContent = msg;
    if (isError) {
      els.syncResult.classList.remove('border-[#a9e2cc]', 'bg-[#e6f7f0]', 'text-[#005c44]');
      els.syncResult.classList.add('border-[#f5b9ad]', 'bg-[#ffeeeb]', 'text-[#a8250b]');
    } else {
      els.syncResult.classList.remove('border-[#f5b9ad]', 'bg-[#ffeeeb]', 'text-[#a8250b]');
      els.syncResult.classList.add('border-[#a9e2cc]', 'bg-[#e6f7f0]', 'text-[#005c44]');
    }
  }

  // Switch：role=switch + aria-checked，click / Space / Enter 都可切換
  function createSwitch(checked, onToggle) {
    const sw = el('span', { class: 'admin-switch', role: 'switch', tabindex: '0', 'aria-checked': checked ? 'true' : 'false' }, [
      el('span', { class: 'knob' }),
    ]);
    sw._checked = !!checked;
    function fire() {
      if (sw.classList.contains('is-busy')) return;
      const next = !sw._checked;
      sw._checked = next;
      sw.setAttribute('aria-checked', next ? 'true' : 'false');
      Promise.resolve(onToggle(next)).catch(() => {
        // 出錯還原
        sw._checked = !next;
        sw.setAttribute('aria-checked', sw._checked ? 'true' : 'false');
      });
    }
    sw.addEventListener('click', fire);
    sw.addEventListener('keydown', (ev) => {
      if (ev.key === ' ' || ev.key === 'Enter') { ev.preventDefault(); fire(); }
    });
    return sw;
  }

  function productStatusSwitch(p) {
    const wrap = el('span', { class: 'inline-flex items-center gap-2' });
    const label = el('span', { class: 'text-xs text-gray-500', text: p.status === 'active' ? '上架' : '下架' });
    const sw = createSwitch(p.status === 'active', async (next) => {
      sw.classList.add('is-busy');
      try {
        await adminApiRequest('/api/admin/products/' + encodeURIComponent(p.id) + '/status', {
          method: 'PATCH',
          json: { status: next ? 'active' : 'inactive' },
        });
        p.status = next ? 'active' : 'inactive';
        label.textContent = next ? '上架' : '下架';
      } finally {
        sw.classList.remove('is-busy');
      }
    });
    wrap.append(sw, label);
    return wrap;
  }

  let categories = [];
  let categoriesById = new Map();
  let rootCategories = [];
  let childrenByParentId = new Map();
  let isLeafById = new Map();
  let currentSkus = [];
  let adjustingSkuId = null;
  let parentCombo = null, childCombo = null, filterCombo = null;

  // ---- Searchable combobox：解決數千個分類塞落 <select> 難用 ----
  function createCombobox(selectEl, options, includeAll) {
    const wrap = el('div', { class: 'admin-combo relative' });
    const input = el('input', { type: 'text', autocomplete: 'off', class: 'admin-input w-full cursor-pointer pr-8', placeholder: '輸入關鍵字搜尋…' });
    const caret = el('span', { class: 'pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400', text: '▾' });
    const list = el('div', { class: 'admin-combo-list hidden absolute z-40 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg' });
    wrap.append(input, caret, list);
    selectEl.replaceWith(wrap);
    const api = { wrap, input, list, value: () => input.dataset.value || '', setDisabled(d){ input.disabled=d; input.classList.toggle('bg-gray-100',d); if(d){list.classList.add('hidden');} } };
    api.setOptions = (opts, allOpt) => {
      const full = (allOpt ? [{ value:'', text:allOpt }] : []).concat(opts||[]);
      input.dataset.options = JSON.stringify(full);
      const cur = input.dataset.value || '';
      const found = full.find(o => String(o.value) === String(cur));
      if (found) input.value = found.text;
      renderList(full, input.value.trim().toLowerCase());
    };
    function renderList(full, q) {
      list.textContent = '';
      const matched = full.filter(o => !q || o.text.toLowerCase().includes(q)).slice(0, 200);
      if (!matched.length) list.appendChild(el('div', { class: 'px-3 py-2 text-sm text-gray-400', text: '無符合分類' }));
      matched.forEach(o => {
        const item = el('div', { class: 'cursor-pointer px-3 py-2 text-sm text-gray-700 hover:bg-[#f0faf4]' + (String(o.value)===String(input.dataset.value||'')?' bg-[#f0faf4] font-semibold text-[#005c44]':''), text: o.text });
        item.addEventListener('mousedown', (ev) => {
          ev.preventDefault();
          input.dataset.value = String(o.value);
          input.value = o.text;
          list.classList.add('hidden');
          selectEl._cbOnSelect && selectEl._cbOnSelect(o.value);
        });
        list.appendChild(item);
      });
    }
    function open() { renderList(JSON.parse(input.dataset.options||'[]'), input.value.trim().toLowerCase()); list.classList.remove('hidden'); }
    input.addEventListener('focus', open);
    input.addEventListener('click', open);
    input.addEventListener('input', () => { input.dataset.value=''; open(); });
    input.addEventListener('keydown', (ev) => { if (ev.key==='Escape') list.classList.add('hidden'); if (ev.key==='Enter'){ev.preventDefault(); const first=list.querySelector('div.cursor-pointer'); first&&first.dispatchEvent(new MouseEvent('mousedown'));} });
    document.addEventListener('mousedown', (ev) => { if (!wrap.contains(ev.target)) list.classList.add('hidden'); });
    api.setOptions(options || [], includeAll || null);
    return api;
  }
  function comboOnSelect(selectEl, fn) { selectEl._cbOnSelect = fn; }
  // ---- /combobox ----

  function categoryName(c) {
    return (c && (c.name_zh_hk || c.name)) || '';
  }

  function buildOptions(select, options, includeAll) {
    select.textContent = '';
    if (includeAll) select.appendChild(el('option', { value: '', text: '全部' }));
    for (const o of options) {
      select.appendChild(el('option', { value: String(o.value), text: o.text }));
    }
  }

  function rebuildChildOptions(parentId, selectedChildId) {
    const kids = childrenByParentId.get(Number(parentId)) || [];
    const leafKids = kids.filter((c) => isLeafById.get(c.id));
    const options = leafKids.map((c) => ({ value: c.id, text: categoryName(c) }));
    if (childCombo) {
      childCombo.setOptions(options, null);
      if (selectedChildId && options.some((o) => String(o.value) === String(selectedChildId))) childCombo.input.dataset.value = String(selectedChildId);
      else if (options[0]) childCombo.input.dataset.value = String(options[0].value);
    } else {
      buildOptions(els.category, options, false);
      if (selectedChildId && options.some((o) => String(o.value) === String(selectedChildId))) {
        els.category.value = String(selectedChildId);
        return;
      }
      if (options[0]) els.category.value = String(options[0].value);
    }
  }

  function rebuildParentOptions(selectedParentId) {
    const options = rootCategories.map((c) => ({ value: c.id, text: categoryName(c) }));
    if (parentCombo) {
      parentCombo.setOptions(options, null);
      if (selectedParentId) parentCombo.input.dataset.value = String(selectedParentId);
      else if (options[0]) parentCombo.input.dataset.value = String(options[0].value);
    } else {
      buildOptions(els.parentCategory, options, false);
      if (selectedParentId && options.some((o) => String(o.value) === String(selectedParentId))) {
        els.parentCategory.value = String(selectedParentId);
        return;
      }
      if (options[0]) els.parentCategory.value = String(options[0].value);
    }
  }

  async function loadCategories() {
    const data = await adminApiRequest('/api/admin/categories');
    categories = data.categories || [];

    categoriesById = new Map(categories.map((c) => [Number(c.id), c]));
    rootCategories = categories.filter((c) => !c.parent_id);
    childrenByParentId = new Map();
    const childCountById = new Map();

    for (const c of categories) {
      if (c.parent_id) {
        const pid = Number(c.parent_id);
        const arr = childrenByParentId.get(pid) || [];
        arr.push(c);
        childrenByParentId.set(pid, arr);
      }
      if (c.parent_id) {
        const pid = Number(c.parent_id);
        childCountById.set(pid, (childCountById.get(pid) || 0) + 1);
      }
    }

    isLeafById = new Map();
    for (const c of categories) {
      const hasChildren = (childCountById.get(Number(c.id)) || 0) > 0;
      isLeafById.set(Number(c.id), Boolean(c.parent_id) && !hasChildren);
    }

    const leafCategories = categories.filter((c) => isLeafById.get(Number(c.id)));
    const leafOptions = leafCategories
      .map((c) => {
        const parent = c.parent_id ? categoriesById.get(Number(c.parent_id)) : null;
        const label = parent ? `${categoryName(parent)} / ${categoryName(c)}` : categoryName(c);
        return { value: c.id, text: label };
      })
      .sort((a, b) => a.text.localeCompare(b.text, 'zh-HK'));

    buildOptions(els.categoryFilter, leafOptions, true);
    if (filterCombo) {
      filterCombo.setOptions(leafOptions, '全部');
    }
    rebuildParentOptions(null);
    rebuildChildOptions(parentCombo ? parentCombo.value() : els.parentCategory.value, null);
  }

  async function loadProducts() {
    setError('');
    els.tbody.textContent = '';
    if (els.cards) els.cards.textContent = '';

    const params = new URLSearchParams();
    const search = (els.search.value || '').trim();
    const categoryId = els.categoryFilter.value;
    if (search) params.set('search', search);
    if (categoryId) params.set('category_id', categoryId);

    const data = await adminApiRequest('/api/admin/products?' + params.toString());
    const products = data.products || [];

    if (els.empty) els.empty.classList.toggle('hidden', products.length > 0);

    for (const p of products) {
      const child = p.category_id ? categoriesById.get(Number(p.category_id)) : null;
      const parent = child && child.parent_id ? categoriesById.get(Number(child.parent_id)) : null;
      const categoryLabel = parent && child ? `${categoryName(parent)} / ${categoryName(child)}` : (p.category_name || '');
      const activeSkuCount = Number(p.active_sku_count || 0);
      const totalStock = Number(p.total_stock || 0);
      const stockLabel = activeSkuCount > 0 ? String(totalStock) : '—';
      const lowStock = activeSkuCount > 0 && totalStock <= 5;
      const isActive = p.status === 'active';
      const productName = p.name_zh_hk || p.name || '';
      const price = Number(p.price || 0);
      const priceLabel = price > 0 ? 'HK$' + price.toFixed(2) : '未定價';

      // ---- 手機卡片 ----
      if (els.cards) {
        const thumbBox = el('div', { class: 'p-card-thumb' }, [
          p.image_url
            ? el('img', { src: p.image_url, alt: '', loading: 'lazy' })
            : el('div', { class: 'p-card-thumb-fallback' }, ['📦']),
        ]);
        const metaBadges = [productStatusSwitch(p)];
        if (activeSkuCount > 0) {
          const outOfStock = totalStock <= 0;
          const stockBadge = el('span', {
            class: 'admin-badge ' + (outOfStock || lowStock ? 'badge-danger' : 'badge-cancelled'),
            text: outOfStock ? '缺貨' : (lowStock ? `僅餘 ${totalStock}` : '庫存 ' + stockLabel),
          });
          metaBadges.push(stockBadge);
        }
        const editBtn = el('button', {
          class: 'admin-btn p-card-edit',
          type: 'button',
          text: '編輯',
          onclick: () => loadProductForEdit(p.id),
        });
        const card = el('div', { class: 'p-card' }, [
          el('div', { class: 'p-card-top' }, [
            thumbBox,
            el('div', { class: 'p-card-info' }, [
              el('div', { class: 'p-card-id', text: '#' + p.id }),
              el('div', { class: 'p-card-name', text: productName }),
              el('div', { class: 'p-card-price', text: priceLabel }),
            ]),
          ]),
          el('div', { class: 'p-card-meta' }, metaBadges),
          el('div', { class: 'p-card-actions' }, [editBtn]),
        ]);
        els.cards.appendChild(card);
      }

      // 縮圖 + 名稱（同一欄）
      const thumb = el('div', { class: 'flex items-center gap-3' }, [
        el('div', {
          class: 'h-11 w-11 flex-shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50',
        }, [
          p.image_url
            ? el('img', { src: p.image_url, alt: '', loading: 'lazy', class: 'h-full w-full object-cover' })
            : el('div', { class: 'flex h-full w-full items-center justify-center text-lg text-gray-300' }, ['📦']),
        ]),
        el('span', { class: 'font-medium text-gray-900', text: p.name_zh_hk || p.name || '' }),
      ]);

      const stockCell = el('td', { class: 'whitespace-nowrap' }, [
        el('span', {
          class: lowStock ? 'admin-badge badge-danger' : 'tabular-nums',
          text: lowStock ? `僅餘 ${totalStock}` : stockLabel,
        }),
      ]);

      // ---- 成本 / 批發 /零售三欄（Japan import rollup）----
      const fmtRange = (lo, hi, prefix) => {
        if (lo == null && hi == null) return '—';
        const f = (v) => prefix + Number(v).toFixed(2);
        if (lo != null && hi != null && Number(lo) !== Number(hi)) return f(lo) + '–' + Number(hi).toFixed(2);
        return f(lo != null ? lo : hi);
      };
      const price3 = el('td', { class: 'whitespace-nowrap text-xs leading-5 tabular-nums' }, [
        el('div', { class: 'text-gray-400', text: '成本 ' + fmtRange(p.min_cost_price, p.max_cost_price, 'HK$') }),
        el('div', { class: 'text-amber-700', text: '批發 ' + fmtRange(p.min_wholesale_price_hkd, p.max_wholesale_price_hkd, 'HK$') }),
        el('div', { class: 'text-gray-900', text: '零售 ' + (price > 0 ? 'HK$' + price.toFixed(2) : '未定價') }),
      ]);

      const tr = el('tr', {}, [
        el('td', { class: 'text-gray-400 tabular-nums', text: String(p.id) }),
        el('td', {}, [thumb]),
        el('td', { class: 'text-gray-500', text: categoryLabel }),
        price3,
        stockCell,
        el('td', {}, [productStatusSwitch(p)]),
        el('td', {}, [
          el('button', { class: 'admin-link-btn', text: '編輯', onclick: () => loadProductForEdit(p.id) }),
        ]),
      ]);
      els.tbody.appendChild(tr);
    }
  }

  function updateTotalStockDisplay() {
    if (!els.totalStock) return;
    if (!currentSkus || currentSkus.length === 0) {
      els.totalStock.textContent = '—';
      return;
    }
    const total = currentSkus
      .filter((s) => s && s.is_active !== false && Number.isInteger(Number(s.stock)))
      .reduce((acc, s) => acc + Number(s.stock || 0), 0);
    els.totalStock.textContent = String(total);
  }

  function closeSkuAdjustModal() {
    adjustingSkuId = null;
    if (els.skuAdjustSkuId) els.skuAdjustSkuId.value = '';
    if (els.skuAdjustDelta) els.skuAdjustDelta.value = '';
    if (els.skuAdjustNote) els.skuAdjustNote.value = '';
    if (els.skuAdjustModal) els.skuAdjustModal.classList.add('hidden');
  }

  function openSkuAdjustModal(skuId) {
    if (!els.skuAdjustModal || !els.skuAdjustSkuId || !els.skuAdjustDelta) return;
    adjustingSkuId = Number(skuId);
    els.skuAdjustSkuId.value = String(adjustingSkuId);
    els.skuAdjustDelta.value = '';
    if (els.skuAdjustNote) els.skuAdjustNote.value = '';
    els.skuAdjustModal.classList.remove('hidden');
    els.skuAdjustDelta.focus();
  }

  async function confirmSkuAdjust() {
    if (!adjustingSkuId) return;
    const deltaRaw = els.skuAdjustDelta ? String(els.skuAdjustDelta.value || '').trim() : '';
    const delta = parseInt(deltaRaw, 10);
    if (!Number.isInteger(delta) || delta === 0) {
      setError('delta 不正確');
      return;
    }
    const note = els.skuAdjustNote ? (String(els.skuAdjustNote.value || '').trim() || null) : null;
    try {
      setError('');
      const out = await adminApiRequest('/api/admin/inventory/adjust', {
        method: 'POST',
        json: { sku_id: adjustingSkuId, delta, note }
      });
      if (out && out.sku && typeof out.sku.stock !== 'undefined') {
        const updated = currentSkus.find((s) => s && Number(s.id) === Number(adjustingSkuId));
        if (updated) updated.stock = Number(out.sku.stock);
        closeSkuAdjustModal();
        updateTotalStockDisplay();
        renderSkus();
      }
    } catch (e) {
      setError(e && e.message ? e.message : String(e));
    }
  }

  function renderSkus() {
    if (!els.skuTbody) return;
    els.skuTbody.textContent = '';
    if (els.skuEmptyHint) {
      if (!currentSkus || currentSkus.length === 0) els.skuEmptyHint.classList.remove('hidden');
      else els.skuEmptyHint.classList.add('hidden');
    }

    for (let i = 0; i < currentSkus.length; i++) {
      const sku = currentSkus[i];
      const isActive = sku.is_active !== false;

      const skuInput = el('input', {
        class: 'admin-input w-full',
        value: sku.sku || '',
        oninput: (e) => { sku.sku = e.target.value; }
      });
      const barcodeInput = el('input', {
        class: 'admin-input w-full',
        value: sku.barcode || '',
        oninput: (e) => { sku.barcode = e.target.value; }
      });
      const costInput = el('input', {
        class: 'admin-input w-full',
        type: 'number',
        step: '0.01',
        value: sku.cost_price ?? '',
        oninput: (e) => { sku.cost_price = e.target.value === '' ? null : Number(e.target.value); }
      });
      const priceInput = el('input', {
        class: 'admin-input w-full',
        type: 'number',
        step: '0.01',
        value: sku.price ?? '',
        oninput: (e) => { sku.price = e.target.value === '' ? null : Number(e.target.value); }
      });
      const jpyCostInput = el('input', {
        class: 'admin-input w-full',
        type: 'number',
        step: '0.01',
        value: sku.cost_price_jpy ?? '',
        oninput: (e) => { sku.cost_price_jpy = e.target.value === '' ? null : Number(e.target.value); }
      });
      const wholesaleInput = el('input', {
        class: 'admin-input w-full',
        type: 'number',
        step: '0.01',
        value: sku.wholesale_price_hkd ?? '',
        oninput: (e) => { sku.wholesale_price_hkd = e.target.value === '' ? null : Number(e.target.value); }
      });

      const activeCheckbox = el('input', {
        type: 'checkbox',
        onchange: (e) => {
          sku.is_active = Boolean(e.target.checked);
          updateTotalStockDisplay();
        }
      });
      activeCheckbox.checked = isActive;

      const adjustBtn = el('button', {
        class: 'admin-link-btn',
        type: 'button',
        text: '調整庫存',
        onclick: () => {
          if (!sku.id) return;
          openSkuAdjustModal(sku.id);
        }
      });
      adjustBtn.disabled = !sku.id;

      const removeBtn = el('button', {
        class: 'admin-link-btn',
        type: 'button',
        text: '移除',
        onclick: () => {
          currentSkus.splice(i, 1);
          renderSkus();
          updateTotalStockDisplay();
        }
      });

      const tr = el('tr', {}, [
        el('td', {}, [skuInput]),
        el('td', {}, [barcodeInput]),
        el('td', {}, [costInput]),
        el('td', {}, [jpyCostInput]),
        el('td', {}, [wholesaleInput]),
        el('td', {}, [priceInput]),
        el('td', { text: sku.id ? String(sku.stock ?? 0) : '—' }),
        el('td', {}, [activeCheckbox]),
        el('td', {}, [adjustBtn, el('span', { text: ' ' }), removeBtn]),
      ]);
      els.skuTbody.appendChild(tr);
    }
  }

  async function loadProductForEdit(id) {
    setError('');
    try {
      const data = await adminApiRequest('/api/admin/products/' + encodeURIComponent(id));
      fillForm(data.product, data.skus || []);
      openModal(false);
    } catch (e) {
      setError(e && e.message ? e.message : String(e));
    }
  }

  function fillForm(p, skus) {
    const childId = p.category_id ? Number(p.category_id) : null;
    const child = childId ? categoriesById.get(childId) : null;
    const parentId = child && child.parent_id ? Number(child.parent_id) : (rootCategories[0] ? Number(rootCategories[0].id) : null);

    els.id.value = p.id ? String(p.id) : '';
    els.name.value = p.name_zh_hk || p.name || '';
    els.slug.value = p.slug || '';
    if (parentId) {
      rebuildParentOptions(parentId);
      rebuildChildOptions(parentId, childId);
    } else {
      if (parentCombo) { parentCombo.input.dataset.value=''; parentCombo.input.value=''; }
      else els.parentCategory.textContent = '';
      if (childCombo) { childCombo.input.dataset.value=''; childCombo.input.value=''; }
      else els.category.textContent = '';
    }
    els.price.value = p.price ?? '';
    els.originalPrice.value = p.original_price ?? '';
    els.status.value = p.status || 'active';
    els.imageUrl.value = p.image_url || '';
    els.imageFile.value = '';
    els.shortDesc.value = p.short_description_zh_hk || '';
    els.desc.value = p.description_zh_hk || p.description || '';

    currentSkus = Array.isArray(skus)
      ? skus.map((s) => ({
          id: s.id ? Number(s.id) : null,
          sku: s.sku || '',
          barcode: s.barcode || '',
          attributes: s.attributes || {},
          price: s.price,
          cost_price: s.cost_price,
          cost_price_jpy: s.cost_price_jpy,
          wholesale_price_hkd: s.wholesale_price_hkd,
          match_status: s.match_status,
          original_price: s.original_price,
          stock: s.stock,
          weight: s.weight,
          weight_unit: s.weight_unit,
          is_active: s.is_active !== false,
        }))
      : [];

    closeSkuAdjustModal();
    renderSkus();
    updateTotalStockDisplay();
  }

  function clearForm() {
    fillForm({
      id: '',
      name: '',
      slug: '',
      category_id: '',
      price: '',
      original_price: '',
      status: 'active',
      image_url: '',
      short_description_zh_hk: '',
      description_zh_hk: '',
    }, []);
  }

  async function uploadImageIfNeeded() {
    const file = els.imageFile.files && els.imageFile.files[0];
    if (!file) return null;
    const fd = new FormData();
    fd.append('image', file);
    const out = await adminApiRequest('/api/admin/upload', { method: 'POST', formData: fd });
    return out && out.url ? out.url : null;
  }

  async function syncMzakkaProducts() {
    setError('');
    setSyncResult('');
    if (!els.sync) return;
    els.sync.disabled = true;
    const originalText = els.sync.textContent;
    els.sync.textContent = '同步中...';
    try {
      const out = await adminApiRequest('/api/admin/catalog/mzakka-sync', {
        method: 'POST',
        json: { pages: 1, limit: 0, delay_ms: 120, batch_size: 100 }
      });
      const result = out && out.result ? out.result : {};
      const imported = result.import || {};
      setSyncResult(
        `已抓取 ${result.recordsFetched || 0} 件，更新商品 ${imported.productsUpserted || 0} 件，SKU ${imported.skusUpserted || 0} 筆。`
      );
      await loadProducts();
    } catch (e) {
      setSyncResult(e && e.message ? e.message : String(e), true);
    } finally {
      els.sync.disabled = false;
      els.sync.textContent = originalText;
    }
  }

  els.form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    setError('');
    els.save.disabled = true;
    try {
      const uploadedUrl = await uploadImageIfNeeded();
      const image_url = uploadedUrl || (els.imageUrl.value || '').trim() || null;

      const payload = {
        name: els.name.value.trim(),
        name_zh_hk: els.name.value.trim(),
        slug: (els.slug.value || '').trim() || undefined,
        description: null,
        description_zh_hk: els.desc.value || null,
        short_description: null,
        short_description_zh_hk: els.shortDesc.value || null,
        price: els.price.value,
        original_price: els.originalPrice.value || null,
        category_id: (childCombo ? childCombo.value() : els.category.value) ? Number(childCombo ? childCombo.value() : els.category.value) : null,
        image_url,
        gallery_images: null,
        status: els.status.value,
        skus: (currentSkus || []).map((s) => ({
          id: s.id || undefined,
          sku: s.sku || null,
          barcode: s.barcode || null,
          attributes: s.attributes || {},
          price: s.price === '' ? null : (s.price ?? null),
          cost_price: s.cost_price === '' ? null : (s.cost_price ?? null),
          cost_price_jpy: s.cost_price_jpy === '' ? null : (s.cost_price_jpy ?? null),
          wholesale_price_hkd: s.wholesale_price_hkd === '' ? null : (s.wholesale_price_hkd ?? null),
          original_price: s.original_price === '' ? null : (s.original_price ?? null),
          stock: s.stock ?? 0,
          weight: s.weight ?? null,
          weight_unit: s.weight_unit || 'g',
          is_active: s.is_active !== false,
        })),
      };

      const id = (els.id.value || '').trim();
      if (id) {
        await adminApiRequest('/api/admin/products/' + encodeURIComponent(id), { method: 'PUT', json: payload });
      } else {
        await adminApiRequest('/api/admin/products', { method: 'POST', json: payload });
      }

      await loadProducts();
      clearForm();
      closeModal();
      showSuccess(els.form.parentNode, id ? '商品已更新' : '商品已建立', 2400);
    } catch (e) {
      setError(e && e.message ? e.message : String(e));
    } finally {
      els.save.disabled = false;
    }
  });

  els.reset.addEventListener('click', () => clearForm());
  els.refresh.addEventListener('click', () => loadProducts().catch((e) => setError(e.message)));
  if (els.sync) {
    els.sync.addEventListener('click', () => syncMzakkaProducts());
  }
  els.newBtn.addEventListener('click', () => { clearForm(); openModal(true); });
  els.search.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') loadProducts().catch((e) => setError(e.message));
  });
  els.categoryFilter.addEventListener('change', () => loadProducts().catch((e) => setError(e.message)));
  els.parentCategory.addEventListener('change', () => {
    rebuildChildOptions(parentCombo ? parentCombo.value() : els.parentCategory.value, null);
  });
  if (els.modalClose) els.modalClose.addEventListener('click', closeModal);
  if (els.modal) els.modal.addEventListener('mousedown', (e) => {
    if (e.target === els.modal) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && els.modal && !els.modal.classList.contains('hidden')) closeModal();
  });
  if (els.skuAdjustCancel) {
    els.skuAdjustCancel.addEventListener('click', () => closeSkuAdjustModal());
  }
  if (els.skuAdjustConfirm) {
    els.skuAdjustConfirm.addEventListener('click', () => confirmSkuAdjust());
  }
  if (els.skuAdd) {
    els.skuAdd.addEventListener('click', () => {
      currentSkus.push({
        id: null,
        sku: '',
        barcode: '',
        attributes: {},
        price: null,
        cost_price: null,
        original_price: null,
        stock: 0,
        weight: null,
        weight_unit: 'g',
        is_active: true,
      });
      closeSkuAdjustModal();
      renderSkus();
      updateTotalStockDisplay();
    });
  }

  try {
    await loadCategories();
    // 將三個分類 <select> 升級做搜尋 combobox（必須喺 loadCategories 之後，先有初始 options）
    parentCombo = createCombobox(els.parentCategory, [], null);
    childCombo = createCombobox(els.category, [], null);
    filterCombo = createCombobox(els.categoryFilter, [], '全部');
    comboOnSelect(els.parentCategory, () => rebuildChildOptions(parentCombo.value(), null));
    comboOnSelect(els.categoryFilter, () => loadProducts().catch(e => setError(e.message)));
    // 重新灌入依三個 select 已 build 好嘅 options
    rebuildParentOptions(null);
    rebuildChildOptions(parentCombo.value(), null);
    const leafOpts = JSON.parse(els.categoryFilter.dataset.options || '[]');
    filterCombo.setOptions(leafOpts.slice(1), '全部');
    await loadProducts();
    clearForm();
  } catch (e) {
    setError(e && e.message ? e.message : String(e));
  }
})();
