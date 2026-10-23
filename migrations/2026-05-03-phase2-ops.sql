-- Phase 2: After-sales / Refunds / Reconciliation / ShipAny tracking fields

-- 1) return_requests (missing in current repo schema)
CREATE TABLE IF NOT EXISTS return_requests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  items JSON,
  return_method VARCHAR(50) NOT NULL,
  images JSON,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  refund_amount DECIMAL(10,2),
  tracking_number VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_return_requests_order_id ON return_requests(order_id);
CREATE INDEX IF NOT EXISTS idx_return_requests_user_id ON return_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_return_requests_status ON return_requests(status);

-- 2) order_status_histories (routes use this name)
CREATE TABLE IF NOT EXISTS order_status_histories (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL,
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_order_status_histories_order_id ON order_status_histories(order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_histories_created_at ON order_status_histories(created_at);

-- 3) orders: add missing payment/shipping fields (safe if already exists)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method_code VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_transaction_id VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipany_label_url VARCHAR(500);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_status VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_updated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS district VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_point_id INTEGER REFERENCES pickup_points(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_method_id INTEGER REFERENCES shipping_methods(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_number VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_paid_at ON orders(paid_at);

-- 4) Backfill minimal payment_status from fulfillment status (one-time)
UPDATE orders
SET payment_status = 'paid'
WHERE payment_status IS NULL
  AND status IN ('paid', 'shipping', 'completed');

UPDATE orders
SET payment_status = 'pending'
WHERE payment_status IS NULL;

-- 5) refunds: add approval/rejection fields (safe if already exists)
ALTER TABLE refunds ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE refunds ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE refunds ADD COLUMN IF NOT EXISTS rejected_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE refunds ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE refunds ADD COLUMN IF NOT EXISTS note TEXT;

-- 6) payment_transactions: ensure uniqueness and indexes for reconciliation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'uniq_payment_transactions_method_tx'
  ) THEN
    CREATE UNIQUE INDEX uniq_payment_transactions_method_tx
      ON payment_transactions(payment_method_code, transaction_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_payment_transactions_order_id ON payment_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_created_at ON payment_transactions(created_at);

