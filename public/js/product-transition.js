/**
 * 商品卡 → 詳情頁 共享圖片轉場（通用版 / FLIP）
 *
 * 唔用跨文件 View Transitions（手機 QQ／微信內置瀏覽器、iOS17、舊 Chrome 唔支援）。
 * 做法：
 *   列表頁撳卡 → 記低被撳圖片嘅 viewport 位置＋src＋產品 id（sessionStorage）
 *   詳情頁 load → 喺舊位置鋪一張「覆蓋圖」，用 Web Animations API 移到主圖位置
 *   動畫完移除覆蓋圖（同主圖重疊，交接無縫）
 *
 * WAAPI + sessionStorage + fixed overlay：所有手機瀏覽器都行；
 * 不支援動畫或資料缺失就靜悄悄普通跳頁，零副作用。
 */
(function () {
  'use strict';

  var KEY = 'mzProductTransition';
  var DURATION = 320;
  var EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';

  var reduced = false;
  try {
    reduced = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (_) {}

  function isDetailPage() {
    return !!document.getElementById('mz-product-main-image');
  }

  // ── 列表頁：撳卡時記錄來源位置 ───────────────────────────────
  function findCardImage(anchor) {
    // 圖片就喺連結入面（products grid 封面連結）
    var direct = anchor.querySelector && anchor.querySelector('img');
    if (direct) return direct;
    // 由標題連結搵返成張卡
    var card = anchor.closest &&
      (anchor.closest('[data-focus-item]') || anchor.closest('article') || anchor.closest('li'));
    if (card) {
      var im = card.querySelector('img');
      if (im) return im;
    }
    return null;
  }

  function bindCapture() {
    document.addEventListener('click', function (e) {
      var anchor = e.target.closest && e.target.closest('a[href^="/product/"]');
      if (!anchor) return;
      // meta/ctrl 開新分頁等就唔好做動畫
      if (e.metaKey || e.ctrlKey || e.shiftKey || (e.button && e.button !== 0)) return;

      var img = findCardImage(anchor);
      if (!img) return;

      var href = anchor.getAttribute('href');
      var idMatch = href.match(/\/product\/(\d+)/);
      var rect = img.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      try {
        sessionStorage.setItem(KEY, JSON.stringify({
          id: idMatch ? idMatch[1] : null,
          src: img.currentSrc || img.src,
          rect: {
            x: rect.left, y: rect.top,
            w: rect.width, h: rect.height,
          },
          from: String(location.pathname + location.search),
        }));
      } catch (_) { /* 無 sessionStorage 就算，普通跳頁 */ }
    });
  }

  // ── 詳情頁：由舊位置動畫到主圖 ───────────────────────────────
  function consumePayload() {
    var raw = null;
    try { raw = sessionStorage.getItem(KEY); sessionStorage.removeItem(KEY); } catch (_) { return null; }
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (_) { return null; }
  }

  function playEntrance(payload) {
    var main = document.getElementById('mz-product-main-image');
    if (!main) return;
    // 確保係同一產品（防止手動改 URL 嘅時候錯配）
    var idMatch = location.pathname.match(/\/product\/(\d+)/);
    if (payload.id && idMatch && String(payload.id) !== idMatch[1]) return;
    if (!payload.src || !payload.rect) return;

    var run = function () {
      var target = main.getBoundingClientRect();
      if (!target.width || !target.height) return;

      var overlay = document.createElement('img');
      overlay.src = payload.src;
      overlay.alt = '';
      overlay.setAttribute('aria-hidden', 'true');
      overlay.style.cssText = [
        'position:fixed',
        'left:' + payload.rect.x + 'px',
        'top:' + payload.rect.y + 'px',
        'width:' + payload.rect.w + 'px',
        'height:' + payload.rect.h + 'px',
        'object-fit:contain',
        'border-radius:12px',
        'z-index:9999',
        'pointer-events:none',
        'will-change:left,top,width,height',
        'max-width:none',
      ].join(';');

      document.body.appendChild(overlay);
      // 動畫期間遮住主圖，等 overlay 做主角；完結先露出（交接位完全重疊）
      main.style.visibility = 'hidden';

      var anim = overlay.animate([
        {
          left: payload.rect.x + 'px', top: payload.rect.y + 'px',
          width: payload.rect.w + 'px', height: payload.rect.h + 'px',
        },
        {
          left: target.left + 'px', top: target.top + 'px',
          width: target.width + 'px', height: target.height + 'px',
        },
      ], { duration: DURATION, easing: EASING, fill: 'forwards' });

      anim.onfinish = anim.oncancel = function () {
        main.style.visibility = '';
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      };
    };

    // 主圖可能未 decode（尤其唔走 cache）；等佢 ready 先有正確 target
    if (main.complete && main.naturalWidth) {
      run();
    } else {
      main.addEventListener('load', run, { once: true });
      // 保險：若 load 事件因任何原因冇到，最遲 1.2s 都照行
      setTimeout(function () { if (main.complete) run(); }, 1200);
    }
  }

  function init() {
    if (reduced) return;
    if (isDetailPage()) {
      var payload = consumePayload();
      if (payload) playEntrance(payload);
    } else {
      bindCapture();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
