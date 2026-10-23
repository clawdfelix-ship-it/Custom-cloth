-- 2026-09-18: 後台可調設定（先放 JPY→HKD 匯率，支援一鍵更新）
CREATE TABLE IF NOT EXISTS app_settings (
  key        VARCHAR(100) PRIMARY KEY,
  value      TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO app_settings (key, value)
VALUES ('jpy_hkd_rate', NULL)   -- NULL = 未設定，沿用 env / 預設 0.052
ON CONFLICT (key) DO NOTHING;
