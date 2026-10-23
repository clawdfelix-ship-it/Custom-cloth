(function attachCustomizerCompositor(global) {
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function drawRoundedRect(ctx, x, y, width, height, radius) {
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, width, height, radius);
      return;
    }

    const r = Math.min(radius, width / 2, height / 2);
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
  }

  function getActiveSide(state) {
    return state.previews && state.previews.activeSide === 'back' ? 'back' : 'front';
  }

  function getColor(state, key, fallback) {
    const designColors = state.design && state.design.colorZones && typeof state.design.colorZones === 'object'
      ? state.design.colorZones
      : {};
    return typeof designColors[key] === 'string' && designColors[key]
      ? designColors[key]
      : fallback;
  }

  function findVariant(state, partType) {
    if (!global.CustomizerCatalog || typeof global.CustomizerCatalog.findPartVariant !== 'function') return null;
    const detail = state.familyDetail || {};
    const code = state.design && state.design.parts ? state.design.parts[partType] : null;
    return global.CustomizerCatalog.findPartVariant(detail, partType, code);
  }

  function drawBaseSilhouette(ctx, geometry) {
    const { x, y, torsoWidth, torsoHeight, sleeveWidth, sleeveHeight } = geometry;

    ctx.beginPath();
    ctx.moveTo(x + sleeveWidth, y + 8);
    ctx.lineTo(x + torsoWidth - sleeveWidth, y + 8);
    ctx.lineTo(x + torsoWidth + sleeveWidth * 0.9, y + sleeveHeight);
    ctx.lineTo(x + torsoWidth - 18, y + sleeveHeight + 22);
    ctx.lineTo(x + torsoWidth - 18, y + torsoHeight);
    ctx.lineTo(x + 18, y + torsoHeight);
    ctx.lineTo(x + 18, y + sleeveHeight + 22);
    ctx.lineTo(x - sleeveWidth * 0.9, y + sleeveHeight);
    ctx.closePath();
  }

  function drawBodyPattern(ctx, geometry, renderKey, colors, side) {
    const { x, y, torsoWidth, torsoHeight } = geometry;
    ctx.save();

    ctx.fillStyle = colors.primary;
    ctx.beginPath();
    drawRoundedRect(ctx, x + 18, y + 36, torsoWidth - 36, torsoHeight - 38, 22);
    ctx.fill();

    ctx.fillStyle = colors.secondary;
    if (renderKey === 'chevron') {
      ctx.beginPath();
      ctx.moveTo(x + torsoWidth * 0.28, y + 76);
      ctx.lineTo(x + torsoWidth * 0.5, y + 146);
      ctx.lineTo(x + torsoWidth * 0.72, y + 76);
      ctx.lineTo(x + torsoWidth * 0.84, y + 110);
      ctx.lineTo(x + torsoWidth * 0.5, y + 212);
      ctx.lineTo(x + torsoWidth * 0.16, y + 110);
      ctx.closePath();
      ctx.fill();
    } else if (renderKey === 'split-stripe' || renderKey === 'center-stripe') {
      ctx.beginPath();
      drawRoundedRect(ctx, x + torsoWidth * 0.4, y + 40, torsoWidth * 0.2, torsoHeight - 50, 12);
      ctx.fill();
    } else if (renderKey === 'half-block') {
      ctx.beginPath();
      drawRoundedRect(ctx, x + 18, y + 36, (torsoWidth - 36) / 2, torsoHeight - 38, 22);
      ctx.fill();
    } else if (renderKey === 'court-panel') {
      ctx.beginPath();
      ctx.moveTo(x + torsoWidth * 0.3, y + 36);
      ctx.lineTo(x + torsoWidth * 0.7, y + 36);
      ctx.lineTo(x + torsoWidth * 0.82, y + torsoHeight - 12);
      ctx.lineTo(x + torsoWidth * 0.18, y + torsoHeight - 12);
      ctx.closePath();
      ctx.fill();
    } else if (renderKey === 'fade-band' || renderKey === 'chest-band') {
      ctx.beginPath();
      drawRoundedRect(ctx, x + 30, y + 82, torsoWidth - 60, 52, 18);
      ctx.fill();
    } else if (renderKey === 'club-panel' || renderKey === 'heritage-block') {
      ctx.beginPath();
      drawRoundedRect(ctx, x + 30, y + 42, torsoWidth - 60, 74, 18);
      ctx.fill();
    }

    ctx.fillStyle = colors.trim;
    if (renderKey === 'solid-panel') {
      ctx.beginPath();
      drawRoundedRect(ctx, x + torsoWidth * 0.28, y + 82, torsoWidth * 0.44, 130, 18);
      ctx.fill();
    } else {
      ctx.beginPath();
      drawRoundedRect(ctx, x + torsoWidth * 0.22, y + torsoHeight - 72, torsoWidth * 0.56, 24, 10);
      ctx.fill();
    }

    if (side === 'back') {
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.beginPath();
      ctx.moveTo(x + torsoWidth * 0.5, y + 44);
      ctx.lineTo(x + torsoWidth * 0.5, y + torsoHeight - 18);
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawSleeves(ctx, geometry, renderKey, colors) {
    const { x, y, torsoWidth, sleeveWidth, sleeveHeight } = geometry;
    ctx.save();
    ctx.fillStyle = colors.primary;

    ctx.beginPath();
    drawRoundedRect(ctx, x - sleeveWidth * 0.88, y + 38, sleeveWidth + 24, sleeveHeight + 22, 18);
    ctx.fill();
    ctx.beginPath();
    drawRoundedRect(ctx, x + torsoWidth - 24, y + 38, sleeveWidth + 24, sleeveHeight + 22, 18);
    ctx.fill();

    ctx.fillStyle = colors.secondary;
    if (renderKey === 'double-band' || renderKey === 'contrast-cuff' || renderKey === 'armhole-trim') {
      ctx.beginPath();
      drawRoundedRect(ctx, x - sleeveWidth * 0.82, y + sleeveHeight + 22, sleeveWidth + 12, 18, 8);
      ctx.fill();
      ctx.beginPath();
      drawRoundedRect(ctx, x + torsoWidth - 12, y + sleeveHeight + 22, sleeveWidth + 12, 18, 8);
      ctx.fill();
    } else if (renderKey === 'raglan-flow') {
      ctx.beginPath();
      ctx.moveTo(x + 26, y + 36);
      ctx.lineTo(x + torsoWidth * 0.38, y + 36);
      ctx.lineTo(x + torsoWidth * 0.18, y + sleeveHeight + 42);
      ctx.lineTo(x - sleeveWidth * 0.78, y + sleeveHeight + 18);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(x + torsoWidth - 26, y + 36);
      ctx.lineTo(x + torsoWidth * 0.62, y + 36);
      ctx.lineTo(x + torsoWidth * 0.82, y + sleeveHeight + 42);
      ctx.lineTo(x + torsoWidth + sleeveWidth * 0.78, y + sleeveHeight + 18);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  function drawCollar(ctx, geometry, renderKey, colors, productTypeName) {
    const { x, y, torsoWidth } = geometry;
    const isPolo = String(productTypeName || '').toLowerCase().includes('polo');
    ctx.save();

    ctx.fillStyle = colors.trim;
    if (renderKey === 'v-neck' || renderKey === 'v-bind' || renderKey === 'piped-v') {
      ctx.beginPath();
      ctx.moveTo(x + torsoWidth * 0.38, y + 22);
      ctx.lineTo(x + torsoWidth * 0.5, y + 58);
      ctx.lineTo(x + torsoWidth * 0.62, y + 22);
      ctx.lineTo(x + torsoWidth * 0.68, y + 24);
      ctx.lineTo(x + torsoWidth * 0.5, y + 74);
      ctx.lineTo(x + torsoWidth * 0.32, y + 24);
      ctx.closePath();
      ctx.fill();
    } else if (renderKey === 'polo-classic' || renderKey === 'polo-contrast' || renderKey === 'zip-polo' || isPolo) {
      ctx.beginPath();
      ctx.moveTo(x + torsoWidth * 0.35, y + 18);
      ctx.lineTo(x + torsoWidth * 0.5, y + 44);
      ctx.lineTo(x + torsoWidth * 0.65, y + 18);
      ctx.lineTo(x + torsoWidth * 0.7, y + 54);
      ctx.lineTo(x + torsoWidth * 0.56, y + 34);
      ctx.lineTo(x + torsoWidth * 0.5, y + 64);
      ctx.lineTo(x + torsoWidth * 0.44, y + 34);
      ctx.lineTo(x + torsoWidth * 0.3, y + 54);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.beginPath();
      drawRoundedRect(ctx, x + torsoWidth * 0.34, y + 18, torsoWidth * 0.32, 24, 12);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawLogoBadge(ctx, state, geometry) {
    const logo = state.design && Array.isArray(state.design.logos) ? state.design.logos[0] : null;
    if (!logo) return;

    const { x, y, torsoWidth } = geometry;
    const label = String(logo.name || logo.slug || 'LOG').slice(0, 3).toUpperCase();
    ctx.save();
    ctx.fillStyle = 'rgba(17, 24, 39, 0.95)';
    ctx.beginPath();
    ctx.arc(x + torsoWidth * 0.31, y + 132, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.85)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#fafafa';
    ctx.font = '800 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, x + torsoWidth * 0.31, y + 136);
    ctx.restore();
  }

  function drawTextLayer(ctx, state, geometry, side) {
    const { x, y, torsoWidth, torsoHeight } = geometry;
    const texts = state.design && state.design.texts && typeof state.design.texts === 'object'
      ? state.design.texts
      : {};

    ctx.save();
    ctx.textAlign = 'center';

    if (side === 'back') {
      if (texts.playerName) {
        ctx.fillStyle = '#fafafa';
        ctx.font = '700 16px sans-serif';
        ctx.fillText(String(texts.playerName).slice(0, 18).toUpperCase(), x + torsoWidth / 2, y + 124);
      }
      if (texts.playerNumber) {
        ctx.fillStyle = '#0f172a';
        ctx.font = '900 74px sans-serif';
        ctx.fillText(String(texts.playerNumber).slice(0, 3), x + torsoWidth / 2, y + torsoHeight * 0.72);
      }
    } else if (texts.teamName) {
      ctx.fillStyle = '#fafafa';
      ctx.font = '800 22px sans-serif';
      ctx.fillText(String(texts.teamName).slice(0, 18).toUpperCase(), x + torsoWidth / 2, y + 164);
    }

    ctx.restore();
  }

  function drawJersey(ctx, state, width, height) {
    const side = getActiveSide(state);
    const bodyVariant = findVariant(state, 'body');
    const sleeveVariant = findVariant(state, 'sleeve');
    const collarVariant = findVariant(state, 'collar');
    const productTypeName = state.selectedProductType ? state.selectedProductType.name : 'Teamwear';
    const familyName = state.selectedTemplateFamily ? state.selectedTemplateFamily.name : 'Template Family';
    const geometry = {
      torsoWidth: clamp(width * 0.28, 200, 320),
      torsoHeight: clamp(height * 0.5, 280, 380),
      sleeveWidth: clamp(width * 0.08, 54, 86),
      sleeveHeight: clamp(height * 0.13, 72, 96),
    };

    geometry.x = (width - geometry.torsoWidth) / 2;
    geometry.y = (height - geometry.torsoHeight) / 2 + 12;

    const colors = {
      primary: getColor(state, 'primary', '#f4f4f5'),
      secondary: getColor(state, 'secondary', '#7f1d45'),
      trim: getColor(state, 'trim', '#fbbf24'),
    };

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.28)';
    ctx.shadowBlur = 28;
    ctx.fillStyle = '#0f172a';
    drawBaseSilhouette(ctx, geometry);
    ctx.fill();
    ctx.shadowBlur = 0;

    drawBodyPattern(ctx, geometry, bodyVariant && bodyVariant.renderKey ? bodyVariant.renderKey : 'solid-panel', colors, side);
    drawSleeves(ctx, geometry, sleeveVariant && sleeveVariant.renderKey ? sleeveVariant.renderKey : 'set-in', colors);
    drawCollar(ctx, geometry, collarVariant && collarVariant.renderKey ? collarVariant.renderKey : 'round', colors, productTypeName);

    ctx.strokeStyle = 'rgba(15, 23, 42, 0.26)';
    ctx.lineWidth = 3;
    drawBaseSilhouette(ctx, geometry);
    ctx.stroke();

    ctx.fillStyle = '#fafafa';
    ctx.font = '800 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(side === 'back' ? 'BACK VIEW' : 'FRONT VIEW', width / 2, geometry.y + 12);

    ctx.fillStyle = '#fafafa';
    ctx.font = '800 18px sans-serif';
    ctx.fillText(String(productTypeName).toUpperCase().slice(0, 20), width / 2, geometry.y + geometry.torsoHeight + 46);

    ctx.fillStyle = '#d4d4d8';
    ctx.font = '600 13px sans-serif';
    ctx.fillText(String(familyName).slice(0, 28), width / 2, geometry.y + geometry.torsoHeight + 70);

    drawLogoBadge(ctx, state, geometry);
    drawTextLayer(ctx, state, geometry, side);
    ctx.restore();
  }

  function drawMetaCards(ctx, state, width, height) {
    const labels = [
      `BODY: ${state.design && state.design.parts ? state.design.parts.body || 'n/a' : 'n/a'}`,
      `SLEEVE: ${state.design && state.design.parts ? state.design.parts.sleeve || 'n/a' : 'n/a'}`,
      `COLLAR: ${state.design && state.design.parts ? state.design.parts.collar || 'n/a' : 'n/a'}`,
    ];

    ctx.save();
    ctx.font = '600 11px sans-serif';
    ctx.textBaseline = 'middle';

    labels.forEach((label, index) => {
      const x = 24;
      const y = height - 40 - (index * 34);
      ctx.fillStyle = 'rgba(15, 13, 22, 0.72)';
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.24)';
      ctx.beginPath();
      drawRoundedRect(ctx, x, y, 168, 26, 10);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fafafa';
      ctx.fillText(label.slice(0, 28), x + 12, y + 13);
    });

    ctx.restore();
  }

  function paintCanvas(canvas, state) {
    if (!canvas || typeof canvas.getContext !== 'function') return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bounds = typeof canvas.getBoundingClientRect === 'function'
      ? canvas.getBoundingClientRect()
      : { width: 720, height: 520 };
    const width = Math.max(420, Math.round(bounds.width || 720));
    const height = Math.max(460, Math.round(bounds.height || 560));
    const pixelRatio = typeof global.devicePixelRatio === 'number' ? global.devicePixelRatio : 1;

    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#20182a');
    gradient.addColorStop(1, '#100d17');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = 'rgba(251, 191, 36, 0.05)';
    ctx.beginPath();
    ctx.arc(width * 0.22, height * 0.24, 140, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(127, 29, 69, 0.12)';
    ctx.beginPath();
    ctx.arc(width * 0.78, height * 0.3, 180, 0, Math.PI * 2);
    ctx.fill();

    drawJersey(ctx, state || {}, width, height);
    drawMetaCards(ctx, state || {}, width, height);
  }

  function createPreviewCompositor(root) {
    return {
      render(state) {
        if (!root || typeof root.querySelector !== 'function') return;
        const canvas = root.querySelector('[data-role="preview-canvas"]');
        paintCanvas(canvas, state || {});
      },
    };
  }

  global.CustomizerCompositor = {
    createPreviewCompositor,
  };
})(window);
