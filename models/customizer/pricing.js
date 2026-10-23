function resolveQuantityTier(quantity, quantityTiers = []) {
  if (!Array.isArray(quantityTiers)) return null;
  return quantityTiers.find((tier) => {
    const min = Number.isFinite(Number(tier.min)) ? Number(tier.min) : 0;
    const max = Number.isFinite(Number(tier.max)) ? Number(tier.max) : Infinity;
    return quantity >= min && quantity <= max;
  }) || null;
}

function calculatePriceBreakdown(input = {}) {
  const quantity = Number.isFinite(Number(input.quantity)) && Number(input.quantity) > 0 ? Number(input.quantity) : 0;
  const baseUnitPrice = Number.isFinite(Number(input.baseUnitPrice)) ? Number(input.baseUnitPrice) : 0;
  const tier = resolveQuantityTier(quantity, input.quantityTiers || []);
  const tierAdjustment = tier && Number.isFinite(Number(tier.unitAdjustment)) ? Number(tier.unitAdjustment) : 0;
  const effectiveUnitPrice = baseUnitPrice + tierAdjustment;
  const extras = Array.isArray(input.extras) ? input.extras : [];

  const normalizedExtras = extras.map((extra) => {
    const extraQuantity = Number.isFinite(Number(extra.quantity)) ? Number(extra.quantity) : 1;
    const unitPrice = Number.isFinite(Number(extra.unitPrice)) ? Number(extra.unitPrice) : 0;
    return {
      code: String(extra.code || ''),
      label: String(extra.label || extra.code || ''),
      quantity: extraQuantity,
      unitPrice,
      total: extraQuantity * unitPrice,
    };
  });

  const extrasTotal = normalizedExtras.reduce((sum, extra) => sum + extra.total, 0);
  const subtotal = effectiveUnitPrice * quantity;
  const total = subtotal + extrasTotal;

  return {
    quantity,
    baseUnitPrice,
    quantityTier: tier ? {
      min: Number(tier.min),
      max: Number.isFinite(Number(tier.max)) ? Number(tier.max) : null,
      unitAdjustment: tierAdjustment,
    } : null,
    quantityTierAdjustment: tierAdjustment,
    effectiveUnitPrice,
    extras: normalizedExtras,
    subtotal,
    extrasTotal,
    total,
  };
}

function decideFulfillmentPath(input = {}) {
  const quantity = Number.isFinite(Number(input.quantity)) ? Number(input.quantity) : 0;
  const directOrderMaxQuantity = Number.isFinite(Number(input.directOrderMaxQuantity))
    ? Number(input.directOrderMaxQuantity)
    : Infinity;

  if (input.pricingComplete === false) return 'quote_required';
  if (input.requiresReview === true) return 'quote_required';
  if (input.isQuotePreferred === true) return 'quote_required';
  if (input.templateAllowsDirectOrder === false) return 'quote_required';
  if (input.assetReviewRequired === true) return 'quote_required';
  if (quantity > directOrderMaxQuantity) return 'quote_required';
  return 'direct_order';
}

function extractPricingConfig(rules = []) {
  return (Array.isArray(rules) ? rules : []).reduce((accumulator, rule) => {
    const ruleType = String(rule.rule_type || rule.ruleType || '');
    const pricing = rule.pricing_json && typeof rule.pricing_json === 'object'
      ? rule.pricing_json
      : rule.pricing && typeof rule.pricing === 'object'
        ? rule.pricing
        : {};

    if (ruleType === 'base_unit') {
      accumulator.baseUnitPrice = Number.isFinite(Number(pricing.baseUnitPrice))
        ? Number(pricing.baseUnitPrice)
        : accumulator.baseUnitPrice;
      accumulator.directOrderMaxQuantity = Number.isFinite(Number(pricing.directOrderMaxQuantity))
        ? Number(pricing.directOrderMaxQuantity)
        : accumulator.directOrderMaxQuantity;
      if (typeof pricing.templateAllowsDirectOrder === 'boolean') {
        accumulator.templateAllowsDirectOrder = pricing.templateAllowsDirectOrder;
      }
    }

    if (ruleType === 'quantity_tier' && Array.isArray(pricing.quantityTiers)) {
      accumulator.quantityTiers.push(...pricing.quantityTiers);
    }

    if (ruleType === 'extra') {
      accumulator.extras.push({
        code: String(pricing.code || rule.name || ''),
        label: String(pricing.label || rule.name || pricing.code || ''),
        unitPrice: Number.isFinite(Number(pricing.unitPrice)) ? Number(pricing.unitPrice) : 0,
        appliesTo: String(pricing.appliesTo || 'items'),
      });
    }

    return accumulator;
  }, {
    baseUnitPrice: 0,
    quantityTiers: [],
    extras: [],
    directOrderMaxQuantity: 30,
    templateAllowsDirectOrder: true,
  });
}

