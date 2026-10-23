WITH RECURSIVE sub AS (
  SELECT id FROM categories WHERE slug = 'sf-lingerie-70062'
  UNION ALL SELECT c.id FROM sub JOIN categories c ON c.parent_id = sub.id
)
SELECT p.id, mzrank.rank
FROM product_storefront ps
JOIN products p ON p.id = ps.product_id AND p.status='active'
LEFT JOIN mzakka_category_rank mzrank
  ON mzrank.product_id = p.id AND mzrank.category_id = 70062
WHERE ps.storefront_category_id IN (SELECT id FROM sub)
ORDER BY mzrank.rank NULLS LAST, p.id DESC
LIMIT 8;
