-- 2026-10-02: B2B 客戶標記
-- 由 Japan wholesale 功能需要：批發價只向已核實嘅 B2B 客戶 + 內部職員顯示。
-- users 表本來只有 is_admin，冇任何商業客戶角色；用最細嘅 boolean 旗標，
-- 唔引入一整套 role 表（admin_roles/admin_permissions 已覆蓋職員權限）。
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_b2b boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN users.is_b2b IS '已核實 B2B / 批發客戶，可見 wholesale_price_hkd';

-- 方便後台篩選 B2B 客戶
CREATE INDEX IF NOT EXISTS idx_users_is_b2b ON users (is_b2b) WHERE is_b2b = true;
