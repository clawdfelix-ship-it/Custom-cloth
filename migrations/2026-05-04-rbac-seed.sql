BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS admin_roles_name_uniq_idx
  ON admin_roles (name);

INSERT INTO admin_roles (name, description, permissions)
SELECT 'catalog', '商品/分類/品牌', '["catalog:read","catalog:write"]'::json
WHERE NOT EXISTS (SELECT 1 FROM admin_roles WHERE name = 'catalog');

INSERT INTO admin_roles (name, description, permissions)
SELECT 'inventory', '庫存/倉庫/低庫存/批量更新', '["inventory:read","inventory:write","inventory:bulk"]'::json
WHERE NOT EXISTS (SELECT 1 FROM admin_roles WHERE name = 'inventory');

INSERT INTO admin_roles (name, description, permissions)
SELECT 'orders', '訂單/履約', '["orders:read","orders:write"]'::json
WHERE NOT EXISTS (SELECT 1 FROM admin_roles WHERE name = 'orders');

INSERT INTO admin_roles (name, description, permissions)
SELECT 'after_sales', '售後', '["returns:read","returns:write"]'::json
WHERE NOT EXISTS (SELECT 1 FROM admin_roles WHERE name = 'after_sales');

INSERT INTO admin_roles (name, description, permissions)
SELECT 'finance', '退款/對賬/報表', '["refunds:read","refunds:write","reconciliation:read","reconciliation:write","reports:read"]'::json
WHERE NOT EXISTS (SELECT 1 FROM admin_roles WHERE name = 'finance');

COMMIT;

