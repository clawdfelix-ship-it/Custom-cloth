(async function () {
  const { $, el, adminApiRequest } = window.AdminCommon;

  const els = {
    id: $('#cp-id'),
    code: $('#cp-code'),
    type: $('#cp-type'),
    value: $('#cp-value'),
    minOrderAmount: $('#cp-min-order-amount'),
    maxDiscountAmount: $('#cp-max-discount-amount'),
    usageLimit: $('#cp-usage-limit'),
    usageLimitPerUser: $('#cp-usage-limit-per-user'),
    allowedCategories: $('#cp-allowed-categories'),
    allowedProducts: $('#cp-allowed-products'),
    allowedMemberLevels: $('#cp-allowed-member-levels'),
    startsAt: $('#cp-starts-at'),
    expiresAt: $('#cp-expires-at'),
    active: $('#cp-active'),
    save: $('#cp-save'),
    reset: $('#cp-reset'),
    filter: $('#cp-filter'),
    error: $('#cp-error'),
    tbody: $('#cp-tbody'),
    pagination: $('#cp-pagination'),
    create: $('#coupon-create'),
    modal: $('#coupon-modal'),
    modalClose: $('#coupon-modal-close'),
    modalTitle: $('#coupon-modal-title'),
  };

  let currentPage = 1;

  function openModal(isNew) {
    if (!els.modal) return;
    if (els.modalTitle) els.modalTitle.textContent = isNew ? '新增優惠券' : '編輯優惠券';
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
    els.error.classList.add('whitespace-pre-line');
    els.error.textContent = msg;
  }

  function numOrNull(input) {
    if (!input) return null;
    const v = String(input.value || '').trim();
    if (v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function strOrNull(input) {
    if (!input) return null;
    const v = String(input.value || '').trim();
    return v === '' ? null : v;
  }

  // datetime-local <-> ISO
  function isoToLocalInput(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function localInputToIso(input) {
    if (!input) return null;
    const v = String(input.value || '').trim();
    if (!v) return null;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  function parseIdList(input) {
    const v = strOrNull(input);
    if (!v) return null;
    const ids = v.split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n > 0);
    return ids.length ? ids : null;
  }

  function parseLevelList(input) {
    const v = strOrNull(input);
    if (!v) return null;
    const levels = v.split(',').map((s) => s.trim()).filter(Boolean);
    return levels.length ? levels : null;
  }

  function formatJsonArray(v) {
    if (!v) return '';
    if (Array.isArray(v)) return v.join(', ');
    if (typeof v === 'string') {
      try {
        const parsed = JSON.parse(v);
        return Array.isArray(parsed) ? parsed.join(', ') : String(v);
      } catch (e) {
        return String(v);
      }
    }
    return String(v);
  }

  function clearForm() {
    const fields = [
      els.id, els.code, els.value, els.minOrderAmount, els.maxDiscountAmount,
      els.usageLimit, els.usageLimitPerUser, els.allowedCategories,
      els.allowedProducts, els.allowedMemberLevels, els.startsAt, els.expiresAt,
    ];
    for (const f of fields) {
      if (f) f.value = '';
    }
    if (els.type) els.type.value = 'percentage';
    if (els.active) els.active.checked = true;
  }

  function readForm() {
    const idRaw = els.id ? String(els.id.value || '').trim() : '';
    const id = idRaw ? Number(idRaw) : null;

    const base = {
      code: strOrNull(els.code),
      type: els.type ? els.type.value : 'percentage',
      value: numOrNull(els.value),
      min_order_amount: numOrNull(els.minOrderAmount),
      max_discount_amount: numOrNull(els.maxDiscountAmount),
      usage_limit: numOrNull(els.usageLimit),
      usage_limit_per_user: numOrNull(els.usageLimitPerUser),
      starts_at: localInputToIso(els.startsAt),
      expires_at: localInputToIso(els.expiresAt),
      is_active: els.active ? Boolean(els.active.checked) : true,
    };

    // 適用範圍只喺 POST（route 合約）先傳
    const createOnly = {
      allowed_categories: parseIdList(els.allowedCategories),
      allowed_products: parseIdList(els.allowedProducts),
      allowed_member_levels: parseLevelList(els.allowedMemberLevels),
    };

    return {
      id: Number.isInteger(id) && id > 0 ? id : null,
      base,
      createOnly,
    };
  }

  function fillForm(c) {
    if (els.id) els.id.value = c && c.id ? String(c.id) : '';
    if (els.code) els.code.value = c && c.code ? String(c.code) : '';
    if (els.type) els.type.value = c && c.type ? String(c.type) : 'percentage';
    if (els.value) els.value.value = c && c.value != null ? String(c.value) : '';
    if (els.minOrderAmount) els.minOrderAmount.value = c && c.min_order_amount != null ? String(c.min_order_amount) : '';
    if (els.maxDiscountAmount) els.maxDiscountAmount.value = c && c.max_discount_amount != null ? String(c.max_discount_amount) : '';
    if (els.usageLimit) els.usageLimit.value = c && c.usage_limit != null ? String(c.usage_limit) : '';
    if (els.usageLimitPerUser) els.usageLimitPerUser.value = c && c.usage_limit_per_user != null ? String(c.usage_limit_per_user) : '';
    if (els.allowedCategories) els.allowedCategories.value = formatJsonArray(c.allowed_categories);
    if (els.allowedProducts) els.allowedProducts.value = formatJsonArray(c.allowed_products);
    if (els.allowedMemberLevels) els.allowedMemberLevels.value = formatJsonArray(c.allowed_member_levels);
    if (els.startsAt) els.startsAt.value = isoToLocalInput(c.starts_at);
    if (els.expiresAt) els.expiresAt.value = isoToLocalInput(c.expires_at);
    if (els.active) els.active.checked = c ? (c.is_active !== false) : true;
  }

  function typeLabel(c) {
    if (c.type === 'percentage') return '% 折扣';
    if (c.type === 'fixed') return '固定金額';
    if (c.type === 'free_shipping') return '免運費';
    return c.type || '';
  }

  function valueLabel(c) {
    if (c.type === 'percentage') return (c.value != null ? c.value : '') + '%';
    if (c.type === 'fixed') return 'HK$' + (c.value != null ? c.value : '');
    if (c.type === 'free_shipping') return '—';
    return c.value != null ? String(c.value) : '';
  }

  async function loadCoupons() {
    setError('');
    let path = '/api/admin/coupons?page=' + encodeURIComponent(String(currentPage)) + '&page_size=50';
    if (els.filter && els.filter.value) {
      path += '&is_active=' + encodeURIComponent(els.filter.value);
    }
    const data = await adminApiRequest(path);
    const rows = data.coupons || [];
    const pg = data.pagination || {};

    if (els.tbody) {
      els.tbody.textContent = '';
      for (const c of rows) {
        const isActive = c.is_active !== false;

        const editBtn = el('button', {
          class: 'admin-link-btn',
          type: 'button',
          text: '編輯',
          onclick: () => { fillForm(c); openModal(false); },
        });

        const delBtn = el('button', {
          class: 'admin-link-btn',
          type: 'button',
          text: '刪除',
          onclick: async () => {
            if (!window.confirm('確定刪除優惠碼 ' + c.code + '？')) return;
            try {
              setError('');
              await adminApiRequest('/api/admin/coupons/' + encodeURIComponent(String(c.id)), { method: 'DELETE' });
              await loadCoupons();
            } catch (e) {
              setError(e && e.message ? e.message : String(e));
            }
          },
        });

        const usage = String(c.used_count != null ? c.used_count : 0) +
          (c.usage_limit != null ? ' / ' + String(c.usage_limit) : '');
        const period = [isoToLocalInput(c.starts_at), isoToLocalInput(c.expires_at)]
          .map((s) => s.replace('T', ' ')).filter(Boolean).join(' 至 ') || '—';

        els.tbody.appendChild(el('tr', {}, [
          el('td', { text: c.code || '' }),
          el('td', { text: typeLabel(c) }),
          el('td', { text: valueLabel(c) }),
          el('td', { text: usage }),
          el('td', { text: period }),
          el('td', { text: isActive ? '啟用' : '停用' }),
          el('td', {}, [editBtn, el('span', { text: ' ' }), delBtn]),
        ]));
      }
    }

    if (els.pagination) {
      els.pagination.textContent = '';
      const total = pg.total != null ? pg.total : rows.length;
      const pageSize = pg.page_size || 50;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));

      if (currentPage > 1) {
        els.pagination.appendChild(el('button', {
          class: 'admin-link-btn', type: 'button', text: '上一頁',
          onclick: () => { currentPage -= 1; loadCoupons().catch((e) => setError(e.message)); },
        }));
      }
      els.pagination.appendChild(el('span', { text: ' 第 ' + currentPage + ' / ' + totalPages + ' 頁（共 ' + total + ' 張） ' }));
      if (currentPage < totalPages) {
        els.pagination.appendChild(el('button', {
          class: 'admin-link-btn', type: 'button', text: '下一頁',
          onclick: () => { currentPage += 1; loadCoupons().catch((e) => setError(e.message)); },
        }));
      }
    }
  }

  async function saveCoupon() {
    setError('');
    const { id, base, createOnly } = readForm();
    if (!base.code) {
      setError('優惠碼必填');
      return;
    }
    if (base.value === null || !Number.isFinite(base.value)) {
      setError('折扣數值必填');
      return;
    }
    if (id) {
      // PUT route 唔更新適用範圍欄位，照 route 合約只傳佢接收嘅欄位
      await adminApiRequest('/api/admin/coupons/' + encodeURIComponent(String(id)), { method: 'PUT', json: base });
    } else {
      await adminApiRequest('/api/admin/coupons', { method: 'POST', json: Object.assign({}, base, createOnly) });
    }
    clearForm();
    closeModal();
    await loadCoupons();
  }

  if (els.reset) els.reset.addEventListener('click', () => clearForm());
  if (els.save) els.save.addEventListener('click', () => saveCoupon().catch((e) => setError(e.message)));
  if (els.filter) els.filter.addEventListener('change', () => {
    currentPage = 1;
    loadCoupons().catch((e) => setError(e.message));
  });
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
    await loadCoupons();
  } catch (e) {
    setError(e && e.message ? e.message : String(e));
  }
})();
