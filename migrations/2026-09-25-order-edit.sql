-- 2026-09-25: 後台訂單編輯 — 訂單關聯（分單）＋編輯審計
-- 旁車式：只加欄位/表格，唔改現有結構，唔影響 mzakka 同步。

-- 訂單拆單關聯：child 單記返 parent；split_no 標第幾張分單
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS parent_order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS split_no INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_orders_parent ON orders(parent_order_id);

-- 訂單編輯審計：邊個 admin、邊張單、做乜動作、改前/改後
CREATE TABLE IF NOT EXISTS order_edit_logs (
  id            SERIAL PRIMARY KEY,
  order_id      INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  action        VARCHAR(30) NOT NULL, -- add_item/update_item/remove_item/split/recalc
  detail        JSON,                 -- 動作細節（項目、數量、價格、目標新單等）
  admin_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_oel_order ON order_edit_logs(order_id);
