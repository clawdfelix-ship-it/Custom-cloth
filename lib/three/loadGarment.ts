import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import type { KitTemplate } from "@/types/kit";

/**
 * Loads the real jersey / shorts / socks geometry used by the reference
 * kit creator (FIFA / EAFC).
 *
 * These are the same .obj meshes the original app ships, which means:
 *
 *  - the preview looks like the real in-game garment, and
 *  - the UVs are the game's own UVs, so the exported texture maps onto
 *    the model exactly as the game expects.
 *
 * The three pieces are authored in ONE shared world space (the shirt spans
 * y 162..298, the shorts 112..206 and the socks 13..96), so simply adding
 * them to the same group produces a player wearing the kit.
 */

export interface GarmentModels {
  shirt: THREE.BufferGeometry;
  shorts: THREE.BufferGeometry;
  socks: THREE.BufferGeometry;
}

/** Which mesh files a template uses. */
export function modelUrls(template: KitTemplate): {
  shirt: string;
  shorts: string;
  socks: string;
} {
  const base = "/models/eafc";
  const id = template.id;

  // The reference app only ships the EAFC body meshes; the FIFA 21-23,
  // PES and FM kits reuse the same bodies with different artwork.
  const women = id.includes("women");
  const tight = id.includes("tight");
  const minikit = id.includes("minikit");
  const hanger = id.includes("hanger");
  const flying = id.includes("flying");

  let shirt: string;
  if (minikit) shirt = `${base}/minikit/collar_0.obj`;
  else if (hanger) shirt = `${base}/hanger/collar_0.obj`;
  else if (flying) shirt = `${base}/flying/collar_0.obj`;
  else if (women) shirt = `${base}/women/jersey_ss.obj`;
  else if (tight) shirt = `${base}/tight/jersey_ss.obj`;
  else shirt = `${base}/regular/jersey_ss.obj`;

  const shorts = women ? `${base}/women/shorts_0.obj` : `${base}/shorts_0.obj`;
  const socks = women ? `${base}/women/socks_0.obj` : `${base}/socks.obj`;

  return { shirt, shorts, socks };
}

/**
 * The UV region each mesh samples from its texture.
 *
 * The game packs each garment into a specific part of its texture, so
 * the exporter has to place artwork inside these bounds rather than over
 * the whole canvas.
 */
export const GARMENT_UV = {
  shirt: { u: [0.2261, 0.7739], v: [0.0576, 0.9884] },
  shorts: { u: [0.021, 0.979], v: [0.0347, 0.5918] },
  socks: { u: [0.0096, 0.9907], v: [0.0283, 0.978] },
} as const;

/** Load the three meshes for a template. Throws if any file is missing. */
export async function loadGarmentModels(
  template: KitTemplate,
): Promise<GarmentModels> {
  const urls = modelUrls(template);
  const loader = new OBJLoader();

  const [shirtObj, shortsObj, socksObj] = await Promise.all([
    loader.loadAsync(urls.shirt),
    loader.loadAsync(urls.shorts),
    loader.loadAsync(urls.socks),
  ]);

  return {
    shirt: firstGeometry(shirtObj, urls.shirt),
    shorts: firstGeometry(shortsObj, urls.shorts),
    socks: firstGeometry(socksObj, urls.socks),
  };
}

/** Extract the first mesh geometry from a loaded OBJ group. */
function firstGeometry(group: THREE.Object3D, url: string): THREE.BufferGeometry {
  let geometry: THREE.BufferGeometry | null = null;
  group.traverse((child) => {
    if (!geometry && child instanceof THREE.Mesh) {
      geometry = child.geometry;
    }
  });
  if (!geometry) {
    throw new Error(`No mesh found in ${url}`);
  }
  return geometry;
}
