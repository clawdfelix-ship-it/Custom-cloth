BEGIN;

ALTER TABLE inventory_warehouses
ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS inventory_warehouses_one_default_idx
  ON inventory_warehouses ((is_default))
  WHERE is_default = true;

WITH has_default AS (
  SELECT 1 AS ok FROM inventory_warehouses WHERE is_default = true LIMIT 1
),
pick_one AS (
  SELECT id FROM inventory_warehouses WHERE is_active = true ORDER BY id ASC LIMIT 1
)
UPDATE inventory_warehouses w
SET is_default = true
WHERE NOT EXISTS (SELECT 1 FROM has_default)
  AND w.id = (SELECT id FROM pick_one);

COMMIT;

