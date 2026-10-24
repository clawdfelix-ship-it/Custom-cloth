"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Hotspot, KitLogo, KitState } from "@/types/kit";
import { Button, NumberInput } from "@/components/ui/Panel";

/**
 * Hotspot editor.
 *
 * Hotspots mark where a crest, sponsor or brand should sit on the garment so
 * the game engine can place the crest automatically. The user drags a marker
 * over the 3D preview; we ray-cast against the garment to resolve the exact
 * surface position, then convert it into the normalized UV the export
 * format expects.
 */

interface HotspotEditorProps {
  kit: KitState;
  onChange: (kit: KitState) => void;
  container: HTMLElement | null;
  enabled: boolean;
}

interface PendingHotspot {
  id: string;
  logoId: string | null;
  group: "jersey" | "shorts" | "socks";
  name: string;
}

export function HotspotEditor({
  kit,
  onChange,
  container,
  enabled,
}: HotspotEditorProps) {
  const [pending, setPending] = useState<PendingHotspot | null>(null);
  const [dragState, setDragState] = useState<{ id: string; u: number; v: number } | null>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  const commitHotspot = useCallback(
    (hotspot: Hotspot) => {
      const next: KitState = {
        ...kit,
        settings: { ...kit.settings },
        layers: kit.layers.map((l) => ({ ...l })),
        logos: kit.logos.map((l) => ({ ...l })),
        hotspots: [...kit.hotspots],
      };
      next.hotspots.push(hotspot);
      onChange(next);
    },
    [kit, onChange],
  );

  const updateHotspot = useCallback(
    (id: string, patch: Partial<Hotspot>) => {
      const next: KitState = {
        ...kit,
        settings: { ...kit.settings },
        layers: kit.layers.map((l) => ({ ...l })),
        logos: kit.logos.map((l) => ({ ...l })),
        hotspots: kit.hotspots.map((h) =>
          h.Name === id ? { ...h, ...patch } : h,
        ),
      };
      onChange(next);
    },
    [kit, onChange],
  );

  const removeHotspot = useCallback(
    (name: string) => {
      const next: KitState = {
        ...kit,
        settings: { ...kit.settings },
        layers: kit.layers.map((l) => ({ ...l })),
        logos: kit.logos.map((l) => ({ ...l })),
        hotspots: kit.hotspots.filter((h) => h.Name !== name),
      };
      onChange(next);
    },
    [kit, onChange],
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (!enabled || !pending || !container) return;
      const scene = (container as unknown as { __kitScene?: { pickGarmentUv: (x: number, y: number) => { u: number; v: number } | null } }).__kitScene;
      if (!scene) return;
      const uv = scene.pickGarmentUv(event.clientX, event.clientY);
      if (!uv) return;

      commitHotspot({
        Group: pending.group,
        Name: pending.name,
        Bounds: { x: uv.u - 0.05, y: 1 - uv.v - 0.05, width: 0.1, height: 0.1 },
        Rotation: 0,
      });
      setPending(null);
    },
    [enabled, pending, container, commitHotspot],
  );

  const suggestedNames: { group: "jersey" | "shorts" | "socks"; name: string }[] = [
    { group: "jersey", name: "team" },
    { group: "jersey", name: "brand" },
    { group: "jersey", name: "sponsor" },
    { group: "shorts", name: "team" },
    { group: "shorts", name: "brand" },
  ];

  if (!enabled) {
    return (
      <div className="rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
        <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
          Hotspots
        </h2>
        <p className="text-[12px] text-[var(--color-ink-faint)]">
          Hotspot placement requires a paid membership. Upgrade to mark where the
          crest, sponsor and brand should appear on the garment.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
      <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
        Hotspots
      </h2>

      {pending ? (
        <p className="mb-2 rounded-[var(--radius-control)] bg-[var(--color-accent)]/10 px-2 py-1.5 text-[12px] text-[var(--color-accent)]">
          Click the garment to place the “{pending.name}” hotspot.
          <button
            onClick={() => setPending(null)}
            className="ml-2 underline"
          >
            cancel
          </button>
        </p>
      ) : (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {suggestedNames.map((suggestion) => (
            <Button
              key={`${suggestion.group}-${suggestion.name}`}
              onClick={() =>
                setPending({
                  id: `${suggestion.group}-${suggestion.name}`,
                  logoId: null,
                  group: suggestion.group,
                  name: suggestion.name,
                })
              }
            >
              + {suggestion.group} {suggestion.name}
            </Button>
          ))}
        </div>
      )}

      {kit.hotspots.length === 0 ? (
        <p className="text-[12px] text-[var(--color-ink-faint)]">
          No hotspots yet. Add one, then click the garment in the 3D preview.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {kit.hotspots.map((hotspot, index) => (
            <li
              key={`${hotspot.Group}-${hotspot.Name}-${index}`}
              className="rounded-[var(--radius-control)] border border-[var(--color-line)] p-2"
            >
              <div className="mb-1.5 flex items-center gap-2">
                <span className="text-[12px] font-medium">
                  {hotspot.Group} · {hotspot.Name}
                </span>
                <Button
                  variant="danger"
                  className="ml-auto"
                  onClick={() => removeHotspot(hotspot.Name)}
                >
                  Remove
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1 text-[11px] text-[var(--color-ink-muted)]">
                  X
                  <NumberInput
                    value={Number(hotspot.Bounds.x.toFixed(3))}
                    step={0.01}
                    onChange={(value) =>
                      updateHotspot(hotspot.Name, {
                        Bounds: { ...hotspot.Bounds, x: value },
                      })
                    }
                  />
                </label>
                <label className="flex flex-col gap-1 text-[11px] text-[var(--color-ink-muted)]">
                  Y
                  <NumberInput
                    value={Number(hotspot.Bounds.y.toFixed(3))}
                    step={0.01}
                    onChange={(value) =>
                      updateHotspot(hotspot.Name, {
                        Bounds: { ...hotspot.Bounds, y: value },
                      })
                    }
                  />
                </label>
                <label className="flex flex-col gap-1 text-[11px] text-[var(--color-ink-muted)]">
                  Width
                  <NumberInput
                    value={Number(hotspot.Bounds.width.toFixed(3))}
                    step={0.01}
                    onChange={(value) =>
                      updateHotspot(hotspot.Name, {
                        Bounds: { ...hotspot.Bounds, width: value },
                      })
                    }
                  />
                </label>
                <label className="flex flex-col gap-1 text-[11px] text-[var(--color-ink-muted)]">
                  Rotation
                  <NumberInput
                    value={hotspot.Rotation}
                    step={1}
                    onChange={(value) =>
                      updateHotspot(hotspot.Name, { Rotation: value })
                    }
                  />
                </label>
              </div>
            </li>
          ))}
        </ul>
      )}

      <input type="hidden" readOnly value={dragState?.id ?? ""} />
    </div>
  );
}
