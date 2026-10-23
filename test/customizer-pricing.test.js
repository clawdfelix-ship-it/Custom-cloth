const test = require('node:test');
const assert = require('node:assert/strict');

const { calculateCustomizerPricing } = require('../models/customizer/pricing');

test('calculateCustomizerPricing applies base unit, quantity tier, and extras', () => {
  const pricing = calculateCustomizerPricing({
    quantity: 12,
    textValues: { playerName: 'CHAN', playerNumber: '7' },
    rosterItems: [{}, {}],
    logoCount: 1,
    rules: [
      { rule_type: 'base_unit', pricing_json: { baseUnitPrice: 120, directOrderMaxQuantity: 30, templateAllowsDirectOrder: true } },
      { rule_type: 'quantity_tier', pricing_json: { quantityTiers: [{ min: 10, max: 30, unitAdjustment: -10 }] } },
      { rule_type: 'extra', pricing_json: { code: 'name', label: 'Name Print', unitPrice: 5, appliesTo: 'named-items' } },
      { rule_type: 'extra', pricing_json: { code: 'logo', label: 'Logo', unitPrice: 20, appliesTo: 'logos' } },
    ],
  });

  assert.equal(pricing.effectiveUnitPrice, 110);
  assert.equal(pricing.extras.length, 2);
  assert.equal(pricing.fulfillmentPath, 'direct_order');
});
