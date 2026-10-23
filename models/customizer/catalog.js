function normalizeJson(value, fallback = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;
  return value;
}

function slugIncludes(slug, needle) {
  return String(slug || '').toLowerCase().includes(String(needle || '').toLowerCase());
}

function buildColorZones(productTypeSlug) {
  const tertiaryLabel = slugIncludes(productTypeSlug, 'polo') ? '鈕門 / 領邊' : '飾邊 / 領口';
  return [
    {
      zoneKey: 'primary',
      zoneName: '主色',
      sortOrder: 10,
      allowColor: true,
      defaultColor: '#f4f4f5',
    },
    {
      zoneKey: 'secondary',
      zoneName: '副色',
      sortOrder: 20,
      allowColor: true,
      defaultColor: '#7f1d45',
    },
    {
      zoneKey: 'trim',
      zoneName: tertiaryLabel,
      sortOrder: 30,
      allowColor: true,
      defaultColor: '#fbbf24',
    },
  ];
}

function buildCommonLogoAndTextZones() {
  return [
    { zoneKey: 'front-crest', zoneName: 'Front Crest', sortOrder: 110, allowLogo: true, allowColor: false },
    { zoneKey: 'front-team-name', zoneName: 'Front Team Name', sortOrder: 120, allowText: true, allowColor: false },
    { zoneKey: 'back-player-name', zoneName: 'Back Player Name', sortOrder: 130, allowText: true, allowColor: false },
    { zoneKey: 'back-player-number', zoneName: 'Back Player Number', sortOrder: 140, allowText: true, allowColor: false },
  ];
}

function buildPresetPartVariants(productTypeSlug, familySlug, isBlank) {
  const footballLike = ['football', 'volleyball'].some((value) => slugIncludes(productTypeSlug, value));
  const basketballLike = ['basketball', 'singlet'].some((value) => slugIncludes(productTypeSlug, value));
  const isPolo = slugIncludes(productTypeSlug, 'polo');

  const body = footballLike
    ? [
      { code: 'speed-chevron', name: 'Speed Chevron', renderKey: isBlank ? 'solid-panel' : 'chevron', description: '胸口斜箭咀，似 fifakitcreator 常見速度感版型。', badge: 'body' },
      { code: 'split-stripe', name: 'Split Stripe', renderKey: 'split-stripe', description: '中直條分割主身，容易做主客場配色。', badge: 'body' },
      { code: 'half-block', name: 'Half Block', renderKey: 'half-block', description: '左右撞色，強調大面積色塊。', badge: 'body' },
    ]
    : basketballLike
      ? [
        { code: 'court-panel', name: 'Court Panel', renderKey: 'court-panel', description: '籃球背心常見肩位拼接。', badge: 'body' },
        { code: 'center-stripe', name: 'Center Stripe', renderKey: 'center-stripe', description: '中柱條帶，適合放隊名。', badge: 'body' },
        { code: 'fade-band', name: 'Fade Band', renderKey: 'fade-band', description: '上胸橫帶，視覺接近比賽款。', badge: 'body' },
      ]
      : [
        { code: 'club-panel', name: 'Club Panel', renderKey: 'club-panel', description: 'Polo 胸位拼接，偏球會制服感。', badge: 'body' },
        { code: 'chest-band', name: 'Chest Band', renderKey: 'chest-band', description: '胸前橫帶，簡潔易認。', badge: 'body' },
        { code: 'heritage-block', name: 'Heritage Block', renderKey: 'heritage-block', description: '經典雙色分層。', badge: 'body' },
      ];

  const sleeve = basketballLike
    ? [
      { code: 'armhole-solid', name: 'Armhole Solid', renderKey: 'armhole-solid', description: '背心全淨邊。', badge: 'sleeve' },
      { code: 'armhole-trim', name: 'Armhole Trim', renderKey: 'armhole-trim', description: '背心邊位撞色包邊。', badge: 'sleeve' },
    ]
    : isPolo
      ? [
        { code: 'set-in', name: 'Set-in Sleeve', renderKey: 'set-in', description: '基本短袖。', badge: 'sleeve' },
        { code: 'contrast-cuff', name: 'Contrast Cuff', renderKey: 'contrast-cuff', description: '袖口撞色。', badge: 'sleeve' },
        { code: 'raglan-flow', name: 'Raglan Flow', renderKey: 'raglan-flow', description: '斜肩流線。', badge: 'sleeve' },
      ]
      : [
        { code: 'set-in', name: 'Set-in Sleeve', renderKey: 'set-in', description: '基本插肩。', badge: 'sleeve' },
        { code: 'double-band', name: 'Double Band', renderKey: 'double-band', description: '雙帶袖邊，接近球衣常見袖款。', badge: 'sleeve' },
        { code: 'raglan-flow', name: 'Raglan Flow', renderKey: 'raglan-flow', description: '斜肩分色，最似模板玩法。', badge: 'sleeve' },
      ];

  const collar = isPolo
    ? [
      { code: 'polo-classic', name: 'Classic Polo', renderKey: 'polo-classic', description: '標準翻領。', badge: 'collar' },
      { code: 'polo-contrast', name: 'Contrast Polo', renderKey: 'polo-contrast', description: '領邊撞色。', badge: 'collar' },
      { code: 'zip-polo', name: 'Zip Polo', renderKey: 'zip-polo', description: '拉鍊領口感。', badge: 'collar' },
    ]
    : basketballLike
      ? [
        { code: 'round-bind', name: 'Round Bind', renderKey: 'round-bind', description: '圓領包邊。', badge: 'collar' },
        { code: 'v-bind', name: 'V Bind', renderKey: 'v-bind', description: 'V 領包邊。', badge: 'collar' },
      ]
      : [
        { code: 'round', name: 'Round Neck', renderKey: 'round', description: '圓領基本款。', badge: 'collar' },
        { code: 'v-neck', name: 'V Neck', renderKey: 'v-neck', description: 'V 領比賽款。', badge: 'collar' },
        { code: 'piped-v', name: 'Piped V', renderKey: 'piped-v', description: '雙色 V 領。', badge: 'collar' },
      ];

  return {
    body,
    sleeve,
    collar,
  };
}

