/* ==========================================================================
   Checkout 付款方式 BottomSheet（pattern 08 嵌套抽屜）
   - 點 #payment-sheet-open 開主 sheet 揀付款方式
   - 每項有「查看詳情」→ 嵌套開子 sheet，主 sheet 自動後退縮小
   - 選擇後同步隱藏 radio（name=payment_method）+ 掣面摘要
   依賴 bottom-sheet.js（window.BottomSheet）
   ========================================================================== */
(function () {
  'use strict';

  const METHODS = [
    {
      value: 'bank_transfer',
      icon: '🏦',
      name: '銀行轉帳',
      desc: '落單後顯示收款戶口，24 小時內過數',
      detail:
        '<div class="space-y-3 text-sm leading-relaxed text-gray-300">' +
        '<p>落單後於訂單確認頁顯示<strong class="text-white">銀行收款戶口號碼</strong>。</p>' +
        '<p>請於<strong class="text-gold"> 24 小時內</strong>過數，並將入數收據上傳或傳回，核實後即安排出貨。</p>' +
        '<div class="rounded-xl bg-ink-800 p-3 text-xs text-gray-400">提示：過數後請保留收據，備註填返訂單編號。</div>' +
        '</div>',
    },
    {
      value: 'fps',
      icon: '⚡',
      name: 'FPS 轉數快',
      desc: '落單後顯示 FPS ID，即時過數',
      detail:
        '<div class="space-y-3 text-sm leading-relaxed text-gray-300">' +
        '<p>落單後於訂單確認頁顯示<strong class="text-white">FPS 轉數快 ID</strong>。</p>' +
        '<p>打開銀行 app 掃碼或輸入 ID <strong class="text-gold">即時過數</strong>，轉賬備註請填訂單編號。</p>' +
        '<div class="rounded-xl bg-ink-800 p-3 text-xs text-gray-400">FPS 24 小時運作，過數通常即時到賬。</div>' +
        '</div>',
    },
  ];

  function currentValue() {
    const checked = document.querySelector('input[name="payment_method"]:checked');
    return checked ? checked.value : 'bank_transfer';
  }

  function applyMethod(method) {
    const icon = document.getElementById('payment-selected-icon');
    const name = document.getElementById('payment-selected-name');
    const desc = document.getElementById('payment-selected-desc');
    if (icon) icon.textContent = method.icon;
    if (name) name.textContent = method.name;
    if (desc) desc.textContent = method.desc;
    document.querySelectorAll('input[name="payment_method"]').forEach(function (r) {
      r.checked = r.value === method.value;
    });
  }

  // 打開某付款方式嘅「詳情」嵌套子 sheet
  function openDetail(parentSheet, method) {
    BottomSheet.open({
      title: method.icon + ' ' + method.name + ' · 詳情',
      content: method.detail,
      detents: ['half', 'full'],
      startDetent: 'half',
      spring: true,
    });
  }

  function openPicker() {
    const current = currentValue();

    const content =
      '<div class="space-y-2.5">' +
      METHODS.map(function (m) {
        const active = m.value === current;
        return (
          '<div class="flex items-center gap-1 rounded-2xl px-1.5 py-1 transition ' +
          (active ? 'bg-wine/15 ring-1 ring-gold/40' : '') +
          '">' +
          '<button type="button" data-pay="' + m.value + '" ' +
          'class="flex min-h-[48px] flex-1 items-center gap-3 rounded-xl px-2 py-2 text-left">' +
          '<span class="text-2xl">' + m.icon + '</span>' +
          '<span class="min-w-0 flex-1">' +
          '<span class="block text-sm font-bold text-white">' + m.name + '</span>' +
          '<span class="block truncate text-xs text-gray-500">' + m.desc + '</span>' +
          '</span>' +
          (active ? '<span class="pr-1 text-gold">✓</span>' : '') +
          '</button>' +
          '<button type="button" data-detail="' + m.value + '" ' +
          'class="mr-1 rounded-full px-3 py-1.5 text-xs font-bold text-gold-light active:bg-wine/25"' +
          ' aria-label="' + m.name + '詳情">詳情</button>' +
          '</div>'
        );
      }).join('') +
      '</div>';

    const sheet = BottomSheet.open({
      title: '選擇付款方式',
      content: content,
      detents: ['half', 'full'],
      startDetent: 'half',
      spring: true,
    });

    sheet.bodyEl.addEventListener('click', function (e) {
      const payBtn = e.target.closest('[data-pay]');
      const detailBtn = e.target.closest('[data-detail]');

      if (detailBtn) {
        const method = METHODS.find((m) => m.value === detailBtn.dataset.detail);
        if (method) openDetail(sheet, method);
        return;
      }
      if (payBtn) {
        const method = METHODS.find((m) => m.value === payBtn.dataset.pay);
        if (method) {
          applyMethod(method);
          sheet.resolve(method.value);
        }
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    const openBtn = document.getElementById('payment-sheet-open');
    if (!openBtn || typeof BottomSheet === 'undefined') return;
    // 確保初始摘要同默認 radio 一致
    const initial = METHODS.find((m) => m.value === currentValue()) || METHODS[0];
    applyMethod(initial);
    openBtn.addEventListener('click', openPicker);
  });
})();
