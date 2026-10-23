INSERT INTO customizer_product_types (slug, name, status, sort_order, config_json)
VALUES
  ('football', '足球', 'active', 10, '{"sizeCodes":["XS","S","M","L","XL","2XL"]}'::jsonb),
  ('basketball', '籃球', 'active', 20, '{"sizeCodes":["XS","S","M","L","XL","2XL"]}'::jsonb),
  ('volleyball', '排球', 'active', 30, '{"sizeCodes":["XS","S","M","L","XL","2XL"]}'::jsonb),
  ('singlet', '背心', 'active', 40, '{"sizeCodes":["XS","S","M","L","XL","2XL"]}'::jsonb),
  ('polo', 'Polo', 'active', 50, '{"sizeCodes":["XS","S","M","L","XL","2XL"]}'::jsonb)
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    status = EXCLUDED.status,
    sort_order = EXCLUDED.sort_order,
    config_json = EXCLUDED.config_json,
    updated_at = NOW();

INSERT INTO customizer_templates (product_type_id, slug, name, status, is_blank, sort_order, config_json, asset_manifest_json)
VALUES
  ((SELECT id FROM customizer_product_types WHERE slug = 'football'), 'football-home', '足球主場', 'active', false, 10, '{"previewStyle":"home"}'::jsonb, '{}'::jsonb),
  ((SELECT id FROM customizer_product_types WHERE slug = 'football'), 'football-blank', '足球空白款', 'active', true, 20, '{"previewStyle":"blank"}'::jsonb, '{}'::jsonb),
  ((SELECT id FROM customizer_product_types WHERE slug = 'basketball'), 'basketball-pro', '籃球比賽款', 'active', false, 10, '{"previewStyle":"pro"}'::jsonb, '{}'::jsonb),
  ((SELECT id FROM customizer_product_types WHERE slug = 'basketball'), 'basketball-blank', '籃球空白款', 'active', true, 20, '{"previewStyle":"blank"}'::jsonb, '{}'::jsonb),
  ((SELECT id FROM customizer_product_types WHERE slug = 'volleyball'), 'volleyball-match', '排球比賽款', 'active', false, 10, '{"previewStyle":"match"}'::jsonb, '{}'::jsonb),
  ((SELECT id FROM customizer_product_types WHERE slug = 'volleyball'), 'volleyball-blank', '排球空白款', 'active', true, 20, '{"previewStyle":"blank"}'::jsonb, '{}'::jsonb),
  ((SELECT id FROM customizer_product_types WHERE slug = 'singlet'), 'singlet-race', '背心比賽款', 'active', false, 10, '{"previewStyle":"race"}'::jsonb, '{}'::jsonb),
  ((SELECT id FROM customizer_product_types WHERE slug = 'singlet'), 'singlet-blank', '背心空白款', 'active', true, 20, '{"previewStyle":"blank"}'::jsonb, '{}'::jsonb),
  ((SELECT id FROM customizer_product_types WHERE slug = 'polo'), 'polo-club', 'Polo 球會款', 'active', false, 10, '{"previewStyle":"club"}'::jsonb, '{}'::jsonb),
  ((SELECT id FROM customizer_product_types WHERE slug = 'polo'), 'polo-blank', 'Polo 空白款', 'active', true, 20, '{"previewStyle":"blank"}'::jsonb, '{}'::jsonb)
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    status = EXCLUDED.status,
    is_blank = EXCLUDED.is_blank,
    sort_order = EXCLUDED.sort_order,
    config_json = EXCLUDED.config_json,
    updated_at = NOW();

WITH target_templates AS (
  SELECT id, slug
    FROM customizer_templates
   WHERE slug IN (
     'football-home', 'football-blank',
     'basketball-pro', 'basketball-blank',
     'volleyball-match', 'volleyball-blank',
     'singlet-race', 'singlet-blank',
     'polo-club', 'polo-blank'
   )
),
zone_defs AS (
  SELECT
    'front-body'::text AS zone_key,
    'Front Body'::text AS zone_name,
    10 AS sort_order,
    '{"allowColor":true,"allowPattern":true}'::jsonb AS rules_json,
    '{"color":"#f4f4f5"}'::jsonb AS default_values_json
  UNION ALL
  SELECT 'back-body', 'Back Body', 20, '{"allowColor":true,"allowPattern":true,"allowText":true}'::jsonb, '{"color":"#f4f4f5"}'::jsonb
  UNION ALL
  SELECT 'collar', 'Collar', 30, '{"allowColor":true}'::jsonb, '{"color":"#7f1d45"}'::jsonb
  UNION ALL
  SELECT 'front-crest', 'Front Crest', 40, '{"allowLogo":true}'::jsonb, '{}'::jsonb
  UNION ALL
  SELECT 'front-team-name', 'Front Team Name', 50, '{"allowText":true}'::jsonb, '{}'::jsonb
  UNION ALL
  SELECT 'back-player-name', 'Back Player Name', 60, '{"allowText":true}'::jsonb, '{}'::jsonb
  UNION ALL
  SELECT 'back-player-number', 'Back Player Number', 70, '{"allowText":true}'::jsonb, '{}'::jsonb
)
INSERT INTO customizer_template_zones (
  template_id,
  zone_key,
  zone_name,
  status,
  sort_order,
  bounds_json,
  rules_json,
  default_values_json
)
SELECT
  target_templates.id,
  zone_defs.zone_key,
  zone_defs.zone_name,
  'active',
  zone_defs.sort_order,
  '{}'::jsonb,
  zone_defs.rules_json,
  zone_defs.default_values_json
