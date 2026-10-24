import type { KitLogo, KitState, KitLayer, AreaName } from "@/types/kit";

/**
 * 2D layer renderer.
 *
 * Produces the flat texture images that make up an exported kit. The export
 * format mirrors the reference implementation:
 *
 *   <area>_color.png    base colour + patterns
 *   <area>_normal.png   normal map (flat + seam hints)
 *   <area>_coeff.png    material coefficients
 *   <area>_taa.png      texture-attenuation approximation
 *
 * Logos are painted onto the colour map unless `renderedSeparately` is set,
 * in which case they get their own `brand_*` / `crest_*` texture set.
 */

export interface RenderArea {
  area: AreaName;
  width: number;
  height: number;
}

/** Export texture size per area. Reference default is 256. */
export const EXPORT_SIZE = {
  shirt: 1024,
  shorts: 512,
  socks: 256,
} as const;

/**
 * Texture layout for the shirt. The game expects a specific UV layout, so we
 * use fixed regions rather than packing freely.
 */
const SHIRT_LAYOUT = {
  body: { x: 0.25, y: 0.0, w: 0.5, h: 1.0 },
  sponsor: { x: 0.25, y: 0.36, w: 0.2, h: 0.12 },
  teamBadge: { x: 0.66, y: 0.06, w: 0.1, h: 0.12 },
  brandBadge: { x: 0.08, y: 0.06, w: 0.1, h: 0.12 },
  number: { x: 0.25, y: 0.18, w: 0.5, h: 0.28 },
};

const SHORTS_LAYOUT = {
  body: { x: 0.3, y: 0.0, w: 0.4, h: 1.0 },
  number: { x: 0.3, y: 0.1, w: 0.4, h: 0.22 },
};

const SOCKS_LAYOUT = {
  body: { x: 0.35, y: 0.0, w: 0.3, h: 1.0 },
};

export interface RenderOptions {
  kit: KitState;
  /** When true logos are excluded from the base colour map. */
  excludeLogos?: boolean;
  /** Restrict painting to logos matching this filter. */
  logoFilter?: (logo: KitLogo) => boolean;
}

export interface AreaTextures {
  color: HTMLCanvasElement;
  normal: HTMLCanvasElement;
  coeff: HTMLCanvasElement;
  taa: HTMLCanvasElement;
}

/**
 * Render one garment area into its four texture maps.
 */
export function renderArea(area: AreaName, options: RenderOptions): AreaTextures {
  const size = EXPORT_SIZE[area];
  const color = createCanvas(size, size);
  const normal = createCanvas(size, size);
  const coeff = createCanvas(size, size);
  const taa = createCanvas(size, size);

  const colorCtx = color.getContext("2d")!;
  const normalCtx = normal.getContext("2d")!;
  const coeffCtx = coeff.getContext("2d")!;
  const taaCtx = taa.getContext("2d")!;

  const layers = options.kit.layers.filter(
    (l) => l.areaName === area && l.visible && l.kind !== "logo" && l.kind !== "extra",
  );
  const extras = options.kit.layers.filter(
    (l) => l.areaName === area && l.visible && (l.kind === "extra" || l.kind === "printing"),
  );
  const logos = options.kit.logos.filter(
    (l) => l.areaName === area && !l.disabled && !l.renderedSeparately,
  );

  // --- colour map -------------------------------------------------------
  const baseColor = baseColorForArea(area, options.kit);
  colorCtx.fillStyle = baseColor;
  colorCtx.fillRect(0, 0, size, size);

  for (const layer of layers) {
    paintLayer(colorCtx, layer, size);
  }
  for (const layer of extras) {
    paintLayer(colorCtx, layer, size);
  }

  if (!options.excludeLogos) {
    const filter = options.logoFilter ?? (() => true);
    for (const logo of logos) {
      if (filter(logo)) paintLogo(colorCtx, logo, size);
    }
  }

  // --- normal map -------------------------------------------------------
  // A flat normal map is the valid default; seam hints come from geometry.
  normalCtx.fillStyle = "rgb(128, 128, 255)";
  normalCtx.fillRect(0, 0, size, size);

  // --- coefficient map --------------------------------------------------
  // R = ambient occlusion, G = roughness, B = metalness (matching the
  // conventional RGB channel layout used by kit texture pipelines).
  const roughness = area === "socks" ? 0.72 : 0.68;
  coeffCtx.fillStyle = `rgb(255, ${Math.round(roughness * 255)}, 0)`;
  coeffCtx.fillRect(0, 0, size, size);

  // --- taa map ----------------------------------------------------------
  // Texture-attenuation approximation: uniform value for fabric.
  taaCtx.fillStyle = "rgb(255, 255, 255)";
  taaCtx.fillRect(0, 0, size, size);

  return { color, normal, coeff, taa };
}

