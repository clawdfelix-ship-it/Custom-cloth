CREATE TABLE IF NOT EXISTS sku_cost_history (
  id SERIAL PRIMARY KEY,
  sku_id INTEGER NOT NULL REFERENCES product_skus(id) ON DELETE CASCADE,
  old_cost_price DECIMAL(10,2),
  new_cost_price DECIMAL(10,2),
  changed_by_admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO inventory_warehouses (name, address, contact_name, contact_phone, is_active)
SELECT '預設倉庫', NULL, NULL, NULL, true
WHERE NOT EXISTS (SELECT 1 FROM inventory_warehouses WHERE is_active = true LIMIT 1);
