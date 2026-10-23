(async function () {
  // 後端合約（routes/marketing.js）：
  //   GET    /api/admin/blog/posts?page=&page_size=&status=
  //          → { posts:[id,title,slug,status,publish_at,featured_image,created_at,updated_at],
  //              pagination:{page,page_size,total} }   ← 列表唔包 content/excerpt/meta_*
  //   POST   /api/admin/blog/posts                 title/slug/content/excerpt/featured_image/
  //                                                status/publish_at/meta_title/meta_description
  //   PUT    /api/admin/blog/posts/:id             同上
  //   DELETE /api/admin/blog/posts/:id
  //   GET    /api/blog/posts/:slug （公開，僅 published 先有；draft/archived 會 404）
  const { $, el, adminApiRequest } = window.AdminCommon;

  const PAGE_SIZE = 20;
  // 狀態照 blog_posts.status 用法（route 預設 draft；公開端只出 published）
  const STATUSES = ['draft', 'published', 'archived'];

  const els = {
    id: $('#bl-id'),
    title: $('#bl-title'),
    slug: $('#bl-slug'),
    slugGen: $('#bl-slug-gen'),
    featuredImage: $('#bl-featured-image'),
    status: $('#bl-status'),
    publishAt: $('#bl-publish-at'),
    metaTitle: $('#bl-meta-title'),
    excerpt: $('#bl-excerpt'),
    content: $('#bl-content'),
    metaDescription: $('#bl-meta-description'),
    save: $('#bl-save'),
    reset: $('#bl-reset'),
    refresh: $('#bl-refresh'),
    filter: $('#bl-filter'),
    error: $('#bl-error'),
    tbody: $('#bl-tbody'),
    pagination: $('#bl-pagination'),
    newBtn: $('#blog-create'),
    modal: $('#blog-modal'),
    modalClose: $('#blog-modal-close'),
    modalTitle: $('#blog-modal-title'),
  };

  let currentPage = 1;

  function openModal(isNew) {
    if (!els.modal) return;
    if (els.modalTitle) els.modalTitle.textContent = isNew ? '新增網誌文章' : '編輯網誌文章';
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
      els.error.classList.remove('whitespace-pre-line');
      els.error.textContent = '';
      return;
    }
    els.error.classList.remove('hidden');
    els.error.classList.add('whitespace-pre-line');
    els.error.textContent = msg;
  }

  function strOrNull(input) {
    if (!input) return null;
    const v = String(input.value || '').trim();
    return v === '' ? null : v;
  }

  // datetime-local → ISO8601
  function localInputToIso(input) {
    if (!input) return null;
    const v = String(input.value || '').trim();
    if (!v) return null;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  // ISO8601 → datetime-local
  function isoToLocalInput(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function slugify(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 255);
  }

  function clearForm() {
    const fields = [
      els.id, els.title, els.slug, els.featuredImage, els.publishAt,
      els.metaTitle, els.excerpt, els.content, els.metaDescription,
    ];
    for (const f of fields) {
      if (f) f.value = '';
    }
    if (els.status) els.status.value = 'draft';
  }

  function readForm() {
    const idRaw = els.id ? String(els.id.value || '').trim() : '';
    const id = idRaw ? Number(idRaw) : null;
    const payload = {
      title: strOrNull(els.title),
      slug: strOrNull(els.slug),
      content: els.content ? String(els.content.value || '') : '',
      excerpt: strOrNull(els.excerpt),
      featured_image: strOrNull(els.featuredImage),
      status: els.status && STATUSES.indexOf(els.status.value) >= 0 ? els.status.value : 'draft',
      publish_at: localInputToIso(els.publishAt),
      meta_title: strOrNull(els.metaTitle),
      meta_description: strOrNull(els.metaDescription),
    };
    return { id: Number.isInteger(id) && id > 0 ? id : null, payload };
  }

  // 只填表單上可由列表 row 攞到嘅欄位
  function fillSummary(row) {
    if (els.id) els.id.value = row && row.id ? String(row.id) : '';
    if (els.title) els.title.value = row && row.title ? String(row.title) : '';
    if (els.slug) els.slug.value = row && row.slug ? String(row.slug) : '';
    if (els.featuredImage) els.featuredImage.value = row && row.featured_image ? String(row.featured_image) : '';
    if (els.status) els.status.value = row && STATUSES.indexOf(row.status) >= 0 ? row.status : 'draft';
    if (els.publishAt) els.publishAt.value = isoToLocalInput(row ? row.publish_at : '');
    if (els.metaTitle) els.metaTitle.value = '';
    if (els.excerpt) els.excerpt.value = '';
    if (els.content) els.content.value = '';
    if (els.metaDescription) els.metaDescription.value = '';
  }

  function fillFull(post) {
    fillSummary(post);
    if (els.metaTitle) els.metaTitle.value = post && post.meta_title ? String(post.meta_title) : '';
    if (els.excerpt) els.excerpt.value = post && post.excerpt ? String(post.excerpt) : '';
    if (els.content) els.content.value = post && post.content ? String(post.content) : '';
    if (els.metaDescription) els.metaDescription.value = post && post.meta_description ? String(post.meta_description) : '';
  }

  function statusLabel(status) {
    if (status === 'draft') return '草稿';
    if (status === 'published') return '已發佈';
    if (status === 'archived') return '已封存';
    return status || '';
  }

  async function editPost(row) {
    setError('');
    fillSummary(row);
    // 列表 endpoint 唔包內容，published 文可以用公開 endpoint 補齊
    if (row.status === 'published' && row.slug) {
      try {
        const data = await adminApiRequest('/api/blog/posts/' + encodeURIComponent(row.slug));
        if (data && data.post) fillFull(data.post);
      } catch (e) {
        setError('未能載入文章完整內容：' + (e && e.message ? e.message : String(e)) +
          '\n喺未載入內容嘅情況下儲存會覆蓋原有內文。');
      }
    } else {
      setError('草稿／封存文章嘅後端列表冇提供內文，且冇管理員單篇端點可用；' +
        '直接儲存會以目前表單內容覆蓋原有內文。');
    }
    openModal(false);
  }

  async function deletePost(row) {
    if (!window.confirm('確定刪除文章「' + row.title + '」？呢個動作唔可以還原。')) return;
    setError('');
    await adminApiRequest('/api/admin/blog/posts/' + encodeURIComponent(String(row.id)), { method: 'DELETE' });
    if (els.id && String(els.id.value || '') === String(row.id)) clearForm();
    await loadPosts();
  }

  async function loadPosts() {
    setError('');
    let path = '/api/admin/blog/posts?page=' + encodeURIComponent(String(currentPage)) +
      '&page_size=' + encodeURIComponent(String(PAGE_SIZE));
    if (els.filter && els.filter.value) {
      path += '&status=' + encodeURIComponent(els.filter.value);
    }

    const data = await adminApiRequest(path);
    const rows = data.posts || [];
    const pg = data.pagination || {};

    if (els.tbody) {
      els.tbody.textContent = '';
      for (const p of rows) {
        const editBtn = el('button', {
          class: 'admin-link-btn', type: 'button', text: '編輯',
          onclick: () => editPost(p).catch((e) => setError(e && e.message ? e.message : String(e))),
        });
        const delBtn = el('button', {
          class: 'admin-link-btn', type: 'button', text: '刪除',
          onclick: () => deletePost(p).catch((e) => setError(e && e.message ? e.message : String(e))),
        });
        els.tbody.appendChild(el('tr', {}, [
          el('td', { text: p.title || '' }),
          el('td', { text: p.slug || '' }),
          el('td', { text: statusLabel(p.status) }),
          el('td', { text: p.publish_at ? isoToLocalInput(p.publish_at).replace('T', ' ') : '—' }),
          el('td', {}, [editBtn, el('span', { text: ' ' }), delBtn]),
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
          onclick: () => { currentPage -= 1; loadPosts().catch((e) => setError(e.message)); },
        }));
      }
      els.pagination.appendChild(el('span', {
        text: ' 第 ' + currentPage + ' / ' + totalPages + ' 頁（共 ' + total + ' 篇） ',
      }));
      if (currentPage < totalPages) {
        els.pagination.appendChild(el('button', {
          class: 'admin-link-btn', type: 'button', text: '下一頁',
          onclick: () => { currentPage += 1; loadPosts().catch((e) => setError(e.message)); },
        }));
      }
    }
  }

  async function savePost() {
    setError('');
    const { id, payload } = readForm();
    if (!payload.title) {
      setError('標題必填');
      return;
    }
    if (!payload.slug) {
      setError('Slug 必填（可點「由標題產生」）');
      return;
    }
    if (!payload.content) {
      setError('內文必填');
      return;
    }
    if (id) {
      await adminApiRequest('/api/admin/blog/posts/' + encodeURIComponent(String(id)), {
        method: 'PUT',
        json: payload,
      });
    } else {
      await adminApiRequest('/api/admin/blog/posts', { method: 'POST', json: payload });
    }
    clearForm();
    currentPage = 1;
    await loadPosts();
    closeModal();
  }

  if (els.newBtn) els.newBtn.addEventListener('click', () => { clearForm(); openModal(true); });
  if (els.modalClose) els.modalClose.addEventListener('click', closeModal);
  if (els.modal) els.modal.addEventListener('mousedown', (e) => {
    if (e.target === els.modal) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && els.modal && !els.modal.classList.contains('hidden')) closeModal();
  });
  if (els.reset) els.reset.addEventListener('click', () => clearForm());
  if (els.save) els.save.addEventListener('click', () => savePost().catch((e) => setError(e.message)));
  if (els.refresh) els.refresh.addEventListener('click', () => {
    loadPosts().catch((e) => setError(e && e.message ? e.message : String(e)));
  });
  if (els.filter) els.filter.addEventListener('change', () => {
    currentPage = 1;
    loadPosts().catch((e) => setError(e.message));
  });
  if (els.slugGen) els.slugGen.addEventListener('click', () => {
    if (!els.slug || !els.title) return;
    if (els.slug.value && !window.confirm('Slug 欄已有內容，確定覆蓋？')) return;
    els.slug.value = slugify(els.title.value);
  });

  try {
    clearForm();
    await loadPosts();
  } catch (e) {
    setError(e && e.message ? e.message : String(e));
  }
})();
