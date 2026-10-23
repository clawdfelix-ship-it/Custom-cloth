const JSZip = require('jszip');
const {
  renderColorMap,
  renderNormalMap,
  renderCoeffMap,
  renderTaaMap,
} = require('./png');

/**
 * Server-side kit export.
 *
 * Produces the same file set the browser exporter writes:
 *
 *   jersey_color.png / jersey_normal.png / jersey_coeff.png / jersey_taa.png
 *   shorts_* / socks_*
 *   settings.json
 *   hotspots.hotspot  (when the session carries hotspots)
 *
 * Rendering happens server-side so a kit can be exported without a browser
 * (for example from a quote email or an admin re-download).
 */

const AREA_SIZES = {
  shirt: 1024,
  shorts: 512,
  socks: 256,
};

const AREA_PREFIX = {
  shirt: 'jersey',
  shorts: 'shorts',
  socks: 'socks',
};

function baseColorForArea(area, zones = {}) {
  if (area === 'shirt') return zones.primary || '#f4f4f5';
  if (area === 'shorts') return zones.shorts || zones.secondary || '#1f2937';
  return zones.socks || zones.trim || '#111827';
}

function buildSettings(design = {}) {
  const zones = design.colorZones || {};
  const settings = {};
  Object.keys(zones).forEach((key) => {
    settings[key] = zones[key];
  });
  settings.jerseyfit = design.jerseyfit !== undefined ? design.jerseyfit : '0';
  settings.shortstyle = design.shortstyle !== undefined ? design.shortstyle : 0;
  settings.jerseynamelayouttype = design.jerseynamelayouttype !== undefined
    ? design.jerseynamelayouttype
    : 0;
  settings.isCreateAClub = Boolean(design.isCreateAClub);
  return settings;
}

function buildHotspots(design = {}) {
  const hotspots = [];

  (design.hotspots || []).forEach((hotspot) => {
    hotspots.push({
      Group: hotspot.Group,
      Name: hotspot.Name,
      Bounds: hotspot.Bounds,
      Rotation: hotspot.Rotation || 0,
    });
  });

  (design.logos || []).forEach((logo) => {
    if (logo.disabled || logo.subtype !== 'team') return;
    const scale = logo.scale || 0.12;
    const position = logo.position || { x: 0.5, y: 0.5 };
    hotspots.push({
      Group: logo.areaName === 'shirt' ? 'jersey' : logo.areaName,
      Name: 'team',
      Bounds: {
        x: position.x - scale / 2,
        y: position.y - scale / 2,
        width: scale,
        height: scale,
      },
      Rotation: logo.rotation || 0,
    });
  });

  return { HotspotFormatVersion: 1, Hotspots: hotspots };
}

/**
 * Build the kit ZIP archive.
 *
 * @param {object} design Session design payload
 * @param {object} options
 * @param {boolean} options.includeHotspots
 * @returns {Promise<{buffer: Buffer, fileName: string, files: string[]}>}
 */
async function buildKitArchive(design = {}, options = {}) {
  const zip = new JSZip();
  const files = [];
  const zones = design.colorZones || {};
  const pattern = zones.pattern || 'none';

  for (const area of Object.keys(AREA_SIZES)) {
    const size = AREA_SIZES[area];
    const prefix = AREA_PREFIX[area];
    const roughness = area === 'socks' ? 0.72 : 0.68;

    const maps = [
      ['color', renderColorMap(size, size, baseColorForArea(area, zones), pattern)],
      ['normal', renderNormalMap(size, size)],
      ['coeff', renderCoeffMap(size, size, roughness)],
      ['taa', renderTaaMap(size, size)],
    ];

    maps.forEach(([suffix, buffer]) => {
      const name = `${prefix}_${suffix}.png`;
      zip.file(name, buffer);
      files.push(name);
    });
  }

  zip.file('settings.json', JSON.stringify(buildSettings(design), null, 3));
  files.push('settings.json');

  if (options.includeHotspots !== false) {
    zip.file('hotspots.hotspot', JSON.stringify(buildHotspots(design), null, 3));
    files.push('hotspots.hotspot');
  }

  const buffer = await zip.generateAsync({ type: 'nodebuffer' });

  return {
    buffer,
    fileName: `${options.fileName || 'custom-kit'}.zip`,
    files,
  };
}

module.exports = {
  buildKitArchive,
  buildSettings,
  buildHotspots,
  AREA_SIZES,
};
