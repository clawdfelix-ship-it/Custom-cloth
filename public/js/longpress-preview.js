/**
 * 長按商品卡 → 快速預覽（手機）
 *
 * 長按卡面（~450ms 冇明顯郁動）→ 彈 BottomSheet 快速睇大圖／價錢／積分，
 * 並可即時加入購物車，唔使入詳情頁。
 *
 * - 只喺觸控設備啟用（matchMedia pointer:coarse），桌面滑鼠唔做
 * - 手指一郁（超過容差）就取消，唔干擾正常滾動
 * - 預覽層「加入購物車」係 data-add-to-cart，cart-client 事件委托會直接處理
 * - 產品資料直接由卡 DOM 提取（唔依賴額外資料島）
 */
(function () {
  'use strict';

  var HOLD_MS = 450;
  var MOVE_TOLERANCE = 10; // px；超過當滾動，取消長按

  var coarse = false;
  try {
    coarse = window.matchMedia('(pointer: coarse)').matches;
  } catch (_) {}
  if (!coarse) return;

  var reduced = false;
  try {
    reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (_) {}

  var timer = null;
  var startX = 0, startY = 0, targetCard = null, fired = false;

  function cardFrom(node) {
    return node.closest && node.closest('[data-focus-item]');
  }

  function cancel() {
    if (timer) { clearTimeout(timer); timer = null; }
    targetCard = null;
  }

  function onStart(e) {
    // 多指／非主觸控唔做
    if (!e.touches || e.touches.length !== 1) return;
    var t = e.touches[0];
    var card = cardFrom(e.target);
    if (!card) return;
    // 長按喺已經係按鈕/連結嘅元素上都得，但唔好阻止佢哋正常點擊（fired 時先 preventDefault）
    targetCard = card;
    startX = t.clientX; startY = t.clientY; fired = false;

    timer = setTimeout(function () {
      fired = true;
      // 觸覺反饋（有先做）
      if (navigator.vibrate) { try { navigator.vibrate(12); } catch (_) {} }
      showPreview(card);
    }, HOLD_MS);
  }

  function onMove(e) {
    if (!timer || !targetCard) return;
    var t = e.touches[0];
    var dx = Math.abs(t.clientX - startX);
    var dy = Math.abs(t.clientY - startY);
    if (dx > MOVE_TOLERANCE || dy > MOVE_TOLERANCE) cancel();
  }

  // ── 預覽層 ────────────────────────────────────────────────
  function escAttr(s) {
    return String(s == null ? '' : s).replace(/"/g, '&quot;');
  }

  function showPreview(card) {
    if (typeof BottomSheet === 'undefined') return;

    var anchor = card.querySelector('a[href^="/product/"]');
    var href = anchor ? anchor.getAttribute('href') : '#';
    var idM = href.match(/\/product\/(\d+)/);
    var id = idM ? idM[1] : '';

    var img = card.querySelector('img');
    var imgSrc = img ? (img.currentSrc || img.src) : '';

    var name = card.querySelector('h3 a');
    var nameText = name ? name.textContent.trim() : '';

    var cat = card.querySelector('.bg-wine\\/15, span');
    // 價錢：直接取卡內 gold 大字
    var priceEl = card.querySelector('.text-gold');
    var priceText = priceEl ? priceEl.textContent.trim() : '';

    // 積分
    var ptsEl = card.querySelector('[class*="text-gold"]');
    var ptsText = '';
    var allSpans = card.querySelectorAll('span');
    for (var i = 0; i < allSpans.length; i++) {
      if (/賺\s*\d+\s*積分/.test(allSpans[i].textContent)) { ptsText = allSpans[i].textContent.trim(); break; }
    }

    var html = '' +
      '<div class="flex flex-col items-center gap-3">' +
        (imgSrc ? '<div class="flex h-72 w-full items-center justify-center rounded-2xl bg-ink-850 p-3"><img src="' + escAttr(imgSrc) + '" alt="" class="max-h-full max-w-full object-contain" /></div>' : '') +
        '<div class="w-full text-center">' +
          '<div class="text-xs text-gray-500">' + escAttr(cat && cat !== priceEl ? cat.textContent.trim() : '') + '</div>' +
          '<div class="mt-1 text-base font-bold text-white line-clamp-2">' + escAttr(nameText) + '</div>' +
          '<div class="mt-2 text-2xl font-black text-gold">' + escAttr(priceText) + '</div>' +
          (ptsText ? '<div class="mt-1 text-xs font-bold text-gold">' + escAttr(ptsText) + '</div>' : '') +
        '</div>' +
        '<div class="mt-2 flex w-full gap-2">' +
          '<a href="' + escAttr(href) + '" class="flex min-h-[44px] flex-1 items-center justify-center rounded-full bg-ink-700 px-3 text-xs font-bold text-white">睇詳情</a>' +
          '<button type="button" data-add-to-cart data-product-id="' + escAttr(id) + '" data-quantity="1" ' +
            'class="flex min-h-[44px] flex-1 items-center justify-center rounded-full bg-orange-500 px-3 text-xs font-bold text-white">加入購物車</button>' +
        '</div>' +
      '</div>';

    var sheet = BottomSheet.open({
      title: '快速預覽',
      content: html,
      detents: ['full'],
      startDetent: 'full',
      spring: true,
    });

    // 喺 sheet 內關閉（撳「睇詳情」會導航；關 sheet 已由 BottomSheet 處理）
    return sheet;
  }

  // 長按觸發後，阻止跟住嗰個合成 click（否則會即刻跳咗去詳情頁）
  document.addEventListener('click', function (e) {
    if (fired) {
      e.preventDefault();
      e.stopPropagation();
      fired = false;
    }
  }, true);

  // 長按商品卡時，壓制瀏覽器原生「儲存圖片／分享」callout。
  // iOS Safari 長按圖片會 fire contextmenu；preventDefault 先唔會彈原生選單。
  document.addEventListener('contextmenu', function (e) {
    var card = cardFrom(e.target);
    if (card) {
      e.preventDefault();
      // 如果長按已經夠時間，直接開預覽（桌面/某些 Android contextmenu 係唯一訊號）
      if (fired) { fired = false; return; }
      if (!timer && targetCard === card) showPreview(card);
    }
  });

  document.addEventListener('touchstart', onStart, { passive: true });
  document.addEventListener('touchmove', onMove, { passive: true });
  document.addEventListener('touchend', cancel, { passive: true });
  document.addEventListener('touchcancel', cancel, { passive: true });
})();
