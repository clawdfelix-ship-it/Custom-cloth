const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const editor = fs.readFileSync(
  require.resolve("../components/editor/KitEditor.tsx"),
  "utf8",
);
const controls = fs.readFileSync(
  require.resolve("../components/ui/Panel.tsx"),
  "utf8",
);
const styles = fs.readFileSync(require.resolve("../app/globals.css"), "utf8");
const scene = fs.readFileSync(
  require.resolve("../lib/three/KitScene.ts"),
  "utf8",
);

function openingTagAfter(anchor) {
  const start = editor.indexOf(anchor);
  assert.notEqual(start, -1, `missing editor anchor: ${anchor}`);
  return editor.slice(start, editor.indexOf(">", start) + 1);
}

test("preview precedes both side panels and has a useful mobile height", () => {
  const preview = editor.indexOf('<main data-editor-preview');
  const garmentOptions = editor.indexOf("<details");
  const textureOptions = editor.indexOf('aria-label="Texture preview"');
  assert.ok(preview >= 0, "preview needs a stable accessible target");
  assert.ok(garmentOptions > preview, "garment options must follow the mobile preview");
  assert.ok(textureOptions > preview, "texture panel must follow the mobile preview");
  const previewTag = openingTagAfter("<main");
  assert.match(previewTag, /min-h-\[(?:20rem|22rem|24rem)\]/);
  assert.match(previewTag, /w-full/);
  assert.match(previewTag, /lg:min-h-0/);
});

test("narrow layouts stack sections while desktop retains its two rails", () => {
  const workspace = openingTagAfter('<div data-editor-workspace');
  assert.match(workspace, /flex-col/);
  assert.match(workspace, /lg:flex-row/);
  assert.match(workspace, /min-w-0/);

  const garment = openingTagAfter('<details data-editor-options');
  assert.match(garment, /w-full/);
  assert.match(garment, /lg:w-\[300px\]/);
  assert.match(garment, /lg:order-2/);
  const summary = openingTagAfter('<summary aria-label="Garment options"');
  assert.match(summary, /lg:hidden/);

  const preview = openingTagAfter('<main data-editor-preview');
  assert.match(preview, /lg:order-1/);
  const texture = openingTagAfter('<aside data-editor-textures');
  assert.match(texture, /lg:order-3/);
  assert.match(texture, /lg:w-\[280px\]/);
});

test("header and action controls can wrap without forcing horizontal overflow", () => {
  const header = openingTagAfter("<header");
  assert.match(header, /flex-wrap/);
  assert.match(header, /min-h-12/);
  assert.doesNotMatch(header, /(?:^|\s)h-12(?:\s|$)/);
  assert.match(header, /overflow-x-hidden/);
  const navigation = openingTagAfter("<nav");
  assert.match(navigation, /flex-wrap/);
  assert.match(navigation, /min-w-0/);
  assert.match(editor, /className="flex h-dvh min-w-0 flex-col overflow-x-hidden/);
});

test("Three.js preview resizes when responsive panels change its container size", () => {
  assert.match(scene, /new ResizeObserver\(/);
  assert.match(scene, /resizeObserver\.observe\(this\.container\)/);
  assert.match(scene, /this\.resizeObserver\.disconnect\(\)/);
});

test("coarse pointers get 44px editor controls without changing desktop sizing", () => {
  for (const control of [
    "ColorInput",
    "Select",
    "NumberInput",
    "Button",
  ]) {
    const component = controls.slice(controls.indexOf(`export function ${control}`));
    assert.match(component, /editor-control/, `${control} must share the touch-target rule`);
  }
  assert.match(editor, /editor-tab/);
  assert.match(editor, /editor-control/);
  assert.match(styles, /@media \(pointer: coarse\) \{/);
  assert.match(styles, /\.editor-control\s*\{[^}]*min-height:\s*44px;/s);
  assert.match(styles, /input\[type="color"\]\.editor-control\s*\{[^}]*min-width:\s*44px;/s);
  assert.match(styles, /\.editor-tab\s*\{[^}]*min-height:\s*44px;/s);
  assert.match(styles, /\.editor-summary\s*\{[^}]*min-height:\s*44px;/s);
});
