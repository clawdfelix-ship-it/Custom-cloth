const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const editor = fs.readFileSync(
  require.resolve("../components/editor/KitEditor.tsx"),
  "utf8",
);

function field(label) {
  const start = editor.indexOf(`<Field label="${label}"`);
  assert.notEqual(start, -1, `missing field ${label}`);
  return editor.slice(start, editor.indexOf("</Field>", start));
}

test("jersey name layout uses the renderer's straight/curved geometry", () => {
  const nameLayout = field("Back name layout");
  assert.match(nameLayout, /<Select/);
  assert.doesNotMatch(nameLayout, /<NumberInput/);
  assert.match(nameLayout, /jerseynamelayouttype/);
  assert.match(nameLayout, /\{ value: 0, label: "Straight" \}/);
  assert.match(nameLayout, /\{ value: 1, label: "Curved" \}/);
});

test("shorts style names each model without inventing undocumented fit labels", () => {
  const shortsStyle = field("Shorts style");
  assert.match(shortsStyle, /<Select/);
  assert.doesNotMatch(shortsStyle, /<NumberInput/);
  assert.match(shortsStyle, /shortstyle/);
  assert.match(shortsStyle, /\{ value: 0, label: "Standard \(model 0\)" \}/);
  for (let value = 1; value <= 6; value += 1) {
    assert.match(
      shortsStyle,
      new RegExp(`\\{ value: ${value}, label: "Model ${value}" \\}`),
    );
  }
});
