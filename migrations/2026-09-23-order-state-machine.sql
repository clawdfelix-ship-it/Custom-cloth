-- 2026-09-23: 訂單狀態機（旁車、向後兼容）
-- 新增出貨單，支援分批出貨。唔改 orders 現有欄位，唔影響 mzakka 同步。

-- 出貨單（一張 order 可有多張 → 分批出貨）
CREATE TABLE IF NOT EXISTS order_fulfillments (
  id                  SERIAL PRIMARY KEY,
  order_id            INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  state               VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending/shipped/delivered/cancelled
  shipping_method_code VARCHAR(50),
  tracking_number     VARCHAR(120),
  handler_admin_id    INTEGER REFERENCES users(id),
  note                TEXT,
  shipped_at          TIMESTAMPTZ,
  delivered_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_of_order ON order_fulfillments(order_id);
CREATE INDEX IF NOT EXISTS idx_of_state ON order_fulfillments(state);

-- 出貨明細：邊個 order item 出幾多
CREATE TABLE IF NOT EXISTS order_fulfillment_items (
  fulfillment_id      INTEGER NOT NULL REFERENCES order_fulfillments(id) ON DELETE CASCADE,
  order_item_id       INTEGER NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  quantity            INTEGER NOT NULL CHECK (quantity > 0),
  PRIMARY KEY (fulfillment_id, order_item_id)
);
CREATE INDEX IF NOT EXISTS idx_offi_item ON order_fulfillment_items(order_item_id);
