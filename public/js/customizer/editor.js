(function attachCustomizerEditor(global, document) {
  const FALLBACK_SWATCHES = ['#f4f4f5', '#7f1d45', '#fbbf24', '#111827', '#2563eb', '#16a34a'];
  const PART_TYPES = [
    { key: 'body', label: 'Body', help: '主身款式' },
    { key: 'sleeve', label: 'Sleeve', help: '袖形 / 包邊' },
    { key: 'collar', label: 'Collar', help: '領口結構' },
  ];

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getActiveSelection(state) {
    return {
      productTypeId: state.selectedProductType ? state.selectedProductType.id : null,
      templateId: state.selectedTemplateFamily ? state.selectedTemplateFamily.id : null,
    };
  }

  function listSelectionAssets(state, assetTypes) {
    if (!global.CustomizerCatalog || typeof global.CustomizerCatalog.listAssetsForSelection !== 'function') {
      return [];
    }
    return global.CustomizerCatalog.listAssetsForSelection(state.catalog, getActiveSelection(state), assetTypes);
  }

  function renderProductTypeOptions(state) {
    if (!state.catalog.productTypes.length) {
      return '<option value="">未有品類資料</option>';
    }

    return state.catalog.productTypes.map((productType) => {
      const selected = state.selectedProductType && String(productType.id) === String(state.selectedProductType.id)
        ? ' selected'
        : '';
      return `<option value="${escapeHtml(productType.id)}"${selected}>${escapeHtml(productType.name)}</option>`;
    }).join('');
  }

  function renderFamilyCards(state) {
    if (!state.selectedProductType) {
      return '<div class="customizer-empty">請先選擇品類。</div>';
    }

    const families = state.catalog.templateFamiliesByProductType[String(state.selectedProductType.id)] || [];
    if (!families.length) {
      return '<div class="customizer-empty">呢個品類仲未有模板家族。</div>';
    }

    return families.map((family) => {
      const selected = state.selectedTemplateFamily && String(family.id) === String(state.selectedTemplateFamily.id);
      const className = selected ? 'customizer-template-card is-selected' : 'customizer-template-card';
      return `
        <button type="button" class="${className}" data-role="template-family" data-template-id="${escapeHtml(family.id)}">
          <span class="customizer-template-card__meta">${family.isBlank ? '空白家族' : '模板家族'}</span>
          <span class="customizer-template-card__name">${escapeHtml(family.name)}</span>
          <span class="customizer-template-card__desc">${escapeHtml(family.description || '')}</span>
        </button>
      `;
    }).join('');
  }

  function renderPartVariantCards(state, partType) {
    const variants = state.familyDetail && state.familyDetail.partVariants && Array.isArray(state.familyDetail.partVariants[partType])
      ? state.familyDetail.partVariants[partType]
      : [];
    if (!variants.length) {
      return '<div class="customizer-empty">未有可切換款式。</div>';
    }

    const selectedCode = state.design && state.design.parts ? state.design.parts[partType] : null;

    return variants.map((variant) => `
      <button
        type="button"
        class="customizer-part-card${String(selectedCode) === String(variant.code) ? ' is-selected' : ''}"
        data-role="part-variant"
        data-part-type="${escapeHtml(partType)}"
        data-part-code="${escapeHtml(variant.code)}"
      >
        <span class="customizer-part-card__badge">${escapeHtml((variant.badge || partType).toUpperCase())}</span>
        <span class="customizer-part-card__name">${escapeHtml(variant.name)}</span>
        <span class="customizer-part-card__desc">${escapeHtml(variant.description || '')}</span>
      </button>
    `).join('');
  }

  function buildPalette(state) {
    const assetColors = listSelectionAssets(state, ['color', 'palette']).flatMap((asset) => {
      const meta = asset.meta_json && typeof asset.meta_json === 'object'
        ? asset.meta_json
        : asset.meta && typeof asset.meta === 'object'
          ? asset.meta
          : {};

      if (Array.isArray(meta.colors)) return meta.colors;
      if (typeof meta.color === 'string') return [meta.color];
      return [];
    });

    const familyPalette = state.familyDetail && Array.isArray(state.familyDetail.palette)
      ? state.familyDetail.palette
      : [];

    const selectedColors = state.design && state.design.colorZones && typeof state.design.colorZones === 'object'
      ? Object.values(state.design.colorZones)
      : [];

    return Array.from(new Set([...familyPalette, ...assetColors, ...selectedColors, ...FALLBACK_SWATCHES])).slice(0, 8);
  }

  function renderColorZoneControls(state) {
    const zones = Array.isArray(state.familyDetail.colorZones)
      ? state.familyDetail.colorZones.filter((zone) => zone.allowColor)
      : [];
    if (!zones.length) {
      return '<div class="customizer-empty">呢個模板家族暫時未定義色區。</div>';
    }

    const palette = buildPalette(state);

    return zones.map((zone) => {
      const value = state.design && state.design.colorZones && typeof state.design.colorZones === 'object'
        ? state.design.colorZones[zone.zoneKey] || zone.defaultColor || '#f4f4f5'
        : zone.defaultColor || '#f4f4f5';

      return `
        <div class="customizer-control-card">
          <div class="customizer-control-card__header">
            <div class="customizer-control-card__title">${escapeHtml(zone.zoneName)}</div>
            <div class="customizer-control-card__value">${escapeHtml(value)}</div>
          </div>
          <input
            class="customizer-color-input"
            type="color"
            value="${escapeHtml(value)}"
            data-role="zone-color"
            data-zone-key="${escapeHtml(zone.zoneKey)}"
          >
          <div class="customizer-swatch-row">
            ${palette.map((color) => `
              <button
                type="button"
                class="customizer-swatch${String(color).toLowerCase() === String(value).toLowerCase() ? ' is-selected' : ''}"
                style="--swatch:${escapeHtml(color)}"
                data-role="zone-swatch"
                data-zone-key="${escapeHtml(zone.zoneKey)}"
                data-color="${escapeHtml(color)}"
                aria-label="選擇 ${escapeHtml(color)}"
              ></button>
            `).join('')}
          </div>
        </div>
      `;
    }).join('');
  }

  function renderTextControls(state) {
    const fields = [
      { key: 'teamName', label: '隊名' },
      { key: 'playerName', label: '球員名' },
      { key: 'playerNumber', label: '號碼' },
    ];

    return fields.map((field) => `
      <label class="customizer-field customizer-field--dense">
        <span class="customizer-field__label">${escapeHtml(field.label)}</span>
        <input
          type="text"
          class="customizer-field__control"
          value="${escapeHtml(state.design && state.design.texts ? state.design.texts[field.key] || '' : '')}"
          placeholder="輸入${escapeHtml(field.label)}"
          data-role="text-input"
          data-text-key="${escapeHtml(field.key)}"
        >
      </label>
    `).join('');
  }

  function renderLogoControls(state) {
    const assets = listSelectionAssets(state, ['logo', 'graphic', 'badge']).slice(0, 6);
    const selectedLogoId = state.design && Array.isArray(state.design.logos) && state.design.logos[0]
      ? state.design.logos[0].assetId
      : null;

    if (!assets.length) {
      return '<div class="customizer-empty">未有官方 logo 素材，可之後再接客戶上傳。</div>';
    }

    return `
      <div class="customizer-logo-grid">
        <button type="button" class="customizer-logo-card${selectedLogoId ? '' : ' is-selected'}" data-role="logo-asset" data-asset-id="">
          <span class="customizer-logo-card__badge">NONE</span>
          <span class="customizer-logo-card__name">不使用</span>
        </button>
        ${assets.map((asset) => `
          <button
            type="button"
            class="customizer-logo-card${String(selectedLogoId) === String(asset.id) ? ' is-selected' : ''}"
            data-role="logo-asset"
            data-asset-id="${escapeHtml(asset.id)}"
          >
            <span class="customizer-logo-card__badge">${escapeHtml(String(asset.name || '').slice(0, 3).toUpperCase())}</span>
            <span class="customizer-logo-card__name">${escapeHtml(asset.name)}</span>
          </button>
        `).join('')}
      </div>
    `;
  }

  function renderSummary(state) {
    const productType = state.selectedProductType ? state.selectedProductType.name : '未選擇';
    const family = state.selectedTemplateFamily ? state.selectedTemplateFamily.name : '未選擇';
    const sessionId = state.session && state.session.id ? state.session.id : '未建立';
    const activeSide = state.previews.activeSide || 'front';
    const totalQuantity = state.roster && Number.isFinite(Number(state.roster.totalQuantity))
      ? state.roster.totalQuantity
      : 0;
    const pricingTotal = state.pricing && Number.isFinite(Number(state.pricing.total))
      ? `HK$${Number(state.pricing.total).toFixed(0)}`
      : '待報價';

    return `
      <div class="customizer-summary-card">
        <div><span class="customizer-summary-card__label">Session</span><span class="customizer-summary-card__value">${escapeHtml(sessionId)}</span></div>
        <div><span class="customizer-summary-card__label">品類</span><span class="customizer-summary-card__value">${escapeHtml(productType)}</span></div>
        <div><span class="customizer-summary-card__label">家族</span><span class="customizer-summary-card__value">${escapeHtml(family)}</span></div>
        <div><span class="customizer-summary-card__label">Body</span><span class="customizer-summary-card__value">${escapeHtml(state.design.parts.body || '未選') }</span></div>
        <div><span class="customizer-summary-card__label">Sleeve</span><span class="customizer-summary-card__value">${escapeHtml(state.design.parts.sleeve || '未選')}</span></div>
        <div><span class="customizer-summary-card__label">Collar</span><span class="customizer-summary-card__value">${escapeHtml(state.design.parts.collar || '未選')}</span></div>
        <div><span class="customizer-summary-card__label">預覽面</span><span class="customizer-summary-card__value">${escapeHtml(activeSide)}</span></div>
        <div><span class="customizer-summary-card__label">預計總額</span><span class="customizer-summary-card__value">${escapeHtml(pricingTotal)}</span></div>
        <div><span class="customizer-summary-card__label">總數量</span><span class="customizer-summary-card__value">${escapeHtml(totalQuantity)}</span></div>
      </div>
    `;
  }

  function renderRosterControls(state) {
    const items = state.roster && Array.isArray(state.roster.items) ? state.roster.items : [];

    return `
      <div class="customizer-roster">
        ${items.length ? items.map((item, index) => `
          <div class="customizer-roster__row">
            <input class="customizer-field__control" type="text" placeholder="球員名" value="${escapeHtml(item.playerName || '')}" data-role="roster-input" data-index="${index}" data-field="playerName">
            <input class="customizer-field__control" type="text" placeholder="號碼" value="${escapeHtml(item.playerNumber || '')}" data-role="roster-input" data-index="${index}" data-field="playerNumber">
            <input class="customizer-field__control" type="text" placeholder="尺碼" value="${escapeHtml(item.sizeCode || '')}" data-role="roster-input" data-index="${index}" data-field="sizeCode">
            <input class="customizer-field__control" type="number" min="1" placeholder="數量" value="${escapeHtml(item.quantity || 1)}" data-role="roster-input" data-index="${index}" data-field="quantity">
            <button type="button" class="customizer-action-button is-secondary" data-role="remove-roster-item" data-index="${index}">刪除</button>
          </div>
        `).join('') : '<div class="customizer-empty">未加入球員名單，直接下單前最好先補 roster。</div>'}
        <button type="button" class="customizer-action-button is-secondary" data-role="add-roster-item">加入球員</button>
      </div>
    `;
  }

  function renderSubmitPanel(state) {
    const error = state.submission && state.submission.error ? state.submission.error : '';

    return `
      <div class="customizer-submit-panel">
        <label class="customizer-field customizer-field--dense">
          <span class="customizer-field__label">備註</span>
          <textarea class="customizer-field__control customizer-field__control--textarea" placeholder="交期、特殊要求、印刷位置補充" data-role="design-notes">${escapeHtml(state.design && state.design.notes ? state.design.notes : '')}</textarea>
        </label>
        ${error ? `<div class="customizer-submit-panel__error">${escapeHtml(error)}</div>` : ''}
        <div class="customizer-submit-panel__actions">
          <button type="button" class="customizer-action-button is-primary" data-role="submit-order">直接下單</button>
          <button type="button" class="customizer-action-button is-secondary" data-role="submit-quote">提交報價</button>
        </div>
      </div>
    `;
  }

  function renderPreview(state) {
    const activeSide = state.previews.activeSide || 'front';
    const familyName = state.selectedTemplateFamily ? state.selectedTemplateFamily.name : '未選擇模板家族';
    const productType = state.selectedProductType ? state.selectedProductType.name : '未選擇品類';
    const title = activeSide === 'back' ? '後幅 Preview' : '前幅 Preview';

    return `
      <div class="customizer-preview__toolbar">
        <div class="customizer-preview__status">
          <span class="customizer-preview__status-label">Family</span>
          <span class="customizer-preview__status-value">${escapeHtml(familyName)}</span>
        </div>
        <div class="customizer-preview__toggle-group">
          <button type="button" class="customizer-preview__toggle${activeSide === 'front' ? ' is-active' : ''}" data-side="front">前幅</button>
          <button type="button" class="customizer-preview__toggle${activeSide === 'back' ? ' is-active' : ''}" data-side="back">後幅</button>
        </div>
      </div>
      <div class="customizer-preview__stage">
        <canvas class="customizer-preview__canvas" data-role="preview-canvas" aria-label="${escapeHtml(title)}"></canvas>
        <div class="customizer-preview__overlay">
          <div class="customizer-preview__title">${escapeHtml(title)}</div>
          <div class="customizer-preview__meta">${escapeHtml(productType)} / ${escapeHtml(familyName)}</div>
          <div class="customizer-preview__hint">逐個切換 body / sleeve / collar，就會見到款式結構即時改變。</div>
        </div>
      </div>
    `;
  }

  function createEditorRenderer(root, store, actions) {
    function render(state) {
      root.innerHTML = `
        <aside class="customizer-panel">
          <div class="text-xs font-bold uppercase tracking-[0.18em] text-gold">Build</div>
          <h1 class="mt-2 text-xl font-black text-white">模板玩法編輯器</h1>
          <p class="mt-2 text-sm text-gray-400">先揀模板家族，再逐件換 body、sleeve、collar，玩法會開始接近 fifakitcreator。</p>

          <label class="customizer-field">
            <span class="customizer-field__label">品類</span>
            <select class="customizer-field__control" data-role="product-type-select">
              ${renderProductTypeOptions(state)}
            </select>
          </label>

          <div class="customizer-section">
            <div class="customizer-section__title">Template Family</div>
            <div class="customizer-template-list">
              ${renderFamilyCards(state)}
            </div>
          </div>

          ${PART_TYPES.map((part) => `
            <div class="customizer-section">
              <div class="customizer-section__title">${escapeHtml(part.label)}</div>
              <div class="customizer-section__help">${escapeHtml(part.help)}</div>
              <div class="customizer-template-list customizer-template-list--compact">
                ${renderPartVariantCards(state, part.key)}
              </div>
            </div>
          `).join('')}

          <div class="customizer-section">
            <div class="customizer-section__title">配色區</div>
            <div class="customizer-control-stack">
              ${renderColorZoneControls(state)}
            </div>
          </div>
        </aside>

        <section class="customizer-preview">
          ${renderPreview(state)}
        </section>

        <aside class="customizer-panel">
          <div class="text-xs font-bold uppercase tracking-[0.18em] text-gold">Finalize</div>
          <div class="mt-3 text-sm text-gray-400">呢邊保留文字、logo、roster 同下單／報價流程。</div>
          <div class="mt-4">${renderSummary(state)}</div>

          <div class="customizer-section">
            <div class="customizer-section__title">文字</div>
            <div class="customizer-control-stack">
              ${renderTextControls(state)}
            </div>
          </div>

          <div class="customizer-section">
            <div class="customizer-section__title">Logo</div>
            ${renderLogoControls(state)}
          </div>

          <div class="customizer-section">
            <div class="customizer-section__title">Roster</div>
            ${renderRosterControls(state)}
          </div>

          <div class="customizer-section">
            <div class="customizer-section__title">提交</div>
            ${renderSubmitPanel(state)}
          </div>
        </aside>
      `;

      const productTypeSelect = root.querySelector('[data-role="product-type-select"]');
      if (productTypeSelect) {
        productTypeSelect.addEventListener('change', (event) => {
          actions.selectProductType(event.target.value);
        });
      }

      root.querySelectorAll('[data-role="template-family"]').forEach((button) => {
        button.addEventListener('click', () => {
          actions.selectTemplateFamily(button.getAttribute('data-template-id'));
        });
      });

      root.querySelectorAll('[data-role="part-variant"]').forEach((button) => {
        button.addEventListener('click', () => {
          actions.selectPartVariant(
            button.getAttribute('data-part-type'),
            button.getAttribute('data-part-code')
          );
        });
      });

      root.querySelectorAll('[data-side]').forEach((button) => {
        button.addEventListener('click', () => {
          actions.setPreviewSide(button.getAttribute('data-side'));
        });
      });

      root.querySelectorAll('[data-role="zone-color"]').forEach((input) => {
        input.addEventListener('input', (event) => {
          actions.updateZoneColor(input.getAttribute('data-zone-key'), event.target.value);
        });
      });

      root.querySelectorAll('[data-role="zone-swatch"]').forEach((button) => {
        button.addEventListener('click', () => {
          actions.updateZoneColor(button.getAttribute('data-zone-key'), button.getAttribute('data-color'));
        });
      });

      root.querySelectorAll('[data-role="text-input"]').forEach((input) => {
        input.addEventListener('input', (event) => {
          actions.updateTextField(input.getAttribute('data-text-key'), event.target.value);
        });
      });

      root.querySelectorAll('[data-role="logo-asset"]').forEach((button) => {
        button.addEventListener('click', () => {
          actions.selectLogoAsset(button.getAttribute('data-asset-id'));
        });
      });

      const notesField = root.querySelector('[data-role="design-notes"]');
      if (notesField) {
        notesField.addEventListener('input', (event) => {
          actions.updateNotes(event.target.value);
        });
      }

      root.querySelectorAll('[data-role="roster-input"]').forEach((input) => {
        input.addEventListener('input', (event) => {
          actions.updateRosterItem(
            Number(input.getAttribute('data-index')),
            input.getAttribute('data-field'),
            event.target.value
          );
        });
      });

      root.querySelectorAll('[data-role="remove-roster-item"]').forEach((button) => {
        button.addEventListener('click', () => {
          actions.removeRosterItem(Number(button.getAttribute('data-index')));
        });
      });

      const addRosterButton = root.querySelector('[data-role="add-roster-item"]');
      if (addRosterButton) {
        addRosterButton.addEventListener('click', () => {
          actions.addRosterItem();
        });
      }

      const submitOrderButton = root.querySelector('[data-role="submit-order"]');
      if (submitOrderButton) {
        submitOrderButton.addEventListener('click', () => {
          actions.submitOrder();
        });
      }

      const submitQuoteButton = root.querySelector('[data-role="submit-quote"]');
      if (submitQuoteButton) {
        submitQuoteButton.addEventListener('click', () => {
          actions.submitQuote();
        });
      }
    }

    return { render };
  }

  global.CustomizerEditor = {
    createEditorRenderer,
  };
})(window, document);
