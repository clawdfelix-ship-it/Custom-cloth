/**
 * Objective measurement of the loaded real-model geometry.
 *
 * Run: npx tsx scripts/measure-models.ts
 *
 * The models are the reference kit creator's own OBJ meshes. These checks
 * guard the properties the 3D preview and the texture export depend on:
 * correct assembly order, real garment proportions, and intact UVs.
 */
import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const base = resolve("public/models/eafc");
const files = {
  shirt: `${base}/regular/jersey_ss.obj`,
  shorts: `${base}/shorts_0.obj`,
  socks: `${base}/socks.obj`,
};

function load(path: string) {
  const group = new OBJLoader().parse(readFileSync(path, "utf8"));
  let geometry: THREE.BufferGeometry | null = null;
  group.traverse((child) => {
    if (!geometry && child instanceof THREE.Mesh) geometry = child.geometry;
  });
  if (!geometry) throw new Error("no mesh in " + path);
  return geometry;
}

function stats(geometry: THREE.BufferGeometry) {
  geometry.computeBoundingBox();
  const b = geometry.boundingBox!;
  const pos = geometry.getAttribute("position");
  const uv = geometry.getAttribute("uv");
  const index = geometry.getIndex();
  return {
    bbox: {
      min: [b.min.x, b.min.y, b.min.z].map((v) => Number(v.toFixed(2))),
      max: [b.max.x, b.max.y, b.max.z].map((v) => Number(v.toFixed(2))),
      size: [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z].map((v) =>
        Number(v.toFixed(2)),
      ),
    },
    vertices: pos.count,
    uvs: uv ? uv.count : 0,
    triangles: index ? index.count / 3 : pos.count / 3,
  };
}

const shirt = stats(load(files.shirt));
const shorts = stats(load(files.shorts));
const socks = stats(load(files.socks));

const assembled = {
  height: Math.max(shirt.bbox.max[1], shorts.bbox.max[1], socks.bbox.max[1]) -
    Math.min(shirt.bbox.min[1], shorts.bbox.min[1], socks.bbox.min[1]),
  width: Math.max(shirt.bbox.size[0], shorts.bbox.size[0], socks.bbox.size[0]),
};

console.log(JSON.stringify({ shirt, shorts, socks, assembled }, null, 2));

// --- assertions -----------------------------------------------------------
const failures: string[] = [];

// Assembly order: the shirt hangs from the shoulders down over the shorts,
// and the socks sit below the shorts.
if (!(shirt.bbox.min[1] > shorts.bbox.min[1])) failures.push("shirt is not above the shorts");
if (!(socks.bbox.max[1] < shorts.bbox.min[1])) failures.push("socks are not below the shorts");

// A jersey is much wider than it is deep (flat front and back).
if (!(shirt.bbox.size[0] > shirt.bbox.size[2] * 1.8)) failures.push("shirt is not flat-fronted");

// The shoulders are the widest part; shorts and socks are narrower.
if (!(shirt.bbox.size[0] > shorts.bbox.size[0] * 1.3)) failures.push("shirt is not wider than shorts");
if (!(shorts.bbox.size[0] > socks.bbox.size[0] * 0.8)) failures.push("shorts are not wider than socks");

// UVs must be present and complete (the export depends on them).
if (!(shirt.uvs === shirt.vertices)) failures.push("shirt missing UVs");
if (!(shorts.uvs === shorts.vertices)) failures.push("shorts missing UVs");
if (!(socks.uvs === socks.vertices)) failures.push("socks missing UVs");

// Sanity: the meshes must not be truncated.
if (!(shirt.bbox.size[0] > 100)) failures.push("shirt looks truncated");
if (!(assembled.height > 200)) failures.push("assembled kit looks truncated");

if (failures.length) {
  console.error("\nFAILURES:\n- " + failures.join("\n- "));
  process.exit(1);
}
console.log("\nAll real-model checks passed.");
