import * as THREE from "three";
import type { KitTemplate } from "@/types/kit";

/**
 * Procedural garment geometry.
 *
 * We build the shirt as a lathe-free custom BufferGeometry: a swept torso
 * profile (chest → waist → hem) with flared shoulders and separately
 * generated sleeves. The result is a smooth, subdivision-free surface that
 * takes UVs mapped for a texture layout (0..1 in U across the body width,
 * 0..1 in V from hem to shoulder).
 */

interface ProfilePoint {
  /** Height along the garment (0 = hem, 1 = shoulder). */
  t: number;
  /** Half-width at that height. */
  width: number;
  /** Depth (front-to-back half-thickness). */
  depth: number;
}

/** Torso cross-sections from hem to shoulder. */
function buildProfile(body: KitTemplate["body"]): ProfilePoint[] {
  const { length, chestWidth, waistWidth } = body;
  const shoulderWidth = chestWidth * 1.06;

  const raw: ProfilePoint[] = [
    { t: 0.0, width: waistWidth * 1.04, depth: waistWidth * 0.62 },
    { t: 0.12, width: waistWidth * 1.0, depth: waistWidth * 0.6 },
    { t: 0.38, width: waistWidth * 0.99, depth: waistWidth * 0.61 },
    { t: 0.6, width: chestWidth * 0.97, depth: chestWidth * 0.62 },
    { t: 0.78, width: chestWidth * 1.0, depth: chestWidth * 0.63 },
    { t: 0.9, width: chestWidth * 1.02, depth: chestWidth * 0.6 },
    { t: 0.97, width: shoulderWidth * 0.94, depth: chestWidth * 0.5 },
    { t: 1.0, width: shoulderWidth * 0.82, depth: chestWidth * 0.38 },
  ];

  return raw.map((p) => ({
    ...p,
    // Scale horizontal dimensions by length so proportions hold across templates.
    width: p.width * (length / 1.0),
    depth: p.depth * (length / 1.0),
  }));
}

/** Elliptical ring around the vertical axis at a given height. */
function ring(width: number, depth: number, segments: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    // Slightly flatten the back so the silhouette reads like a torso.
    const zScale = 0.92 + 0.08 * Math.cos(angle);
    points.push(
      new THREE.Vector3(
        Math.sin(angle) * width,
        0,
        Math.cos(angle) * depth * zScale,
      ),
    );
  }
  return points;
}

export interface GarmentGeometry {
  /** Torso surface with UVs. */
  body: THREE.BufferGeometry;
  /** Combined sleeve geometry (both arms), no UVs needed beyond a simple planar map. */
  sleeves: THREE.BufferGeometry;
  /** Neck ring geometry for collar rendering. */
  neck: THREE.BufferGeometry;
  /** Collar variants, indexed by collar number. */
  collars: THREE.BufferGeometry[];
}

const RADIAL = 32;
const PROFILE_STEPS = 40;

/**
 * Build the torso. V maps 0 at the hem to 1 at the shoulder so the texture
 * layout matches a standard kit texture (waist at bottom, collar at top).
 */
