import JSZip from "jszip";
import type { KitLogo, KitState } from "@/types/kit";
import {
  buildHotspotFile,
  buildSettingsJson,
  renderArea,
  renderSeparateLogoAreas,
  type AreaTextures,
} from "./layerRenderer";

/**
 * Kit export.
 *
 * Produces a ZIP archive containing the same file set as the reference
 * implementation so the result can be consumed by the same texture
 * pipeline.
 */

export interface ExportOptions {
  kit: KitState;
  /** Include the hotspot file (requires the feature to be enabled). */
  includeHotspots: boolean;
  /** Render logos into separate texture files. */
  renderLogosSeparately: boolean;
  /** Base file name, without extension. */
  fileName: string;
}

export interface ExportResult {
  blob: Blob;
  fileName: string;
  files: string[];
}

export async function exportKitZip(options: ExportOptions): Promise<ExportResult> {
  const { kit } = options;
  const zip = new JSZip();
  const files: string[] = [];

  const addCanvas = (name: string, canvas: HTMLCanvasElement) => {
    zip.file(name, canvas.toDataURL("image/png"), { binary: true });
    files.push(name);
  };

  // Base area textures.
  for (const area of ["shirt", "shorts", "socks"] as const) {
    const textures = renderArea(area, { kit });
    const prefix = area === "shirt" ? "jersey" : area;
    addCanvas(`${prefix}_color.png`, textures.color);
    addCanvas(`${prefix}_normal.png`, textures.normal);
    addCanvas(`${prefix}_coeff.png`, textures.coeff);
    addCanvas(`${prefix}_taa.png`, textures.taa);
  }

  // Separately rendered logos.
  if (options.renderLogosSeparately) {
    const groups: { name: string; filter: (logo: KitLogo) => boolean }[] = [
      {
        name: "brand_jersey",
        filter: (logo) => logo.subtype === "brand" && logo.areaName === "shirt",
      },
      {
        name: "brand_shorts",
        filter: (logo) => logo.subtype === "brand" && logo.areaName === "shorts",
      },
      {
        name: "crest",
        filter: (logo) => logo.subtype === "team" && logo.areaName === "shirt",
      },
      {
        name: "crest_shorts",
        filter: (logo) => logo.subtype === "team" && logo.areaName === "shorts",
      },
    ];

    const separate = renderSeparateLogoAreas(kit, groups);
    for (const [name, textures] of Object.entries(separate)) {
      const hasContent = texturesHasContent(textures.color);
      if (!hasContent) continue;
      addCanvas(`${name}_color.png`, textures.color);
      addCanvas(`${name}_normal.png`, textures.normal);
      addCanvas(`${name}_coeff.png`, textures.coeff);
    }
  }

  // Settings payload.
  const settings = buildSettingsJson(kit);
  zip.file("settings.json", JSON.stringify(settings, null, 3), { binary: true });
  files.push("settings.json");

  // Hotspot payload.
  if (options.includeHotspots) {
    const hotspots = buildHotspotFile(kit);
    zip.file("hotspots.hotspot", JSON.stringify(hotspots, null, 3), { binary: true });
    files.push("hotspots.hotspot");
  }

  const blob = await zip.generateAsync({ type: "blob" });
  return { blob, fileName: `${options.fileName}.zip`, files };
}

/**
 * Export a single area as a PNG (used by the "save screenshot" action).
 */
export function exportAreaPng(kit: KitState, area: "shirt" | "shorts" | "socks"): Blob {
  const textures = renderArea(area, { kit });
  return dataUrlToBlob(textures.color.toDataURL("image/png"));
}

/** Export the whole kit as a flat PNG preview. */
export function exportPreviewPng(kit: KitState): Blob {
  const textures = renderArea("shirt", { kit });
  return dataUrlToBlob(textures.color.toDataURL("image/png"));
}

function texturesHasContent(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] > 0) return true;
  }
  return false;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, body] = dataUrl.split(",");
  const mime = header.match(/data:(.*?);/)?.[1] ?? "image/png";
  const binary = atob(body);
  const buffer = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    buffer[i] = binary.charCodeAt(i);
  }
  return new Blob([buffer], { type: mime });
}

/** Trigger a browser download for a blob. */
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  // Revoke on the next tick so Safari has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
