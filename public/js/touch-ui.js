/* ============================================================
   Ohya2.0 Touch UI — 高級觸控交互組件庫
   純原生 JS、零依賴，經 data-attr 自動初始化，桌面/手機皆可用。
   組件：
     [data-flip]      Flip to Detail（3D 翻轉詳情）
     [data-hold]      Hold to Confirm（長按確認）
     [data-slide]     Slide to Confirm（滑動確認）
     [data-radial]    Radial Menu（弧形菜單，由 FAB 觸發）
     [data-context]   Context Menu Preview（長按浮起預覽）
     .coverflow       Cover Flow（3D 輪播，由 initCoverFlow 建立）
   原則：手一碰就有反饋；未完成手勢平滑回退；尊重 prefers-reduced-motion。
   ============================================================ */
(function () {
  'use strict';

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DUR = reduced ? 0 : 260;

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, attrs, kids) {
    const n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(k => {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on' && typeof attrs[k] === 'function') n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(c => n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
    return n;
  }
  const ease = 'cubic-bezier(.22,1,.36,1)';

  /* ----------------------------------------------------------
     Shared overlay/modal helpers
  ---------------------------------------------------------- */
  function openOverlay(node) {
    node.style.position = 'fixed';
    node.style.inset = '0';
    node.style.zIndex = '80';
    document.body.appendChild(node);
    requestAnimationFrame(() => { node.classList.add('is-open'); });
  }
  function closeOverlay(node) {
    node.classList.remove('is-open');
    setTimeout(() => { if (node.parentNode) node.parentNode.removeChild(node); }, DUR);
  }

  /* ----------------------------------------------------------
     ① Flip to Detail
     用法：封面元素加 data-flip，data-flip-target = 詳情內容 selector
     （或 data-flip-html 提供 HTML）。點擊飛到中心、Y 軸翻轉。
  ---------------------------------------------------------- */
  function initFlip() {
    document.addEventListener('click', (ev) => {
      const trigger = ev.target.closest('[data-flip]');
      if (!trigger || trigger.dataset.flipBound) return;
      // 只在有 data 的元素首次標記；用事件委托故無需逐個綁
    });
    $all('[data-flip]').forEach(trigger => {
      if (trigger.dataset.flipReady) return;
      trigger.dataset.flipReady = '1';
      trigger.addEventListener('click', (ev) => {
        ev.preventDefault();
        const contentHTML = trigger.dataset.flipHtml
          || ($(trigger.dataset.flipTarget) ? $(trigger.dataset.flipTarget).innerHTML : '');
        const rect = trigger.getBoundingClientRect();

        const overlay = el('div', { class: 'flip-overlay' });
        const card = el('div', { class: 'flip-card' }, [
          el('button', { class: 'flip-close', type: 'button', 'aria-label': '關閉', text: '×' }),
          el('div', { class: 'flip-back' }),
        ]);
        $('.flip-back', card).innerHTML = contentHTML;
        overlay.appendChild(card);
        document.body.appendChild(overlay);

        // 起點：封面位置
        card.style.transition = 'none';
        card.style.left = rect.left + 'px';
        card.style.top = rect.top + 'px';
        card.style.width = rect.width + 'px';
        card.style.height = rect.height + 'px';
        requestAnimationFrame(() => requestAnimationFrame(() => {
          card.style.transition = `transform ${DUR}ms ${ease}, left ${DUR}ms ${ease}, top ${DUR}ms ${ease}, width ${DUR}ms ${ease}, height ${DUR}ms ${ease}`;
          const targetW = Math.min(window.innerWidth - 24, 460);
          card.style.left = ((window.innerWidth - targetW) / 2) + 'px';
          card.style.top = '8vh';
          card.style.width = targetW + 'px';
          card.style.height = 'auto';
          card.classList.add('is-flipped');
        }));

        const shut = () => {
          card.classList.remove('is-flipped');
          card.style.left = rect.left + 'px';
          card.style.top = rect.top + 'px';
          card.style.width = rect.width + 'px';
          card.style.height = rect.height + 'px';
          overlay.classList.remove('is-open');
          setTimeout(() => overlay.remove(), DUR);
        };
        $('.flip-close', card).addEventListener('click', shut);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) shut(); });
        requestAnimationFrame(() => overlay.classList.add('is-open'));
      });
    });
  }

  /* ----------------------------------------------------------
     ② Hold to Confirm
     用法：<button data-hold data-hold-ms="700">，按住邊緣畫環；
     完成觸發 'hold-confirm' 事件（由頁面執行真正動作）。
  ---------------------------------------------------------- */
  function initHold() {
    $all('[data-hold]').forEach(btn => {
      if (btn.dataset.holdReady) return;
      btn.dataset.holdReady = '1';
      const ms = parseInt(btn.dataset.holdMs || '700', 10);
      btn.classList.add('hold-btn');
      const svgNS = 'http://www.w3.org/2000/svg';
      const ring = document.createElementNS(svgNS, 'svg');
      ring.setAttribute('class', 'hold-ring');
      const circ = document.createElementNS(svgNS, 'circle');
      circ.setAttribute('class', 'hold-ring-c');
      ring.appendChild(circ);
      btn.appendChild(ring);

      let raf = null, start = 0, done = false;
      function sizeRing() {
        const r = btn.getBoundingClientRect();
        const cx = r.width / 2, cy = r.height / 2, rad = Math.min(cx, cy) - 3;
        ring.setAttribute('viewBox', `0 0 ${r.width} ${r.height}`);
        circ.setAttribute('cx', cx); circ.setAttribute('cy', cy);
        circ.setAttribute('r', rad);
        circ.style.strokeDasharray = (2 * Math.PI * rad);
        circ.style.strokeDashoffset = (2 * Math.PI * rad);
        btn._circLen = 2 * Math.PI * rad;
      }
      function tick(t) {
        if (!start) start = t;
        const p = Math.min((t - start) / ms, 1);
        circ.style.strokeDashoffset = String(btn._circLen * (1 - p));
        if (p >= 1) { done = true; btn.dispatchEvent(new CustomEvent('hold-confirm')); btn.classList.remove('is-holding'); return; }
        raf = requestAnimationFrame(tick);
      }
      function begin(e) {
        if (done) return;
        e.preventDefault();
        sizeRing();
        btn.classList.add('is-holding');
        start = 0;
        raf = requestAnimationFrame(tick);
      }
      function cancel() {
        if (done) return;
        cancelAnimationFrame(raf);
        btn.classList.remove('is-holding');
        circ.style.transition = 'stroke-dashoffset 180ms ' + ease;
        circ.style.strokeDashoffset = String(btn._circLen);
        setTimeout(() => { circ.style.transition = ''; }, 200);
      }
      btn.addEventListener('pointerdown', begin);
      btn.addEventListener('pointerup', cancel);
      btn.addEventListener('pointerleave', cancel);
      btn.addEventListener('pointercancel', cancel);
    });
  }

  /* ----------------------------------------------------------
     ⑥ Slide to Confirm
     用法：容器 [data-slide]，內含 thumb；超過 80% 觸發，否則彈回。
  ---------------------------------------------------------- */
  function initSlide() {
    $all('[data-slide]').forEach(track => {
      if (track.dataset.slideReady) return;
      track.dataset.slideReady = '1';
      const thumb = $('.slide-thumb', track);
      let max = 0, dragging = false, startX = 0, x = 0, fired = false;
      function layout() { max = track.clientWidth - thumb.offsetWidth - 4; }
      function setX(v, animate) {
        x = Math.max(0, Math.min(v, max));
        thumb.style.transition = animate ? `transform 200ms ${ease}` : 'none';
        thumb.style.transform = `translateX(${x}px)`;
        track.style.setProperty('--slide-p', String(x / (max || 1)));
      }
      thumb.addEventListener('pointerdown', e => {
        if (fired) return;
        layout(); dragging = true; startX = e.clientX - x;
        thumb.setPointerCapture(e.pointerId);
      });
      thumb.addEventListener('pointermove', e => {
        if (!dragging) return;
        setX(e.clientX - startX, false);
      });
      function end() {
        if (!dragging) return;
        dragging = false;
        if (x / (max || 1) >= 0.8) {
          fired = true;
          setX(max, true);
          track.classList.add('is-confirmed');
          track.dispatchEvent(new CustomEvent('slide-confirmed'));
        } else {
          setX(0, true);
        }
      }
      thumb.addEventListener('pointerup', end);
      thumb.addEventListener('pointercancel', () => { dragging = false; setX(0, true); });
      window.addEventListener('resize', layout);
      setTimeout(layout, 0);
    });
  }

  /* ----------------------------------------------------------
     ⑤ Radial Menu
     用法：FAB 按鈕 [data-radial]，data-items = JSON
     [{label,icon,action?}]，或用 [data-radial-item] 子項。
     長按/點擊展開弧形，交錯彈出；滑過放大顯示標籤。
  ---------------------------------------------------------- */
  function initRadial() {
    $all('[data-radial]').forEach(fab => {
      if (fab.dataset.radialReady) return;
      fab.dataset.radialReady = '1';
      let items = [];
      try { items = JSON.parse(fab.dataset.items || '[]'); } catch (e) { items = []; }
      let opened = false, wrap = null;

      function build() {
        wrap = el('div', { class: 'radial-wrap' });
        const arc = el('div', { class: 'radial-arc' });
        const n = items.length;
        items.forEach((it, i) => {
          const b = el('button', {
            class: 'radial-item', type: 'button', 'aria-label': it.label,
            style: `--i:${i};--n:${Math.max(n - 1, 1)}`,
          }, [el('span', { class: 'radial-item-icon', text: it.icon || '•' }), el('span', { class: 'radial-item-label', text: it.label })]);
          b.addEventListener('click', () => {
            if (typeof window[it.action] === 'function') window[it.action]();
            b.dispatchEvent(new CustomEvent('radial-pick', { detail: it, bubbles: true }));
            hide();
          });
          arc.appendChild(b);
        });
        wrap.appendChild(arc);
        wrap.addEventListener('click', e => { if (e.target === wrap) hide(); });
      }
      function show() {
        build();
        document.body.appendChild(wrap);
        requestAnimationFrame(() => wrap.classList.add('is-open'));
        opened = true;
        fab.classList.add('is-active');
      }
      function hide() {
        if (!wrap) return;
        wrap.classList.remove('is-open');
        const w = wrap;
        setTimeout(() => w.remove(), DUR);
        wrap = null; opened = false;
        fab.classList.remove('is-active');
      }
      fab.addEventListener('click', e => { e.preventDefault(); opened ? hide() : show(); });
    });
  }

  /* ----------------------------------------------------------
     ⑦ Context Menu Preview
     用法：列表項 [data-context]，data-actions = JSON
     [{label,icon,kind?,action?}]。長按觸發，背景模糊、項浮起。
  ---------------------------------------------------------- */
  function initContext() {
    $all('[data-context]').forEach(item => {
      if (item.dataset.ctxReady) return;
      item.dataset.ctxReady = '1';
      let timer = null, fired = false;
      item.addEventListener('pointerdown', () => {
        fired = false;
        timer = setTimeout(() => { fired = true; open(); }, 420);
      });
      ['pointerup', 'pointermove', 'pointercancel'].forEach(ev =>
        item.addEventListener(ev, () => clearTimeout(timer)));
      item.addEventListener('click', e => { if (fired) { e.preventDefault(); fired = false; } });

      function open() {
        let actions = [];
        try { actions = JSON.parse(item.dataset.actions || '[]'); } catch (e) {}
        if (!actions.length) return;
        if (navigator.vibrate) navigator.vibrate(12);
        const overlay = el('div', { class: 'ctx-overlay' });
        const card = el('div', { class: 'ctx-card' });
        actions.forEach(a => {
          const b = el('button', {
            class: 'ctx-action' + (a.kind === 'danger' ? ' is-danger' : ''), type: 'button',
          }, [el('span', { class: 'ctx-action-icon', text: a.icon || '' }), el('span', { text: a.label })]);
          b.addEventListener('click', () => {
            if (typeof window[a.action] === 'function') window[a.action]();
            item.dispatchEvent(new CustomEvent('context-pick', { detail: a, bubbles: true }));
            hide();
          });
          card.appendChild(b);
        });
        overlay.appendChild(card);
        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('is-open'));
        function hide() {
          overlay.classList.remove('is-open');
          setTimeout(() => overlay.remove(), DUR);
        }
        overlay.addEventListener('click', e => { if (e.target === overlay) hide(); });
      }
    });
  }

  /* ----------------------------------------------------------
     ⑩ Cover Flow
     用法：容器 <div class="coverflow" data-cover='[{html|img,title}]'>
     橫向 3D 透視輪播，當前居中放大。返回 API {next,prev}。
  ---------------------------------------------------------- */
  window.initCoverFlow = function (root, items) {
    items = items || [];
    try { items = items.length ? items : JSON.parse(root.dataset.cover || '[]'); } catch (e) { items = []; }
    root.classList.add('coverflow');
    const track = el('div', { class: 'coverflow-track' });
    root.appendChild(track);
    let idx = 0;
    function render() {
      track.innerHTML = '';
      items.forEach((it, i) => {
        const s = el('div', { class: 'coverflow-slide' + (i === idx ? ' is-active' : '') });
        if (it.img) s.appendChild(el('img', { src: it.img, alt: it.title || '', loading: 'lazy' }));
        else if (it.html) s.innerHTML = it.html;
        s.style.setProperty('--rel', String(i - idx));
        s.addEventListener('click', () => { if (i !== idx) go(i); });
        track.appendChild(s);
      });
      root.dispatchEvent(new CustomEvent('coverflow-change', { detail: { index: idx, item: items[idx] } }));
    }
    function go(i) { idx = (i + items.length) % items.length; render(); }
    // drag / swipe
    let sx = null;
    root.addEventListener('pointerdown', e => { sx = e.clientX; });
    root.addEventListener('pointerup', e => {
      if (sx == null) return;
      const dx = e.clientX - sx;
      if (Math.abs(dx) > 36) go(idx + (dx < 0 ? 1 : -1));
      sx = null;
    });
    render();
    return { next: () => go(idx + 1), prev: () => go(idx - 1), go };
  };

  /* ----------------------------------------------------------
     ⑪ Focus Group（選中一張，其他後退）
     用法：容器加 data-focus-group；內裡每一項加 data-focus-item。
     桌面 hover 聚焦；觸控點一下選中（其他降飽和＋縮小＋微模糊），
     再點選中項內嘅連結先會導航。點空白處解除。
  ---------------------------------------------------------- */
  function initFocusGroups() {
    $all('[data-focus-group]').forEach(group => {
      if (group.dataset.focusBound) return;
      group.dataset.focusBound = '1';
      const items = () => $all('[data-focus-item]', group);

      // 桌面：hover 即聚焦，離開還原
      group.addEventListener('pointerover', (ev) => {
        const item = ev.target.closest('[data-focus-item]');
        if (!item || window.matchMedia('(hover: none)').matches) return;
        items().forEach(it => {
          it.classList.toggle('is-dim', it !== item);
          it.classList.toggle('is-spotlit', it === item);
        });
      });
      group.addEventListener('pointerout', (ev) => {
        if (window.matchMedia('(hover: none)').matches) return;
        if (!ev.relatedTarget || !group.contains(ev.relatedTarget)) {
          items().forEach(it => it.classList.remove('is-dim', 'is-spotlit'));
        }
      });

      // 觸控：點擊切換選中；未選中時先攔截導航
      group.addEventListener('click', (ev) => {
        if (!window.matchMedia('(hover: none)').matches) return;
        const item = ev.target.closest('[data-focus-item]');
        if (!item) {
          items().forEach(it => it.classList.remove('is-dim', 'is-spotlit'));
          return;
        }
        if (!item.classList.contains('is-spotlit')) {
          // 第一次點：只選中，唔導航
          ev.preventDefault();
          ev.stopPropagation();
          items().forEach(it => {
            const on = it === item;
            it.classList.toggle('is-spotlit', on);
            it.classList.toggle('is-dim', !on);
          });
        }
        // 已選中：放行內部連結／按鈕（默認行為照走）
      }, true);
    });
  }

  /* ----------------------------------------------------------
     ⑫ Density Switch（捏合改密度 + 換列走弧線）
     用法：控件 [data-density-control] data-target=<grid selector>
     內裡按鈕 data-density-set="cozy|standard|compact"。
     切換時用 FLIP：每項沿弧線移動到新位置，相鄰項錯開延遲。
  ---------------------------------------------------------- */
  const DENSITY_KEY = 'ohya-density';
  const DENSITY_MODES = ['cozy', 'standard', 'compact'];

  function arcAnimate(grid, mode) {
    if (reduced) { grid.dataset.density = mode; return; }
    const items = $all('[data-focus-item], [data-density-item]', grid);
    // FLIP - First
    const first = items.map(it => it.getBoundingClientRect());
    grid.dataset.density = mode;
    // FLIP - Last + Invert + Play
    const anims = items.map((it, i) => {
      const r = it.getBoundingClientRect();
      const dx = first[i].left - r.left;
      const dy = first[i].top - r.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return null;
      const arc = Math.min(34, 12 + Math.hypot(dx, dy) * 0.08);
      const a = it.animate([
        { transform: `translate(${dx}px, ${dy}px)` },
        { transform: `translate(${dx / 2}px, ${dy / 2 - arc}px) scale(1.02)`, offset: 0.5 },
        { transform: 'translate(0, 0) scale(1)' },
      ], {
        duration: 430,
        delay: Math.min(i * 22, 320),
        easing: 'cubic-bezier(.22,1,.36,1)',
      });
      return a;
    });
    return Promise.all(anims.filter(Boolean).map(a => a.finished.catch(() => {})));
  }

  function syncControlActive(control, mode) {
    $all('[data-density-set]', control).forEach(btn => {
      const on = btn.getAttribute('data-density-set') === mode;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function initDensitySwitch() {
    $all('[data-density-control]').forEach(control => {
      if (control.dataset.densityBound) return;
      control.dataset.densityBound = '1';
      const grid = $(control.getAttribute('data-target'));
      if (!grid) return;

      const saved = localStorage.getItem(DENSITY_KEY);
      const initial = DENSITY_MODES.indexOf(saved) >= 0 ? saved : (grid.dataset.density || 'standard');
      grid.dataset.density = initial;
      syncControlActive(control, initial);

      control.addEventListener('click', (ev) => {
        const btn = ev.target.closest('[data-density-set]');
        if (!btn) return;
        const mode = btn.getAttribute('data-density-set');
        if (mode === grid.dataset.density) return;
        syncControlActive(control, mode);
        localStorage.setItem(DENSITY_KEY, mode);
        arcAnimate(grid, mode);
      });
    });
  }

  /* ----------------------------------------------------------
     ⑬ Pull Zoom（下拉拉大頂圖）
     用法：容器加 data-pullzoom；內裡被放大嘅媒體加 data-pullzoom-media；
     要隨下拉淡出嘅覆蓋元素加 data-pullzoom-fade。
     頁面到頂再向下拉時觸發；鬆手帶阻尼回彈。觸控裝置限定。
  ---------------------------------------------------------- */
  function initPullZoom() {
    if (!('ontouchstart' in window) && window.matchMedia('(hover: hover)').matches) {
      // 桌面無觸屏：native rubber-band 冇 API，唔啟用
    }
    $all('[data-pullzoom]').forEach(scope => {
      if (scope.dataset.pullzoomBound) return;
      scope.dataset.pullzoomBound = '1';
      const media = $('[data-pullzoom-media]', scope) || scope;
      const fades = () => $all('[data-pullzoom-fade]', scope);

      let startY = null;
      let pulling = false;
      const MAX_PULL = 220;
      const ZOOM_K = 0.0022; // 每拉 1px 嘅 scale 增量

      function apply(pull) {
        const scale = 1 + pull * ZOOM_K;
        media.style.transform = `scale(${scale})`;
        const op = Math.max(0, 1 - pull / 110);
        fades().forEach(n => { n.style.opacity = op; });
      }
      function reset() {
        media.style.transition = 'transform .5s cubic-bezier(.34,1.4,.5,1)';
        media.style.transform = 'scale(1)';
        fades().forEach(n => {
          n.style.transition = 'opacity .5s ease';
          n.style.opacity = '';
        });
        setTimeout(() => {
          media.style.transition = '';
          fades().forEach(n => { n.style.transition = ''; });
        }, 520);
      }

      scope.addEventListener('touchstart', (ev) => {
        if (window.scrollY > 2) { startY = null; return; }
        startY = ev.touches[0].clientY;
        pulling = false;
      }, { passive: true });

      // 非被動：要喺到頂下拉時攔截原生滾動
      scope.addEventListener('touchmove', (ev) => {
        if (startY == null) return;
        const d = ev.touches[0].clientY - startY;
        if (d <= 0) return;
        if (window.scrollY > 0) return;
        if (!pulling) {
          // 越過小門檻先接管，避免誤觸
          if (d < 6) return;
          pulling = true;
        }
        ev.preventDefault();
        apply(Math.min(d, MAX_PULL));
      }, { passive: false });

      const end = () => {
        if (pulling) reset();
        startY = null;
        pulling = false;
      };
      scope.addEventListener('touchend', end);
      scope.addEventListener('touchcancel', end);
    });
  }

  /* ----------------------------------------------------------
     ⑭ Adaptive Invert（跟背景換黑白）
     用法：元素加 data-adaptive。佢會採樣自己中心點背後嘅實際背景亮度，
     自動喺黑／白間連續過渡（唔硬切）。滾動時即時更新。
     data-adaptive-threshold 可調（默認 .55）。
  ---------------------------------------------------------- */
  function bgLuminanceAt(x, y, self) {
    let stack = document.elementsFromPoint(x, y);
    // 排除被採樣元素自己同佢嘅子元素，否則會採到自己嘅半透明底色
    if (self) stack = stack.filter(el => el !== self && !self.contains(el));
    for (const el of stack) {
      if (!el || el.nodeType !== 1) continue;
      const bg = getComputedStyle(el).backgroundColor;
      const m = bg && bg.match(/rgba?\(([^)]+)\)/);
      if (!m) continue;
      const parts = m[1].split(',').map(s => parseFloat(s));
      const a = parts.length === 4 ? parts[3] : 1;
      if (a < 0.1) continue; // 透明，落到下一層
      const [r, g, b] = parts;
      // WCAG relative luminance（sRGB 线性化）
      const lin = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); };
      const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
      return L;
    }
    // 冇任何實心背景 → 當頁面底色
    return document.body.classList.contains('mz-body') ? 0 : 1;
  }

  function initAdaptive() {
    const nodes = $all('[data-adaptive]');
    if (!nodes.length) return;
    let ticking = false;
    function update() {
      ticking = false;
      nodes.forEach(node => {
        const r = node.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) return;
        const x = r.left + r.width / 2;
        const y = r.top + r.height / 2;
        const L = bgLuminanceAt(x, y, node);
        // 連續映射：亮底 → 黑前景；暗底 → 白前景。用 CSS var 供子樣式使用
        node.style.setProperty('--bg-lum', L.toFixed(3));
        // 前景色在黑白間連續插值（threshold 附近自然過渡，唔硬切）
        const k = Math.min(1, Math.max(0, (L - 0.18) / 0.5)); // 0..1
        const v = Math.round((1 - k) * 255); // 暗底→255 白，亮底→0 黑
        node.style.setProperty('--adaptive-fg', `rgb(${v},${v},${v})`);
        node.classList.toggle('on-dark', L < 0.5);
        node.classList.toggle('on-light', L >= 0.5);
      });
    }
    function schedule() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    update();
    // 圖片/字體載入可能改變佈局，延遲再補一次
    setTimeout(update, 400);
    window.__adaptiveUpdate = update;
  }

  /* ----------------------------------------------------------
     ⑮ Motion Blur（甩起来嘅拖影）
     用法：元素加 data-motion-blur。滾動時按速度加方向性模糊，
     速度歸零平滑恢復清晰。用 SVG feGaussianBlur 做到單軸模糊。
     data-motion-blur-k 可調靈敏度（默認 .18）。
  ---------------------------------------------------------- */
  function ensureMotionFilter() {
    let svg = document.getElementById('mz-motion-svg');
    if (svg) return document.getElementById('mz-motion-std');
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'mz-motion-svg';
    svg.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none');
    const fid = 'mz-motion-filter';
    svg.innerHTML = `<filter id="${fid}"><feGaussianBlur id="mz-motion-std" in="SourceGraphic" stdDeviation="0,0"/></filter>`;
    document.body.appendChild(svg);
    return document.getElementById('mz-motion-std');
  }

  function initMotionBlur() {
    const targets = $all('[data-motion-blur]');
    if (!targets.length || reduced) return;
    const std = ensureMotionFilter();
    const FILTER = 'url(#mz-motion-filter)';

    let lastY = window.scrollY;
    let lastT = performance.now();
    let velocity = 0;      // px/ms，有方向
    let current = 0;       // 當前模糊強度
    let raf = null;
    let activeCount = 0;   // 仲有幾多目標套緊 filter

    function applyBlur(amount) {
      // 垂直滾動 → 垂直軸模糊
      std.setAttribute('stdDeviation', `0,${amount.toFixed(2)}`);
    }
    function frame(now) {
      // 速度自然衰減（冇新滾動事件時快速歸零）
      velocity *= 0.86;
      if (Math.abs(velocity) < 0.02) velocity = 0;
      // 目標模糊強度跟速度，平滑逼近，唔跳變
      const target = Math.min(7, Math.abs(velocity) * 0.18);
      current += (target - current) * 0.35;
      applyBlur(current);
      if (current < 0.05 && !velocity) {
        // 收尾：除 filter，還原清晰
        std.setAttribute('stdDeviation', '0,0');
        targets.forEach(t => { t.style.filter = ''; });
        activeCount = 0;
        raf = null;
        return;
      }
      raf = requestAnimationFrame(frame);
    }

    window.addEventListener('scroll', () => {
      const now = performance.now();
      const y = window.scrollY;
      const dt = Math.max(1, now - lastT);
      // 用近期速度（加權）避免單次抖動
      const inst = (y - lastY) / dt;
      velocity = velocity * 0.5 + inst * 0.5;
      lastY = y; lastT = now;
      if (!activeCount) {
        targets.forEach(t => { t.style.filter = FILTER; });
        activeCount = targets.length;
      }
      if (!raf) raf = requestAnimationFrame(frame);
    }, { passive: true });
  }

  /* ----------------------------------------------------------
     ⑯ Scroll Drive（滚动带着进度走）
     用法：元素加 data-scroll-drive。滾過視窗期間佢會獲得
     CSS 變數 --drive（0→1，可逆；停住就停在對應進度）。
     子元素 / CSS animation 可綁定呢個變數。
     data-drive-mode="viewport"（默認：由底部入場到頂部離場）。
     另有 data-scroll-progress="<selector>"：整頁閱讀進度條，
     其寬度 / --p 跟全頁滾動位置。
  ---------------------------------------------------------- */
  function initScrollDrive() {
    const drives = $all('[data-scroll-drive]');
    const bars = $all('[data-scroll-progress]');
    if ((!drives.length && !bars.length) || reduced) {
      // 進度條即使 reduced 都可用（唔係裝飾動畫），故只喺完全無元素時退
      if (!bars.length) return;
    }
    let ticking = false;

    function update() {
      ticking = false;
      const vh = window.innerHeight;
      drives.forEach(node => {
        const r = node.getBoundingClientRect();
        // 元素底部入視窗（0）→ 元素頂部離開視窗頂（1）
        const span = vh + r.height;
        let p = (vh - r.top) / span;
        p = Math.min(1, Math.max(0, p));
        node.style.setProperty('--drive', p.toFixed(4));
      });
      // 整頁閱讀進度
      const doc = document.documentElement;
      const max = Math.max(1, doc.scrollHeight - vh);
      const pageP = Math.min(1, Math.max(0, window.scrollY / max));
      bars.forEach(bar => {
        bar.style.setProperty('--p', pageP.toFixed(4));
        bar.style.transform = `scaleX(${pageP})`;
      });
    }
    function schedule() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    update();
    setTimeout(update, 500);
  }

  function initAll() {
    initFlip();
    initHold();
    initSlide();
    initRadial();
    initContext();
    initFocusGroups();
    initDensitySwitch();
    initPullZoom();
    initAdaptive();
    initMotionBlur();
    initScrollDrive();
    $all('.coverflow').forEach(r => window.initCoverFlow(r));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAll);
  else initAll();
  // 動態插入嘅內容可手動重跑
  window.TouchUI = { init: initAll };
})();
