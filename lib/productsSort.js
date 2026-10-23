function getProductsOrderBy(sortKey) {
  const key = typeof sortKey === 'string' ? sortKey : '';

  const map = {
    recommend: 'p.is_featured DESC, p.created_at DESC',
    newest: 'p.created_at DESC',
    price_asc: 'p.price ASC, p.created_at DESC',
    price_desc: 'p.price DESC, p.created_at DESC',
    popular: 'COALESCE(p.review_count, 0) DESC, COALESCE(p.average_rating, 0) DESC, p.created_at DESC',
  };

  return map[key] || map.recommend;
}

function normalizeProductsSort(sortKey) {
  const key = typeof sortKey === 'string' ? sortKey : '';
  const allowed = new Set(['recommend', 'newest', 'price_asc', 'price_desc', 'popular']);
  // 全站默認「最新上架」（created_at 新→舊）；推介排序要用戶顯式揀
  return allowed.has(key) ? key : 'newest';
}

module.exports = { getProductsOrderBy, normalizeProductsSort };

