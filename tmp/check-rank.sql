WITH RECURSIVE sub AS (
  SELECT id FROM categories WHERE slug = 'sf-lingerie-70062'
  UNION ALL SELECT c.id FROM sub JOIN categories c ON c.parent_id = sub.id
),
psf AS (
  SELECT ps.product_id
  FROM product_storefront ps
  WHERE ps.storefront_category_id IN (SELECT id FROM sub)
)
SELECT COUNT(*) products,
       COUNT(mzrank.rank) with_rank,
       COUNT(DISTINCT mzrank.rank) distinct_ranks
FROM psf
LEFT JOIN mzakka_category_rank mzrank
  ON mzrank.product_id = psf.product_id AND mzrank.category_id = 70062;
