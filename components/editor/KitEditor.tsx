"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { KitScene } from "@/lib/three/KitScene";
import {
  createInitialKit,
  getTemplate,
  templatesForGame,
} from "@/lib/kits/templates";
import { renderArea } from "@/lib/render/layerRenderer";
import { downloadBlob, exportKitZip } from "@/lib/render/exporter";
import { TIER_LIMITS, type KitLogo, type KitState, type UserTierLimits } from "@/types/kit";
import { Badge, Button, ColorInput, Field, NumberInput, Panel, Select } from "@/components/ui/Panel";
import { HotspotEditor } from "@/components/editor/HotspotEditor";
import { LogoImageUpload } from "@/components/editor/LogoImageUpload";

const PATTERNS = [
  { value: "none", label: "Solid" },
  { value: "stripes", label: "Stripes" },
  { value: "hoops", label: "Hoops" },
  { value: "halves", label: "Halves" },
  { value: "sash", label: "Sash" },
  { value: "checks", label: "Checks" },
  { value: "gradient", label: "Gradient" },
];

const LOGO_SUBTYPES = [
  { value: "team", label: "Team badge" },
  { value: "brand", label: "Brand" },
  { value: "sponsor", label: "Sponsor" },
  { value: "badge", label: "Badge" },
  { value: "text", label: "Text" },
];

interface KitEditorProps {
  tier: number;
  premium: boolean;
  username?: string;
}