function buildPresetConfig(row) {
  const slug = String(row.slug || '');
  const name = String(row.name || '');
  const config = normalizeJson(row.config_json);
  const manifest = normalizeJson(row.asset_manifest_json);
  const productTypeSlug = String(row.product_type_slug || row.productTypeSlug || '');
  const isBlank = row.is_blank === true || config.isBlank === true;
  const partVariants = manifest.partVariants || buildPresetPartVariants(productTypeSlug, slug, isBlank);
  const colorZones = Array.isArray(config.colorZones) && config.colorZones.length
    ? config.colorZones
    : buildColorZones(productTypeSlug);

  return {
    description: config.description || `${name} 模板家族，先揀 body / sleeve / collar，再做配色同字樣。`,
    previewStyle: config.previewStyle || slug,
    recommended: typeof config.recommended === 'boolean' ? config.recommended : !isBlank,
    startModes: Array.isArray(config.startModes) && config.startModes.length
      ? config.startModes
      : (isBlank ? ['blank'] : ['template', 'blank']),
    palette: Array.isArray(config.palette) && config.palette.length
      ? config.palette
      : ['#f4f4f5', '#7f1d45', '#fbbf24', '#111827', '#2563eb', '#16a34a'],
    colorZones,
    partVariants,
    defaultPartSelection: config.defaultPartSelection && typeof config.defaultPartSelection === 'object'
      ? config.defaultPartSelection
      : {
        body: partVariants.body && partVariants.body[0] ? partVariants.body[0].code : null,
        sleeve: partVariants.sleeve && partVariants.sleeve[0] ? partVariants.sleeve[0].code : null,
        collar: partVariants.collar && partVariants.collar[0] ? partVariants.collar[0].code : null,
      },
  };
}

function mapProductType(row) {
  const config = normalizeJson(row.config_json);
  return {
    ...row,
    sizeCodes: Array.isArray(config.sizeCodes) ? config.sizeCodes : [],
    config,
  };
}

function mapTemplateFamily(row) {
  const preset = buildPresetConfig(row);
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    product_type_id: row.product_type_id,
    productTypeId: row.product_type_id,
    product_type_slug: row.product_type_slug || null,
    status: row.status,
    is_blank: row.is_blank === true,
    isBlank: row.is_blank === true,
    sort_order: row.sort_order,
    preview_thumb_front_url: row.preview_thumb_front_url || null,
    preview_thumb_back_url: row.preview_thumb_back_url || null,
    description: preset.description,
    previewStyle: preset.previewStyle,
    recommended: preset.recommended,
    startModes: preset.startModes,
    palette: preset.palette,
    colorZones: preset.colorZones,
    partVariants: preset.partVariants,
    defaultPartSelection: preset.defaultPartSelection,
  };
}

