-- 2026-10-01: 加 product_skus.wholesale_price_hkd (B2B 賣家見到嘅批發價)
-- 同時加 products.jan_idx 索引方便 Excel.JAN JOIN
ALTER TABLE product_skus
  ADD COLUMN IF NOT EXISTS wholesale_price_hkd DECIMAL(10,2);

CREATE INDEX IF NOT EXISTS idx_product_skus_wholesale
  ON product_skus(wholesale_price_hkd) WHERE wholesale_price_hkd IS NOT NULL;

-- 加 cost_price_jpy (explicit JPY storage, separate from cost_price which is HKD)
ALTER TABLE product_skus
  ADD COLUMN IF NOT EXISTS cost_price_jpy DECIMAL(10,2);

CREATE INDEX IF NOT EXISTS idx_product_skus_cost_jpy
  ON product_skus(cost_price_jpy) WHERE cost_price_jpy IS NOT NULL;

COMMENT ON COLUMN product_skus.cost_price IS 'Cost in HKD (existing; computed from JPY × FX)';
COMMENT ON COLUMN product_skus.cost_price_jpy IS 'Cost in JPY (wholesale Japan source)';
COMMENT ON COLUMN product_skus.wholesale_price_hkd IS 'B2B wholesale price in HKD (markup on JPY cost)';

-- Match audit columns (trgm similarity match from Japan wholesale import)
ALTER TABLE product_skus
  ADD COLUMN IF NOT EXISTS match_status TEXT,
  ADD COLUMN IF NOT EXISTS match_sim NUMERIC(5,3),
  ADD COLUMN IF NOT EXISTS match_source_jan TEXT,
  ADD COLUMN IF NOT EXISTS match_matched_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_product_skus_match_status
  ON product_skus(match_status) WHERE match_status IS NOT NULL;

COMMENT ON COLUMN product_skus.match_status IS 'auto (sim>=0.70) | unverified (sim 0.50-0.70) | manual | rejected';
COMMENT ON COLUMN product_skus.match_sim IS 'pg_trgm similarity score 0.000-1.000';
COMMENT ON COLUMN product_skus.match_source_jan IS 'JAN code from wholesale source (Excel)';