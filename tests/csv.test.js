const test = require('node:test');
const assert = require('node:assert/strict');
const { toCsv } = require('../src/lib/csv');

test('toCsv outputs header and rows', () => {
  const csv = toCsv([{ a: 'x', b: 'y' }], [
    { key: 'a', header: 'A' },
    { key: 'b', header: 'B' }
  ]);
  assert.equal(csv.trim(), 'A,B\nx,y');
});

