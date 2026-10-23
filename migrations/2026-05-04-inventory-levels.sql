-- Add per-warehouse inventory levels

CREATE TABLE IF NOT EXISTS inventory_levels (
  warehouse_id INTEGER NOT NULL REFERENCES inventory_warehouses(id) ON DELETE CASCADE,
  sku_id INTEGER NOT NULL REFERENCES product_skus(id) ON DELETE CASCADE,
  stock INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (warehouse_id, sku_id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_levels_sku_id ON inventory_levels(sku_id);

-- Backfill: put existing total stock into the default warehouse (or first active warehouse)
DO $$
DECLARE
  default_wh_id INTEGER;
BEGIN
  SELECT id INTO default_wh_id
  FROM inventory_warehouses
  WHERE is_active = true
  ORDER BY is_default DESC, id ASC
  LIMIT 1;

  IF default_wh_id IS NULL THEN
    RAISE NOTICE 'No active inventory_warehouses; skip inventory_levels backfill';
    RETURN;
  END IF;

  INSERT INTO inventory_levels (warehouse_id, sku_id, stock)
  SELECT default_wh_id, ps.id, ps.stock
  FROM product_skus ps
  ON CONFLICT (warehouse_id, sku_id) DO NOTHING;
END $$;

