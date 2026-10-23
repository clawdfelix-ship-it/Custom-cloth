/* ==========================================================================
   OHYA2.0 搜尋自動完成（remote search 選擇器 pattern）
   - debounce 300ms
   - AbortController + request id：舊請求唔可以覆蓋新結果
   - loading / 空結果 / 失敗 三態
   - 鍵盤：↑↓ 選擇、Enter 確認、Esc 收起
   ========================================================================== */
(function () {
  'use strict';

  var form = document.querySelector('[data-search-form]');
  if (!form) return;
  var input = form.querySelector('[data-search-input]');
  var panel = form.querySelector('[data-search-panel]');
  var catSelect = form.querySelector('[data-search-category]');
  if (!input || !panel) return;

  var DEBOUNCE_MS = 300;
  var debounceTimer = null;
  var requestSeq = 0;          // 單調遞增，過期 response 直接丟棄
  var currentController = null;
  var items = [];              // 目前 panel 內可選列（{type,href,label,el}）
  var activeIndex = -1;
  var priced = new Intl.NumberFormat('zh-HK', { style: 'currency', currency: 'HKD', maximumFractionDigits: 0 });

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function openPanel() {
    panel.classList.remove('hidden');
    input.setAttribute('aria-expanded', 'true');
  }
  function closePanel() {
    panel.classList.add('hidden');
    input.setAttribute('aria-expanded', 'false');
    items = [];
    activeIndex = -1;
  }

  function renderState(html) {
    panel.innerHTML = html;
    openPanel();
  }

  function renderResults(data) {
    var products = data.products || [];
    var categories = data.categories || [];
    if (!products.length && !categories.length) {
      renderState('<div class="mz-search-empty">搵唔到「' + esc(input.value.trim()) + '」相關嘅嘢</div>');
      return;
    }

    var html = '';
    items = [];

    if (categories.length) {
      html += '<div class="mz-search-group">分類</div>';
      categories.forEach(function (c) {
        var href = '/products?category=' + encodeURIComponent(c.slug) + '&page=1';
        html += '<a class="mz-search-item" role="option" href="' + href + '">'
          + '<span class="mz-search-ic">🏷️</span><span class="mz-search-label">' + esc(c.name) + '</span></a>';
        items.push({ href: href });
      });
    }

    if (products.length) {
      html += '<div class="mz-search-group">商品</div>';
      products.forEach(function (p) {
        var href = '/product/' + p.id;
        var img = p.image
          ? '<img src="' + esc(p.image) + '" alt="" loading="lazy">'
          : '<span class="mz-search-noimg">📦</span>';
        html += '<a class="mz-search-item" role="option" href="' + href + '">'
          + '<span class="mz-search-thumb">' + img + '</span>'
          + '<span class="mz-search-label">' + esc(p.name) + '</span>'
          + '<span class="mz-search-price">' + esc(priced.format(p.priceCents / 100)) + '</span></a>';
        items.push({ href: href });
      });
    }

    // 底部：完整文字搜尋
    var fullHref = buildSearchHref(input.value.trim());
    html += '<a class="mz-search-item mz-search-all" role="option" href="' + esc(fullHref) + '">'
      + '<span class="mz-search-ic">🔍</span><span>搜尋「' + esc(input.value.trim()) + '」嘅全部結果</span></a>';
    items.push({ href: fullHref });

    panel.innerHTML = html;
    bindItemEls();
    openPanel();
  }

  function bindItemEls() {
    var els = panel.querySelectorAll('.mz-search-item');
    Array.prototype.forEach.call(els, function (el, i) {
      if (items[i]) items[i].el = el;
      el.addEventListener('mousemove', function () { setActive(i); });
    });
  }

  function setActive(i) {
    if (activeIndex >= 0 && items[activeIndex] && items[activeIndex].el) {
      items[activeIndex].el.classList.remove('is-active');
      items[activeIndex].el.removeAttribute('aria-selected');
    }
    activeIndex = i;
    if (activeIndex >= 0 && items[activeIndex] && items[activeIndex].el) {
      items[activeIndex].el.classList.add('is-active');
      items[activeIndex].el.setAttribute('aria-selected', 'true');
      items[activeIndex].el.scrollIntoView({ block: 'nearest' });
    }
  }

  function buildSearchHref(term) {
    var p = new URLSearchParams();
    p.set('page', '1');
    if (catSelect && catSelect.value && catSelect.value !== 'all') p.set('category', catSelect.value);
    if (term) p.set('q', term);
    return '/products?' + p.toString();
  }

  function fetchSuggestions() {
    var term = input.value.trim();
    if (!term) { closePanel(); return; }

    if (currentController) {
      try { currentController.abort(); } catch (e) {}
    }
    currentController = new AbortController();
    var seq = ++requestSeq;

    renderState('<div class="mz-search-loading"><span class="mz-spinner" aria-hidden="true"></span>搜尋中…</div>');

    fetch('/api/search-suggestions?q=' + encodeURIComponent(term), { signal: currentController.signal })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        if (seq !== requestSeq) return;          // 已有更新請求，丟棄過期結果
        renderResults(data);
      })
      .catch(function (err) {
        if (err.name === 'AbortError') return;
        if (seq !== requestSeq) return;
        renderState('<div class="mz-search-error">搜尋失敗，<button type="button" data-retry>重試</button></div>');
        var retry = panel.querySelector('[data-retry]');
        if (retry) retry.addEventListener('click', function (e) {
          e.preventDefault();
          requestSeq++;
          fetchSuggestions();
        });
      });
  }

  input.addEventListener('input', function () {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(fetchSuggestions, DEBOUNCE_MS);
  });

  input.addEventListener('keydown', function (e) {
    if (panel.classList.contains('hidden') || !items.length) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        fetchSuggestions();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((activeIndex + 1) % items.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(activeIndex <= 0 ? items.length - 1 : activeIndex - 1);
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && items[activeIndex]) {
        e.preventDefault();
        window.location.href = items[activeIndex].href;
      }
    } else if (e.key === 'Escape') {
      closePanel();
    }
  });

  input.addEventListener('focus', function () {
    if (input.value.trim() && panel.innerHTML) openPanel();
  });

  document.addEventListener('click', function (e) {
    if (!form.contains(e.target)) closePanel();
  });
})();
