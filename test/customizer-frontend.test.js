const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadBrowserScript(relativePath, extras = {}) {
  const absolutePath = path.join(__dirname, '..', relativePath);
  const source = fs.readFileSync(absolutePath, 'utf8');
  const context = {
    window: {},
    document: {},
    console,
    ...extras,
  };
  vm.runInNewContext(source, context, { filename: absolutePath });
  return context.window;
}

test('customizer state store returns cloned snapshots and notifies subscribers', () => {
  const windowObject = loadBrowserScript('public/js/customizer/state.js');
  const store = windowObject.CustomizerState.createCustomizerStore({
    selectedProductType: { id: 1, name: 'Football' },
  });

  let observed = null;
  store.subscribe((state) => {
    observed = state;
  });

  const snapshot = store.getState();
  snapshot.selectedProductType.name = 'Mutated';

  store.setState({
    selectedTemplateFamily: { id: 2, name: 'Velocity Home' },
  });

  const nextSnapshot = store.getState();
  assert.equal(nextSnapshot.selectedProductType.name, 'Football');
  assert.equal(nextSnapshot.selectedTemplateFamily.name, 'Velocity Home');
  assert.equal(observed.selectedTemplateFamily.name, 'Velocity Home');
});

test('customizer catalog indexes template families by product type and resolves defaults', () => {
  const windowObject = loadBrowserScript('public/js/customizer/catalog.js');
  const catalog = windowObject.CustomizerCatalog.normalizeCatalogPayload({
    productTypes: [{ id: 10, name: 'Basketball' }, { id: 20, name: 'Volleyball' }],
    templateFamilies: [
      { id: 100, name: 'Fast Break', product_type_id: 10, recommended: true },
      { id: 101, name: 'Defense', product_type_id: 10, is_blank: true },
      { id: 200, name: 'Ace', product_type_id: 20, recommended: true },
    ],
  });

  assert.equal(catalog.templateFamiliesByProductType['10'].length, 2);
  assert.equal(windowObject.CustomizerCatalog.findDefaultProductType(catalog, null).id, 10);
  assert.equal(windowObject.CustomizerCatalog.findDefaultTemplate(catalog, 10, 101).name, 'Defense');
  assert.equal(windowObject.CustomizerCatalog.findTemplateForStartMode(catalog, 10, 'blank', null).name, 'Defense');
});

test('customizer compositor paints preview canvas for part-driven current side', () => {
  const windowObject = loadBrowserScript('public/js/customizer/compositor.js', {
    window: { devicePixelRatio: 1 },
  });

  const operations = [];
  const gradient = { addColorStop() {} };
  const context2d = {
    save() { operations.push('save'); },
    restore() { operations.push('restore'); },
    setTransform() { operations.push('setTransform'); },
    clearRect() { operations.push('clearRect'); },
    fillRect() { operations.push('fillRect'); },
    beginPath() { operations.push('beginPath'); },
    moveTo() { operations.push('moveTo'); },
    lineTo() { operations.push('lineTo'); },
    closePath() { operations.push('closePath'); },
    fill() { operations.push('fill'); },
    stroke() { operations.push('stroke'); },
    roundRect() { operations.push('roundRect'); },
    arc() { operations.push('arc'); },
    fillText() { operations.push('fillText'); },
    createLinearGradient() { return gradient; },
    textBaseline: 'alphabetic',
    textAlign: 'left',
    font: '',
    lineWidth: 1,
    fillStyle: '',
    strokeStyle: '',
    shadowColor: '',
    shadowBlur: 0,
  };

  const canvas = {
    width: 0,
    height: 0,
    style: {},
    getContext() {
      return context2d;
    },
    getBoundingClientRect() {
      return { width: 640, height: 520 };
    },
  };

  const root = {
    querySelector(selector) {
      return selector === '[data-role="preview-canvas"]' ? canvas : null;
    },
  };

  const compositor = windowObject.CustomizerCompositor.createPreviewCompositor(root);
  compositor.render({
    selectedProductType: { name: 'Football' },
    selectedTemplateFamily: { name: 'Away Kit' },
    previews: { activeSide: 'back' },
    design: {
      parts: { body: 'speed-chevron', sleeve: 'double-band', collar: 'v-neck' },
      colorZones: { primary: '#ffffff', secondary: '#7f1d45', trim: '#fbbf24' },
      texts: {},
      logos: [],
    },
  });

  assert.equal(canvas.width, 640);
  assert.equal(canvas.height, 520);
  assert.match(operations.join(','), /fillRect/);
  assert.match(operations.join(','), /fillText/);
});
