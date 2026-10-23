/* ==========================================================================
   手機商品分類 BottomSheet（可拖拽 half/full + 嵌套子分類）
   取代舊左側抽屜。數據嚟自 partial 內 [data-category-tree-json]。
   - 主 sheet：half 起，可拖上 full；列全部頂層分類 + 全部 + 特別專區
   - 有子分類嘅項 → 點「細類」嵌套開子 sheet（pattern 08），主 sheet 後退
   - 點分類本身直接導航
   依賴 bottom-sheet.js
   ========================================================================== */
(function () {
  'use strict';

  function readData() {
    const node = document.querySelector('[data-category-tree-json]');
    if (!node) return null;
    try {
      return JSON.parse(node.textContent);
    } catch (e) {
      return null;
    }
  }

  function categoryHref(slug) {
    return '/products?category=' + encodeURIComponent(slug) + '&page=1';
  }

  // 渲染分類列表 HTML（depth 控制縮進；頂層調用）
  function renderList(nodes, active, { nestable = true } = {}) {
    return (
      '<div class="space-y-2">' +
      nodes
        .map(function (node) {
          const kids = Array.isArray(node.children) ? node.children : [];
          const isCurrent = active === node.slug;
          const hasKids = kids.length > 0;
          return (
            '<div class="flex items-center gap-1 rounded-2xl border px-1.5 py-1 transition ' +
            (isCurrent
              ? 'border-gold/40 bg-wine/15'
              : 'border-ink-600 bg-ink-800') +
            '">' +
            '<a href="' + categoryHref(node.slug) + '" ' +
            'class="flex min-h-[48px] min-w-0 flex-1 items-center gap-2 rounded-xl px-3 py-2 text-left">' +
            '<span class="min-w-0 flex-1 truncate text-sm font-semibold ' +
            (isCurrent ? 'text-gold-light' : 'text-gray-200') + '">' + node.name + '</span>' +
            '<span class="text-[11px] text-gray-500">' + (node.count != null ? node.count : '') + '</span>' +
            (isCurrent ? '<span class="text-gold">✓</span>' : '') +
            '</a>' +
            (hasKids && nestable
              ? '<button type="button" data-nest-slug="' + node.slug + '" ' +
                'class="mr-1 flex h-9 w-9 items-center justify-center rounded-full text-gold-light active:bg-wine/25" ' +
                'aria-label="' + node.name + '細分類" title="細分類">⌄</button>'
              : '') +
            '</div>'
          );
        })
        .join('') +
      '</div>'
    );
  }

  // 嵌套子 sheet：列某分類嘅細類（含「睇呢類全部」入口）。
  // 遞迴：子 sheet 都會綁嵌套點擊，可一層層落到最底層。
  function openChildren(parentNode, active) {
    const kids = Array.isArray(parentNode.children) ? parentNode.children : [];
    let html =
      '<a href="' + categoryHref(parentNode.slug) + '" ' +
      'class="mb-3 flex items-center justify-between rounded-2xl border border-gold/40 bg-wine/15 px-4 py-3 text-sm font-bold text-gold-light">' +
      '<span>睇「' + parentNode.name + '」全部</span><span>→</span></a>';
    html += renderList(kids, active, { nestable: true });

    const sheet = BottomSheet.open({
      title: parentNode.name,
      content: html,
      detents: ['half', 'full'],
      startDetent: 'half',
      spring: true,
    });

    // 子 sheet 嵌套：喺呢層嘅 kids 入面搵節點，再開下一層
    sheet.bodyEl.addEventListener('click', function (e) {
      const nestBtn = e.target.closest('[data-nest-slug]');
      if (!nestBtn) return;
      e.preventDefault();
      const node = kids.find((n) => n.slug === nestBtn.dataset.nestSlug);
      if (node) openChildren(node, active);
    });

    return sheet;
  }

  function openMain(data) {
    const active = data.active;
    let html =
      '<a href="/products?page=1" ' +
      'class="mb-3 flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-semibold ' +
      (!active || active === 'all'
        ? 'border-gold/40 bg-wine/15 text-gold-light'
        : 'border-ink-600 bg-ink-800 text-gray-300') +
      '"><span>全部商品</span>' +
      '<span class="text-[11px] text-gray-500">' + (data.allCount || 0) + '</span></a>';

    html += renderList(data.tree, active);

    if (Array.isArray(data.specials) && data.specials.length) {
      html += '<div class="mb-1 mt-4 px-1 text-[11px] font-black uppercase tracking-wider text-gray-500">特別專區</div>';
      html +=
        '<div class="space-y-2">' +
        data.specials
          .map(function (sp) {
            const isCurrent = active === sp.slug;
            return (
              '<a href="' + categoryHref(sp.slug) + '" ' +
              'class="flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-semibold ' +
              (isCurrent
                ? 'border-gold/40 bg-wine/15 text-gold-light'
                : 'border-ink-600 bg-ink-800 text-gray-300') +
              '"><span>' + sp.name + '</span>' +
              '<span class="text-[11px] text-gray-500">' + sp.count + '</span></a>'
            );
          })
          .join('') +
        '</div>';
    }

    const sheet = BottomSheet.open({
      title: '商品分類',
      content: html,
      detents: ['half', 'full'],
      startDetent: 'half',
      spring: true,
    });

    // 嵌套：點 ⌄ 開子分類 sheet（<a> 照常導航，由 BottomSheet 點掣分擔）
    sheet.bodyEl.addEventListener('click', function (e) {
      const nestBtn = e.target.closest('[data-nest-slug]');
      if (!nestBtn) return;
      e.preventDefault();
      const node = data.tree.find((n) => n.slug === nestBtn.dataset.nestSlug);
      if (node) openChildren(node, active);
    });
  }

  // 兩個入口：
  // 1) tabbar「分類」掣（全頁）[data-category-tab-open]
  // 2) 頁內篩選按鈕（products/product 頁）[data-category-sheet-open]
  function bindOpeners() {
    if (typeof BottomSheet === 'undefined') return;
    document.addEventListener('click', function (e) {
      const btn = e.target.closest &&
        e.target.closest('[data-category-tab-open],[data-category-sheet-open]');
      if (!btn) return;
      e.preventDefault();
      const data = readData();
      if (data) openMain(data);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindOpeners);
  } else {
    bindOpeners();
  }
})();
