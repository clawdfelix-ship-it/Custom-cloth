(function bootCustomizer(global, document) {
  const root = document.getElementById('customizer-app');
  if (!root) return;

  const DEBOUNCE_MS = 220;
  const PART_TYPES = ['body', 'sleeve', 'collar'];
  const bootstrapNode = document.getElementById('customizer-bootstrap');
  const { CustomizerApi, CustomizerState, CustomizerCatalog, CustomizerEditor, CustomizerCompositor } = global;

  let bootstrap = {};
  let persistTimer = null;

  if (bootstrapNode && bootstrapNode.textContent) {
    try {
      bootstrap = JSON.parse(bootstrapNode.textContent);
    } catch (error) {
      bootstrap = {};
    }
  }

  const startMode = bootstrap.startMode || 'template';
  const store = CustomizerState.createCustomizerStore({
    submission: {
      phase: 'booting',
      error: null,
    },
  });

  function sumRosterQuantity(items = []) {
    return (Array.isArray(items) ? items : []).reduce((sum, item) => {
      const quantity = Number(item.quantity);
      return sum + (Number.isFinite(quantity) && quantity > 0 ? quantity : 0);
    }, 0);
  }

  function buildPartSelection(detail = {}, existing = {}) {
    return PART_TYPES.reduce((accumulator, partType) => {
      const variants = detail.partVariants && Array.isArray(detail.partVariants[partType])
        ? detail.partVariants[partType]
        : [];
      const preferred = existing && typeof existing === 'object' ? existing[partType] : null;
      const fallback = detail.defaultPartSelection && detail.defaultPartSelection[partType]
        ? detail.defaultPartSelection[partType]
        : variants[0] && variants[0].code
          ? variants[0].code
          : null;
      const resolved = variants.find((variant) => String(variant.code) === String(preferred))
        ? preferred
        : fallback;
      accumulator[partType] = resolved || null;
      return accumulator;
    }, {});
  }

  function buildColorZoneValues(detail = {}, existing = {}) {
    return (Array.isArray(detail.colorZones) ? detail.colorZones : [])
      .filter((zone) => zone.allowColor)
      .reduce((accumulator, zone) => {
        const existingValue = existing && typeof existing === 'object' ? existing[zone.zoneKey] : null;
        accumulator[zone.zoneKey] = typeof existingValue === 'string' && existingValue
          ? existingValue
          : (zone.defaultColor || '#f4f4f5');
        return accumulator;
      }, {});
  }

  function alignDesignWithFamily(design = {}, detail = {}) {
    return {
      templateFamilyId: detail.templateFamily ? detail.templateFamily.id : (design.templateFamilyId || null),
      parts: buildPartSelection(detail, design.parts),
      colorZones: buildColorZoneValues(detail, design.colorZones),
      currentView: String(design.currentView || 'front') === 'back' ? 'back' : 'front',
      texts: design.texts && typeof design.texts === 'object' ? { ...design.texts } : {},
      logos: Array.isArray(design.logos) ? design.logos : [],
      notes: typeof design.notes === 'string' ? design.notes : '',
    };
  }

  function buildSelectionFromState(state) {
    return {
      productTypeId: state.selectedProductType ? state.selectedProductType.id : null,
      templateId: state.selectedTemplateFamily ? state.selectedTemplateFamily.id : null,
    };
  }

  function setSubmissionPhase(phase, error = null) {
    store.update((state) => ({
      ...state,
      submission: { phase, error },
    }));
  }

  async function loadTemplateFamilyDetail(templateId) {
    if (!templateId) {
      store.update((state) => ({
        ...state,
        familyDetail: {
          partVariants: {},
          colorZones: [],
          defaultPartSelection: {},
          palette: [],
        },
      }));
      return null;
    }

    const payload = await CustomizerApi.fetchTemplate(templateId);
    const detail = CustomizerCatalog.normalizeTemplateDetail(payload);

    store.update((state) => ({
      ...state,
      selectedTemplateFamily: detail.templateFamily || state.selectedTemplateFamily,
      familyDetail: {
        partVariants: detail.partVariants || {},
        colorZones: detail.colorZones || [],
        defaultPartSelection: detail.defaultPartSelection || {},
        palette: detail.palette || [],
      },
      design: alignDesignWithFamily(state.design, detail),
      previews: {
        ...state.previews,
        activeSide: (state.design && state.design.currentView) || 'front',
      },
    }));

    return detail;
  }

  async function persistDesignSelection(nextState) {
    if (!nextState.session || !nextState.session.id) return;
    const response = await CustomizerApi.saveDesign(
      nextState.session.id,
      nextState.design,
      buildSelectionFromState(nextState)
    );

    store.update((state) => ({
      ...state,
      session: response.session || state.session,
    }));
  }

  function scheduleDesignPersist() {
    if (persistTimer) global.clearTimeout(persistTimer);
    persistTimer = global.setTimeout(async () => {
      persistTimer = null;
      try {
        await persistDesignSelection(store.getState());
      } catch (error) {
        setSubmissionPhase('error', error.message || 'Unable to save design');
      }
    }, DEBOUNCE_MS);
  }

  function updateNotes(value) {
    store.update((state) => ({
      ...state,
      design: {
        ...state.design,
        notes: value,
      },
      submission: {
        ...state.submission,
        phase: 'ready',
        error: null,
      },
    }));
    scheduleDesignPersist();
  }

  function addRosterItem() {
    store.update((state) => {
      const items = Array.isArray(state.roster.items) ? state.roster.items : [];
      const nextItems = items.concat({
        playerName: '',
        playerNumber: '',
        sizeCode: '',
        quantity: 1,
        sortOrder: items.length,
      });
      return {
        ...state,
        roster: {
          items: nextItems,
          totalQuantity: sumRosterQuantity(nextItems),
        },
      };
    });
  }

  function updateRosterItem(index, field, value) {
    store.update((state) => {
      const nextItems = (Array.isArray(state.roster.items) ? state.roster.items : []).map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        return {
          ...item,
          [field]: field === 'quantity' ? value : value,
        };
      });
      return {
        ...state,
        roster: {
          items: nextItems,
          totalQuantity: sumRosterQuantity(nextItems.map((item) => ({
            ...item,
            quantity: Number(item.quantity) || 0,
          }))),
        },
      };
    });
  }

  function removeRosterItem(index) {
    store.update((state) => {
      const nextItems = (Array.isArray(state.roster.items) ? state.roster.items : [])
        .filter((_, itemIndex) => itemIndex !== index)
        .map((item, itemIndex) => ({
          ...item,
          sortOrder: itemIndex,
        }));
      return {
        ...state,
        roster: {
          items: nextItems,
          totalQuantity: sumRosterQuantity(nextItems),
        },
      };
    });
  }

  function buildPreviewPayload(state) {
    const sessionId = state.session && state.session.id ? state.session.id : 'draft';
    const timestamp = Date.now();
    const sides = ['front', 'back'];

    return sides.reduce((accumulator, side) => {
      accumulator[side] = {
        storageKey: `customizer/session-${sessionId}/${side}-${timestamp}.json`,
        mimeType: 'image/png',
        meta: {
          side,
          templateFamilyId: state.selectedTemplateFamily ? state.selectedTemplateFamily.id : null,
          productTypeId: state.selectedProductType ? state.selectedProductType.id : null,
          parts: state.design.parts || {},
          colorZones: state.design.colorZones || {},
          texts: state.design.texts || {},
          logoCount: Array.isArray(state.design.logos) ? state.design.logos.length : 0,
        },
      };
      return accumulator;
    }, {});
  }

  async function submitSession(mode) {
    const current = store.getState();
    if (!current.session || !current.session.id) return;

    try {
      setSubmissionPhase(mode === 'quote' ? 'submitting-quote' : 'submitting-order');

      await persistDesignSelection(current);
      await CustomizerApi.saveRoster(current.session.id, current.roster.items || []);
      const previewsResponse = await CustomizerApi.savePreviews(current.session.id, buildPreviewPayload(store.getState()));
      const response = await CustomizerApi.submitSession(current.session.id, {
        mode,
        note: current.design.notes || '',
      });

      store.update((state) => ({
        ...state,
        previews: {
          ...state.previews,
          ...(previewsResponse.previews || {}),
        },
        pricing: response.pricing || state.pricing,
        deliverable: response.deliverable || state.deliverable,
        session: response.session || state.session,
        submission: {
          phase: 'submitted',
          error: null,
        },
      }));

      if (response.mode === 'direct_order' && response.orderDraft) {
        global.location.href = `/customizer/order-success?draftId=${encodeURIComponent(response.orderDraft.id)}`;
        return;
      }

      if (response.quoteRequest) {
        global.location.href = `/customizer/quote-success?quoteId=${encodeURIComponent(response.quoteRequest.id)}`;
      }
    } catch (error) {
      setSubmissionPhase('error', error.message || 'Submit failed');
    }
  }

  async function selectProductType(productTypeId) {
    const current = store.getState();
    const nextProductType = current.catalog.productTypes.find((item) => String(item.id) === String(productTypeId)) || null;
    const nextTemplateFamily = nextProductType
      ? CustomizerCatalog.findTemplateForStartMode(current.catalog, nextProductType.id, startMode, null)
      : null;

    store.update((state) => ({
      ...state,
      selectedProductType: nextProductType,
      selectedTemplateFamily: nextTemplateFamily,
      session: state.session ? {
        ...state.session,
        product_type_id: nextProductType ? nextProductType.id : null,
        template_id: nextTemplateFamily ? nextTemplateFamily.id : null,
      } : state.session,
    }));

    if (nextTemplateFamily && nextTemplateFamily.id) {
      await loadTemplateFamilyDetail(nextTemplateFamily.id);
    }

    await persistDesignSelection(store.getState());
  }

  async function selectTemplateFamily(templateId) {
    store.update((state) => ({
      ...state,
      selectedTemplateFamily: state.catalog.templateFamilies.find((item) => String(item.id) === String(templateId)) || null,
      session: state.session ? {
        ...state.session,
        template_id: templateId ? Number(templateId) : null,
      } : state.session,
    }));

    await loadTemplateFamilyDetail(templateId ? Number(templateId) : null);
    await persistDesignSelection(store.getState());
  }

  function selectPartVariant(partType, code) {
    if (!PART_TYPES.includes(String(partType))) return;
    store.update((state) => ({
      ...state,
      design: {
        ...state.design,
        parts: {
          ...state.design.parts,
          [partType]: code || null,
        },
      },
      submission: {
        ...state.submission,
        phase: 'ready',
        error: null,
      },
    }));
    scheduleDesignPersist();
  }

  function setPreviewSide(side) {
    const nextSide = side === 'back' ? 'back' : 'front';
    store.update((state) => ({
      ...state,
      previews: {
        ...state.previews,
        activeSide: nextSide,
      },
      design: {
        ...state.design,
        currentView: nextSide,
      },
    }));
  }

  function updateZoneColor(zoneKey, color) {
    store.update((state) => ({
      ...state,
      design: {
        ...state.design,
        colorZones: {
          ...state.design.colorZones,
          [zoneKey]: color || state.design.colorZones[zoneKey] || '#f4f4f5',
        },
      },
      submission: {
        ...state.submission,
        phase: 'ready',
        error: null,
      },
    }));
    scheduleDesignPersist();
  }

  function updateTextField(fieldKey, value) {
    store.update((state) => ({
      ...state,
      design: {
        ...state.design,
        texts: {
          ...state.design.texts,
          [fieldKey]: value,
        },
      },
      submission: {
        ...state.submission,
        phase: 'ready',
        error: null,
      },
    }));
    scheduleDesignPersist();
  }

  function selectLogoAsset(assetId) {
    const current = store.getState();
    const asset = current.catalog.assets.find((item) => String(item.id) === String(assetId));

    store.update((state) => ({
      ...state,
      design: {
        ...state.design,
        logos: asset ? [{
          assetId: asset.id,
          slug: asset.slug || null,
          name: asset.name || '',
          previewUrl: asset.preview_url || asset.previewUrl || null,
        }] : [],
      },
      submission: {
        ...state.submission,
        phase: 'ready',
        error: null,
      },
    }));
    scheduleDesignPersist();
  }

  const renderer = CustomizerEditor.createEditorRenderer(root, store, {
    selectProductType,
    selectTemplateFamily,
    selectPartVariant,
    setPreviewSide,
    setPreviewMode(mode) {
      store.update((state) => ({
        ...state,
        previews: {
          ...state.previews,
          mode3d: mode === '3d',
        },
      }));
      previewManager.syncMode(mode);
    },
    exportKit() {
      const state = store.getState();
      const design = state.design || {};
      if (!global.CustomizerKitExporter || typeof global.CustomizerKitExporter.buildZip !== 'function') {
        setSubmissionPhase('error', '匯出模組未載入');
        return;
      }
      setSubmissionPhase('exporting');
      global.CustomizerKitExporter.buildZip({
        design,
        includeHotspots: true,
        renderLogosSeparately: true,
        fileName: `custom-kit-${Date.now()}`,
      })
        .then((result) => {
          global.CustomizerKitExporter.downloadBlob(result.blob, result.fileName);
          setSubmissionPhase('idle', null);
        })
        .catch((error) => {
          setSubmissionPhase('error', error && error.message ? error.message : '匯出失敗');
        });
    },
    updateZoneColor,
    updateTextField,
    selectLogoAsset,
    updateNotes,
    addRosterItem,
    updateRosterItem,
    removeRosterItem,
    submitQuote() {
      return submitSession('quote');
    },
    submitOrder() {
      return submitSession('direct_order');
    },
  });

  const compositor = CustomizerCompositor && typeof CustomizerCompositor.createPreviewCompositor === 'function'
    ? CustomizerCompositor.createPreviewCompositor(root)
    : null;

  /**
   * 3D preview manager.
   *
   * The 2D canvas is the source of truth for the exported texture; the 3D
   * view renders the same texture on a procedurally generated garment so the
   * customer can see the construction from a second angle. It is created
   * lazily on first use because WebGL is expensive to initialise.
   */
  const previewManager = {
    instance: null,
    mode: '2d',

    ensure() {
      if (this.instance) return this.instance;
      if (!global.CustomizerKitPreview || typeof global.CustomizerKitPreview.create !== 'function') {
        return null;
      }
      const host = root.querySelector('[data-role="preview-3d"]');
      if (!host) return null;
      const instance = global.CustomizerKitPreview.create({ container: host });
      if (!instance) return null;
      instance.buildGarment(previewManager.bodyForDesign(store.getState()));
      this.instance = instance;
      return instance;
    },

    bodyForDesign(state) {
      const family = state.selectedTemplateFamily || {};
      // The catalog exposes garment proportions on the template family so the
      // 3D preview matches the selected template rather than a default.
      const body = family.body || {};
      return {
        length: body.length || 1,
        chestWidth: body.chestWidth || 0.52,
        waistWidth: body.waistWidth || 0.46,
        sleeveLength: body.sleeveLength || 0.22,
      };
    },

    syncMode(mode) {
      this.mode = mode;
      const host = root.querySelector('[data-role="preview-3d"]');
      const canvas = root.querySelector('[data-role="preview-canvas"]');
      const overlay = root.querySelector('[data-role="preview-overlay"]');
      if (!host || !canvas) return;

      if (mode === '3d') {
        const instance = this.ensure();
        if (!instance) {
          // WebGL unavailable: fall back to the 2D view rather than showing a
          // blank stage.
          host.hidden = true;
          canvas.hidden = false;
          if (overlay) overlay.hidden = false;
          return;
        }
        host.hidden = false;
        canvas.hidden = true;
        if (overlay) overlay.hidden = true;
        instance.applyColors(store.getState().design);
        this.refreshTexture();
      } else {
        host.hidden = true;
        canvas.hidden = false;
        if (overlay) overlay.hidden = false;
      }
    },

    refreshTexture() {
      if (!this.instance) return;
      const state = store.getState();
      const textures = global.CustomizerKitTexture
        ? global.CustomizerKitTexture.renderArea('shirt', state.design)
        : null;
      if (!textures) return;
      this.instance.setTexture(textures.color);
    },
  };

  store.subscribe((state) => {
    renderer.render(state);
    if (compositor) compositor.render(state);
    root.dataset.startMode = startMode;
    root.dataset.phase = state.submission.phase || 'idle';
    if (previewManager.mode === '3d' && previewManager.instance) {
      previewManager.instance.applyColors(state.design);
      previewManager.refreshTexture();
    }
  });

  async function init() {
    try {
      setSubmissionPhase('loading-catalog');
      const catalogPayload = await CustomizerApi.fetchCatalog();
      const catalog = CustomizerCatalog.normalizeCatalogPayload(catalogPayload);
      const selectedProductType = CustomizerCatalog.findDefaultProductType(catalog, bootstrap.productTypeId);
      const selectedTemplateFamily = selectedProductType
        ? CustomizerCatalog.findTemplateForStartMode(catalog, selectedProductType.id, startMode, bootstrap.templateId)
        : null;

      store.update((state) => ({
        ...state,
        catalog,
        selectedProductType,
        selectedTemplateFamily,
      }));

      if (selectedTemplateFamily && selectedTemplateFamily.id) {
        await loadTemplateFamilyDetail(selectedTemplateFamily.id);
      }

      setSubmissionPhase('creating-session');
      const sessionPayload = {
        ...buildSelectionFromState(store.getState()),
        design: store.getState().design,
      };
      const sessionResponse = await CustomizerApi.createSession(sessionPayload);

      store.update((state) => ({
        ...state,
        session: sessionResponse.session,
        design: sessionResponse.design || state.design,
        submission: {
          phase: 'ready',
          error: null,
        },
      }));
    } catch (error) {
      setSubmissionPhase('error', error.message || 'Customizer init failed');
      store.update((state) => ({
        ...state,
        submission: {
          phase: 'error',
          error: error.message || 'Customizer init failed',
        },
      }));
    }
  }

  renderer.render(store.getState());
  init();
})(window, document);