function mapColorZones(templateFamily, zoneRows = []) {
  if (Array.isArray(templateFamily.colorZones) && templateFamily.colorZones.length) {
    return templateFamily.colorZones.map((zone, index) => ({
      id: zone.id ?? null,
      templateId: templateFamily.id,
      zoneKey: String(zone.zoneKey || '').trim(),
      zoneName: String(zone.zoneName || zone.zoneKey || '').trim(),
      sortOrder: Number.isFinite(Number(zone.sortOrder)) ? Number(zone.sortOrder) : (index + 1) * 10,
      allowColor: zone.allowColor !== false,
      allowLogo: zone.allowLogo === true,
      allowText: zone.allowText === true,
      defaultValues: {
        color: zone.defaultColor || '#f4f4f5',
      },
      rules: {
        allowColor: zone.allowColor !== false,
        allowLogo: zone.allowLogo === true,
        allowText: zone.allowText === true,
      },
    }));
  }

  return zoneRows.map((zone) => ({
    id: zone.id ?? null,
    templateId: zone.template_id ?? templateFamily.id,
    zoneKey: zone.zone_key,
    zoneName: zone.zone_name,
    sortOrder: zone.sort_order,
    allowColor: zone.allow_color ?? true,
    allowLogo: zone.allow_logo ?? false,
    allowText: zone.allow_text ?? false,
    defaultValues: zone.default_values_json || {},
    rules: zone.rules_json || {},
  }));
}

function createCatalogModel(db) {
  return {
    async listProductTypes() {
      const result = await db.query(
        `SELECT *
           FROM customizer_product_types
          WHERE status = 'active'
          ORDER BY sort_order ASC, id ASC`
      );
      return result.rows.map(mapProductType);
    },

    async listAllTemplates() {
      const result = await db.query(
        `SELECT t.*,
                p.slug AS product_type_slug
           FROM customizer_templates t
           JOIN customizer_product_types p
             ON p.id = t.product_type_id
          WHERE t.status = 'active'
          ORDER BY t.product_type_id ASC, t.sort_order ASC, t.id ASC`
      );
      return result.rows.map(mapTemplateFamily);
    },

    async listTemplatesByProductType(productTypeId) {
      const result = await db.query(
        `SELECT t.*,
                p.slug AS product_type_slug
           FROM customizer_templates t
           JOIN customizer_product_types p
             ON p.id = t.product_type_id
          WHERE t.product_type_id = $1
            AND t.status = 'active'
          ORDER BY t.sort_order ASC, t.id ASC`,
        [productTypeId]
      );
      return result.rows.map(mapTemplateFamily);
    },

    async getTemplateById(templateId) {
      const result = await db.query(
        `SELECT t.*,
                p.slug AS product_type_slug
           FROM customizer_templates t
           JOIN customizer_product_types p
             ON p.id = t.product_type_id
          WHERE t.id = $1`,
        [templateId]
      );
      const row = result.rows[0];
      return row ? mapTemplateFamily(row) : null;
    },

    async listTemplateZones(templateId) {
      const [templateFamily, result] = await Promise.all([
        this.getTemplateById(templateId),
        db.query(
          `SELECT *
             FROM customizer_template_zones
            WHERE template_id = $1
              AND status = 'active'
            ORDER BY sort_order ASC, id ASC`,
          [templateId]
        ),
      ]);
      if (!templateFamily) return [];

      return mapColorZones(templateFamily, [
        ...result.rows,
        ...buildCommonLogoAndTextZones(),
      ]);
    },

    async getTemplateDetail(templateId) {
      const [templateFamily, colorZones] = await Promise.all([
        this.getTemplateById(templateId),
        this.listTemplateZones(templateId),
      ]);
      if (!templateFamily) return null;

      return {
        templateFamily,
        partVariants: templateFamily.partVariants,
        colorZones,
        defaultPartSelection: templateFamily.defaultPartSelection,
        palette: templateFamily.palette,
      };
    },

    async listAssets({ productTypeId = null, templateId = null, assetType = null } = {}) {
      const result = await db.query(
        `SELECT *
           FROM customizer_design_assets
          WHERE status = 'active'
            AND ($1::bigint IS NULL OR product_type_id = $1 OR product_type_id IS NULL)
            AND ($2::bigint IS NULL OR template_id = $2 OR template_id IS NULL)
            AND ($3::text IS NULL OR asset_type = $3)
          ORDER BY id ASC`,
        [productTypeId, templateId, assetType]
      );
      return result.rows;
    },
  };
}

module.exports = {
  createCatalogModel,
};
