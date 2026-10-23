-- Backfill subcategories (two-level categories) and ensure products.category_id points to a leaf subcategory.

-- Ensure categories table has parent_id (safe for existing schema)
ALTER TABLE categories ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL;

-- 1) For each root category, ensure an "其他" subcategory exists.
-- Slug uses "<parent-slug>-other" (or -other-2/-other-3 if taken).
DO $$
DECLARE
  parent RECORD;
  base_slug TEXT;
  candidate_slug TEXT;
  suffix INT;
  existing_id INT;
BEGIN
  FOR parent IN
    SELECT id, COALESCE(name_zh_hk, name) AS parent_name, slug
    FROM categories
    WHERE parent_id IS NULL
  LOOP
    IF EXISTS (
      SELECT 1
      FROM categories c
      WHERE c.parent_id = parent.id AND c.slug LIKE (parent.slug || '-other%')
      LIMIT 1
    ) THEN
      CONTINUE;
    END IF;

    base_slug := parent.slug || '-other';
    candidate_slug := base_slug;
    suffix := 2;

    LOOP
      SELECT id INTO existing_id FROM categories WHERE slug = candidate_slug LIMIT 1;
      EXIT WHEN existing_id IS NULL;
      candidate_slug := base_slug || '-' || suffix::text;
      suffix := suffix + 1;
    END LOOP;

    INSERT INTO categories (name, name_zh_hk, slug, parent_id, sort_order, status, created_at, updated_at)
    VALUES ('其他', '其他', candidate_slug, parent.id, 9999, 'active', NOW(), NOW());
  END LOOP;
END $$;

-- 2) Move products whose category_id points to a root category into that root's "其他" subcategory.
WITH root_categories AS (
  SELECT id AS root_id, slug AS root_slug
  FROM categories
  WHERE parent_id IS NULL
),
other_subcategories AS (
  SELECT c.parent_id AS root_id, c.id AS other_id
  FROM categories c
  JOIN root_categories r ON r.root_id = c.parent_id
  WHERE c.slug LIKE (r.root_slug || '-other%')
),
products_to_move AS (
  SELECT p.id AS product_id, o.other_id
  FROM products p
  JOIN root_categories r ON r.root_id = p.category_id
  JOIN other_subcategories o ON o.root_id = r.root_id
)
UPDATE products p
SET category_id = m.other_id, updated_at = NOW()
FROM products_to_move m
WHERE p.id = m.product_id;

