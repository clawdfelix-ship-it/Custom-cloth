-- 入數證明（買家上傳，bytea 存於 PostgreSQL；方案 2）
-- 一張訂單可多次上傳（駁回後重傳），只保留審計軌跡。
CREATE TABLE IF NOT EXISTS payment_proofs (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  uploaded_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  file_name TEXT,
  mime_type TEXT NOT NULL DEFAULT 'image/jpeg',
  file_size INTEGER,
  file_data BYTEA NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',        -- pending | approved | rejected
  reviewed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  reject_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_proofs_order ON payment_proofs(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_proofs_status ON payment_proofs(status);

-- payment_status 增加「已上傳憑證待確認」語義：直接用值 'proof_pending'。
-- （不改動既有 CHECK；若 orders.payment_status 有約束，見下安全放寬。）
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'orders'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%payment_status%'
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE orders DROP CONSTRAINT ' || conname
      FROM pg_constraint
      WHERE conrelid = 'orders'::regclass AND contype = 'c'
        AND pg_get_constraintdef(oid) ILIKE '%payment_status%'
      LIMIT 1
    );
  END IF;
END $$;
