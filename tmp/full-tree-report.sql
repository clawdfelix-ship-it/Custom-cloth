WITH RECURSIVE
direct AS (
  SELECT storefront_category_id AS cid, COUNT(*)::int n
  FROM product_storefront GROUP BY 1
),
walk AS (
  SELECT c.id, c.parent_id, c.slug, c.name, 1 AS lvl,
         ARRAY[c.sort_order, c.id % 100000] AS path
  FROM categories c
  WHERE c.status='active' AND c.source='storefront' AND c.parent_id IS NULL
  UNION ALL
  SELECT c.id, c.parent_id, c.slug, c.name, w.lvl + 1,
         w.path || ARRAY[c.sort_order, c.id % 100000]
  FROM categories c JOIN walk w ON w.id = c.parent_id
  WHERE c.status='active' AND c.source='storefront'
),
sub AS (
  SELECT w2.id,
         COALESCE(d.n,0)::int AS direct_n
  FROM walk w2 LEFT JOIN direct d ON d.cid = w2.id
),
-- subtree sums via closure
closure AS (
  SELECT c.id AS root, c.id AS cid
  FROM categories c WHERE c.status='active' AND c.source='storefront'
  UNION ALL
  SELECT cl.root, c.id FROM closure cl
  JOIN categories c ON c.parent_id = cl.cid
  WHERE c.status='active' AND c.source='storefront'
),
subtotal AS (
  SELECT cl.root, COALESCE(SUM(d.n),0)::int AS total
  FROM closure cl LEFT JOIN direct d ON d.cid = cl.cid
  GROUP BY cl.root
)
SELECT lpad('', (w.lvl-1)*2) || w.name AS tree,
       w.lvl,
       COALESCE(s.direct_n,0) AS direct,
       st.total AS subtree,
       w.slug
FROM walk w
JOIN sub s ON s.id = w.id
JOIN subtotal st ON st.root = w.id
ORDER BY w.path;
