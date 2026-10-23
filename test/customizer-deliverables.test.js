const test = require('node:test');
const assert = require('node:assert/strict');

const { buildDeliverablePackage } = require('../models/customizer/deliverables');

test('buildDeliverablePackage combines session previews roster and pricing', () => {
  const deliverable = buildDeliverablePackage({
    session: {
      id: 99,
      selection: { productTypeId: 1, templateId: 3 },
      uploadedAssets: [{ id: 7, storageKey: 'uploads/logo-7.png' }],
    },
    previews: {
      front: { storageKey: 'previews/front-99.png' },
      back: { storageKey: 'previews/back-99.png' },
    },
    roster: {
      items: [
        { playerName: 'Chan', quantity: 1 },
        { playerName: 'Lee', quantity: 2 },
      ],
    },
    pricing: {
      total: 1280,
      fulfillmentPath: 'direct_order',
    },
  });

  assert.equal(deliverable.sessionId, 99);
  assert.equal(deliverable.selectedProductType, 1);
  assert.equal(deliverable.selectedTemplate, 3);
  assert.equal(deliverable.previews.front.storageKey, 'previews/front-99.png');
  assert.equal(deliverable.rosterSummary.itemCount, 2);
  assert.equal(deliverable.rosterSummary.totalQuantity, 3);
  assert.equal(deliverable.fulfillmentPath, 'direct_order');
});
