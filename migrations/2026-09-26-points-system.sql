-- 2026-09-26: 積分系統閉環
-- 1) points_transactions 加冪等約束：同一 order + type 只可以有一筆（防重複發分/扣分）
-- 2) 積分相關 app_settings（用 ON CONFLICT DO NOTHING，向後兼容）

-- 人手調整 (type='adjust') / 生日 (type='birthday') 等冇 order_id，唔受呢個約束。
CREATE UNIQUE INDEX IF NOT EXISTS uq_points_txn_order_type
  ON points_transactions (order_id, type)
  WHERE order_id IS NOT NULL;

-- 積分設定（值 NULL = 用代碼預設）
INSERT INTO app_settings (key, value) VALUES
  ('points_enabled',       '1'),      -- 積分制總開關
  ('points_earn_hkd',      '100'),    -- 每 HK$100 消費賺 1 分
  ('points_redeem_hkd',    '100'),    -- 每 100 分兌 HK$1 折扣
  ('points_min_redeem',    '100'),    -- 每次最少兌 100 分
  ('points_expiry_days',   '0')       -- 0 = 唔過期
ON CONFLICT (key) DO NOTHING;

-- users.points 可能喺舊庫缺失：保險補欄
ALTER TABLE users ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT 0 NOT NULL;