function calculateCustomizerPricing(input = {}) {
  const quantity = Number.isFinite(Number(input.quantity)) && Number(input.quantity) > 0 ? Number(input.quantity) : 0;
  const textValues = input.textValues && typeof input.textValues === 'object' ? input.textValues : {};
  const rosterItems = Array.isArray(input.rosterItems) ? input.rosterItems : [];
  const logoCount = Number.isFinite(Number(input.logoCount)) ? Number(input.logoCount) : 0;
  const pricingConfig = extractPricingConfig(input.rules || []);
  const extras = [];

  pricingConfig.extras.forEach((extra) => {
    let extraQuantity = 0;

    if (extra.appliesTo === 'logos') extraQuantity = logoCount;
    else if (extra.appliesTo === 'named-items') {
      extraQuantity = rosterItems.length || (textValues.playerName ? quantity : 0);
    } else if (extra.appliesTo === 'numbered-items') {
      extraQuantity = rosterItems.length || (textValues.playerNumber ? quantity : 0);
    } else if (extra.appliesTo === 'items') extraQuantity = quantity;
    else if (extra.appliesTo === 'single' || extra.appliesTo === 'order') extraQuantity = 1;

    if (extraQuantity > 0) {
      extras.push({
        code: extra.code,
        label: extra.label,
        quantity: extraQuantity,
        unitPrice: extra.unitPrice,
      });
    }
  });

  const breakdown = calculatePriceBreakdown({
    quantity,
    baseUnitPrice: pricingConfig.baseUnitPrice,
    quantityTiers: pricingConfig.quantityTiers,
    extras,
  });

  const pricingComplete = quantity > 0 && pricingConfig.baseUnitPrice > 0;
  const fulfillmentPath = decideFulfillmentPath({
    pricingComplete,
    quantity,
    directOrderMaxQuantity: pricingConfig.directOrderMaxQuantity,
    templateAllowsDirectOrder: pricingConfig.templateAllowsDirectOrder,
    isQuotePreferred: input.isQuotePreferred === true,
    assetReviewRequired: input.assetReviewRequired === true,
    requiresReview: input.requiresReview === true,
  });

  return {
    ...breakdown,
    pricingComplete,
    directOrderMaxQuantity: pricingConfig.directOrderMaxQuantity,
    templateAllowsDirectOrder: pricingConfig.templateAllowsDirectOrder,
    fulfillmentPath,
  };
}

function createPricingModel(db) {
  return {
    async listPricingRules({ productTypeId = null, templateId = null } = {}) {
      const result = await db.query(
        `SELECT *
           FROM customizer_pricing_rules
          WHERE status = 'active'
            AND ($1::bigint IS NULL OR product_type_id = $1 OR product_type_id IS NULL)
            AND ($2::bigint IS NULL OR template_id = $2 OR template_id IS NULL)
          ORDER BY sort_order ASC, id ASC`,
        [productTypeId, templateId]
      );
      return result.rows;
    },
  };
}

module.exports = {
  calculatePriceBreakdown,
  calculateCustomizerPricing,
  decideFulfillmentPath,
  createPricingModel,
};
