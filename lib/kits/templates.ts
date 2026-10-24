import type { GameId, KitState, KitTemplate } from "@/types/kit";

/**
 * Template registry.
 *
 * The garment meshes are the reference kit creator's own OBJ assets (see
 * `lib/three/loadGarment.ts`), so the 3D preview matches the in-game kit
 * and the exported textures map onto the model exactly as the game expects.
 * Silhouette parameters here approximate each shape.
 */

const EAFC_REGULAR: KitTemplate = {
  id: "eafc-regular",
  game: "FIFA",
  name: "EAFC Standard",
  body: {
    length: 1.0,
    chestWidth: 0.52,
    waistWidth: 0.46,
    sleeveLength: 0.22,
    collarCount: 26,
    sockStyles: ["Standard", "Short", "Long"],
    hasTuckedIn: true,
    hasUndershirt: true,
    hasNeckwarmer: true,
    hasMannequin: true,
  },
  cameraPositionZ: { reg: 450, mini: 480 },
  kitPositionY: { shirt: -233, mini: -229 },
};

const EAFC_TIGHT: KitTemplate = {
  ...EAFC_REGULAR,
  id: "eafc-tight",
  name: "EAFC Tight",
  body: {
    ...EAFC_REGULAR.body,
    chestWidth: 0.47,
    waistWidth: 0.41,
  },
};

const EAFC_WOMEN: KitTemplate = {
  ...EAFC_REGULAR,
  id: "eafc-women",
  name: "EAFC Women",
  body: {
    ...EAFC_REGULAR.body,
    chestWidth: 0.44,
    waistWidth: 0.38,
    length: 0.96,
  },
};

const EAFC_MINIKIT: KitTemplate = {
  ...EAFC_REGULAR,
  id: "eafc-minikit",
  name: "EAFC Minikit",
  body: {
    ...EAPC_BODY_FALLBACK(),
  },
};

const EAFC_HANGER: KitTemplate = {
  ...EAFC_REGULAR,
  id: "eafc-hanger",
  name: "EAFC Hanger",
  body: {
    ...EAFC_REGULAR.body,
    length: 1.06,
    sleeveLength: 0.26,
  },
};

const EAFC_FLYING: KitTemplate = {
  ...EAFC_REGULAR,
  id: "eafc-flying",
  name: "EAFC Flying",
  body: {
    ...EAFC_REGULAR.body,
    sleeveLength: 0.34,
    chestWidth: 0.56,
  },
};

const FIFA21_REGULAR: KitTemplate = {
  id: "fifa21-regular",
  game: "FIFA",
  name: "FIFA 21-23",
  body: {
    length: 1.0,
    chestWidth: 0.53,
    waistWidth: 0.47,
    sleeveLength: 0.2,
    collarCount: 26,
    sockStyles: ["Standard", "Short", "Long"],
    hasTuckedIn: true,
    hasUndershirt: true,
    hasNeckwarmer: true,
    hasMannequin: true,
  },
  cameraPositionZ: { reg: 450, mini: 480 },
  kitPositionY: { shirt: -233, mini: -229 },
};

const FIFA21_TIGHT: KitTemplate = {
  ...FIFA21_REGULAR,
  id: "fifa21-tight",
  name: "FIFA 21-23 Tight",
  body: {
    ...FIFA21_REGULAR.body,
    chestWidth: 0.48,
    waistWidth: 0.42,
  },
};

const FIFA21_WOMEN: KitTemplate = {
  ...FIFA21_REGULAR,
  id: "fifa21-women",
  name: "FIFA 21-23 Women",
  body: {
    ...FIFA21_REGULAR.body,
    chestWidth: 0.45,
    waistWidth: 0.39,
    length: 0.96,
  },
};

const FIFA21_HANGER: KitTemplate = {
  ...FIFA21_REGULAR,
  id: "fifa21-hanger",
  name: "FIFA 21-23 Hanger",
  body: {
    ...FIFA21_REGULAR.body,
    length: 1.06,
    sleeveLength: 0.25,
  },
};

const PES_REGULAR: KitTemplate = {
  ...FIFA21_REGULAR,
  id: "pes-regular",
  game: "PES",
  name: "PES Standard",
};

const FM_REGULAR: KitTemplate = {
  ...FIFA21_REGULAR,
  id: "fm-regular",
  game: "FM",
  name: "Football Manager",
};

function EAPC_BODY_FALLBACK(): KitTemplate["body"] {
  return {
    length: 0.42,
    chestWidth: 0.5,
    waistWidth: 0.45,
    sleeveLength: 0.12,
    collarCount: 26,
    sockStyles: ["Standard"],
    hasTuckedIn: false,
    hasUndershirt: false,
    hasNeckwarmer: false,
    hasMannequin: false,
  };
}

export const TEMPLATES: KitTemplate[] = [
  EAFC_REGULAR,
  EAFC_TIGHT,
  EAFC_WOMEN,
  EAFC_MINIKIT,
  EAFC_HANGER,
  EAFC_FLYING,
  FIFA21_REGULAR,
  FIFA21_TIGHT,
  FIFA21_WOMEN,
  FIFA21_HANGER,
  PES_REGULAR,
  FM_REGULAR,
];

export function getTemplate(id: string): KitTemplate {
  return TEMPLATES.find((t) => t.id === id) ?? EAFC_REGULAR;
}

export function templatesForGame(game: GameId): KitTemplate[] {
  return TEMPLATES.filter((t) => t.game === game);
}

export const DEFAULT_SETTINGS = {
  // A classic white shirt / black shorts / white socks kit. Starting on a
  // black palette hides the garment silhouette, which made the 3D preview
  // read as an untextured blob.
  primary: "#f2f4f7",
  secondary: "#101318",
  trim: "#101318",
  pattern: "none",
  patternType: "none",
  sponsor: "none",
  shorts: "#101318",
  socks: "#f2f4f7",
  shortsnumbercolor: "#ffffff",
  socksnumbercolor: "#ffffff",
  collar: 0,
  jerseyfit: "0",
  shortstyle: 0,
  jerseynamelayouttype: 0,
  isCreateAClub: false,
};

export function createInitialKit(templateId = "eafc-regular"): KitState {
  return {
    game: getTemplate(templateId).game,
    templateId,
    settings: { ...DEFAULT_SETTINGS },
    layers: [
      {
        id: "layer-shirt",
        kind: "shirt",
        areaName: "shirt",
        name: "Shirt",
        color: DEFAULT_SETTINGS.primary,
        visible: true,
        opacity: 1,
      },
      {
        id: "layer-shorts",
        kind: "shorts",
        areaName: "shorts",
        name: "Shorts",
        color: DEFAULT_SETTINGS.shorts,
        visible: true,
        opacity: 1,
      },
      {
        id: "layer-socks",
        kind: "socks",
        areaName: "socks",
        name: "Socks",
        color: DEFAULT_SETTINGS.socks,
        visible: true,
        opacity: 1,
      },
    ],
    logos: [],
    hotspots: [],
  };
}
