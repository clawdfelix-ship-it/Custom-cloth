function extractBreadcrumbCategoryNames(html) {
  if (typeof html !== 'string' || !html) return [];
  const m = html.match(/<div[^>]*id=\"breadcrumb\"[^>]*>([\s\S]*?)<\/div>/i);
  if (!m) return [];
  const block = m[1];
  return [...block.matchAll(/category\.php\?category=\d+[^>]*>([^<]+)</ig)]
    .map(x => String(x[1] || '').trim())
    .filter(Boolean);
}

function getRootCategoryNameFromHtml(html) {
  const cats = extractBreadcrumbCategoryNames(html);
  function isPseudoCategory(name) {
    if (!name) return true;
    const s = String(name);
    if (s.includes('新商品')) return true;
    if (s.includes('新規取扱')) return true;
    if (s.includes('注目商品')) return true;
    if (s.includes('ランキング')) return true;
    if (s.includes('上半期')) return true;
    if (s.includes('下半期')) return true;
    if (s.includes('年')) return true;
    return false;
  }

  for (const c of cats) {
    if (!isPseudoCategory(c)) return c;
  }
  return '未分類';
}

module.exports = { extractBreadcrumbCategoryNames, getRootCategoryNameFromHtml };
