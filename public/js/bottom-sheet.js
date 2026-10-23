/* ==========================================================================
   BottomSheet — 可重用高級彈窗引擎
   實現：底部進入 / detents(half,full) / 彈性 / 拖拽關閉(位移+速度) /
        拖拽吸附 / 嵌套後退 / 擴展頁面 / 彈窗變成功。
   用法：
     const sheet = BottomSheet.open({
       title: '排序',
       detents: ['half','full'],
       startDetent: 'half',
       spring: true,
       content: htmlString | HTMLElement,
       onClose: fn,
     });
   或直接綁定現有 DOM：BottomSheet.from(element, opts)
   ========================================================================== */
(function (global) {
  'use strict';

  const prefersReduced = () =>
    global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function setBodyScrollLock(on) {
    document.body.style.overflow = on ? 'hidden' : '';
  }

  // --- 彈窗變成功（pattern 10）：掛喺按鈕上，返回 Promise ---
  function successButton(btn, { onActivate } = {}) {
    if (!btn) return;
    btn.classList.add('bs-success-btn');
    btn.innerHTML =
      '<span class="bs-success-label"></span>' +
      '<span class="bs-success-spinner"></span>' +
      '<svg class="bs-success-check" viewBox="0 0 24 24" fill="none" ' +
      'stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M4 12.5l5 5L20 6.5"/></svg>';
    const label = btn.querySelector('.bs-success-label');
    label.textContent = btn.dataset.label || btn.textContent.trim() || '確定';

    btn.addEventListener('click', async () => {
      if (btn.dataset.state === 'busy') return;
      btn.dataset.state = 'busy';
      btn.classList.add('is-loading');
      try {
        if (typeof onActivate === 'function') await onActivate();
        btn.classList.remove('is-loading');
        btn.classList.add('is-done');
        // notify, then caller decides to close
        btn.dispatchEvent(new CustomEvent('bs:success', { bubbles: true }));
      } catch (err) {
        btn.classList.remove('is-loading');
        btn.dataset.state = '';
        btn.dispatchEvent(new CustomEvent('bs:error', { bubbles: true, detail: err }));
      }
    });
  }

  function showToast(text, { duration = 1800 } = {}) {
    let toast = document.querySelector('.bs-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'bs-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = text;
    requestAnimationFrame(() => toast.classList.add('is-show'));
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toast.classList.remove('is-show'), duration);
  }

  class Sheet {
    constructor(opts = {}) {
      this.opts = Object.assign(
        {
          title: '',
          detents: ['half'],
          startDetent: 'half',
          spring: true,
          closeOnScrim: true,
          showClose: true,
          nested: false,
        },
        opts
      );
      this.stackIndex = Sheet.stack.length;
      Sheet.stack.push(this);
      this._build();
    }

    _build() {
      const root = document.createElement('div');
      root.className = 'bs-root';
      if (this.opts.spring && !prefersReduced()) root.classList.add('bs-spring');
      root.setAttribute('role', 'dialog');
      root.setAttribute('aria-modal', 'true');

      const scrim = document.createElement('div');
      scrim.className = 'bs-scrim';

      const panel = document.createElement('div');
      panel.className = 'bs-panel';

      panel.innerHTML =
        '<div class="bs-grip"></div>' +
        '<div class="bs-header">' +
        '<span class="bs-title"></span>' +
        (this.opts.showClose ? '<button type="button" class="bs-close" aria-label="關閉">✕</button>' : '<span></span>') +
        '</div>';
      const body = document.createElement('div');
      body.className = 'bs-body';
      panel.appendChild(body);

      root.appendChild(scrim);
      root.appendChild(panel);
      document.body.appendChild(root);

      this.el = root;
      this.panelEl = panel;
      this.bodyEl = body;
      this.setTitle(this.opts.title);
      this.setContent(this.opts.content);

      panel.querySelector('.bs-close').addEventListener('click', () => this.close());
      scrim.addEventListener('click', () => {
        if (this.opts.closeOnScrim) this.close();
      });

      this._onKey = (e) => {
        if (e.key === 'Escape' && Sheet.top() === this) this.close();
      };
      document.addEventListener('keydown', this._onKey);

      this._initDrag();
      // open on next frame so transition runs
      requestAnimationFrame(() => {
        this.detent = this.opts.startDetent;
        this.el.dataset.detent = this.detent;
        this.el.classList.add('is-open');
        this._applyPageBehind(true);
        setBodyScrollLock(true);
      });
    }

    setTitle(text) {
      const t = this.panelEl.querySelector('.bs-title');
      if (t) t.textContent = text || '';
    }

    setContent(content) {
      this.bodyEl.innerHTML = '';
      if (content == null) return;
      if (typeof content === 'string') {
        this.bodyEl.innerHTML = content;
      } else if (content instanceof Node) {
        this.bodyEl.appendChild(content);
      }
    }

    /** 08 嵌套：打開子 sheet 時，自己後退 */
    nest() {
      this.el.classList.add('bs-nested-behind');
    }
    unnest() {
      this.el.classList.remove('bs-nested-behind');
    }

    _applyPageBehind(on) {
      // nested child should move the *previous sheet* back, not the page
      if (this.stackIndex > 0) {
        const parent = Sheet.stack[this.stackIndex - 1];
        if (on) parent.nest();
        else parent.unnest();
      } else {
        document.body.classList.toggle('bs-page-behind', on);
      }
    }

    goDetent(name) {
      if (!this.opts.detents.includes(name)) return;
      this.detent = name;
      this.el.dataset.detent = name;
    }

    _initDrag() {
      const panel = this.panelEl;
      let startY = 0;
      let currentY = 0;
      let lastY = 0;
      let lastT = 0;
      let velocity = 0; // px/ms
      let dragging = false;
      let startScrollTop = 0;

      const onStart = (clientY, target) => {
        // 只喺 grip/header 或 body 已滾到頂時先可以拖，否則係滾動內容
        const fromHandle = !!target.closest('.bs-grip, .bs-header');
        startScrollTop = this.bodyEl.scrollTop;
        if (!fromHandle && startScrollTop > 0) return;

        dragging = true;
        startY = clientY;
        lastY = clientY;
        lastT = performance.now();
        velocity = 0;
        this.el.classList.add('is-dragging');
      };

      const onMove = (clientY) => {
        if (!dragging) return;
        const now = performance.now();
        const dy = clientY - startY;
        // 內容未到頂時向下拖要先消耗 body 滾動
        if (dy < 0 && this.bodyEl.scrollTop > 0) {
          currentY = 0;
          return;
        }
        currentY = Math.max(dy, 0);
        panel.style.transform = this._xOffset() + 'translateY(' + currentY + 'px)';

        const dt = now - lastT;
        if (dt > 0) velocity = (clientY - lastY) / dt;
        lastY = clientY;
        lastT = now;
      };

      const onEnd = () => {
        if (!dragging) return;
        dragging = false;
        this.el.classList.remove('is-dragging');
        panel.style.transform = '';

        const h = panel.getBoundingClientRect().height;
        // 06 拖拽關閉：位移 > 30% 或快速下滑 (>0.5px/ms) → 關
        const closeByDistance = currentY > h * 0.3;
        const closeByFlick = velocity > 0.5 && currentY > 12;
        if (closeByDistance || closeByFlick) {
          this.close();
          return;
        }
        // 07 拖拽擴展：向上拖 → 吸附更高檔；否則回到當前檔
        if (currentY < -h * 0.12 || velocity < -0.4) {
          const order = ['half', 'full'];
          const idx = order.indexOf(this.detent);
          if (idx >= 0 && idx < order.length - 1) this.goDetent(order[idx + 1]);
          return;
        }
        // snap back to current detent (transform cleared → CSS restores)
        this.goDetent(this.detent);
      };

      panel.addEventListener('touchstart', (e) => onStart(e.touches[0].clientY, e.target), { passive: true });
      panel.addEventListener('touchmove', (e) => onMove(e.touches[0].clientY), { passive: true });
      panel.addEventListener('touchend', onEnd);
      panel.addEventListener('touchcancel', onEnd);

      // mouse drag (desktop testing)
      let mouseDown = false;
      panel.addEventListener('mousedown', (e) => {
        mouseDown = true;
        onStart(e.clientY, e.target);
      });
      window.addEventListener('mousemove', (e) => {
        if (mouseDown) onMove(e.clientY);
      });
      window.addEventListener('mouseup', () => {
        if (mouseDown) {
          mouseDown = false;
          onEnd();
        }
      });
    }

    _xOffset() {
      // desktop panel uses translate(-50%,…); dragging appends translateY only,
      // so keep the centering translate intact.
      return global.matchMedia('(min-width:768px)').matches ? 'translate(-50%,0) ' : '';
    }

    /** 09 抽屜變頁面 */
    expandToPage() {
      this.el.classList.add('bs-expand-page');
      this.el.dataset.detent = 'full';
    }

    close() {
      if (this._closed) return;
      this._closed = true;
      this.el.classList.remove('is-open');
      this._applyPageBehind(false);
      setBodyScrollLock(Sheet.stack.some((s) => s !== this && !s._closed) ? true : false);
      document.removeEventListener('keydown', this._onKey);

      const idx = Sheet.stack.indexOf(this);
      if (idx >= 0) Sheet.stack.splice(idx, 1);

      setTimeout(() => {
        if (this.el.parentNode) this.el.parentNode.removeChild(this.el);
      }, prefersReduced() ? 0 : 450);

      if (typeof this.opts.onClose === 'function') this.opts.onClose(this._result);
    }

    // 帶結果關閉（例如選擇咗某項）
    resolve(result) {
      this._result = result;
      this.close();
    }
  }

  Sheet.stack = [];
  Sheet.top = () => Sheet.stack[Sheet.stack.length - 1];

  // --- 簡易 confirm/choice sheet，返回 Promise ---
  Sheet.choice = function ({ title = '選擇', options = [] } = {}) {
    return new Promise((resolve) => {
      const html =
        '<div class="space-y-2">' +
        options
          .map(
            (o, i) =>
              '<button type="button" data-i="' + i + '" ' +
              'class="flex w-full items-center justify-between rounded-xl bg-white/5 px-4 py-3 text-left font-semibold text-gray-100 active:bg-wine/30">' +
              '<span>' + o.label + '</span><span class="text-gold">' + (o.hint || '') + '</span></button>'
          )
          .join('') +
        '</div>';
      const sheet = new Sheet({
        title,
        content: html,
        detents: ['half'],
        onClose: (result) => resolve(result || null),
      });
      sheet.bodyEl.querySelectorAll('[data-i]').forEach((b) => {
        b.addEventListener('click', () => {
          const o = options[Number(b.dataset.i)];
          sheet.resolve(o.value != null ? o.value : o);
        });
      });
    });
  };

  global.BottomSheet = {
    open: (opts) => new Sheet(opts),
    choice: Sheet.choice,
    successButton,
    showToast,
    Sheet,
  };
})(window);
