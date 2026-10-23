(async function () {
  const { $, el, adminApiRequest } = window.AdminCommon;

  const els = {
    search: $('#users-search'),
    refresh: $('#users-refresh'),
    newBtn: $('#users-new'),
    error: $('#users-error'),
    tbody: $('#users-tbody'),

    form: $('#user-form'),
    id: $('#user-id'),
    username: $('#user-username'),
    email: $('#user-email'),
    phone: $('#user-phone'),
    whatsapp: $('#user-whatsapp'),
    active: $('#user-active'),
    blacklisted: $('#user-blacklisted'),
    admin: $('#user-admin'),
    b2b: $('#user-b2b'),
    role: $('#user-role'),
    passwordWrap: $('#user-password-wrap'),
    password: $('#user-password'),
    reset: $('#user-reset'),
    save: $('#user-save'),
    resetPassword: $('#user-reset-password'),

    passwordModal: $('#user-password-modal'),
    newPassword: $('#user-new-password'),
    passwordConfirm: $('#user-password-confirm'),
    passwordCancel: $('#user-password-cancel'),

    pointsPanel: $('#user-points-panel'),
    pointsBalance: $('#user-points-balance'),
    pointsDelta: $('#user-points-delta'),
    pointsReason: $('#user-points-reason'),
    pointsApply: $('#user-points-apply'),
    pointsRefresh: $('#user-points-refresh'),
    pointsTbody: $('#user-points-tbody'),
    modal: $('#user-modal'),
    modalClose: $('#user-modal-close'),
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

  let users = [];
  let roles = [];

  function ensureRoleOptions() {
    if (!els.role) return;
    els.role.textContent = '';
    els.role.appendChild(el('option', { value: '', text: '（無）' }));
    for (const r of roles) {
      els.role.appendChild(el('option', { value: String(r.id), text: r.name }));
    }
  }

  async function loadRoles() {
    try {
      const out = await adminApiRequest('/api/admin/roles');
      roles = out.roles || [];
      ensureRoleOptions();
    } catch (e) {
      roles = [];
      ensureRoleOptions();
    }
  }

  function fillForm(u) {
    const isNew = !u || !u.id;
    els.id.value = isNew ? '' : String(u.id);
    els.username.value = u && u.username ? u.username : '';
    els.email.value = u && u.email ? u.email : '';
    els.phone.value = u && u.phone ? u.phone : '';
    els.whatsapp.value = u && u.whatsapp ? u.whatsapp : '';
    els.active.value = String(u && u.is_active !== undefined ? !!u.is_active : true);
    els.blacklisted.value = String(u && u.is_blacklisted !== undefined ? !!u.is_blacklisted : false);
    els.admin.value = String(u && u.is_admin !== undefined ? !!u.is_admin : false);
    if (els.b2b) els.b2b.value = String(u && u.is_b2b !== undefined ? !!u.is_b2b : false);
    if (els.role) els.role.value = u && u.role_id ? String(u.role_id) : '';
    els.password.value = '';
    els.passwordWrap.style.display = isNew ? '' : 'none';

    // 積分：現有用戶即載入結餘＋流水；新用戶清空
    if (!isNew && u && u.id) {
      loadPoints(u.id).catch((e) => renderPointsError(e.message));
    } else {
      clearPoints();
    }
  }

  function clearForm() {
    fillForm({ id: '', username: '', email: '', phone: '', whatsapp: '', is_active: true, is_blacklisted: false, is_admin: false, is_b2b: false });
  }

  // ===================== 積分管理 =====================
  const TYPE_LABEL = {
    earn: '賺取', redeem: '兌換', adjust: '調整',
    revoke: '追回', expire: '過期', birthday: '生日',
  };
  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function fmtTime(t) {
    if (!t) return '';
    try { return new Date(t).toLocaleString('zh-HK', { month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false }); }
    catch (_) { return String(t); }
  }
  function clearPoints() {
    if (els.pointsBalance) els.pointsBalance.textContent = '—';
    if (els.pointsDelta) els.pointsDelta.value = '';
    if (els.pointsReason) els.pointsReason.value = '';
    if (els.pointsTbody) {
      els.pointsTbody.innerHTML = '<tr><td colspan="4" class="text-center text-gray-400 py-3">請先選擇用戶</td></tr>';
    }
  }
  function renderPointsError(msg) {
    if (els.pointsTbody) {
      els.pointsTbody.innerHTML = '<tr><td colspan="4" class="text-center text-red-500 py-3">' + escHtml(msg) + '</td></tr>';
    }
  }
  function renderPoints(balance, rows) {
    if (els.pointsBalance) els.pointsBalance.textContent = String(balance);
    if (!els.pointsTbody) return;
    if (!rows || !rows.length) {
      els.pointsTbody.innerHTML = '<tr><td colspan="4" class="text-center text-gray-400 py-3">暫無積分流水</td></tr>';
      return;
    }
    els.pointsTbody.innerHTML = rows.map((r) => {
      const pts = parseInt(r.points, 10);
      const color = pts > 0 ? '#065f46' : '#991b1b';
      const sign = pts > 0 ? '+' : '';
      return '<tr>' +
        '<td>' + escHtml(fmtTime(r.created_at)) + '</td>' +
        '<td style="color:' + color + ';font-weight:700">' + sign + pts + '</td>' +
        '<td>' + escHtml(TYPE_LABEL[r.type] || r.type) + '</td>' +
        '<td>' + escHtml(r.description || '') + '</td>' +
        '</tr>';
    }).join('');
  }
  async function loadPoints(userId) {
    const data = await adminApiRequest('/api/admin/users/' + encodeURIComponent(userId) + '/points');
    renderPoints(data.balance, data.history ? data.history.rows : []);
  }
  if (els.pointsApply) {
    els.pointsApply.addEventListener('click', async () => {
      const id = (els.id.value || '').trim();
      if (!id) { setError('請先揀一個用戶'); return; }
      const points = parseInt(els.pointsDelta.value, 10);
      const reason = (els.pointsReason.value || '').trim();
      if (!Number.isInteger(points) || points === 0) { setError('請輸入非零整數（減分用負數）'); return; }
      if (!reason) { setError('必須填寫調整原因'); return; }
      setError('');
      els.pointsApply.disabled = true;
      try {
        const data = await adminApiRequest('/api/admin/users/' + encodeURIComponent(id) + '/points', {
          method: 'POST',
          json: { points, reason },
        });
        els.pointsDelta.value = '';
        els.pointsReason.value = '';
        renderPoints(data.balance, data.history ? data.history.rows : []);
      } catch (e) {
        setError(e && e.message ? e.message : String(e));
      } finally {
        els.pointsApply.disabled = false;
      }
    });
  }
  if (els.pointsRefresh) {
    els.pointsRefresh.addEventListener('click', () => {
      const id = (els.id.value || '').trim();
      if (id) loadPoints(id).catch((e) => renderPointsError(e.message));
    });
  }

  async function loadUsers() {
    setError('');
    els.tbody.textContent = '';
    const params = new URLSearchParams();
    const search = (els.search.value || '').trim();
    if (search) params.set('search', search);
    const data = await adminApiRequest('/api/admin/users?' + params.toString());
    users = data.users || [];

    for (const u of users) {
      const status = (u.is_blacklisted ? '黑名單' : (u.is_active ? '啟用' : '停用'));
      const tr = el('tr', {}, [
        el('td', { text: String(u.id) }),
        el('td', { text: u.username || '' }),
        el('td', { text: u.email || '' }),
        el('td', { text: u.phone || '' }),
        el('td', { text: status }),
        el('td', { text: u.is_admin ? '是' : '否' }),
        el('td', { text: u.is_b2b ? '是' : '否' }),
        el('td', { text: u.role_name || '' }),
        el('td', {}, [
          el('button', { class: 'admin-link-btn', text: '編輯', onclick: () => { fillForm(u); openModal(); } }),
        ]),
      ]);
      els.tbody.appendChild(tr);
    }
  }

  els.form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    setError('');
    els.save.disabled = true;
    try {
      const id = (els.id.value || '').trim();
      if (id) {
        await adminApiRequest('/api/admin/users/' + encodeURIComponent(id), {
          method: 'PUT',
          json: {
            email: (els.email.value || '').trim() || null,
            phone: (els.phone.value || '').trim() || null,
            whatsapp: (els.whatsapp.value || '').trim() || null,
            first_name: null,
            last_name: null,
            is_active: els.active.value === 'true',
            is_blacklisted: els.blacklisted.value === 'true',
            is_admin: els.admin.value === 'true',
            is_b2b: els.b2b && els.b2b.value === 'true',
            member_level_id: null,
            role_id: els.role && els.role.value ? Number(els.role.value) : null,
          },
        });
      } else {
        if (!els.password.value || els.password.value.length < 6) {
          throw new Error('新用戶密碼至少 6 位');
        }
        await adminApiRequest('/api/admin/users', {
          method: 'POST',
          json: {
            username: els.username.value.trim(),
            email: (els.email.value || '').trim() || null,
            phone: (els.phone.value || '').trim() || null,
            password: els.password.value,
            first_name: null,
            last_name: null,
            is_admin: els.admin.value === 'true',
            is_active: els.active.value === 'true',
            role_id: els.role && els.role.value ? Number(els.role.value) : null,
          },
        });
      }

      await loadUsers();
      clearForm();
      closeModal();
    } catch (e) {
      setError(e && e.message ? e.message : String(e));
    } finally {
      els.save.disabled = false;
    }
  });

  els.resetPassword.addEventListener('click', async () => {
    const id = (els.id.value || '').trim();
    if (!id) {
      setError('請先揀一個用戶');
      return;
    }
    if (els.newPassword) els.newPassword.value = '';
    if (els.passwordModal) els.passwordModal.classList.remove('hidden');
  });

  if (els.passwordCancel) {
    els.passwordCancel.addEventListener('click', () => {
      if (els.passwordModal) els.passwordModal.classList.add('hidden');
    });
  }

  if (els.passwordConfirm) {
    els.passwordConfirm.addEventListener('click', async () => {
      const id = (els.id.value || '').trim();
      const pw = (els.newPassword && els.newPassword.value ? els.newPassword.value : '').trim();
      if (!id) return;
      if (!pw || pw.length < 6) {
        setError('密碼至少 6 位');
        return;
      }
      try {
        await adminApiRequest('/api/admin/users/' + encodeURIComponent(id) + '/password', {
          method: 'POST',
          json: { new_password: pw },
        });
        setError('');
        if (els.passwordModal) els.passwordModal.classList.add('hidden');
      } catch (e) {
        setError(e && e.message ? e.message : String(e));
      }
    });
  }

  els.reset.addEventListener('click', () => clearForm());
  els.refresh.addEventListener('click', () => loadUsers().catch((e) => setError(e.message)));
  els.newBtn.addEventListener('click', () => { clearForm(); openModal(); });
  if (els.modalClose) els.modalClose.addEventListener('click', closeModal);
  if (els.modal) els.modal.addEventListener('mousedown', (e) => {
    if (e.target === els.modal) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && els.modal && !els.modal.classList.contains('hidden')) closeModal();
  });
  els.search.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') loadUsers().catch((e) => setError(e.message));
  });

  try {
    await loadRoles();
    await loadUsers();
    clearForm();
  } catch (e) {
    setError(e && e.message ? e.message : String(e));
  }
})();
