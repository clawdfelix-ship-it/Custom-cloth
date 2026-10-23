(async function () {
  const { $, adminApiRequest } = window.AdminCommon;

  const els = {
    download: $('#bs-download-template'),
    file: $('#bs-file'),
    check: $('#bs-check'),
    apply: $('#bs-apply'),
    error: $('#bs-error'),
    summary: $('#bs-summary'),
    errors: $('#bs-errors'),
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

  function setSummary(msg) {
    if (!els.summary) return;
    els.summary.textContent = msg || '';
  }

  function setErrorsList(lines) {
    if (!els.errors) return;
    if (!lines || lines.length === 0) {
      els.errors.classList.add('hidden');
      els.errors.textContent = '';
      return;
    }
    els.errors.classList.remove('hidden');
    els.errors.textContent = lines.join('\n');
  }

  async function upload(dryRun) {
    setError('');
    setSummary('');
    setErrorsList([]);
    if (els.apply) els.apply.classList.add('hidden');

    const f = els.file && els.file.files && els.file.files[0];
    if (!f) {
      setError('請先選擇 CSV 檔案');
      return;
    }
    const fd = new FormData();
    fd.append('file', f);

    const out = await adminApiRequest(`/api/admin/bulk-skus/import?dry_run=${dryRun ? '1' : '0'}`, {
      method: 'POST',
      formData: fd,
    });

    const s = out && out.summary ? out.summary : null;
    if (s) {
      setSummary(`總行數: ${s.total}；有效: ${s.valid || 0}；無效: ${s.invalid || 0}`);
    }
    const errs = (out && out.errors) || [];
    setErrorsList(errs.slice(0, 50).map((e) => (typeof e === 'string' ? e : JSON.stringify(e))));

    if (dryRun && errs.length === 0 && els.apply) {
      els.apply.classList.remove('hidden');
    }
  }

  if (els.download) {
    els.download.addEventListener('click', () => {
      window.location.href = '/api/admin/bulk-skus/template.csv';
    });
  }
  if (els.check) {
    els.check.addEventListener('click', () => {
      upload(true).catch((e) => setError(e && e.message ? e.message : String(e)));
    });
  }
  if (els.apply) {
    els.apply.addEventListener('click', () => {
      upload(false).catch((e) => setError(e && e.message ? e.message : String(e)));
    });
  }
})();