export function buildTorsoGeometry(body: KitTemplate["body"]): THREE.BufferGeometry {
  const profile = buildProfile(body);

  // Resample the profile to a uniform parameter grid.
  const sampled: ProfilePoint[] = [];
  for (let i = 0; i < PROFILE_STEPS; i++) {
    const t = i / (PROFILE_STEPS - 1);
    sampled.push(sampleProfile(profile, t));
  }

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let row = 0; row < PROFILE_STEPS; row++) {
    const point = sampled[row];
    const ringPoints = ring(point.width, point.depth, RADIAL);
    const y = point.t * body.length;

    for (let col = 0; col <= RADIAL; col++) {
      const p = ringPoints[col % RADIAL];
      positions.push(p.x, y, p.z);
      // U wraps the body; V runs hem (0) -> shoulder (1).
      uvs.push(col / RADIAL, point.t);
    }
  }

  for (let row = 0; row < PROFILE_STEPS - 1; row++) {
    for (let col = 0; col < RADIAL; col++) {
      const a = row * (RADIAL + 1) + col;
      const b = a + 1;
      const c = a + (RADIAL + 1);
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function sampleProfile(profile: ProfilePoint[], t: number): ProfilePoint {
  for (let i = 0; i < profile.length - 1; i++) {
    const a = profile[i];
    const b = profile[i + 1];
    if (t >= a.t && t <= b.t) {
      const span = b.t - a.t;
      const k = span === 0 ? 0 : (t - a.t) / span;
      // Smoothstep keeps the silhouette free of visible creases.
      const s = k * k * (3 - 2 * k);
      return {
        t,
        width: a.width + (b.width - a.width) * s,
        depth: a.depth + (b.depth - a.depth) * s,
      };
    }
  }
  return profile[profile.length - 1];
}

/**
 * A tapered sleeve: a cone frustum swept from the shoulder outward and down.
 */
export function buildSleeveGeometry(
  body: KitTemplate["body"],
  side: 1 | -1,
): THREE.BufferGeometry {
  const profile = buildProfile(body);
  const shoulder = profile[profile.length - 2];
  const segments = 12;
  const rings = 8;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const shoulderX = shoulder.width * 0.9;
  const shoulderY = 0.94 * body.length;
  const length = body.sleeveLength * body.length;
  const topRadius = shoulder.width * 0.34;
  const bottomRadius = topRadius * 0.78;

  for (let ringIndex = 0; ringIndex < rings; ringIndex++) {
    const t = ringIndex / (rings - 1);
    const radius = topRadius + (bottomRadius - topRadius) * t;
    const x = shoulderX + length * t * 0.78 * side;
    const y = shoulderY - length * t * 0.62;

    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      positions.push(
        x + Math.cos(angle) * radius * 0.9 * side,
        y + Math.sin(angle) * radius,
        Math.cos(angle) * radius * 0.85,
      );
      uvs.push(i / segments, t);
    }
  }

  for (let ringIndex = 0; ringIndex < rings - 1; ringIndex++) {
    for (let i = 0; i < segments; i++) {
      const a = ringIndex * (segments + 1) + i;
      const b = a + 1;
      const c = a + (segments + 1);
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** A torus used as the neck opening. */
export function buildNeckGeometry(body: KitTemplate["body"]): THREE.BufferGeometry {
  const profile = buildProfile(body);
  const shoulder = profile[profile.length - 2];
  const radius = shoulder.width * 0.34;
  const geometry = new THREE.TorusGeometry(radius, radius * 0.22, 10, 28);
  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, 0.955 * body.length, 0);
  return geometry;
}

/**
 * Collar variants. Index 0 is a plain crew neck; higher indices add a V,
 * a polo fold, or a funnel shape. All are small rings or lathed bands so
 * they render as part of the shirt without needing extra textures.
 */
export function buildCollarGeometries(body: KitTemplate["body"]): THREE.BufferGeometry[] {
  const profile = buildProfile(body);
  const shoulder = profile[profile.length - 2];
  const baseRadius = shoulder.width * 0.34;
  const y = 0.955 * body.length;
  const collars: THREE.BufferGeometry[] = [];

  // 0: crew
  {
    const g = new THREE.TorusGeometry(baseRadius, baseRadius * 0.2, 8, 26);
    g.rotateX(Math.PI / 2);
    g.translate(0, y, 0);
    collars.push(g);
  }

  // 1-12: V-neck variants (varying depth)
  for (let i = 1; i <= 12; i++) {
    const depth = 0.03 + (i / 12) * 0.16;
    const g = new THREE.TorusGeometry(baseRadius * 1.02, baseRadius * 0.18, 8, 26, Math.PI * 1.15);
    g.rotateX(Math.PI / 2);
    g.rotateY(Math.PI * 0.42);
    g.translate(0, y - depth * 0.35, baseRadius * 0.28);
    collars.push(g);
  }

  // 13-25: polo / funnel bands
  for (let i = 13; i < 26; i++) {
    const collarCount = i - 12;
    const bandHeight = 0.02 + collarCount * 0.006;
    const g = new THREE.CylinderGeometry(
      baseRadius * (1.02 + collarCount * 0.006),
      baseRadius * (1.04 + collarCount * 0.006),
      bandHeight,
      26,
      1,
      true,
    );
    g.translate(0, y + bandHeight * 0.4, 0);
    collars.push(g);
  }

  return collars;
}

export interface GarmentParts {
  body: THREE.BufferGeometry;
  sleeves: THREE.BufferGeometry;
  neck: THREE.BufferGeometry;
  collars: THREE.BufferGeometry[];
}

/** Assemble every garment part for a template. */
export function buildGarment(body: KitTemplate["body"]): GarmentParts {
  const left = buildSleeveGeometry(body, -1);
  const right = buildSleeveGeometry(body, 1);
  const merged = mergeGeometries([left, right]);

  return {
    body: buildTorsoGeometry(body),
    sleeves: merged,
    neck: buildNeckGeometry(body),
    collars: buildCollarGeometries(body),
  };
}

/**
 * Minimal geometry merge. Three's BufferGeometryUtils is a separate
 * example module; we only need position/uv/normal here.
 */
function mergeGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  let offset = 0;

  for (const geometry of geometries) {
    const pos = geometry.getAttribute("position");
    const uv = geometry.getAttribute("uv");
    const nor = geometry.getAttribute("normal");
    const index = geometry.getIndex();

    for (let i = 0; i < pos.count; i++) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      if (uv) uvs.push(uv.getX(i), uv.getY(i));
      else uvs.push(0, 0);
      if (nor) normals.push(nor.getX(i), nor.getY(i), nor.getZ(i));
      else normals.push(0, 1, 0);
    }

    if (index) {
      for (let i = 0; i < index.count; i++) {
        indices.push(index.getX(i) + offset);
      }
    } else {
      for (let i = 0; i < pos.count; i++) {
        indices.push(i + offset);
      }
    }
    offset += pos.count;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  merged.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  merged.setIndex(indices);
  return merged;
}
