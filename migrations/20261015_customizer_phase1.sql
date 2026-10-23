CREATE TABLE IF NOT EXISTS customizer_product_types (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  sort_order INTEGER NOT NULL DEFAULT 0,
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customizer_templates (
  id BIGSERIAL PRIMARY KEY,
  product_type_id BIGINT NOT NULL REFERENCES customizer_product_types(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  is_blank BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  asset_manifest_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  preview_thumb_front_url TEXT,
  preview_thumb_back_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customizer_template_zones (
  id BIGSERIAL PRIMARY KEY,
  template_id BIGINT NOT NULL REFERENCES customizer_templates(id) ON DELETE CASCADE,
  zone_key TEXT NOT NULL,
  zone_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  sort_order INTEGER NOT NULL DEFAULT 0,
  bounds_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  rules_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  default_values_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (template_id, zone_key)
);

CREATE TABLE IF NOT EXISTS customizer_design_assets (
  id BIGSERIAL PRIMARY KEY,
  asset_type TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'global',
  product_type_id BIGINT REFERENCES customizer_product_types(id) ON DELETE SET NULL,
  template_id BIGINT REFERENCES customizer_templates(id) ON DELETE SET NULL,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  file_url TEXT,
  preview_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customizer_sessions (
  id BIGSERIAL PRIMARY KEY,
  session_token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft',
  product_type_id BIGINT REFERENCES customizer_product_types(id) ON DELETE SET NULL,
  template_id BIGINT REFERENCES customizer_templates(id) ON DELETE SET NULL,
  fulfillment_path TEXT,
  latest_pricing_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customizer_session_designs (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL REFERENCES customizer_sessions(id) ON DELETE CASCADE,
  design_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id)
);

CREATE TABLE IF NOT EXISTS customizer_session_previews (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL REFERENCES customizer_sessions(id) ON DELETE CASCADE,
  preview_side TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'image/png',
  meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customizer_rosters (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL REFERENCES customizer_sessions(id) ON DELETE CASCADE,
  total_quantity INTEGER NOT NULL DEFAULT 0,
  meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id)
);

CREATE TABLE IF NOT EXISTS customizer_roster_items (
  id BIGSERIAL PRIMARY KEY,
  roster_id BIGINT NOT NULL REFERENCES customizer_rosters(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  player_number TEXT NOT NULL,
  size_code TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customizer_uploaded_assets (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT REFERENCES customizer_sessions(id) ON DELETE CASCADE,
  asset_role TEXT NOT NULL DEFAULT 'logo',
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  width_px INTEGER,
  height_px INTEGER,
  storage_key TEXT NOT NULL,
  preview_storage_key TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customizer_pricing_rules (
  id BIGSERIAL PRIMARY KEY,
  product_type_id BIGINT REFERENCES customizer_product_types(id) ON DELETE SET NULL,
  template_id BIGINT REFERENCES customizer_templates(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  rule_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  sort_order INTEGER NOT NULL DEFAULT 0,
  condition_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  pricing_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customizer_quote_requests (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL REFERENCES customizer_sessions(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'new',
  deliverable_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customizer_quote_request_assets (
  id BIGSERIAL PRIMARY KEY,
  quote_request_id BIGINT NOT NULL REFERENCES customizer_quote_requests(id) ON DELETE CASCADE,
  uploaded_asset_id BIGINT REFERENCES customizer_uploaded_assets(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customizer_order_drafts (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL REFERENCES customizer_sessions(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft',
  deliverable_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customizer_templates_product_type
  ON customizer_templates(product_type_id, status, sort_order);

CREATE INDEX IF NOT EXISTS idx_customizer_template_zones_template
  ON customizer_template_zones(template_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_customizer_session_previews_session
  ON customizer_session_previews(session_id, preview_side, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customizer_roster_items_roster
  ON customizer_roster_items(roster_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_customizer_pricing_rules_scope
  ON customizer_pricing_rules(product_type_id, template_id, status, sort_order);

CREATE INDEX IF NOT EXISTS idx_customizer_quote_requests_session
  ON customizer_quote_requests(session_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customizer_order_drafts_session
  ON customizer_order_drafts(session_id, status, created_at DESC);
