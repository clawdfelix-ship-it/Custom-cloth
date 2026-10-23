const { createCatalogModel } = require('../models/customizer/catalog');
const { createDeliverablesModel } = require('../models/customizer/deliverables');
const { createOrderDraftsModel } = require('../models/customizer/orderDrafts');
const { createPreviewsModel } = require('../models/customizer/previews');
const { calculateCustomizerPricing, createPricingModel } = require('../models/customizer/pricing');
const { createQuotesModel } = require('../models/customizer/quotes');
const { buildDesignSession, createSessionsModel } = require('../models/customizer/sessions');
const { createUploadsModel } = require('../models/customizer/uploads');
const { createSnapshotRecord } = require('../utils/customizer/snapshot');
const { validateRosterItems } = require('../utils/customizer/validation');

function createSessionToken() {
  return `cs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function toNullableId(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function mapPreviewRowsBySide(rows = []) {
  return (Array.isArray(rows) ? rows : []).reduce((accumulator, row) => {
    const side = String(row.preview_side || row.previewSide || '').trim();
    if (!side) return accumulator;
    accumulator[side] = {
      storageKey: row.storage_key || row.storageKey || null,
      mimeType: row.mime_type || row.mimeType || 'image/png',
      meta: row.meta_json || row.meta || {},
    };
    return accumulator;
  }, { front: null, back: null });
}

function normalizeUploadedAssetIds(uploadedAssets = []) {
  return (Array.isArray(uploadedAssets) ? uploadedAssets : [])
    .map((asset) => toNullableId(asset.id || asset.uploadedAssetId || asset))
    .filter(Boolean);
}

module.exports = function registerCustomizerApi(app, pool) {
  const catalogModel = createCatalogModel(pool);
  const deliverablesModel = createDeliverablesModel();
  const orderDraftsModel = createOrderDraftsModel(pool);
  const previewsModel = createPreviewsModel(pool);
  const pricingModel = createPricingModel(pool);
  const quotesModel = createQuotesModel(pool);
  const sessionsModel = createSessionsModel(pool);
  const uploadsModel = createUploadsModel(pool);

  async function loadSessionWorkspace(sessionId) {
    const [session, designRow, roster, previewRows, uploadedAssets] = await Promise.all([
      sessionsModel.getSessionById(sessionId),
      sessionsModel.getLatestDesign(sessionId),
      sessionsModel.getRoster(sessionId),
      previewsModel.getLatestPreviews(sessionId),
      uploadsModel.listSessionAssets(sessionId),
    ]);

    if (!session) return null;

    return {
      session,
      design: designRow && designRow.design_json ? designRow.design_json : {},
      roster: roster || { items: [], total_quantity: 0 },
      previews: mapPreviewRowsBySide(previewRows),
      uploadedAssets,
    };
  }

  async function buildPricingAndDeliverable({ sessionId, note = '', isQuotePreferred = false } = {}) {
    const workspace = await loadSessionWorkspace(sessionId);
    if (!workspace) return null;

    const pricingRules = await pricingModel.listPricingRules({
      productTypeId: workspace.session.product_type_id,
      templateId: workspace.session.template_id,
    });
    const quantity = Number(workspace.roster.total_quantity) || 0;
    const pricing = calculateCustomizerPricing({
      rules: pricingRules,
      quantity,
      textValues: workspace.design.texts || {},
      rosterItems: workspace.roster.items || [],
      logoCount: Array.isArray(workspace.design.logos) ? workspace.design.logos.length : 0,
      isQuotePreferred,
      assetReviewRequired: workspace.uploadedAssets.length > 0,
    });

    const updatedSession = await sessionsModel.updateSessionCommerce(sessionId, {
      fulfillmentPath: pricing.fulfillmentPath,
      latestPricing: pricing,
    });

    const deliverable = deliverablesModel.buildDeliverablePackage({
      session: updatedSession || workspace.session,
      design: workspace.design,
      previews: workspace.previews,
      roster: workspace.roster,
      uploadedAssets: workspace.uploadedAssets,
      pricing,
      note,
    });

    return {
      workspace,
      session: updatedSession || workspace.session,
      pricing,
      deliverable,
    };
  }

  app.get('/api/customizer/catalog', async (req, res) => {
    if (!pool) return res.status(500).json({ error: 'Database not configured' });
    const [productTypes, templateFamilies, assets] = await Promise.all([
      catalogModel.listProductTypes(),
      catalogModel.listAllTemplates(),
      catalogModel.listAssets(),
    ]);
    res.json({
      productTypes,
      templateFamilies,
      templates: templateFamilies,
      assets,
    });
  });

  app.get('/api/customizer/product-types/:id/templates', async (req, res) => {
    if (!pool) return res.status(500).json({ error: 'Database not configured' });
    const productTypeId = toNullableId(req.params.id);
    if (!productTypeId) return res.status(400).json({ error: 'Invalid product type id' });
    const templateFamilies = await catalogModel.listTemplatesByProductType(productTypeId);
    res.json({ templateFamilies, templates: templateFamilies });
  });

  app.get('/api/customizer/templates/:id', async (req, res) => {
    if (!pool) return res.status(500).json({ error: 'Database not configured' });
    const templateId = toNullableId(req.params.id);
    if (!templateId) return res.status(400).json({ error: 'Invalid template id' });
    const detail = await catalogModel.getTemplateDetail(templateId);
    if (!detail) return res.status(404).json({ error: 'Template not found' });
    res.json({
      templateFamily: detail.templateFamily,
      template: detail.templateFamily,
      partVariants: detail.partVariants,
      colorZones: detail.colorZones,
      defaultPartSelection: detail.defaultPartSelection,
      palette: detail.palette,
      zones: detail.colorZones,
    });
  });

  app.get('/api/customizer/assets', async (req, res) => {
    if (!pool) return res.status(500).json({ error: 'Database not configured' });
    const assets = await catalogModel.listAssets({
      productTypeId: toNullableId(req.query.productTypeId),
      templateId: toNullableId(req.query.templateId),
      assetType: typeof req.query.assetType === 'string' ? req.query.assetType : null,
    });
    res.json({ assets });
  });

  app.post('/api/customizer/sessions', async (req, res) => {
    if (!pool) return res.status(500).json({ error: 'Database not configured' });

    const productTypeId = toNullableId(req.body && req.body.productTypeId);
    const templateId = toNullableId(req.body && req.body.templateId);
    const sessionPayload = buildDesignSession({
      selection: { productTypeId, templateId },
      design: req.body && req.body.design,
      roster: req.body && req.body.roster,
    });

    const session = await sessionsModel.createSession({
      sessionToken: createSessionToken(),
      productTypeId,
      templateId,
    });
    await sessionsModel.saveDesign(session.id, sessionPayload.design);
    res.status(201).json({ session, design: sessionPayload.design });
  });

  app.get('/api/customizer/sessions/:id', async (req, res) => {
    if (!pool) return res.status(500).json({ error: 'Database not configured' });
    const sessionId = toNullableId(req.params.id);
    if (!sessionId) return res.status(400).json({ error: 'Invalid session id' });
    const workspace = await loadSessionWorkspace(sessionId);
    if (!workspace) return res.status(404).json({ error: 'Session not found' });
    res.json(workspace);
  });

  app.put('/api/customizer/sessions/:id/design', async (req, res) => {
    if (!pool) return res.status(500).json({ error: 'Database not configured' });
    const sessionId = toNullableId(req.params.id);
    if (!sessionId) return res.status(400).json({ error: 'Invalid session id' });
    const productTypeId = toNullableId(req.body && req.body.productTypeId);
    const templateId = toNullableId(req.body && req.body.templateId);
    const design = buildDesignSession({
      selection: { productTypeId, templateId },
      design: req.body && req.body.design,
    }).design;
    const session = await sessionsModel.updateSessionSelection(sessionId, { productTypeId, templateId });
    const saved = await sessionsModel.saveDesign(sessionId, design);
    res.json({ session, design: saved });
  });

  app.put('/api/customizer/sessions/:id/roster', async (req, res) => {
    if (!pool) return res.status(500).json({ error: 'Database not configured' });
    const sessionId = toNullableId(req.params.id);
    if (!sessionId) return res.status(400).json({ error: 'Invalid session id' });
    const validation = validateRosterItems((req.body && req.body.items) || []);
    if (!validation.valid) return res.status(400).json({ error: 'Invalid roster items', details: validation.errors });
    const saved = await sessionsModel.saveRoster(sessionId, validation.totalQuantity, { items: validation.normalizedItems });
    res.json({ roster: saved, items: validation.normalizedItems });
  });

  app.post('/api/customizer/sessions/:id/previews', async (req, res) => {
    if (!pool) return res.status(500).json({ error: 'Database not configured' });
    const sessionId = toNullableId(req.params.id);
    if (!sessionId) return res.status(400).json({ error: 'Invalid session id' });

    const previews = req.body && req.body.previews && typeof req.body.previews === 'object'
      ? req.body.previews
      : {};
    const snapshotPayload = {};

    Object.entries(previews).forEach(([side, preview]) => {
      const normalized = createSnapshotRecord({
        side,
        storageKey: preview && preview.storageKey
          ? preview.storageKey
          : `customizer/session-${sessionId}/${side}-${Date.now()}.json`,
        mimeType: preview && preview.mimeType ? preview.mimeType : 'image/png',
        meta: preview && preview.meta ? preview.meta : {},
      });

      if (normalized.side && normalized.storageKey) {
        snapshotPayload[normalized.side] = normalized;
      }
    });

    const rows = await previewsModel.savePreviewRefs(sessionId, snapshotPayload);
    res.status(201).json({ previews: mapPreviewRowsBySide(rows) });
  });

  app.post('/api/customizer/sessions/:id/submit', async (req, res) => {
    if (!pool) return res.status(500).json({ error: 'Database not configured' });
    const sessionId = toNullableId(req.params.id);
    if (!sessionId) return res.status(400).json({ error: 'Invalid session id' });

    const mode = String(req.body && req.body.mode || 'auto');
    const note = String(req.body && req.body.note || '').trim();
    const forceQuote = mode === 'quote' || (req.body && req.body.isQuotePreferred === true);
    const result = await buildPricingAndDeliverable({
      sessionId,
      note,
      isQuotePreferred: forceQuote,
    });
    if (!result) return res.status(404).json({ error: 'Session not found' });

    const uploadedAssetIds = normalizeUploadedAssetIds(result.workspace.uploadedAssets);
    if (result.pricing.fulfillmentPath === 'direct_order' && mode !== 'quote') {
      const orderDraft = await orderDraftsModel.createOrderDraft({
        sessionId,
        deliverable: result.deliverable,
        note,
      });
      return res.status(201).json({
        mode: 'direct_order',
        session: result.session,
        pricing: result.pricing,
        deliverable: result.deliverable,
        orderDraft,
      });
    }

    const quoteRequest = await quotesModel.createQuoteRequest({
      sessionId,
      deliverable: result.deliverable,
      note,
      uploadedAssetIds,
    });
    return res.status(201).json({
      mode: 'quote_required',
      session: result.session,
      pricing: result.pricing,
      deliverable: result.deliverable,
      quoteRequest,
    });
  });
};
