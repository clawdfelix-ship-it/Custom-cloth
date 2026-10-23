SELECT c.id, c.parent_id, c.slug, c.name, c.name_zh_hk,
       COALESCE(s.n,0)::int AS count
FROM categories c
LEFT JOIN (SELECT 1 AS x) AS dummy ON true
LEFT JOIN LATERAL (
  WITH RECURSIVE d AS (
    SELECT c2.id AS root, c2.id AS cid FROM categories c2 WHERE c2.id=c.id
    UNION ALL SELECT c3.id, c4.id FROM d
    JOIN categories c4 ON c4.parent_id=d.cid
  )
  SELECT 1 FROM d LIMIT 1
) s ON true
WHERE c.status='active' AND c.source='storefront'
ORDER BY c.id;
