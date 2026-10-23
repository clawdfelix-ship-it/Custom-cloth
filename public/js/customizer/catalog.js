(function attachCustomizerCatalog(global) {
  function normalizeFamily(family = {}) {
    return {
      id: family.id ?? null,
      slug: String(family.slug || '').trim(),
      name: String(family.name || '').trim(),
      productTypeId: family.product_type_id ?? family.productTypeId ?? null,
      productTypeSlug: family.product_type_slug ?? family.productTypeSlug ?? null,
      isBlank: family.is_blank === true || family.isBlank === true,
      description: String(family.description || '').trim(),
      recommended: family.recommended !== false,
      previewStyle: String(family.previewStyle || '').trim(),
      startModes: Array.isArray(family.startModes) ? family.startModes : ['template', 'blank'],
      palette: Array.isArray(family.palette) ? family.palette : [],
      defaultPartSelection: family.defaultPartSelection && typeof family.defaultPartSelection === 'object'
        ? family.defaultPartSelection
        : {},
      partVariants: family.partVariants && typeof family.partVariants === 'object'
        ? family.partVariants
        : {},
      colorZones: Array.isArray(family.colorZones) ? family.colorZones : [],
    };
  }

  function normalizeZone(zone = {}) {
    const rules = zone.rules_json && typeof zone.rules_json === 'object'
      ? zone.rules_json
      : zone.rules && typeof zone.rules === 'object'
        ? zone.rules
        : {};
    const defaults = zone.default_values_json && typeof zone.default_values_json === 'object'
      ? zone.default_values_json
      : zone.defaultValues && typeof zone.defaultValues === 'object'
        ? zone.defaultValues
        : {};

    return {
      id: zone.id ?? null,
      templateId: zone.template_id ?? zone.templateId ?? null,
      zoneKey: String(zone.zone_key || zone.zoneKey || '').trim(),
      zoneName: String(zone.zone_name || zone.zoneName || zone.zone_key || zone.zoneKey || '').trim(),
      sortOrder: Number.isFinite(Number(zone.sort_order ?? zone.sortOrder))
        ? Number(zone.sort_order ?? zone.sortOrder)
        : 0,
      allowColor: zone.allow_color ?? zone.allowColor ?? rules.allowColor ?? false,
      allowLogo: zone.allow_logo ?? zone.allowLogo ?? rules.allowLogo ?? false,
      allowText: zone.allow_text ?? zone.allowText ?? rules.allowText ?? false,
      defaultColor: defaults.color || zone.defaultColor || null,
      defaultValues: defaults,
      rules,
    };
  }

  function indexFamiliesByProductType(families = []) {
    return families.reduce((accumulator, family) => {
      const key = String(family.productTypeId || family.product_type_id || '');
      if (!accumulator[key]) accumulator[key] = [];
      accumulator[key].push(family);
      return accumulator;
    }, {});
  }

  function normalizeCatalogPayload(payload = {}) {
    const productTypes = Array.isArray(payload.productTypes) ? payload.productTypes : [];
    const templateFamilies = (Array.isArray(payload.templateFamilies) ? payload.templateFamilies : payload.templates || [])
      .map(normalizeFamily);
    const assets = Array.isArray(payload.assets) ? payload.assets : [];

    return {
      productTypes,
      templateFamilies,
      templates: templateFamilies,
      templateFamiliesByProductType: indexFamiliesByProductType(templateFamilies),
      assets,
    };
  }

  function findDefaultProductType(catalog, preferredId) {
    if (preferredId) {
      return catalog.productTypes.find((item) => String(item.id) === String(preferredId)) || null;
    }
    return catalog.productTypes[0] || null;
  }

  function findDefaultTemplateFamily(catalog, productTypeId, preferredId) {
    const candidates = catalog.templateFamiliesByProductType[String(productTypeId)] || [];
    if (preferredId) {
      return candidates.find((item) => String(item.id) === String(preferredId)) || null;
    }
    return candidates.find((item) => item.recommended) || candidates[0] || null;
  }

  function findTemplateForStartMode(catalog, productTypeId, startMode, preferredId) {
    const candidates = catalog.templateFamiliesByProductType[String(productTypeId)] || [];
    if (!candidates.length) return null;
    if (preferredId) return findDefaultTemplateFamily(catalog, productTypeId, preferredId);

    if (String(startMode) === 'blank') {
      return candidates.find((item) => item.isBlank) || candidates[0];
    }

    return candidates.find((item) => !item.isBlank) || candidates[0];
  }

  function normalizeTemplateDetail(payload = {}) {
    const templateFamily = normalizeFamily(payload.templateFamily || payload.template || {});
    const colorZones = Array.isArray(payload.colorZones)
      ? payload.colorZones.map(normalizeZone)
      : Array.isArray(payload.zones)
        ? payload.zones.map(normalizeZone)
        : [];

    return {
      templateFamily,
      template: templateFamily,
      partVariants: payload.partVariants && typeof payload.partVariants === 'object'
        ? payload.partVariants
        : templateFamily.partVariants || {},
      defaultPartSelection: payload.defaultPartSelection && typeof payload.defaultPartSelection === 'object'
        ? payload.defaultPartSelection
        : templateFamily.defaultPartSelection || {},
      palette: Array.isArray(payload.palette) ? payload.palette : templateFamily.palette || [],
      colorZones,
      zones: colorZones,
    };
  }

  function listAssetsForSelection(catalog = {}, selection = {}, assetTypes = []) {
    const assets = Array.isArray(catalog.assets) ? catalog.assets : [];
    const productTypeId = selection.productTypeId ?? selection.product_type_id ?? null;
    const templateId = selection.templateId ?? selection.template_id ?? null;
    const allowedTypes = Array.isArray(assetTypes) && assetTypes.length
      ? assetTypes.map((type) => String(type))
      : null;

    return assets.filter((asset) => {
      const assetProductTypeId = asset.product_type_id ?? asset.productTypeId ?? null;
      const assetTemplateId = asset.template_id ?? asset.templateId ?? null;
      const assetType = String(asset.asset_type || asset.assetType || '');

      if (allowedTypes && !allowedTypes.includes(assetType)) return false;
      if (productTypeId && assetProductTypeId && String(assetProductTypeId) !== String(productTypeId)) return false;
      if (templateId && assetTemplateId && String(assetTemplateId) !== String(templateId)) return false;
      return true;
    });
  }

  function findPartVariant(detail = {}, partType, code) {
    const variants = detail.partVariants && Array.isArray(detail.partVariants[partType])
      ? detail.partVariants[partType]
      : [];
    return variants.find((variant) => String(variant.code) === String(code)) || null;
  }

  global.CustomizerCatalog = {
    normalizeCatalogPayload,
    normalizeTemplateDetail,
    findDefaultProductType,
    findDefaultTemplate: findDefaultTemplateFamily,
    findTemplateForStartMode,
    listAssetsForSelection,
    findPartVariant,
  };
})(window);
