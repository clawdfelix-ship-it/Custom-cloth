const test = require('node:test');
const assert = require('node:assert/strict');
const { addBusinessDays, normalizeHolidaySet } = require('../src/lib/hk-date');

test('addBusinessDays skips weekend', () => {
  const holidays = normalizeHolidaySet([]);
  assert.equal(addBusinessDays('2026-05-08', 1, holidays), '2026-05-11');
});

test('addBusinessDays skips holiday', () => {
  const holidays = normalizeHolidaySet(['2026-01-01']);
  assert.equal(addBusinessDays('2025-12-31', 1, holidays), '2026-01-02');
});