/**
 * Render the logos that were excluded from the base map into their own
 * texture set, one canvas per logo group (brand / crest).
 */
export function renderSeparateLogoAreas(
  kit: KitState,
  groups: { name: string; filter: (l: KitLogo) => boolean }[],
): Record<string, AreaTextures> {
  const result: Record<string, AreaTextures> = {};

  for (const group of groups) {
    const size = EXPORT_SIZE.shirt;
    const color = createCanvas(size, size);
    const normal = createCanvas(size, size);
    const coeff = createCanvas(size, size);
    const taa = createCanvas(size, size);

    const colorCtx = color.getContext("2d")!;
    colorCtx.clearRect(0, 0, size, size);
    for (const logo of kit.logos) {
      if (logo.renderedSeparately && !logo.disabled && group.filter(logo)) {
        paintLogo(colorCtx, logo, size);
      }
    }

    normal.getContext("2d")!.fillStyle = "rgb(128, 128, 255)";
    normal.getContext("2d")!.fillRect(0, 0, size, size);
    const c = coeff.getContext("2d")!;
    c.fillStyle = "rgb(255, 174, 0)";
    c.fillRect(0, 0, size, size);
    const t = taa.getContext("2d")!;
    t.fillStyle = "rgb(255, 255, 255)";
    t.fillRect(0, 0, size, size);

    result[group.name] = { color, normal, coeff, taa };
  }

  return result;
}

function baseColorForArea(area: AreaName, kit: KitState): string {
  switch (area) {
    case "shirt":
      return kit.settings.primary;
    case "shorts":
      return kit.settings.shorts;
    case "socks":
      return kit.settings.socks;
  }
}

/**
 * Paint a layer: solid colour with optional pattern overlay.
 * Pattern is drawn as a procedural stripe/checker rather than an image so
 * the renderer stays dependency free.
 */
function paintLayer(ctx: CanvasRenderingContext2D, layer: KitLayer, size: number) {
  ctx.save();
  ctx.globalAlpha = layer.opacity;
  ctx.fillStyle = layer.color;
  ctx.fillRect(0, 0, size, size);

  if (layer.pattern && layer.pattern !== "none") {
    ctx.globalAlpha = (layer.patternOpacity ?? 1) * layer.opacity;
    paintPattern(ctx, layer.pattern, layer.color, size);
  }
  ctx.restore();
}

function paintPattern(
  ctx: CanvasRenderingContext2D,
  pattern: string,
  baseColor: string,
  size: number,
) {
  const secondary = lighten(baseColor, 0.35);

  switch (pattern) {
    case "stripes": {
      ctx.fillStyle = secondary;
      const stripe = size / 12;
      for (let x = 0; x < size; x += stripe * 2) {
        ctx.fillRect(x, 0, stripe, size);
      }
      break;
    }
    case "hoops": {
      ctx.fillStyle = secondary;
      const hoop = size / 14;
      for (let y = 0; y < size; y += hoop * 2) {
        ctx.fillRect(0, y, size, hoop);
      }
      break;
    }
    case "halves": {
      ctx.fillStyle = secondary;
      ctx.fillRect(0, 0, size / 2, size);
      break;
    }
    case "sash": {
      ctx.fillStyle = secondary;
      ctx.save();
      ctx.translate(size / 2, size / 2);
      ctx.rotate(-Math.PI / 5);
      ctx.fillRect(-size, -size * 0.09, size * 2, size * 0.18);
      ctx.restore();
      break;
    }
    case "checks": {
      ctx.fillStyle = secondary;
      const cell = size / 10;
      for (let y = 0; y < size; y += cell) {
        for (let x = 0; x < size; x += cell) {
          if (((x / cell) | 0) % 2 === ((y / cell) | 0) % 2) {
            ctx.fillRect(x, y, cell, cell);
          }
        }
      }
      break;
    }
    case "gradient": {
      const gradient = ctx.createLinearGradient(0, size, 0, 0);
      gradient.addColorStop(0, baseColor);
      gradient.addColorStop(1, lighten(baseColor, 0.5));
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
      break;
    }
  }
}

