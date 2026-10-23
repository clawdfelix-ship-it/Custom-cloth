function adminEscapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function adminRenderJson(el, data) {
  if (!el) return;
  el.textContent = JSON.stringify(data, null, 2);
}

function getCsrfToken() {
  const meta = document.querySelector('meta[name="csrf-token"]');
  return meta ? String(meta.getAttribute('content') || '') : '';
}

async function adminApiRequest(path, { method = 'GET', json, formData } = {}) {
  const init = { method, headers: { Accept: 'application/json' } };
  const m = String(method || 'GET').toUpperCase();
  if (m !== 'GET' && m !== 'HEAD' && m !== 'OPTIONS') {
    const t = getCsrfToken();
    if (t) init.headers['X-CSRF-Token'] = t;
  }
  if (json !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(json);
  }
  if (formData) {
    init.body = formData;
  }

  const r = await fetch(path, init);
  const isJson = (r.headers.get('content-type') || '').includes('application/json');
  const body = isJson ? await r.json() : await r.text();
  if (!r.ok) {
    const msg = typeof body === 'string' ? body : (body && body.error ? body.error : JSON.stringify(body));
    const e = new Error(`HTTP ${r.status}: ${msg}`);
    e.status = r.status;
    e.body = body;
    throw e;
  }
  return body;
}

async function adminApiGet(path) {
  return adminApiRequest(path, { method: 'GET' });
}

function $(sel) {
  return document.querySelector(sel);
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else node.setAttribute(k, v);
  }
  for (const c of children) {
    if (c === null || c === undefined) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

// Segmented control：options=[{value,text}]，onChange(value)；回傳 {root, value, set, busy}
function createSegmented(options, currentValue, onChange) {
  const root = document.createElement('div');
  root.className = 'admin-seg';
  root.setAttribute('role', 'group');
  const btns = [];
  function set(value, quiet) {
    btns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value === String(value))));
    if (!quiet && typeof onChange === 'function') onChange(value);
  }
  (options || []).forEach((o) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'seg-btn';
    b.dataset.value = o.value;
    b.textContent = o.text;
    b.setAttribute('aria-pressed', String(o.value === currentValue));
    b.addEventListener('click', () => { if (!root.classList.contains('is-busy')) set(o.value); });
    root.appendChild(b);
    btns.push(b);
  });
  return {
    root,
    set,
    get value() { const x = btns.find((b) => b.getAttribute('aria-pressed') === 'true'); return x ? x.dataset.value : null; },
    busy(on) { root.classList.toggle('is-busy', !!on); },
  };
}

// 完成反饋（自繪對勾動畫）：showSuccess(container, label) 會插入並喺 ttlMs 後移除
function showSuccess(container, label, ttlMs) {
  if (!container) return null;
  const node = document.createElement('span');
  node.className = 'admin-success-pop';
  node.setAttribute('role', 'status');
  node.innerHTML = '<span class="ck-circle"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="ck-check" d="M5 12.5l4.2 4.2L19 7"/></svg></span><span class="ck-label"></span>';
  node.querySelector('.ck-label').textContent = label || '完成';
  container.appendChild(node);
  const ttl = typeof ttlMs === 'number' ? ttlMs : 2200;
  if (ttl > 0) setTimeout(() => { node.style.transition = 'opacity .2s ease'; node.style.opacity = '0'; setTimeout(() => node.remove(), 220); }, ttl);
  return node;
}

window.AdminCommon = {
  $,
  el,
  createSegmented,
  showSuccess,
  adminEscapeHtml,
  adminRenderJson,
  adminApiGet,
  adminApiRequest,
};
