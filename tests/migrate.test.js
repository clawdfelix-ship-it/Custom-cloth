const test = require('node:test');
const assert = require('node:assert/strict');

test('migrate exports ensureMigrations', () => {
  const { ensureMigrations } = require('../src/lib/migrate');
  assert.equal(typeof ensureMigrations, 'function');
});

