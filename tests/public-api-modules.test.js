const test = require('node:test');
const assert = require('node:assert/strict');

test('public api modules export handler functions', () => {
  const styles = require('../api/public/styles');
  const sizeTable = require('../api/public/size-tables/[id]');
  assert.equal(typeof styles, 'function');
  assert.equal(typeof sizeTable, 'function');
});