export function KitEditor({ tier, premium, username }: KitEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<KitScene | null>(null);
  const [kit, setKit] = useState<KitState>(() => createInitialKit());
  const [textureVersion, setTextureVersion] = useState(0);
  const [status, setStatus] = useState("");
  const [activeTab, setActiveTab] = useState<
    "colors" | "logos" | "hotspots" | "export" | "settings"
  >("colors");

  const limits: UserTierLimits = useMemo(() => {
    const base = TIER_LIMITS[tier] ?? TIER_LIMITS[0];
    if (premium && tier === 0) {
      return {
        ...base,
        maxCustomImages: 50,
        canUseHotspots: true,
        canRenderLogosSeparately: true,
        canPositionLogos: true,
        maxSavedKits: 25,
      };
    }
    return base;
  }, [tier, premium]);

  // --- 3D scene lifecycle -------------------------------------------------
  useEffect(() => {
    if (!containerRef.current) return;
    const scene = new KitScene({
      container: containerRef.current,
      template: getTemplate(kit.templateId),
    });
    sceneRef.current = scene;
    scene.applyKit(kit);
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
    // The scene is created once; template changes rebuild the garment in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- re-render texture and push into the 3D preview ---------------------
  useEffect(() => {
    const textures = renderArea("shirt", { kit });
    sceneRef.current?.setTexture(textures.color);
    setTextureVersion((v) => v + 1);
  }, [kit]);

  const update = useCallback((mutate: (draft: KitState) => void) => {
    setKit((current) => {
      const next: KitState = {
        ...current,
        settings: { ...current.settings },
        layers: current.layers.map((layer) => ({ ...layer })),
        logos: current.logos.map((logo) => ({ ...logo })),
        hotspots: [...current.hotspots],
      };
      mutate(next);
      return next;
    });
  }, []);

  const setSetting = useCallback(
    (key: keyof KitState["settings"], value: string | number | boolean) => {
      update((draft) => {
        (draft.settings as Record<string, unknown>)[key] = value;
      });
    },
    [update],
  );

  const setLayerColor = useCallback(
    (layerId: string, color: string) => {
      update((draft) => {
        const layer = draft.layers.find((l) => l.id === layerId);
        if (layer) layer.color = color;
        if (layerId === "layer-shirt") draft.settings.primary = color;
        if (layerId === "layer-shorts") draft.settings.shorts = color;
        if (layerId === "layer-socks") draft.settings.socks = color;
      });
    },
    [update],
  );

  const setLayerPattern = useCallback(
    (layerId: string, pattern: string) => {
      update((draft) => {
        const layer = draft.layers.find((l) => l.id === layerId);
        if (layer) layer.pattern = pattern;
        if (layerId === "layer-shirt") draft.settings.pattern = pattern;
      });
    },
    [update],
  );

  const addLogo = useCallback(() => {
    if (kit.logos.length >= limits.maxCustomImages) {
      setStatus(
        `Custom image limit reached (${limits.maxCustomImages}). Upgrade for more.`,
      );
      return;
    }
    const logo: KitLogo = {
      id: `logo-${Date.now()}`,
      name: `Logo ${kit.logos.length + 1}`,
      subtype: "team",
      areaName: "shirt",
      position: { x: 0.5, y: 0.22 },
      scale: 0.14,
      rotation: 0,
      zIndex: kit.logos.length,
      renderedSeparately: false,
      opacity: 1,
    };
    update((draft) => {
      draft.logos.push(logo);
    });
  }, [kit.logos.length, limits.maxCustomImages, update]);

  const updateLogo = useCallback(
    (logoId: string, patch: Partial<KitLogo>) => {
      update((draft) => {
        const logo = draft.logos.find((l) => l.id === logoId);
        if (logo) Object.assign(logo, patch);
      });
    },
    [update],
  );

  const handleLogoUpload = useCallback(
    (url: string, name: string) => {
      const logoId = kit.logos.length > 0 ? kit.logos[kit.logos.length - 1].id : null;
      if (!logoId) {
        addLogo();
        return;
      }
      updateLogo(logoId, { src: url, name });
      setStatus(`Attached ${name}.`);
    },
    [kit.logos, addLogo, updateLogo],
  );

  const removeLogo = useCallback(
    (logoId: string) => {
      update((draft) => {
        draft.logos = draft.logos.filter((l) => l.id !== logoId);
      });
    },
    [update],
  );

  const switchTemplate = useCallback((templateId: string) => {
    const template = getTemplate(templateId);
    setKit((current) => ({
      ...current,
      templateId,
      game: template.game,
    }));
    sceneRef.current?.buildGarment(template);
  }, []);

  const switchGame = useCallback((game: string) => {
    const available = templatesForGame(game as KitState["game"]);
    if (available.length === 0) return;
    switchTemplate(available[0].id);
  }, [switchTemplate]);

  // --- export -------------------------------------------------------------
  const handleExport = useCallback(async () => {
    setStatus("Building kit archive…");
    try {
      const result = await exportKitZip({
        kit,
        includeHotspots: limits.canUseHotspots,
        renderLogosSeparately: limits.canRenderLogosSeparately,
        fileName: `kit-${kit.templateId}-${Date.now()}`,
      });
      downloadBlob(result.blob, result.fileName);
      setStatus(`Exported ${result.files.length} files.`);
    } catch (error) {
      setStatus(
        `Export failed: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }
  }, [kit, limits.canUseHotspots, limits.canRenderLogosSeparately]);

  const handleSave = useCallback(async () => {
    setStatus("Saving…");
    try {
      const response = await fetch("/api/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Kit ${new Date().toLocaleDateString()}`,
          game: kit.game,
          template: kit.templateId,
          settings: {
            settings: kit.settings,
            layers: kit.layers,
            logos: kit.logos,
            hotspots: kit.hotspots,
          },
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${response.status})`);
      }
      setStatus("Kit saved.");
    } catch (error) {
      setStatus(
        `Save failed: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }
  }, [kit]);

  const shirts = kit.layers.filter((l) => l.kind === "shirt");
  const shorts = kit.layers.filter((l) => l.kind === "shorts");
  const socks = kit.layers.filter((l) => l.kind === "socks");

  return (
    <div className="flex h-dvh flex-col bg-[var(--color-surface-sunken)]">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-[var(--color-line)] bg-[var(--color-surface)] px-4">
        <span className="text-[13px] font-semibold">Zenex Sports Custom</span>
        <nav className="flex items-center gap-1">
          {(["colors", "logos", "hotspots", "export", "settings"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`h-7 rounded-[var(--radius-control)] px-2.5 text-[12px] font-medium capitalize transition-colors ${
                activeTab === tab
                  ? "bg-[var(--color-surface-raised)] text-[var(--color-ink)]"
                  : "text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[12px] text-[var(--color-ink-muted)]">
            {status}
          </span>
          {username ? (
            <Badge tone={tier > 0 || premium ? "accent" : "neutral"}>
              {username}
            </Badge>
          ) : null}
          <Button onClick={handleSave} disabled={!username}>
            Save kit
          </Button>
          <Button variant="primary" onClick={handleExport}>
            Export ZIP
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Left rail: garment options */}
        <aside className="scroll-thin w-[300px] shrink-0 overflow-y-auto border-r border-[var(--color-line)] bg-[var(--color-surface)] p-3">
          <div className="flex flex-col gap-3">
            <Panel title="Template">
              <div className="flex flex-col gap-2">
                <Field label="Game">
                  <Select
                    value={kit.game}
                    onChange={switchGame}
                    options={[
                      { value: "FIFA", label: "FIFA" },
                      { value: "PES", label: "PES" },
                      { value: "FM", label: "Football Manager" },
                    ]}
                  />
                </Field>
                <Field label="Kit type">
                  <Select
                    value={kit.templateId}
                    onChange={switchTemplate}
                    options={templatesForGame(kit.game).map((t) => ({
                      value: t.id,
                      label: t.name,
                    }))}
                  />
                </Field>
                <Field label="Collar" hint={`${kit.settings.collar + 1} / 26`}>
                  <input
                    type="range"
                    min={0}
                    max={25}
                    value={kit.settings.collar}
                    onChange={(event) =>
                      setSetting("collar", Number(event.target.value))
                    }
                    className="w-full accent-[var(--color-accent)]"
                  />
                </Field>
              </div>
            </Panel>

            {activeTab === "colors" ? (
              <>
                <Panel title="Kit colours">
                  <div className="flex flex-col gap-3">
                    {shirts.map((layer) => (
                      <Field key={layer.id} label="Shirt">
                        <ColorInput
                          value={layer.color}
                          onChange={(value) => setLayerColor(layer.id, value)}
                        />
                      </Field>
                    ))}
                    <Field label="Shirt pattern">
                      <Select
                        value={shirts[0]?.pattern ?? "none"}
                        onChange={(value) => setLayerPattern("layer-shirt", value)}
                        options={PATTERNS}
                      />
                    </Field>
                    {shorts.map((layer) => (
                      <Field key={layer.id} label="Shorts">
                        <ColorInput
                          value={layer.color}
                          onChange={(value) => setLayerColor(layer.id, value)}
                        />
                      </Field>
                    ))}
                    {socks.map((layer) => (
                      <Field key={layer.id} label="Socks">
                        <ColorInput
                          value={layer.color}
                          onChange={(value) => setLayerColor(layer.id, value)}
                        />
                      </Field>
                    ))}
                  </div>
                </Panel>

                <Panel title="Numbers">
                  <div className="flex flex-col gap-3">
                    <Field label="Shorts number colour">
                      <ColorInput
                        value={kit.settings.shortsnumbercolor}
                        onChange={(value) => setSetting("shortsnumbercolor", value)}
                      />
                    </Field>
                    <Field label="Socks number colour">
                      <ColorInput
                        value={kit.settings.socksnumbercolor}
                        onChange={(value) => setSetting("socksnumbercolor", value)}
                      />
                    </Field>
                    <Field label="Number layout">
                      <NumberInput
                        value={kit.settings.jerseynamelayouttype}
                        min={0}
                        max={1}
                        onChange={(value) => setSetting("jerseynamelayouttype", value)}
                      />
                    </Field>
                  </div>
                </Panel>
              </>
            ) : null}

            {activeTab === "logos" ? (
              <Panel
                title={`Logos (${kit.logos.length})`}
                action={
                  <div className="flex gap-2">
                    <Button onClick={addLogo} disabled={!limits.maxCustomImages}>
                      Add logo
                    </Button>
                  </div>
                }
              >
                {kit.logos.length === 0 ? (
                  <p className="text-[12px] text-[var(--color-ink-faint)]">
                    No logos yet. Add one to place a badge, sponsor or brand mark.
                  </p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {kit.logos.map((logo) => (
                      <div
                        key={logo.id}
                        className="rounded-[var(--radius-control)] border border-[var(--color-line)] p-2.5"
                      >
                        <div className="mb-2 flex items-center gap-2">
                          <input
                            value={logo.name}
                            onChange={(event) =>
                              updateLogo(logo.id, { name: event.target.value })
                            }
                            className="h-7 flex-1 rounded-[var(--radius-control)] border border-[var(--color-line)] bg-[var(--color-surface-sunken)] px-2 text-[12px] outline-none focus:border-[var(--color-line-strong)]"
                          />
                          <Button variant="danger" onClick={() => removeLogo(logo.id)}>
                            Remove
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Field label="Type">
                            <Select
                              value={logo.subtype}
                              onChange={(value) =>
                                updateLogo(logo.id, {
                                  subtype: value as KitLogo["subtype"],
                                })
                              }
                              options={LOGO_SUBTYPES}
                            />
                          </Field>
                          <Field label="Area">
                            <Select
                              value={logo.areaName}
                              onChange={(value) =>
                                updateLogo(logo.id, {
                                  areaName: value as KitLogo["areaName"],
                                })
                              }
                              options={[
                                { value: "shirt", label: "Shirt" },
                                { value: "shorts", label: "Shorts" },
                                { value: "socks", label: "Socks" },
                              ]}
                            />
                          </Field>
                        </div>
                        <div className="mt-2 grid grid-cols-3 gap-2">
                          <Field label="X">
                            <NumberInput
                              value={Number(logo.position.x.toFixed(3))}
                              step={0.01}
                              min={0}
                              max={1}
                              disabled={!limits.canPositionLogos}
                              onChange={(value) =>
                                updateLogo(logo.id, {
                                  position: { ...logo.position, x: value },
                                })
                              }
                            />
                          </Field>
                          <Field label="Y">
                            <NumberInput
                              value={Number(logo.position.y.toFixed(3))}
                              step={0.01}
                              min={0}
                              max={1}
                              disabled={!limits.canPositionLogos}
                              onChange={(value) =>
                                updateLogo(logo.id, {
                                  position: { ...logo.position, y: value },
                                })
                              }
                            />
                          </Field>
                          <Field label="Scale">
                            <NumberInput
                              value={Number(logo.scale.toFixed(3))}
                              step={0.01}
                              min={0.01}
                              max={1}
                              disabled={!limits.canPositionLogos}
                              onChange={(value) => updateLogo(logo.id, { scale: value })}
                            />
                          </Field>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <label className="flex items-center gap-1.5 text-[11px] text-[var(--color-ink-muted)]">
                            <input
                              type="checkbox"
                              checked={logo.renderedSeparately}
                              disabled={!limits.canRenderLogosSeparately}
                              onChange={(event) =>
                                updateLogo(logo.id, {
                                  renderedSeparately: event.target.checked,
                                })
                              }
                            />
                            Separate texture
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            ) : null}

            {activeTab === "hotspots" ? (
              <HotspotEditor
                kit={kit}
                onChange={setKit}
                container={containerRef.current}
                enabled={limits.canUseHotspots}
              />
            ) : null}

            {activeTab === "export" ? (
              <Panel title="Export">
                <div className="flex flex-col gap-3 text-[12px] text-[var(--color-ink-muted)]">
                  <p>
                    Produces a ZIP with the colour, normal, coefficient and TAA
                    texture maps for shirt, shorts and socks, plus
                    <code className="mx-1 rounded bg-[var(--color-surface-raised)] px-1 py-0.5 font-mono text-[11px] text-[var(--color-ink)]">
                      settings.json
                    </code>
                    .
                  </p>
                  {limits.canUseHotspots ? (
                    <p>
                      The hotspot file
                      <code className="mx-1 rounded bg-[var(--color-surface-raised)] px-1 py-0.5 font-mono text-[11px] text-[var(--color-ink)]">
                        hotspots.hotspot
                      </code>
                      will be included.
                    </p>
                  ) : (
                    <Badge tone="warn">
                      Hotspot export requires a paid membership
                    </Badge>
                  )}
                  <Button variant="primary" onClick={handleExport}>
                    Export ZIP
                  </Button>
                </div>
              </Panel>
            ) : null}

            {activeTab === "settings" ? (
              <Panel title="Kit settings">
                <div className="flex flex-col gap-3">
                  <Field label="Primary colour">
                    <ColorInput
                      value={kit.settings.primary}
                      onChange={(value) => setSetting("primary", value)}
                    />
                  </Field>
                  <Field label="Secondary colour">
                    <ColorInput
                      value={kit.settings.secondary}
                      onChange={(value) => setSetting("secondary", value)}
                    />
                  </Field>
                  <Field label="Trim colour">
                    <ColorInput
                      value={kit.settings.trim}
                      onChange={(value) => setSetting("trim", value)}
                    />
                  </Field>
                  <Field label="Jersey fit">
                    <Select
                      value={kit.settings.jerseyfit}
                      onChange={(value) => setSetting("jerseyfit", value)}
                      options={[
                        { value: "0", label: "Regular" },
                        { value: "1", label: "Tight" },
                      ]}
                    />
                  </Field>
                  <Field label="Shorts style">
                    <NumberInput
                      value={kit.settings.shortstyle}
                      min={0}
                      max={6}
                      onChange={(value) => setSetting("shortstyle", value)}
                    />
                  </Field>
                  <label className="flex items-center gap-2 text-[12px] text-[var(--color-ink-muted)]">
                    <input
                      type="checkbox"
                      checked={kit.settings.isCreateAClub}
                      onChange={(event) =>
                        setSetting("isCreateAClub", event.target.checked)
                      }
                    />
                    Create A Club kit
                  </label>
                </div>
              </Panel>
            ) : null}
          </div>
        </aside>

        {/* Centre: 3D preview */}
        <main className="relative min-w-0 flex-1">
          <div ref={containerRef} className="absolute inset-0" />
          <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-2">
            <Badge>3D preview</Badge>
            <Badge tone="neutral">
              texture v{textureVersion}
            </Badge>
          </div>
        </main>

        {/* Right rail: texture preview */}
        <aside className="scroll-thin w-[280px] shrink-0 overflow-y-auto border-l border-[var(--color-line)] bg-[var(--color-surface)] p-3">
          <Panel title="Texture preview">
            <div className="flex flex-col gap-3">
              <TexturePreview area="shirt" kit={kit} />
              <TexturePreview area="shorts" kit={kit} />
              <TexturePreview area="socks" kit={kit} />
            </div>
          </Panel>
        </aside>
      </div>
    </div>
  );
}

function TexturePreview({
  area,
  kit,
}: {
  area: "shirt" | "shorts" | "socks";
  kit: KitState;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const textures = renderArea(area, { kit });
    const target = canvasRef.current;
    if (!target) return;
    target.width = textures.color.width;
    target.height = textures.color.height;
    const ctx = target.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, target.width, target.height);
    ctx.drawImage(textures.color, 0, 0);
  }, [area, kit]);

  return (
    <figure className="flex flex-col gap-1.5">
      <canvas
        ref={canvasRef}
        className="w-full rounded-[var(--radius-control)] border border-[var(--color-line)] bg-[var(--color-surface-sunken)]"
        style={{ imageRendering: "pixelated" }}
      />
      <figcaption className="text-[11px] capitalize text-[var(--color-ink-faint)]">
        {area} colour map
      </figcaption>
    </figure>
  );
}
