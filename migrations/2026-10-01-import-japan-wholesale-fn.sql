-- 2026-10-01: Server-side UPSERT function for Japan wholesale import
-- Strategy D 三層分級:
--   sim >= 0.70 → match_status='auto', UPSERT cost_price + wholesale_price
--   sim 0.50-0.70 → match_status='unverified', UPSERT but admin UI marks "to review"
--   sim < 0.50 OR no candidate → NOT touched (exported via app script)

CREATE OR REPLACE FUNCTION stage.fn_import_japan_wholesale()
RETURNS TABLE (
  affected_rows INT,
  auto_count INT,
  unverified_count INT
) AS $$
DECLARE
  v_fx NUMERIC;
  v_tiers JSONB;
  v_affected INT := 0;
  v_auto INT := 0;
  v_unverified INT := 0;
BEGIN
  -- Load FX + markup tiers from app_settings
  -- Note: app_settings.value is TEXT (existing schema), not JSONB
  SELECT value::NUMERIC INTO v_fx
  FROM app_settings WHERE key = 'fx.jpy_hkd';

  -- markup.tiers_below stored as JSON text, parse to jsonb
  SELECT value::JSONB INTO v_tiers
  FROM app_settings WHERE key = 'markup.tiers_below';

  IF v_fx IS NULL OR v_tiers IS NULL THEN
    RAISE EXCEPTION 'app_settings missing fx.jpy_hkd or markup.tiers_below';
  END IF;

  -- Mark matched counts before update
  SELECT COUNT(*) FILTER (WHERE sim_max >= 0.70),
         COUNT(*) FILTER (WHERE sim_max BETWEEN 0.50 AND 0.70)
  INTO v_auto, v_unverified
  FROM stage.tmp_match_preview;

  -- UPSERT via UPDATE ... FROM with computed markup per row
  -- Tier lookup: CASE expression picks multiplier based on price_jpy
  WITH matched AS (
    SELECT
      m.product_id,
      m.excel_jan,
      m.price_jpy,
      m.sim_max,
      CASE
        WHEN m.sim_max >= 0.70 THEN 'auto'
        WHEN m.sim_max >= 0.50 THEN 'unverified'
        ELSE NULL  -- below 0.50: skip
      END AS new_status,
      -- cost_hkd = price_jpy / 100 * fx
      ROUND((m.price_jpy / 100.0) * v_fx, 2) AS new_cost_hkd,
      -- markup: tier-based lookup (CASE preserves order: <1000, <3000, else)
      CASE
        WHEN m.price_jpy < 1000 THEN (v_tiers->0->>'multiplier')::NUMERIC
        WHEN m.price_jpy < 3000 THEN (v_tiers->1->>'multiplier')::NUMERIC
        ELSE (v_tiers->2->>'multiplier')::NUMERIC
      END AS markup
    FROM stage.tmp_match_preview m
    WHERE m.sim_max >= 0.50  -- threshold for write
  ),
  computed AS (
    SELECT
      matched.product_id,
      matched.excel_jan,
      matched.price_jpy,
      matched.sim_max,
      matched.new_status,
      matched.new_cost_hkd,
      matched.markup,
      ROUND(matched.new_cost_hkd * matched.markup, 2) AS new_wholesale_hkd
    FROM matched
  ),
  -- Find the canonical product_skus.id per product_id (1 SKU per product for now)
  sku_targets AS (
    SELECT DISTINCT ON (ps.product_id)
      ps.id AS sku_id,
      c.product_id,
      c.excel_jan,
      c.price_jpy,
      c.sim_max,
      c.new_status,
      c.new_cost_hkd,
      c.new_wholesale_hkd
    FROM computed c
    JOIN product_skus ps ON ps.product_id = c.product_id
    ORDER BY ps.product_id, ps.id
  ),
  upd AS (
    UPDATE product_skus ps
    SET
      cost_price = st.new_cost_hkd,
      cost_price_jpy = st.price_jpy,
      wholesale_price_hkd = st.new_wholesale_hkd,
      match_status = st.new_status,
      match_sim = st.sim_max,
      match_source_jan = st.excel_jan,
      match_matched_at = NOW(),
      updated_at = NOW()
    FROM sku_targets st
    WHERE ps.id = st.sku_id
    RETURNING ps.id
  )
  SELECT COUNT(*) INTO v_affected FROM upd;

  affected_rows := v_affected;
  auto_count := v_auto;
  unverified_count := v_unverified;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION stage.fn_import_japan_wholesale() IS
  'UPSERT Japan wholesale prices (cost + markup) into product_skus based on stage.tmp_match_preview. Strategy D: sim>=0.70 auto, 0.50-0.70 unverified, <0.50 untouched.';
