const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const customizerPagesRoutes = require('../routes/customizerPages');

function createRouteCapturingApp() {
  const routes = [];
  const record = (method) => (routePath, ...handlers) => routes.push({ method, path: routePath, handlers });
  return {
    routes,
    get: record('GET'),
  };
}

function count(routes, method, routePath) {
  return routes.filter((route) => route.method === method && route.path === routePath).length;
}

test('customizer pages register storefront entry routes', () => {
  const app = createRouteCapturingApp();
  customizerPagesRoutes(app);

  assert.equal(count(app.routes, 'GET', '/customizer'), 1);
  assert.equal(count(app.routes, 'GET', '/customizer/editor'), 1);
  assert.equal(count(app.routes, 'GET', '/customizer/quote-success'), 1);
  assert.equal(count(app.routes, 'GET', '/customizer/order-success'), 1);
});

test('customizer editor view includes root marker and bootstrap payload', () => {
  const editorView = fs.readFileSync(path.join(__dirname, '..', 'views', 'customizer', 'editor.ejs'), 'utf8');
  assert.match(editorView, /id="customizer-app"/);
  assert.match(editorView, /id="customizer-bootstrap"/);
  assert.match(editorView, /\/js\/customizer\/compositor\.js/);
  assert.match(editorView, /\/js\/customizer\/app\.js/);
});

test('customizer index view includes template and blank entry CTAs', () => {
  const indexView = fs.readFileSync(path.join(__dirname, '..', 'views', 'customizer', 'index.ejs'), 'utf8');
  assert.match(indexView, /模板開始/);
  assert.match(indexView, /空白款開始/);
  assert.match(indexView, /body、sleeve、collar/);
});
