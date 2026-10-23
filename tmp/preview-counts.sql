WITH RECURSIVE direct AS (
  SELECT storefront_category_id AS cid, COUNT(*)::int n
  FROM product_storefront GROUP BY 1
),
descendants AS (
  SELECT c.id AS root_id, c.id AS cid
  FROM categories c WHERE c.status='active' AND c.source='storefront'
  UNION ALL
  SELECT d.root_id, c.id
  FROM descendants d
  JOIN categories c ON c.parent_id = d.cid
  WHERE c.status='active' AND c.source='storefront'
),
subtree AS (
  SELECT d.root_id, SUM(direct.n)::int n
  FROM descendants d LEFT JOIN direct ON direct.cid = d.cid
  GROUP BY d.root_id
)
SELECT c.slug, c.name, COALESCE(subtree.n,0) cnt
FROM categories c
LEFT JOIN subtree ON subtree.root_id = c.id
WHERE c.status='active' AND c.source='storefront' AND c.parent_id IS NULL
ORDER BY cnt DESC;
