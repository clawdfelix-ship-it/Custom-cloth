-- 2026-10-03 每日自動同步狀態表
-- new_arrival_order：mzakka 1789 完整文檔次序（排行榜真相來源，取代「只有本地 JSON」）
CREATE TABLE IF NOT EXISTS new_arrival_order (
  item_id    text PRIMARY KEY,          -- mzakka item id，例如 M12543
  rank       integer NOT NULL,          -- 1 = 最前
  updated_at timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_new_arrival_order_rank ON new_arrival_order(rank);

-- sync_pending_items：排行榜有、但店內 products 未有嘅 item（等爬詳情＋匯入）
CREATE TABLE IF NOT EXISTS sync_pending_items (
  item_id    text PRIMARY KEY,
  rank       integer NOT NULL,
  attempts   integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sync_pending_rank ON sync_pending_items(rank);
CREATE INDEX IF NOT EXISTS idx_sync_pending_attempts ON sync_pending_items(attempts);
