WITH RECURSIVE t AS (
  SELECT id, parent_id, name, 1 AS lvl, ARRAY[sort_order] AS path
  FROM categories
  WHERE parent_id IS NULL AND status='active'
  UNION ALL
  SELECT c.id, c.parent_id, c.name, t.lvl + 1, t.path || c.sort_order
  FROM categories c
  JOIN t ON t.id = c.parent_id
  WHERE c.status='active'
),
pc AS (
  SELECT category_id, COUNT(*)::int AS n
  FROM products
  WHERE status='active'
  GROUP BY category_id
)
SELECT t.lvl, t.id, t.parent_id, COALESCE(pc.n, 0), t.name
FROM t
LEFT JOIN pc ON pc.category_id = t.id
ORDER BY t.path, t.name;
