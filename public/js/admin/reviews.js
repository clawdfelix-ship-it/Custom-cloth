(async function () {
  const { $, el, adminApiRequest } = window.AdminCommon;

  const els = {
    refresh: $('#reviews-refresh'),
    error: $('#reviews-error'),
    tbody: $('#reviews-tbody'),
  };

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

  function formatTime(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    const pad = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function ratingStars(rating) {
    const n = Math.max(0, Math.min(5, Number(rating) || 0));
    const full = '★'.repeat(n);
    const empty = '☆'.repeat(5 - n);
    return el('span', {
      text: full + empty + '（' + n + '星）',
      style: 'white-space:nowrap;color:#b45309;font-weight:700;',
    });
  }

  function parseImages(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.filter(Boolean);
    try {
      const parsed = JSON.parse(String(raw));
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch (e) {
      return [];
    }
  }

  function reviewBodyCell(r) {
    const wrap = el('div', { class: 'space-y-1', style: 'min-width:200px;max-width:420px;' });
    if (r.title) {
      wrap.appendChild(el('div', { class: 'font-bold', text: String(r.title) }));
    }
    if (r.content) {
      wrap.appendChild(el('div', { style: 'white-space:pre-wrap;word-break:break-word;', text: String(r.content) }));
    }
    const images = parseImages(r.images);
    if (images.length > 0) {
      const imgRow = el('div', { class: 'flex gap-1 flex-wrap' });
      for (const src of images.slice(0, 6)) {
        imgRow.appendChild(el('img', {
          src: String(src),
          alt: '評價圖片',
          style: 'width:44px;height:44px;border-radius:6px;object-fit:cover;background:#f3f4f6;',
        }));
      }
      wrap.appendChild(imgRow);
    }
    if (!r.title && !r.content && images.length === 0) {
      wrap.appendChild(el('span', { style: 'color:var(--ad-muted);', text: '（冇填文字內容）' }));
    }
    return wrap;
  }

  async function updateStatus(r, status) {
    const label = status === 'approved' ? '核准' : '駁回';
    if (!confirm('確定' + label + '呢條評價？')) return;
    setError('');
    await adminApiRequest('/api/admin/reviews/' + encodeURIComponent(String(r.id)) + '/status', {
      method: 'PUT',
      json: { status },
    });
    await loadPending();
  }

  function renderRow(r) {
    const approveBtn = el('button', {
      class: 'admin-btn',
      type: 'button',
      text: '核准',
      onclick: () => updateStatus(r, 'approved').catch((e) => setError(e.message)),
    });
    const rejectBtn = el('button', {
      class: 'admin-btn-secondary',
      type: 'button',
      text: '駁回',
      onclick: () => updateStatus(r, 'rejected').catch((e) => setError(e.message)),
    });
    const actions = el('div', { class: 'flex gap-2', style: 'min-width:190px;' }, [approveBtn, rejectBtn]);

    return el('tr', {}, [
      el('td', { text: r.product_name || ('#' + r.product_id), style: 'font-weight:700;min-width:120px;' }),
      el('td', { text: r.username || '', style: 'white-space:nowrap;' }),
      el('td', {}, [ratingStars(r.rating)]),
      el('td', {}, [reviewBodyCell(r)]),
      el('td', { text: formatTime(r.created_at), style: 'white-space:nowrap;color:var(--ad-muted);' }),
      el('td', {}, [actions]),
    ]);
  }

  async function loadPending() {
    setError('');
    if (!els.tbody) return;
    els.tbody.textContent = '';
    const data = await adminApiRequest('/api/admin/reviews/pending');
    const rows = data.reviews || [];

    if (rows.length === 0) {
      els.tbody.appendChild(el('tr', {}, [
        el('td', {
          colspan: '6',
          text: '暫時冇待審核嘅評價',
          style: 'text-align:center;color:var(--ad-muted);padding:1.5rem;',
        }),
      ]));
      return;
    }

    for (const r of rows) {
      els.tbody.appendChild(renderRow(r));
    }
  }

  if (els.refresh) els.refresh.addEventListener('click', () => loadPending().catch((e) => setError(e.message)));

  try {
    await loadPending();
  } catch (e) {
    setError(e && e.message ? e.message : String(e));
  }
})();
