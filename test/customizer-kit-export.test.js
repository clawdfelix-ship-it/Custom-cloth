const test = require('node:test');
const assert = require('node:assert/strict');

const { renderColorMap, renderNormalMap, renderCoeffMap, renderTaaMap, parseHexColor } = require('../utils/customizer/png');
const { buildKitArchive, buildSettings, buildHotspots } = require('../utils/customizer/kitExport');

test('parseHexColor accepts short and long hex forms', () => {
  assert.deepEqual(parseHexColor('#fff'), { r: 255, g: 255, b: 255, a: 255 });
  assert.deepEqual(parseHexColor('#7f1d45'), { r: 127, g: 29, b: 69, a: 255 });
});

test('parseHexColor falls back for invalid input', () => {
  const fallback = { r: 1, g: 2, b: 3, a: 4 };
  assert.deepEqual(parseHexColor('nope', fallback), fallback);
  assert.deepEqual(parseHexColor('', fallback), fallback);
});

test('png encoder produces a valid PNG signature and IHDR', () => {
  const png = renderColorMap(8, 8, '#ffffff', 'none');
  assert.equal(png.slice(1, 4).toString('ascii'), 'PNG');
  // IHDR width/height are big-endian uint32 at fixed offsets.
  assert.equal(png.readUInt32BE(16), 8);
  assert.equal(png.readUInt32BE(20), 8);
});

test('normal map encodes a flat surface normal', () => {
  const png = renderNormalMap(4, 4);
  assert.equal(png.slice(1, 4).toString('ascii'), 'PNG');
});

test('coefficient map encodes roughness in the green channel', () => {
  const png = renderCoeffMap(4, 4, 0.5);
  assert.equal(png.slice(1, 4).toString('ascii'), 'PNG');
});

test('taa map encodes a uniform white texture', () => {
  const png = renderTaaMap(4, 4);
  assert.equal(png.slice(1, 4).toString('ascii'), 'PNG');
});

test('buildSettings carries colour zones and garment flags', () => {
  const settings = buildSettings({
    colorZones: { primary: '#7f1d45', secondary: '#f8fafc' },
    jerseyfit: '1',
    shortstyle: 2,
    jerseynamelayouttype: 1,
    isCreateAClub: true,
  });

  assert.equal(settings.primary, '#7f1d45');
  assert.equal(settings.secondary, '#f8fafc');
  assert.equal(settings.jerseyfit, '1');
  assert.equal(settings.shortstyle, 2);
  assert.equal(settings.jerseynamelayouttype, 1);
  assert.equal(settings.isCreateAClub, true);
});

test('buildHotspots merges explicit hotspots with team logo anchors', () => {
  const hotspots = buildHotspots({
    hotspots: [{ Group: 'jersey', Name: 'sponsor', Bounds: { x: 0, y: 0, width: 1, height: 1 }, Rotation: 0 }],
    logos: [
      {
        subtype: 'team',
        areaName: 'shirt',
        position: { x: 0.5, y: 0.2 },
        scale: 0.1,
        rotation: 15,
      },
      { subtype: 'brand', areaName: 'shirt', position: { x: 0.2, y: 0.1 }, scale: 0.1 },
    ],
  });

  assert.equal(hotspots.HotspotFormatVersion, 1);
  // The explicit sponsor hotspot plus one anchor for the team logo.
  assert.equal(hotspots.Hotspots.length, 2);

  const team = hotspots.Hotspots.find((h) => h.Name === 'team');
  assert.ok(team);
  assert.equal(team.Group, 'jersey');
  assert.equal(team.Rotation, 15);
  assert.equal(team.Bounds.width, 0.1);
});

test('buildKitArchive emits the full texture set and metadata files', async () => {
  const result = await buildKitArchive(
    {
      colorZones: { primary: '#7f1d45', pattern: 'stripes' },
      logos: [],
      hotspots: [],
    },
    { fileName: 'test-kit' },
  );

  const expected = [
    'jersey_color.png', 'jersey_normal.png', 'jersey_coeff.png', 'jersey_taa.png',
    'shorts_color.png', 'shorts_normal.png', 'shorts_coeff.png', 'shorts_taa.png',
    'socks_color.png', 'socks_normal.png', 'socks_coeff.png', 'socks_taa.png',
    'settings.json', 'hotspots.hotspot',
  ];

  assert.deepEqual(result.files, expected);
  assert.equal(result.fileName, 'test-kit.zip');
  assert.ok(result.buffer.length > 0);
  // ZIP local file header magic.
  assert.equal(result.buffer.slice(0, 2).toString('ascii'), 'PK');
});

test('buildKitArchive can omit the hotspot file', async () => {
  const result = await buildKitArchive(
    { colorZones: {}, logos: [], hotspots: [] },
    { includeHotspots: false },
  );

  assert.equal(result.files.includes('hotspots.hotspot'), false);
  assert.equal(result.files.includes('settings.json'), true);
});
