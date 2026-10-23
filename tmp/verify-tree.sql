WITH RECURSIVE t AS (
  SELECT id, parent_id, slug, name, 1 AS lvl
  FROM categories
  WHERE status='active' AND source='storefront' AND parent_id IS NULL
  UNION ALL
  SELECT c.id, c.parent_id, c.slug, c.name, t.lvl + 1
  FROM categories c JOIN t ON t.id = c.parent_id
  WHERE c.status='active' AND c.source='storefront'
)
SELECT lvl, COUNT(*) nodes FROM t GROUP BY 1 ORDER BY 1;
