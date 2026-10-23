(async function () {
  const { $, el, adminApiRequest } = window.AdminCommon;

  const els = {
    error: $('#ac-error'),
    tbody: $('#ac-tbody'),
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

  function isoToDisplay(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    const pad = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function parseCartData(raw) {
    if (raw == null) return null;
    if (typeof raw === 'object') return raw;
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw);
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  // 購物車價錢可能係港幣或仙，照常見結構盡量顯示
  function toHkd(n) {
    if (n == null || !Number.isFinite(Number(n))) return null;
    return Number(n);
  }

  function describeItems(cart) {
    if (!cart || !Array.isArray(cart.items)) return null;
    return cart.items.map((item) => {
      const name = item.name || item.product_name || ('商品 #' + (item.product_id || item.id || '?'));
      const qty = item.quantity || item.qty || 1;
      return name + ' × ' + qty;
    });
  }

  function extractTotal(cart, descriptions) {
    if (!cart) return null;
    const candidates = [cart.total, cart.total_amount, cart.totalAmount, cart.grand_total];
    for (const c of candidates) {
      const v = toHkd(c);
      if (v !== null) return v;
    }
    if (Array.isArray(cart.items)) {
      let sum = 0;
      let found = false;
      for (const item of cart.items) {
        const price = toHkd(item.price != null ? item.price : item.unit_price);
        const qty = Number(item.quantity || item.qty || 1);
        if (price !== null && Number.isFinite(qty)) {
          sum += price * qty;
          found = true;
        }
      }
      if (found) return sum;
    }
    return null;
  }

  function contactLabel(c) {
    const parts = [];
    if (c.email) parts.push('Email: ' + c.email);
    if (c.phone) parts.push('電話: ' + c.phone);
    if (c.whatsapp) parts.push('WhatsApp: ' + c.whatsapp);
    if (c.user_id) parts.push('用戶 #' + c.user_id);
    return parts.join(' / ');
  }

  function restoreUrl(c) {
    return '/cart?restore_cart=' + encodeURIComponent(String(c.token));
  }

  async function loadAbandonedCarts() {
    setError('');
    const data = await adminApiRequest('/api/admin/abandoned-carts');
    const rows = data.abandoned_carts || [];
    if (!els.tbody) return;
    els.tbody.textContent = '';

    for (const c of rows) {
      const cart = parseCartData(c.cart_data);
      const descriptions = describeItems(cart);
      const total = extractTotal(cart, descriptions);

      const contentTd = el('td');
      if (descriptions && descriptions.length) {
        const ul = el('ul', { class: 'list-disc pl-4' });
        for (const d of descriptions) {
          ul.appendChild(el('li', { text: d }));
        }
        contentTd.appendChild(ul);
      } else if (cart) {
        const pre = el('pre', { class: 'text-xs whitespace-pre-wrap' });
        pre.textContent = JSON.stringify(cart);
        contentTd.appendChild(pre);
      } else {
        contentTd.textContent = '（無法解析購物車內容）';
      }

      const link = restoreUrl(c);
      const openBtn = el('a', {
        class: 'admin-link-btn',
        href: link,
        target: '_blank',
        rel: 'noopener',
        text: '恢復連結',
      });
      const copyBtn = el('button', {
        class: 'admin-link-btn',
        type: 'button',
        text: '複製',
        onclick: async () => {
          const abs = window.location.origin + link;
          try {
            await navigator.clipboard.writeText(abs);
            copyBtn.textContent = '已複製';
            setTimeout(() => { copyBtn.textContent = '複製'; }, 1500);
          } catch (e) {
            window.prompt('複製呢條連結：', abs);
          }
        },
      });

      const reminderLabel = (c.reminder_sent ? '已發 ' + c.reminder_sent + ' 次' : '未發') +
        (c.last_reminder_sent_at ? '\n' + isoToDisplay(c.last_reminder_sent_at) : '');
      const reminderTd = el('td', { class: 'whitespace-pre-line', text: reminderLabel });

      const actionTd = el('td', {}, [openBtn, el('span', { text: ' ' }), copyBtn]);

      els.tbody.appendChild(el('tr', {}, [
        el('td', { text: isoToDisplay(c.created_at) }),
        el('td', { text: contactLabel(c) || '—' }),
        contentTd,
        el('td', { text: total !== null ? 'HK$' + total.toFixed(2) : '—' }),
        reminderTd,
        actionTd,
      ]));
    }
  }

  try {
    await loadAbandonedCarts();
  } catch (e) {
    setError(e && e.message ? e.message : String(e));
  }
})();
