/**
 * Ohya2.0 前台共享購物車 client（P1/P2/P3 修正）
 * - 統一貨幣格式 HK$（價格一律為 cents）
 * - 訪客：localStorage；會員：/api/cart* API（CSRF）
 * - 全站預購模式：不追蹤庫存，數量不設上限
 * - 全站加車用 toast，唔再 alert
 *
 * 頁面用法：
 *   1. <body data-logged-in="0|1">、<meta name="csrf-token">
 *   2. 商品 JSON island：<script id="mz-products" type="application/json">[...]</script>
 *      （詳情頁可用 id="mz-product" 放單一物件）
 *   3. 掣加屬性 data-add-to-cart data-product-id="123"（可選 data-quantity）
 *      共享腳本會做事件委托，掣喺 <a> 入面都會正確擋跳轉
 *   4. 詳情頁自訂數量可直接 await MZCart.add(product, quantity)
 */
(function () {
  'use strict';

  var GUEST_CART_KEY = 'cart';

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  function isLoggedIn() {
    return document.body.dataset.loggedIn === '1';
  }

  function csrfToken() {
    var meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') || '' : '';
  }

  // --- 價格（cents → HK$）---
  function formatPrice(cents) {
    return 'HK$' + (Number(cents || 0) / 100).toFixed(0);
  }

  // --- 訪客 cart ---
  function readGuestCart() {
    try {
      var raw = JSON.parse(localStorage.getItem(GUEST_CART_KEY) || '[]');
      return Array.isArray(raw) ? raw : [];
    } catch (_) {
      return [];
    }
  }

  function writeGuestCart(cart) {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify(cart));
  }

  function guestCount() {
    return readGuestCart().reduce(function (sum, item) {
      return sum + Number(item.quantity || 0);
    }, 0);
  }

  // --- API ---
  function requestJson(url, options) {
    options = options || {};
    var headers = new Headers(options.headers || {});
    var method = String(options.method || 'GET').toUpperCase();

    if (options.body && !headers.has('content-type')) {
      headers.set('content-type', 'application/json');
    }
    if (method !== 'GET' && method !== 'HEAD' && csrfToken()) {
      headers.set('csrf-token', csrfToken());
    }

    return fetch(url, Object.assign({ credentials: 'same-origin' }, options, { headers: headers }))
      .then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (data) {
          if (!response.ok) {
            var err = new Error(data.error || '請稍後再試');
            err.status = response.status;
            throw err;
          }
          return data;
        });
      });
  }

  function setBadgeCount(count) {
    var badge = document.getElementById('cart-count');
    if (badge) {
      var prev = parseInt(badge.textContent || '0', 10) || 0;
      badge.textContent = String(count);
      if (count > prev && window.MZFluid) window.MZFluid.popBadge(); // 07 COUNT
    }
    // 手機 tabbar badge（可能同 header badge 並存）
    Array.prototype.forEach.call(document.querySelectorAll('[data-cart-badge]'), function (b) {
      b.textContent = String(count);
      b.hidden = !(count > 0);
    });
  }

  function refreshCount() {
    var badge = document.getElementById('cart-count');
    var hasMobileBadge = document.querySelector('[data-cart-badge]');
    if (!badge && !hasMobileBadge) return Promise.resolve();

    if (!isLoggedIn()) {
      setBadgeCount(guestCount());
      return Promise.resolve();
    }

    if (!badge && hasMobileBadge) {
      return requestJson('/api/cart')
        .then(function (data) {
          var count = Array.isArray(data.items)
            ? data.items.reduce(function (sum, item) { return sum + Number(item.quantity || 0); }, 0)
            : 0;
          setBadgeCount(count);
        })
        .catch(function (err) { console.error('Failed to refresh cart count:', err); });
    }

    return requestJson('/api/cart')
      .then(function (data) {
        var count = Array.isArray(data.items)
          ? data.items.reduce(function (sum, item) { return sum + Number(item.quantity || 0); }, 0)
          : 0;
        setBadgeCount(count);
      })
      .catch(function (err) {
        console.error('Failed to refresh cart count:', err);
      });
  }

  /**
  * 加商品入車。
  * product 需有 { id, name, price(cents), image }
  * 成功回 true；失敗拋 Error（message 可直接展示）
  * 預購模式：不檢查 stock，數量不設上限
  */
  function add(product, quantity) {
    quantity = parseInt(quantity, 10);
    if (!product || !product.id) {
      return Promise.reject(new Error('商品資料不正確'));
    }
    if (!Number.isFinite(quantity) || quantity < 1) {
      return Promise.reject(new Error('請選擇正確數量'));
    }

    if (isLoggedIn()) {
      return requestJson('/api/cart/add', {
        method: 'POST',
        body: JSON.stringify({ product_id: product.id, quantity: quantity }),
      }).then(function () {
        return refreshCount();
      }).then(function () { return true; });
    }

    // 訪客：localStorage
    var cart = readGuestCart();
    var existing = cart.find(function (item) { return item.id === product.id; });
    var nextQuantity = (existing ? Number(existing.quantity) : 0) + quantity;

    if (existing) {
      existing.quantity = nextQuantity;
    } else {
      cart.push({
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image || null,
        quantity: quantity,
      });
    }
    writeGuestCart(cart);
    return refreshCount().then(function () { return true; });
  }

  // --- Toast ---
  var toastTimer = null;
  function toast(message, tone) {
    var el = document.getElementById('mz-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'mz-toast';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      el.style.cssText =
        'position:fixed;left:50%;bottom:1.5rem;transform:translateX(-50%) translateY(1rem);' +
        'z-index:9999;max-width:90vw;padding:0.75rem 1.25rem;border-radius:9999px;' +
        'font-size:0.875rem;font-weight:700;color:#fff;background:#1f2937;' +
        'box-shadow:0 8px 24px rgba(0,0,0,0.18);opacity:0;transition:opacity .2s ease,transform .2s ease;' +
        'pointer-events:none;';
      document.body.appendChild(el);
    }
    el.textContent = '';
    // 05 DRAW: success shows a checkmark that strokes itself in
    if (tone === 'success' && window.MZFluid && !window.MZFluid.reduceMotion) {
      var span = document.createElement('span');
      span.innerHTML = window.MZFluid.checkSvg();
      var svg = span.firstChild;
      el.appendChild(svg);
      var label = document.createElement('span');
      label.textContent = message;
      el.appendChild(label);
      requestAnimationFrame(function () { svg.classList.add('fluid-check--in'); });
    } else {
      el.textContent = message;
    }
    el.style.background = tone === 'error' ? '#b91c1c' : (tone === 'success' ? '#15803d' : '#1f2937');
    requestAnimationFrame(function () {
      el.style.opacity = '1';
      el.style.transform = 'translateX(-50%) translateY(0)';
    });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.style.opacity = '0';
      el.style.transform = 'translateX(-50%) translateY(1rem)';
    }, 2200);
  }

  // --- 由頁面 JSON island 搵商品 ---
  function productMap() {
    var map = {};
    var listEl = document.getElementById('mz-products');
    if (listEl) {
      try {
        var list = JSON.parse(listEl.textContent || '[]');
        if (Array.isArray(list)) {
          list.forEach(function (p) { if (p && p.id != null) map[p.id] = p; });
        }
      } catch (_) {}
    }
    var singleEl = document.getElementById('mz-product');
    if (singleEl) {
      try {
        var p = JSON.parse(singleEl.textContent || 'null');
        if (p && p.id != null) map[p.id] = p;
      } catch (_) {}
    }
    return map;
  }

  // --- 事件委托：data-add-to-cart ---
  ready(function () {
    refreshCount();

    document.addEventListener('click', function (event) {
      var btn = event.target && event.target.closest
        ? event.target.closest('[data-add-to-cart]')
        : null;
      if (!btn) return;

      // 掣可能擺喺商品卡 <a> 入面，必須擋跳轉
      event.preventDefault();
      event.stopPropagation();

      if (btn.disabled || btn.getAttribute('aria-disabled') === 'true') {
        return;
      }

      var id = parseInt(btn.dataset.productId, 10);
      var qty = parseInt(btn.dataset.quantity || '1', 10);
      var product = productMap()[id];
      if (!product) {
        toast('商品資料不正確', 'error');
        return;
      }

      btn.disabled = true;
      var originalHtml = btn.innerHTML;

      // Pattern 10：掣 morph 做圓形 spinner → 綠底畫對勾。外層寬度不變，唔跳版。
      function buildMorphDom() {
        btn.innerHTML =
          '<span class="mzc-label"></span>' +
          '<span class="mzc-circle">' +
            '<span class="mzc-spinner"></span>' +
            '<svg class="mzc-check" viewBox="0 0 24 24" fill="none" ' +
              'stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">' +
              '<path d="M4 12.5l5 5L20 6.5"/></svg>' +
          '</span>';
        btn.querySelector('.mzc-label').innerHTML = originalHtml;
      }
      function resetBtn() {
        btn.classList.remove('is-morphing', 'is-added');
        btn.innerHTML = originalHtml;
        btn.disabled = false;
      }

      buildMorphDom();
      // force layout so the class change animates
      void btn.offsetWidth;
      btn.classList.add('is-morphing');

      add(product, qty)
        .then(function () {
          toast('已加入購物車！', 'success');
          // 叨叨 #8：商品圖縮成圓形沿弧線飛入購物車；掣自身同時 burst
          if (window.MZFluid) {
            window.MZFluid.flyToCart(btn);
            window.MZFluid.burstFrom(btn);
          }
          btn.classList.remove('is-morphing');
          btn.classList.add('is-added');
          setTimeout(resetBtn, 1100);
        })
        .catch(function (err) {
          toast(err.message || '加入購物車失敗', 'error');
          resetBtn();
        });
    });
  });

  window.MZCart = {
    formatPrice: formatPrice,
    refreshCount: refreshCount,
    add: add,
    toast: toast,
    readGuestCart: readGuestCart,
  };
})();