FROM target_templates
CROSS JOIN zone_defs
ON CONFLICT (template_id, zone_key) DO UPDATE
SET zone_name = EXCLUDED.zone_name,
    status = EXCLUDED.status,
    sort_order = EXCLUDED.sort_order,
    rules_json = EXCLUDED.rules_json,
    default_values_json = EXCLUDED.default_values_json,
    updated_at = NOW();

INSERT INTO customizer_design_assets (
  asset_type,
  scope,
  product_type_id,
  template_id,
  slug,
  name,
  status,
  meta_json,
  file_url,
  preview_url
)
VALUES
  ( 'logo', 'global', NULL, NULL, 'club-crest-classic', 'Classic Crest', 'active', '{"category":"crest"}'::jsonb, NULL, NULL ),
  ( 'logo', 'global', NULL, NULL, 'club-crest-stripe', 'Stripe Crest', 'active', '{"category":"crest"}'::jsonb, NULL, NULL ),
  ( 'badge', 'global', NULL, NULL, 'league-badge-pro', 'League Badge', 'active', '{"category":"badge"}'::jsonb, NULL, NULL ),
  ( 'palette', 'global', NULL, NULL, 'palette-home-classic', 'Home Palette', 'active', '{"colors":["#f4f4f5","#7f1d45","#d4af37","#111827"]}'::jsonb, NULL, NULL ),
  ( 'palette', 'global', NULL, NULL, 'palette-away-bright', 'Away Palette', 'active', '{"colors":["#ffffff","#2563eb","#16a34a","#111827"]}'::jsonb, NULL, NULL )
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    status = EXCLUDED.status,
    meta_json = EXCLUDED.meta_json,
    updated_at = NOW();

DELETE FROM customizer_pricing_rules
 WHERE name IN (
   'Customizer Base Unit',
   'Customizer Quantity Tier',
   'Customizer Name Print',
   'Customizer Number Print',
   'Customizer Logo Placement'
 );

INSERT INTO customizer_pricing_rules (
  product_type_id,
  template_id,
  name,
  rule_type,
  status,
  sort_order,
  condition_json,
  pricing_json
)
SELECT
  id,
  NULL,
  'Customizer Base Unit',
  'base_unit',
  'active',
  10,
  '{}'::jsonb,
  jsonb_build_object(
    'baseUnitPrice',
    CASE slug
      WHEN 'football' THEN 168
      WHEN 'basketball' THEN 158
      WHEN 'volleyball' THEN 148
      WHEN 'singlet' THEN 138
      ELSE 178
    END,
    'directOrderMaxQuantity',
    40,
    'templateAllowsDirectOrder',
    true
  )
FROM customizer_product_types
WHERE slug IN ('football', 'basketball', 'volleyball', 'singlet', 'polo');

INSERT INTO customizer_pricing_rules (
  product_type_id,
  template_id,
  name,
  rule_type,
  status,
  sort_order,
  condition_json,
  pricing_json
)
SELECT
  id,
  NULL,
  'Customizer Quantity Tier',
  'quantity_tier',
  'active',
  20,
  '{}'::jsonb,
  '{"quantityTiers":[{"min":1,"max":9,"unitAdjustment":0},{"min":10,"max":29,"unitAdjustment":-12},{"min":30,"max":40,"unitAdjustment":-20}]}'::jsonb
FROM customizer_product_types
WHERE slug IN ('football', 'basketball', 'volleyball', 'singlet', 'polo');

INSERT INTO customizer_pricing_rules (
  product_type_id,
  template_id,
  name,
  rule_type,
  status,
  sort_order,
  condition_json,
  pricing_json
)
SELECT id, NULL, 'Customizer Name Print', 'extra', 'active', 30, '{}'::jsonb, '{"code":"name","label":"球員名","unitPrice":8,"appliesTo":"named-items"}'::jsonb
FROM customizer_product_types
WHERE slug IN ('football', 'basketball', 'volleyball', 'singlet', 'polo');

INSERT INTO customizer_pricing_rules (
  product_type_id,
  template_id,
  name,
  rule_type,
  status,
  sort_order,
  condition_json,
  pricing_json
)
SELECT id, NULL, 'Customizer Number Print', 'extra', 'active', 40, '{}'::jsonb, '{"code":"number","label":"球員號碼","unitPrice":6,"appliesTo":"numbered-items"}'::jsonb
FROM customizer_product_types
WHERE slug IN ('football', 'basketball', 'volleyball', 'singlet', 'polo');

INSERT INTO customizer_pricing_rules (
  product_type_id,
  template_id,
  name,
  rule_type,
  status,
  sort_order,
  condition_json,
  pricing_json
)
SELECT id, NULL, 'Customizer Logo Placement', 'extra', 'active', 50, '{}'::jsonb, '{"code":"logo","label":"Logo Placement","unitPrice":25,"appliesTo":"logos"}'::jsonb
FROM customizer_product_types
WHERE slug IN ('football', 'basketball', 'volleyball', 'singlet', 'polo');
