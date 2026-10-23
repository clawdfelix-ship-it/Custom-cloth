function summarizeRoster(roster = {}) {
  const items = Array.isArray(roster.items) ? roster.items : [];
  return {
    itemCount: items.length,
    totalQuantity: items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
  };
}

function normalizePreviewCollection(previews = {}) {
  if (Array.isArray(previews)) {
    return previews.reduce((accumulator, preview) => {
      const key = String(preview.preview_side || preview.previewSide || preview.side || '').trim();
      if (!key) return accumulator;
      accumulator[key] = {
        storageKey: preview.storage_key || preview.storageKey || null,
        mimeType: preview.mime_type || preview.mimeType || 'image/png',
        meta: preview.meta_json || preview.meta || {},
      };
      return accumulator;
    }, { front: null, back: null });
  }

  return {
    front: previews.front || null,
    back: previews.back || null,
  };
}

function buildDeliverablePackage(input = {}) {
  const session = input.session || {};
  const selection = session.selection || {
    productTypeId: session.product_type_id ?? session.productTypeId ?? null,
    templateId: session.template_id ?? session.templateId ?? null,
  };
  const previews = normalizePreviewCollection(input.previews || {});
  const pricing = input.pricing || {};
  const design = input.design || session.design || {};
  const roster = input.roster || session.roster || {};

  return {
    sessionId: session.id ?? input.sessionId ?? null,
    selectedProductType: selection.productTypeId ?? selection.product_type_id ?? null,
    selectedTemplate: selection.templateId ?? selection.template_id ?? null,
    previews: {
      front: previews.front || null,
      back: previews.back || null,
    },
    rosterSummary: summarizeRoster(roster),
    design,
    uploadedAssetRefs: Array.isArray(input.uploadedAssets || session.uploadedAssets)
      ? (input.uploadedAssets || session.uploadedAssets)
      : [],
    pricingBreakdown: pricing,
    fulfillmentPath: pricing.fulfillmentPath || session.fulfillmentPath || session.fulfillment_path || 'quote_required',
  };
}

function createDeliverablesModel() {
  return {
    buildDeliverablePackage,
  };
}

module.exports = {
  buildDeliverablePackage,
  createDeliverablesModel,
};
