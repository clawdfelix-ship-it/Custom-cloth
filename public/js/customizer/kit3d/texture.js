(function attachKitTexture(global) {
  /**
   * Layered texture renderer.
   *
   * Produces the flat maps that make up an exported kit:
   *
   *   <area>_color.png    base colour, patterns and logos
   *   <area>_normal.png   normal map
   *   <area>_coeff.png    material coefficients (AO / roughness / metalness)
   *   <area>_taa.png      texture-attenuation approximation
   *
   * Logos stay on the base map unless `renderedSeparately` is set, in which
   * case they get their own `brand_*` / `crest_*` texture set.
   */

  var EXPORT_SIZE = {
    shirt: 1024,
    shorts: 512,
    socks: 256
  };

  function createCanvas(width, height) {
    var canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  function baseColorForArea(area, design) {
    var zones = (design && design.colorZones) || {};
    if (area === 'shirt') return zones.primary || '#f4f4f5';
    if (area === 'shorts') return zones.shorts || zones.secondary || '#1f2937';
    return zones.socks || zones.trim || '#111827';
  }

  function lighten(hex, amount) {
    var clean = String(hex || '').replace('#', '');
    if (clean.length !== 6) return hex;
    var num = parseInt(clean, 16);
    var r = Math.min(255, ((num >> 16) & 0xff) + Math.round(255 * amount));
    var g = Math.min(255, ((num >> 8) & 0xff) + Math.round(255 * amount));
    var b = Math.min(255, (num & 0xff) + Math.round(255 * amount));
    return '#' + (((r << 16) | (g << 8) | b).toString(16).padStart(6, '0'));
  }

  function paintPattern(ctx, pattern, baseColor, size) {
    if (!pattern || pattern === 'none') return;
    var secondary = lighten(baseColor, 0.35);

    ctx.save();
    ctx.fillStyle = secondary;

    if (pattern === 'stripes') {
      var stripe = size / 12;
      for (var x = 0; x < size; x += stripe * 2) ctx.fillRect(x, 0, stripe, size);
    } else if (pattern === 'hoops') {
      var hoop = size / 14;
      for (var y = 0; y < size; y += hoop * 2) ctx.fillRect(y ? 0 : 0, y, size, hoop);
    } else if (pattern === 'halves') {
      ctx.fillRect(0, 0, size / 2, size);
    } else if (pattern === 'sash') {
      ctx.translate(size / 2, size / 2);
      ctx.rotate(-Math.PI / 5);
      ctx.fillRect(-size, -size * 0.09, size * 2, size * 0.18);
    } else if (pattern === 'checks') {
      var cell = size / 10;
      for (var cy = 0; cy < size; cy += cell) {
        for (var cx = 0; cx < size; cx += cell) {
          if ((Math.floor(cx / cell) % 2) === (Math.floor(cy / cell) % 2)) {
            ctx.fillRect(cx, cy, cell, cell);
          }
        }
      }
    } else if (pattern === 'gradient') {
      var gradient = ctx.createLinearGradient(0, size, 0, 0);
      gradient.addColorStop(0, baseColor);
      gradient.addColorStop(1, lighten(baseColor, 0.5));
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
    }
    ctx.restore();
  }

  function drawRoundRect(ctx, x, y, width, height, radius) {
    var r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  var imageCache = {};

  function getImage(src) {
    if (!src) return null;
    if (imageCache[src]) {
      return imageCache[src].complete && imageCache[src].naturalWidth > 0
        ? imageCache[src]
        : null;
    }
    var image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = src;
    imageCache[src] = image;
    return null;
  }

  function paintLogo(ctx, logo, size) {
    if (!logo) return;

    var width = (logo.scale || 0.12) * size;
    var height = width;
    var x = (logo.position && logo.position.x ? logo.position.x : 0.5) * size;
    // Texture V runs bottom-up while logo positions are stored top-down.
    var y = (1 - (logo.position && logo.position.y ? logo.position.y : 0.5)) * size;

    ctx.save();
    ctx.globalAlpha = typeof logo.opacity === 'number' ? logo.opacity : 1;
    ctx.translate(x, y);
    ctx.rotate(-((logo.rotation || 0) * Math.PI) / 180);

    if (logo.src) {
      var image = getImage(logo.src);
      if (image) {
        ctx.drawImage(image, -width / 2, -height / 2, width, height);
      }
    } else {
      var radius = Math.min(width, height) * 0.18;
      ctx.fillStyle = logo.tint || '#ffffff';
      drawRoundRect(ctx, -width / 2, -height / 2, width, height, radius);
      ctx.fill();
      ctx.fillStyle = '#111111';
      ctx.font = '600 ' + Math.round(height * 0.3) + 'px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(logo.name || '').slice(0, 6), 0, 0);
    }
    ctx.restore();
  }

  function logosForArea(design, area) {
    var logos = (design && design.logos) || [];
    return logos.filter(function (logo) {
      if (logo.disabled) return false;
      if (logo.renderedSeparately) return false;
      return (logo.areaName || 'shirt') === area;
    });
  }

  /**
   * Render one garment area into its four texture maps.
   */
  function renderArea(area, design, options) {
    var opts = options || {};
    var size = EXPORT_SIZE[area] || 512;

    var color = createCanvas(size, size);
    var normal = createCanvas(size, size);
    var coeff = createCanvas(size, size);
    var taa = createCanvas(size, size);

    var colorCtx = color.getContext('2d');
    var normalCtx = normal.getContext('2d');
    var coeffCtx = coeff.getContext('2d');
    var taaCtx = taa.getContext('2d');

    var baseColor = baseColorForArea(area, design);
    colorCtx.fillStyle = baseColor;
    colorCtx.fillRect(0, 0, size, size);

    var zones = (design && design.colorZones) || {};
    var pattern = zones.pattern || 'none';
    paintPattern(colorCtx, pattern, baseColor, size);

    if (!opts.excludeLogos) {
      var filter = opts.logoFilter || function () { return true; };
      logosForArea(design, area).forEach(function (logo) {
        if (filter(logo)) paintLogo(colorCtx, logo, size);
      });
    }

    // A flat normal map is the valid default; seam hints come from geometry.
    normalCtx.fillStyle = 'rgb(128, 128, 255)';
    normalCtx.fillRect(0, 0, size, size);

    // R = ambient occlusion, G = roughness, B = metalness.
    var roughness = area === 'socks' ? 0.72 : 0.68;
    coeffCtx.fillStyle = 'rgb(255, ' + Math.round(roughness * 255) + ', 0)';
    coeffCtx.fillRect(0, 0, size, size);

    taaCtx.fillStyle = 'rgb(255, 255, 255)';
    taaCtx.fillRect(0, 0, size, size);

    return { color: color, normal: normal, coeff: coeff, taa: taa };
  }

  /**
   * Render separately-rendered logos into their own texture set.
   */
  function renderSeparateLogos(design, groups) {
    var result = {};

    (groups || []).forEach(function (group) {
      var size = EXPORT_SIZE.shirt;
      var color = createCanvas(size, size);
      var normal = createCanvas(size, size);
      var coeff = createCanvas(size, size);
      var taa = createCanvas(size, size);

      var colorCtx = color.getContext('2d');
      colorCtx.clearRect(0, 0, size, size);

      ((design && design.logos) || []).forEach(function (logo) {
        if (logo.renderedSeparately && !logo.disabled && group.filter(logo)) {
          paintLogo(colorCtx, logo, size);
        }
      });

      normal.getContext('2d').fillStyle = 'rgb(128, 128, 255)';
      normal.getContext('2d').fillRect(0, 0, size, size);

      var c = coeff.getContext('2d');
      c.fillStyle = 'rgb(255, 174, 0)';
      c.fillRect(0, 0, size, size);

      var t = taa.getContext('2d');
      t.fillStyle = 'rgb(255, 255, 255)';
      t.fillRect(0, 0, size, size);

      result[group.name] = { color: color, normal: normal, coeff: coeff, taa: taa };
    });

    return result;
  }

  global.CustomizerKitTexture = {
    EXPORT_SIZE: EXPORT_SIZE,
    createCanvas: createCanvas,
    renderArea: renderArea,
    renderSeparateLogos: renderSeparateLogos,
    paintLogo: paintLogo
  };
})(window);
