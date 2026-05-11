const test = require('node:test');
const assert = require('node:assert/strict');

test('admin.html contains login inputs for acc/pwd', async () => {
  const fs = require('node:fs/promises');
  const html = await fs.readFile('admin.html', 'utf8');
  assert.match(html, /id="accInput"/);
  assert.match(html, /id="pwdInput"/);
});

test('admin.html contains size table paste inputs', async () => {
  const fs = require('node:fs/promises');
  const html = await fs.readFile('admin.html', 'utf8');
  assert.match(html, /id="sizePaste"/);
  assert.match(html, /id="sizePasteHasHeader"/);
  assert.match(html, /id="previewSizeBtn"/);
});

test('admin.html contains size table preview thumbnail UI', async () => {
  const fs = require('node:fs/promises');
  const html = await fs.readFile('admin.html', 'utf8');
  assert.match(html, />\s*Preview\s*</);
  assert.match(html, /id="sizePreviewModal"/);
});

test('admin.html contains style category selects', async () => {
  const fs = require('node:fs/promises');
  const html = await fs.readFile('admin.html', 'utf8');
  assert.match(html, /id="styleCate1Sel"/);
  assert.match(html, /id="styleCate2Sel"/);
});

test('admin.html contains jersey cate3/cate4 selects', async () => {
  const fs = require('node:fs/promises');
  const html = await fs.readFile('admin.html', 'utf8');
  assert.match(html, /id="styleCate3Sel"/);
  assert.match(html, /id="styleCate4Sel"/);
});
