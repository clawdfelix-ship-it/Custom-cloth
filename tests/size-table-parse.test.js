const test = require('node:test');
const assert = require('node:assert/strict');

const { parseSizeTableText } = require('../src/lib/size-table-parse');

test('parse TSV with header', () => {
  const tsv = [
    'EU\tCHEST\tWAIST\tLENGTH\tCHINA SIZE\tSUGGESTED HEIGHT',
    'S\t88-91\t74-77\t66\t170/88A\t168-173cm',
    'M\t92-95\t78-81\t69\t175/92A\t173-178cm'
  ].join('\n');
  const r = parseSizeTableText(tsv, { header: true });
  assert.equal(r.ok, true);
  assert.equal(r.rows.length, 2);
  assert.deepEqual(r.rows[0], { eu: 'S', chest: '88-91', waist: '74-77', length: '66', china: '170/88A', height: '168-173cm' });
});

test('parse TSV without header uses fixed columns', () => {
  const tsv = [
    'S\t88-91\t74-77\t66\t170/88A\t168-173cm',
    'M\t92-95\t78-81\t69\t175/92A\t173-178cm'
  ].join('\n');
  const r = parseSizeTableText(tsv, { header: false });
  assert.equal(r.ok, true);
  assert.equal(r.rows.length, 2);
  assert.equal(r.rows[1].china, '175/92A');
});

test('parse CSV with header', () => {
  const csv = [
    'EU,CHEST,WAIST,LENGTH,CHINA,SUGGESTED HEIGHT',
    'S,88-91,74-77,66,170/88A,168-173cm'
  ].join('\n');
  const r = parseSizeTableText(csv, { header: true });
  assert.equal(r.ok, true);
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].eu, 'S');
});

