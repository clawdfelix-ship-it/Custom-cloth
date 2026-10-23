-- 2026-09-18: 最小結帳流程 — 銀行轉帳 / FPS（人工核實）＋ 運費到付
-- live DB 以 schema.sql 起，orders 表本來無付款/運費欄位，呢度補上。

ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_number       VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal_amount   DECIMAL(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_fee      DECIMAL(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS freight_collect   BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method_code VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status    VARCHAR(20) DEFAULT 'pending';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_note      TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);

-- 銀行轉帳係今次新增（fps 已喺 schema-full seed；呢度冚住用 schema.sql 起嘅庫）
INSERT INTO payment_methods (name, code, is_active, sort_order)
VALUES ('銀行轉帳', 'bank_transfer', true, 1)
ON CONFLICT (code) DO NOTHING;

INSERT INTO payment_methods (name, code, is_active, sort_order)
VALUES ('FPS 轉數快', 'fps', true, 2)
ON CONFLICT (code) DO NOTHING;
