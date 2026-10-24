/**
 * Kit domain types.
 *
 * These mirror the export format used by the reference implementation
 * (`settings.json` + `hotspots.hotspot`) so exported kits stay compatible
 * with the EA/FIFA kit texture pipeline.
 */

export type GameId = "FIFA" | "PES" | "FM";

/** Layer kinds rendered onto the garment texture. */
export type LayerKind =
  | "shirt"
  | "shorts"
  | "socks"
  | "logo"
  | "extra"
  | "printing";

/** Garment region a logo or extra layer is attached to. */
export type AreaName = "shirt" | "shorts" | "socks";

/** Logo classification, mirrors `subtype` in the reference bundle. */
export type LogoSubtype = "team" | "brand" | "sponsor" | "badge" | "text";

export interface KitLogo {
  id: string;
  name: string;
  subtype: LogoSubtype;
  areaName: AreaName;
  /** Normalized 0..1 position on the garment. */
  position: { x: number; y: number };
  /** Normalized scale relative to the garment width. */
  scale: number;
  rotation: number;
  /** Layer index within its area, used for z-ordering. */
  zIndex: number;
  /** Data URL for uploaded artwork, or a preset id. */
  src?: string;
  presetId?: string;
  /** Stencil index used when baking a logo into the base texture. */
  stencilIndex?: number;
  /** When true the logo renders into its own texture file instead of the base. */
  renderedSeparately: boolean;
  disabled?: boolean;
  opacity: number;
  /** Tint applied to the logo, hex without `#`. */
  tint?: string;
}

export interface KitLayer {
  id: string;
  kind: LayerKind;
  areaName: AreaName;
  name: string;
  color: string;
  visible: boolean;
  opacity: number;
  /** Optional SVG/pattern overlay rendered on top of the base colour. */
  pattern?: string;
  patternOpacity?: number;
}

export interface ShortsSettings {
  style: number;
  color: string;
  numberColor: string;
  trimColor: string;
}

export interface SocksSettings {
  style: number;
  color: string;
  numberColor: string;
}

export interface HotspotBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Hotspot {
  Group: "jersey" | "shorts" | "socks";
  Name: string;
  Bounds: HotspotBounds;
  Rotation: number;
}

export interface HotspotFile {
  HotspotFormatVersion: 1;
  Hotspots: Hotspot[];
}

/** The payload written to `settings.json` in an exported kit. */
export interface KitSettings {
  primary: string;
  secondary: string;
  trim: string;
  pattern: string;
  patternType: string;
  sponsor: string;
  shorts: string;
  socks: string;
  shortsnumbercolor: string;
  socksnumbercolor: string;
  collar: number;
  jerseyfit: string;
  shortstyle: number;
  jerseynamelayouttype: number;
  isCreateAClub: boolean;
  [key: string]: string | number | boolean;
}

/** Full editor state for one kit. */
export interface KitState {
  game: GameId;
  templateId: string;
  settings: KitSettings;
  layers: KitLayer[];
  logos: KitLogo[];
  hotspots: Hotspot[];
}

/** Template describes a garment silhouette + its 3D assets. */
export interface KitTemplate {
  id: string;
  game: GameId;
  name: string;
  /** Base body mesh parameters used to generate geometry at runtime. */
  body: {
    /** Shoulder-to-hip length in arbitrary units. */
    length: number;
    /** Chest half-width. */
    chestWidth: number;
    /** Waist half-width. */
    waistWidth: number;
    /** Sleeve length from shoulder. */
    sleeveLength: number;
    /** Number of collar variants. */
    collarCount: number;
    /** Sock styles supported. */
    sockStyles: string[];
    /** Whether the template supports tucked-in shirts. */
    hasTuckedIn: boolean;
    hasUndershirt: boolean;
    hasNeckwarmer: boolean;
    hasMannequin: boolean;
  };
  cameraPositionZ: { reg: number; mini: number };
  kitPositionY: { shirt: number; mini: number };
}

export interface UserTierLimits {
  maxCustomImages: number;
  canUseHotspots: boolean;
  canUseFreeformPath: boolean;
  canRenderLogosSeparately: boolean;
  canUseStencils: boolean;
  canPositionLogos: boolean;
  maxSavedKits: number;
}

export const TIER_LIMITS: Record<number, UserTierLimits> = {
  0: {
    maxCustomImages: 0,
    canUseHotspots: false,
    canUseFreeformPath: false,
    canRenderLogosSeparately: false,
    canUseStencils: false,
    canPositionLogos: false,
    maxSavedKits: 3,
  },
  1: {
    maxCustomImages: 750,
    canUseHotspots: true,
    canUseFreeformPath: true,
    canRenderLogosSeparately: true,
    canUseStencils: false,
    canPositionLogos: true,
    maxSavedKits: 100,
  },
  2: {
    maxCustomImages: 1250,
    canUseHotspots: true,
    canUseFreeformPath: true,
    canRenderLogosSeparately: true,
    canUseStencils: true,
    canPositionLogos: true,
    maxSavedKits: 1000,
  },
};
