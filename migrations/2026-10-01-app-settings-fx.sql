-- 2026-10-01: app_settings 加 FX (JPY → HKD) 鎖定 / 動態
-- 同時加 markup rules (Tier-based)

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by_admin_id INTEGER
);

INSERT INTO app_settings (key, value) VALUES
  ('fx.jpy_hkd', '5.3'::jsonb),
  ('fx.jpy_hkd_updated_at', to_jsonb(NOW())),
  ('markup.tiers_below', '[
    {"max_jpy": 1000, "multiplier": 1.8},
    {"max_jpy": 3000, "multiplier": 1.5},
    {"max_jpy": null, "multiplier": 1.3}
  ]'::jsonb),
  ('markup.tiers_below_updated_at', to_jsonb(NOW()))
ON CONFLICT (key) DO NOTHING;