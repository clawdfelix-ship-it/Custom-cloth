const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { normalizeTemplateZone, validateRosterItems } = require('../utils/customizer/validation');
const { buildDesignSession } = require('../models/customizer/sessions');

test('customizer migration defines core session and registry tables', () => {
  const migrationPath = path.join(__dirname, '..', 'migrations', '20261015_customizer_phase1.sql');
  assert.ok(fs.existsSync(migrationPath));
  const sql = fs.readFileSync(migrationPath, 'utf8');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS\s+customizer_product_types/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS\s+customizer_templates/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS\s+customizer_sessions/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS\s+customizer_session_designs/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS\s+customizer_rosters/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS\s+customizer_pricing_rules/i);
});

test('buildDesignSession returns family-driven session shape', () => {
  const session = buildDesignSession({
    selection: { productTypeId: 1, templateId: 2 },
    design: {
      parts: { body: 'speed-chevron', sleeve: 'double-band', collar: 'v-neck' },
      colorZones: { primary: '#ffffff', secondary: '#7f1d45', trim: '#fbbf24' },
      texts: { teamName: 'Rovers' },
    },
    roster: { items: [] },
  });

  assert.equal(session.status, 'draft');
  assert.equal(session.selection.productTypeId, 1);
  assert.equal(session.selection.templateId, 2);
  assert.equal(session.design.parts.body, 'speed-chevron');
  assert.equal(session.design.colorZones.primary, '#ffffff');
  assert.equal(session.design.texts.teamName, 'Rovers');
  assert.deepEqual(session.uploadedAssets, []);
});

test('normalizeTemplateZone fills defaults and maps snake_case fields', () => {
  const zone = normalizeTemplateZone({
    zone_key: 'front-body',
    zone_name: 'Front Body',
    sort_order: 4,
    allow_logo: true,
  });

  assert.equal(zone.zoneKey, 'front-body');
  assert.equal(zone.zoneName, 'Front Body');
  assert.equal(zone.sortOrder, 4);
  assert.equal(zone.allowColor, true);
  assert.equal(zone.allowLogo, true);
});

test('validateRosterItems normalizes valid rows and reports total quantity', () => {
  const result = validateRosterItems([
    { player_name: 'Chan', player_number: '7', size_code: 'm' },
    { playerName: 'Lee', playerNumber: '10', sizeCode: 'L', quantity: 2 },
  ]);

  assert.equal(result.valid, true);
  assert.equal(result.normalizedItems[0].sizeCode, 'M');
  assert.equal(result.totalQuantity, 3);
});
