(async function () {
  // 後端合約（routes/members.js，admin_operation_logs 表，requireSuperAdmin）：
  //   GET /api/admin/operation-logs?page=&page_size=&admin_id=
  //       → { logs:[{ id, admin_id, admin_name, action, entity_type, entity_id,
  //                   old_data, new_data, ip_address, user_agent, created_at }],
  //           pagination:{ page, page_size, total } }
  // 唯讀，冇寫入端點。
  const { $, el, adminApiRequest } = window.AdminCommon;

  const PAGE_SIZE = 50;

  const els = {
    adminId: $('#ol-admin-id'),
    search: $('#ol-search'),
    clear: $('#ol-clear'),
    refresh: $('#ol-refresh'),
    error: $('#ol-error'),
    tbody: $('#ol-tbody'),
    pagination: $('#ol-pagination'),
  };

  let currentPage = 1;
  let adminIdFilter = '';

  function setError(msg) {
    if (!els.error) return;
    if (!msg) {
      els.error.classList.add('hidden');
      els.error.classList.remove('whitespace-pre-line');
      els.error.textContent = '';
      return;
    }
    els.error.classList.remove('hidden');
    els.error.classList.add('whitespace-pre-line');
    els.error.textContent = msg;
  }

  function formatTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    const pad = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  // JSON 欄位（pg 會自動 parse 成 object）：用 <pre> 縮排顯示
  function jsonCell(data) {
    if (data === null || data === undefined || data === '') {
      return el('span', { text: '—' });
    }
    let text;
    if (typeof data === 'string') {
      // 可能係 JSON 字串，試下 parse 再縮排
      try {
        text = JSON.stringify(JSON.parse(data), null, 2);
      } catch (e) {
        text = data;
      }
    } else {
      text = JSON.stringify(data, null, 2);
    }
    return el('pre', {
      class: 'text-xs whitespace-pre-wrap break-all m-0 max-h-40 overflow-auto',
      text,
    });
  }

  function changeCell(row) {
    const wrap = el('div', { class: 'space-y-1' });
    const oldPre = jsonCell(row.old_data);
    const newPre = jsonCell(row.new_data);
    wrap.appendChild(el('div', { class: 'text-xs opacity-70' }, [el('span', { text: '舊：' }), oldPre]));
    wrap.appendChild(el('div', { class: 'text-xs' }, [el('span', { text: '新：' }), newPre]));
    return wrap;
  }

  async function loadLogs() {
    setError('');
    let path = '/api/admin/operation-logs?page=' + encodeURIComponent(String(currentPage)) +
      '&page_size=' + encodeURIComponent(String(PAGE_SIZE));
    if (adminIdFilter) {
      path += '&admin_id=' + encodeURIComponent(adminIdFilter);
    }

    const data = await adminApiRequest(path);
    const rows = data.logs || [];
    const pg = data.pagination || {};

    if (els.tbody) {
      els.tbody.textContent = '';
      for (const r of rows) {
        const adminLabel = r.admin_name
          ? String(r.admin_name) + ' (#' + String(r.admin_id) + ')'
          : '#' + String(r.admin_id);
        els.tbody.appendChild(el('tr', { valign: 'top' }, [
          el('td', { class: 'whitespace-nowrap', text: formatTime(r.created_at) }),
          el('td', { text: adminLabel }),
          el('td', { text: r.action || '' }),
          el('td', { text: r.entity_type || '' }),
          el('td', { text: r.entity_id != null ? String(r.entity_id) : '' }),
          el('td', { text: r.ip_address || '—' }),
          el('td', {}, [changeCell(r)]),
        ]));
      }
    }

    if (els.pagination) {
      els.pagination.textContent = '';
      const total = pg.total != null ? pg.total : rows.length;
      const pageSize = pg.page_size || PAGE_SIZE;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));

      if (currentPage > 1) {
        els.pagination.appendChild(el('button', {
          class: 'admin-link-btn', type: 'button', text: '上一頁',
          onclick: () => { currentPage -= 1; loadLogs().catch((e) => setError(e.message)); },
        }));
      }
      els.pagination.appendChild(el('span', {
        text: ' 第 ' + currentPage + ' / ' + totalPages + ' 頁（共 ' + total + ' 條） ',
      }));
      if (currentPage < totalPages) {
        els.pagination.appendChild(el('button', {
          class: 'admin-link-btn', type: 'button', text: '下一頁',
          onclick: () => { currentPage += 1; loadLogs().catch((e) => setError(e.message)); },
        }));
      }
    }
  }

  function applyFilter() {
    const raw = els.adminId ? String(els.adminId.value || '').trim() : '';
    if (raw) {
      const n = Number(raw);
      if (!Number.isInteger(n) || n <= 0) {
        setError('管理員 ID 要係正整數');
        return;
      }
      adminIdFilter = String(n);
    } else {
      adminIdFilter = '';
    }
    currentPage = 1;
    loadLogs().catch((e) => setError(e && e.message ? e.message : String(e)));
  }

  if (els.search) els.search.addEventListener('click', applyFilter);
  if (els.clear) els.clear.addEventListener('click', () => {
    if (els.adminId) els.adminId.value = '';
    adminIdFilter = '';
    currentPage = 1;
    loadLogs().catch((e) => setError(e && e.message ? e.message : String(e)));
  });
  if (els.refresh) els.refresh.addEventListener('click', () => {
    loadLogs().catch((e) => setError(e && e.message ? e.message : String(e)));
  });
  if (els.adminId) els.adminId.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') applyFilter();
  });

  try {
    await loadLogs();
  } catch (e) {
    setError(e && e.message ? e.message : String(e));
  }
})();
