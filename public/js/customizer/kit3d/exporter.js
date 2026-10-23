(function attachKitExporter(global) {
  /**
   * Kit export.
   *
   * Produces a ZIP archive with the file set the kit texture pipeline
   * consumes: colour, normal, coefficient and TAA maps for each garment
   * area, plus `settings.json` and (for members with the entitlement)
   * `hotspots.hotspot`.
   */

  function canvasToDataUrl(canvas) {
    return canvas.toDataURL('image/png');
  }

  function dataUrlToBlob(dataUrl) {
    var parts = dataUrl.split(',');
    var mime = (parts[0].match(/data:(.*?);/) || [])[1] || 'image/png';
    var binary = atob(parts[1]);
    var buffer = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) buffer[i] = binary.charCodeAt(i);
    return new Blob([buffer], { type: mime });
  }

  function buildSettings(design) {
    var zones = (design && design.colorZones) || {};
    var settings = {};
    Object.keys(zones).forEach(function (key) { settings[key] = zones[key]; });
    settings.jerseyfit = design && design.jerseyfit !== undefined ? design.jerseyfit : '0';
    settings.shortstyle = design && design.shortstyle !== undefined ? design.shortstyle : 0;
    settings.jerseynamelayouttype = design && design.jerseynamelayouttype !== undefined
      ? design.jerseynamelayouttype
      : 0;
    settings.isCreateAClub = !!(design && design.isCreateAClub);
    return settings;
  }

  function buildHotspots(design) {
    var hotspots = [];
    ((design && design.hotspots) || []).forEach(function (hotspot) {
      hotspots.push({
        Group: hotspot.Group,
        Name: hotspot.Name,
        Bounds: hotspot.Bounds,
        Rotation: hotspot.Rotation || 0
      });
    });

    ((design && design.logos) || []).forEach(function (logo) {
      if (logo.disabled || logo.subtype !== 'team') return;
      var scale = logo.scale || 0.12;
      hotspots.push({
        Group: logo.areaName === 'shirt' ? 'jersey' : logo.areaName,
        Name: 'team',
        Bounds: {
          x: (logo.position ? logo.position.x : 0.5) - scale / 2,
          y: (logo.position ? logo.position.y : 0.5) - scale / 2,
          width: scale,
          height: scale
        },
        Rotation: logo.rotation || 0
      });
    });

    return { HotspotFormatVersion: 1, Hotspots: hotspots };
  }

  function texturesHaveContent(canvas) {
    var ctx = canvas.getContext('2d');
    if (!ctx) return false;
    var data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    for (var i = 3; i < data.length; i += 4) {
      if (data[i] > 0) return true;
    }
    return false;
  }

  /**
   * Build the ZIP archive.
   *
   * @param {object} options
   * @param {object} options.design         Current design session payload
   * @param {boolean} options.includeHotspots
   * @param {boolean} options.renderLogosSeparately
   * @param {string} options.fileName
   * @returns {Promise<{blob: Blob, fileName: string, files: string[]}>}
   */
  function buildZip(options) {
    var opts = options || {};
    var design = opts.design || {};
    var JSZipCtor = global.JSZip;

    if (!JSZipCtor) {
      return Promise.reject(new Error('JSZip is not loaded'));
    }

    var zip = new JSZipCtor();
    var files = [];

    function addCanvas(name, canvas) {
      zip.file(name, canvasToDataUrl(canvas), { binary: true });
      files.push(name);
    }

    var areas = [
      { area: 'shirt', prefix: 'jersey' },
      { area: 'shorts', prefix: 'shorts' },
      { area: 'socks', prefix: 'socks' }
    ];

    areas.forEach(function (entry) {
      var textures = global.CustomizerKitTexture.renderArea(entry.area, design);
      addCanvas(entry.prefix + '_color.png', textures.color);
      addCanvas(entry.prefix + '_normal.png', textures.normal);
      addCanvas(entry.prefix + '_coeff.png', textures.coeff);
      addCanvas(entry.prefix + '_taa.png', textures.taa);
    });

    if (opts.renderLogosSeparately) {
      var groups = [
        {
          name: 'brand_jersey',
          filter: function (logo) { return logo.subtype === 'brand' && logo.areaName !== 'shorts'; }
        },
        {
          name: 'brand_shorts',
          filter: function (logo) { return logo.subtype === 'brand' && logo.areaName === 'shorts'; }
        },
        {
          name: 'crest',
          filter: function (logo) { return logo.subtype === 'team' && logo.areaName !== 'shorts'; }
        },
        {
          name: 'crest_shorts',
          filter: function (logo) { return logo.subtype === 'team' && logo.areaName === 'shorts'; }
        }
      ];

      var separate = global.CustomizerKitTexture.renderSeparateLogos(design, groups);
      Object.keys(separate).forEach(function (name) {
        var textures = separate[name];
        if (!texturesHaveContent(textures.color)) return;
        addCanvas(name + '_color.png', textures.color);
        addCanvas(name + '_normal.png', textures.normal);
        addCanvas(name + '_coeff.png', textures.coeff);
      });
    }

    zip.file('settings.json', JSON.stringify(buildSettings(design), null, 3), { binary: true });
    files.push('settings.json');

    if (opts.includeHotspots) {
      zip.file('hotspots.hotspot', JSON.stringify(buildHotspots(design), null, 3), { binary: true });
      files.push('hotspots.hotspot');
    }

    return zip.generateAsync({ type: 'blob' }).then(function (blob) {
      return {
        blob: blob,
        fileName: (opts.fileName || 'kit') + '.zip',
        files: files
      };
    });
  }

  function downloadBlob(blob, fileName) {
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    // Revoke on the next tick so Safari has time to start the download.
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  global.CustomizerKitExporter = {
    buildZip: buildZip,
    downloadBlob: downloadBlob,
    buildSettings: buildSettings,
    buildHotspots: buildHotspots,
    dataUrlToBlob: dataUrlToBlob
  };
})(window);
