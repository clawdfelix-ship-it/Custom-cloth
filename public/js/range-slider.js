/**
 * Ohya2.0 雙滑桿價格區間（叨叨 #2 拖動調節條）
 * - 按住變粗（active class）、填充跟手
 * - 拖過端點有橡皮筋拉伸，鬆手回彈（CSS transition on release）
 * - 同 facet 數字 input（#facet-min / #facet-max）雙向同步
 * - 鍵盤 ←→ 微調（role=slider）
 * 無依賴；reduced-motion 下用即時定位唔做拉伸。
 */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 橡皮筋：超出量隨手指拉長而衰減（resistance 愈大愈難拉）
  function rubberBand(delta, bound, resistance) {
    if (delta <= 0) return 0;
    return bound * delta / (resistance + delta);
  }

  function initRange(root) {
    var track = root.querySelector('.mz-range__track');
    var fill = root.querySelector('.mz-range__fill');
    var thumbLo = root.querySelector('[data-range-thumb="lo"]');
    var thumbHi = root.querySelector('[data-range-thumb="hi"]');

    var boundMin = parseFloat(root.dataset.boundMin) || 0;
    var boundMax = parseFloat(root.dataset.boundMax) || 10000;
    var span = boundMax - boundMin || 1;

    var minEl = document.getElementById('facet-min');
    var maxEl = document.getElementById('facet-max');

    // 邏輯值（喺 bounds 內）；overrun 只係視覺橡皮筋，唔改邏輯值
    var valLo = clamp(parseFloat(root.dataset.initMin), boundMin, boundMax);
    var valHi = clamp(parseFloat(root.dataset.initMax), boundMin, boundMax);

    function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

    function pct(v) { return ((v - boundMin) / span) * 100; }

    function render(overPct) {
      // overPct: {lo: -n..0(向左拉), hi: 0..n} 視覺用百分點
      overPct = overPct || { lo: 0, hi: 0 };
      var lp = clamp(pct(valLo), 0, 100) + (overPct.lo || 0);
      var hp = clamp(pct(valHi), 0, 100) + (overPct.hi || 0);

      thumbLo.style.left = lp + '%';
      thumbHi.style.left = hp + '%';
      fill.style.left = Math.min(lp, hp) + '%';
      fill.style.right = (100 - Math.max(lp, hp)) + '%';

      thumbLo.setAttribute('aria-valuenow', Math.round(valLo));
      thumbHi.setAttribute('aria-valuenow', Math.round(valHi));
    }

    function syncInputs() {
      // 滑桿到邊界 = 唔限（留空）；中間先填數字，等篩選語義清晰
      if (minEl) minEl.value = valLo <= boundMin ? '' : String(Math.round(valLo));
      if (maxEl) maxEl.value = valHi >= boundMax ? '' : String(Math.round(valHi));
    }

    // --- pointer drag ---
    var drag = null;

    function valueFromPointer(clientX) {
      var r = track.getBoundingClientRect();
      var ratio = (clientX - r.left) / r.width;
      return boundMin + clamp(ratio, 0, 1) * span;
    }

    function onDown(e) {
      var thumb = e.target.closest ? e.target.closest('[data-range-thumb]') : null;
      if (!thumb) return;
      e.preventDefault();
      var which = thumb.dataset.rangeThumb;
      drag = {
        which: which,
        startX: e.clientX,
        r: track.getBoundingClientRect(),
        moved: false,
      };
      root.classList.add('is-active');
      thumb.classList.add('is-drag');
      thumb.setPointerCapture && thumb.setPointerCapture(e.pointerId);
    }

    function onMove(e) {
      if (!drag) return;
      drag.moved = true;
      var ratio = (e.clientX - drag.r.left) / drag.r.width;

      var over = { lo: 0, hi: 0 };
      var RESIST = 6;
      var MAX_OVER = 18; // 視覺最多拉 18 個百分點

      if (drag.which === 'lo') {
        var rawLo = boundMin + ratio * span;
        if (rawLo < boundMin) {
          var d = (boundMin - rawLo) / span * 100;
          over.lo = -rubberBand(d, MAX_OVER, RESIST);
          valLo = boundMin;
        } else {
          valLo = clamp(rawLo, boundMin, Math.min(valHi, boundMax));
        }
      } else {
        var rawHi = boundMin + ratio * span;
        if (rawHi > boundMax) {
          var d2 = (rawHi - boundMax) / span * 100;
          over.hi = rubberBand(d2, MAX_OVER, RESIST);
          valHi = boundMax;
        } else {
          valHi = clamp(rawHi, Math.max(valLo, boundMin), boundMax);
        }
      }

      if (reduceMotion) { render(); syncInputs(); return; }
      // 拖動中關 transition 做「跟手」；橡皮筋直接反映喺 over
      root.classList.add('is-dragging');
      render(over);
      syncInputs();
    }

    function onUp(e) {
      if (!drag) return;
      var thumb = drag.which === 'lo' ? thumbLo : thumbHi;
      drag = null;
      root.classList.remove('is-active', 'is-dragging');
      thumb.classList.remove('is-drag');
      try { thumb.releasePointerCapture && thumb.releasePointerCapture(e.pointerId); } catch (_) {}
      // 鬆手：transition 開返 → 橡皮筋回彈 + snap
      render();
      syncInputs();
    }

    thumbLo.addEventListener('pointerdown', onDown);
    thumbHi.addEventListener('pointerdown', onDown);
    thumbLo.addEventListener('pointermove', onMove);
    thumbHi.addEventListener('pointermove', onMove);
    thumbLo.addEventListener('pointerup', onUp);
    thumbHi.addEventListener('pointerup', onUp);
    thumbLo.addEventListener('pointercancel', onUp);
    thumbHi.addEventListener('pointercancel', onUp);

    // --- 鍵盤 ---
    function keyStep(which, dir) {
      var step = Math.max(1, Math.round(span / 100));
      if (which === 'lo') {
        valLo = clamp(valLo + dir * step, boundMin, Math.min(valHi, boundMax));
      } else {
        valHi = clamp(valHi + dir * step, Math.max(valLo, boundMin), boundMax);
      }
      render();
      syncInputs();
    }
    [ [thumbLo, 'lo'], [thumbHi, 'hi'] ].forEach(function (pair) {
      pair[0].addEventListener('keydown', function (e) {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); keyStep(pair[1], -1); }
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); keyStep(pair[1], 1); }
      });
    });

    // --- 數字 input → 滑桿 ---
    if (minEl) minEl.addEventListener('input', function () {
      var v = parseFloat(minEl.value);
      if (Number.isFinite(v)) valLo = clamp(v, boundMin, Math.min(valHi, boundMax));
      render();
    });
    if (maxEl) maxEl.addEventListener('input', function () {
      var v = parseFloat(maxEl.value);
      if (Number.isFinite(v)) valHi = clamp(v, Math.max(valLo, boundMin), boundMax);
      render();
    });

    render();
    syncInputs();
  }

  function boot() {
    var nodes = document.querySelectorAll('[data-price-range]');
    Array.prototype.forEach.call(nodes, initRange);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
