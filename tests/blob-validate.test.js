const test = require('node:test');
const assert = require('node:assert/strict');

test('blob.js validates image-only uploads', async () => {
  const { uploadDataUrl } = require('../src/lib/blob');
  assert.equal(typeof uploadDataUrl, 'function');
  const r = await uploadDataUrl('t', 'a.txt', 'data:text/plain;base64,SGVsbG8=');
  assert.equal(r, null);
});

test('blob.js rejects oversized images', async () => {
  const { uploadDataUrl } = require('../src/lib/blob');
  const b64 = Buffer.alloc(500 * 1024 + 1, 0).toString('base64');
  const r = await uploadDataUrl('t', 'a.png', `data:image/png;base64,${b64}`);
  assert.equal(r, null);
});