/**
 * Paint a logo. Positions are normalized 0..1 against the garment canvas;
 * the anchor point is the logo centre.
 */
function paintLogo(ctx: CanvasRenderingContext2D, logo: KitLogo, size: number) {
  if (!logo.src && !logo.presetId) return;

  const width = logo.scale * size;
  const height = width;
  const x = logo.position.x * size;
  // Texture V runs bottom-up, logo positions are stored top-down.
  const y = (1 - logo.position.y) * size;

  ctx.save();
  ctx.globalAlpha = logo.opacity;
  ctx.translate(x, y);
  ctx.rotate((-logo.rotation * Math.PI) / 180);

  if (logo.tint) {
    // Tint placeholder artwork via a colour wash.
    ctx.globalCompositeOperation = "source-atop";
  }

  if (logo.src) {
    const image = getCachedImage(logo.src);
    if (image) {
      ctx.drawImage(image, -width / 2, -height / 2, width, height);
    }
  } else {
    // Preset placeholder: a labelled rounded badge.
    const radius = Math.min(width, height) * 0.18;
    ctx.fillStyle = logo.tint ?? "#ffffff";
    roundRect(ctx, -width / 2, -height / 2, width, height, radius);
    ctx.fill();
    ctx.fillStyle = "#111111";
    ctx.font = `600 ${Math.round(height * 0.3)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(logo.name.slice(0, 6), 0, 0);
  }
  ctx.restore();
}

const imageCache = new Map<string, HTMLImageElement>();

function getCachedImage(src: string): HTMLImageElement | null {
  const cached = imageCache.get(src);
  if (cached) return cached.complete && cached.naturalWidth > 0 ? cached : null;

  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = src;
  imageCache.set(src, image);
  return null;
}

export function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function lighten(hex: string, amount: number): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return hex;
  const num = parseInt(clean, 16);
  const r = Math.min(255, ((num >> 16) & 0xff) + Math.round(255 * amount));
  const g = Math.min(255, ((num >> 8) & 0xff) + Math.round(255 * amount));
  const b = Math.min(255, (num & 0xff) + Math.round(255 * amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/**
 * Build the `settings.json` payload written into an exported kit.
 */
export function buildSettingsJson(kit: KitState): Record<string, string | number | boolean> {
  const settings: Record<string, string | number | boolean> = {
    ...kit.settings,
  };
  // Derived values that the reference implementation stores explicitly.
  settings.shortsnumbercolor = kit.settings.shortsnumbercolor;
  settings.socksnumbercolor = kit.settings.socksnumbercolor;
  return settings;
}

/**
 * Build the `hotspots.hotspot` payload.
 */
export function buildHotspotFile(kit: KitState) {
  const hotspots = [...kit.hotspots];
  for (const logo of kit.logos) {
    if (logo.disabled || logo.subtype !== "team") continue;
    hotspots.push({
      Group: logo.areaName === "shirt" ? "jersey" : logo.areaName,
      Name: "team",
      Bounds: {
        x: logo.position.x - logo.scale / 2,
        y: logo.position.y - logo.scale / 2,
        width: logo.scale,
        height: logo.scale,
      },
      Rotation: logo.rotation,
    });
  }
  return {
    HotspotFormatVersion: 1 as const,
    Hotspots: hotspots,
  };
}
