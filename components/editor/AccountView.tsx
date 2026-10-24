"use client";

import { useState } from "react";
import { Badge, Button } from "@/components/ui/Panel";
import { TIER_LIMITS } from "@/types/kit";
import { readJsonSafe } from "@/lib/api-client";

const TIER_COPY: Record<number, { name: string; blurb: string }> = {
  0: {
    name: "Free",
    blurb: "Design kits with the core colour, pattern and 3D preview tools.",
  },
  1: {
    name: "Tier 1",
    blurb: "Adds hotspot export, freeform paths, separate logo textures and logo positioning.",
  },
  2: {
    name: "Tier 2",
    blurb: "Adds stencils, the highest custom image allowance and unlimited saved kits.",
  },
};

export function AccountView({
  username,
  email,
  tier,
  premium,
}: {
  username: string;
  email: string;
  tier: number;
  premium: boolean;
}) {
  const [status, setStatus] = useState("");
  const [twoFactorOn, setTwoFactorOn] = useState(false);
  const [code, setCode] = useState("");

  const effectiveTier = tier === 0 && premium ? 1 : tier;
  const limits = TIER_LIMITS[effectiveTier] ?? TIER_LIMITS[0];

  const requestCode = async () => {
    setStatus("Sending code…");
    try {
      const response = await fetch("/api/auth/two-factor", { method: "POST" });
      const result = await readJsonSafe<{ error?: string; devCode?: string }>(
        response,
      );
      if (!result.ok) throw new Error(result.error ?? "Failed to send code.");
      setStatus(
        result.data?.devCode
          ? `Development code: ${result.data.devCode}`
          : "Code sent to your email.",
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to send code.");
    }
  };

  const verifyCode = async () => {
    setStatus("Verifying…");
    try {
      const response = await fetch("/api/auth/two-factor?verify=1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const result = await readJsonSafe<{ error?: string }>(response);
      if (!result.ok) throw new Error(result.error ?? "Verification failed.");
      setTwoFactorOn(true);
      setStatus("Two-factor protection is now on.");
      setCode("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Verification failed.");
    }
  };

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  const features: { label: string; enabled: boolean }[] = [
    { label: "Core kit designer", enabled: true },
    { label: "Save kits", enabled: true },
    { label: "Publish to showcase", enabled: true },
    { label: "Hotspot export", enabled: limits.canUseHotspots },
    { label: "Freeform path editor", enabled: limits.canUseFreeformPath },
    { label: "Separate logo textures", enabled: limits.canRenderLogosSeparately },
    { label: "Logo positioning", enabled: limits.canPositionLogos },
    { label: "Stencil baking", enabled: limits.canUseStencils },
  ];

  return (
    <main className="min-h-dvh bg-[var(--color-surface-sunken)]">
      <header className="flex h-12 items-center gap-3 border-b border-[var(--color-line)] bg-[var(--color-surface)] px-4">
        <a href="/editor" className="text-[13px] font-semibold hover:underline">
          Zenex Sports Custom
        </a>
        <span className="text-[12px] text-[var(--color-ink-faint)]">/ Account</span>
        <div className="ml-auto flex items-center gap-2">
          <a href="/saved">
            <Button>Saved kits</Button>
          </a>
          <Button onClick={() => void signOut()}>Sign out</Button>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-6 py-6">
        <section className="mb-4 rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-surface-raised)] text-[14px] font-semibold uppercase">
              {username.slice(0, 2)}
            </div>
            <div className="min-w-0">
              <p className="text-[14px] font-semibold">{username}</p>
              <p className="truncate text-[12px] text-[var(--color-ink-muted)]">{email}</p>
            </div>
            <Badge tone={effectiveTier > 0 ? "accent" : "neutral"} className="ml-auto">
              {TIER_COPY[effectiveTier].name}
            </Badge>
          </div>
          <p className="mt-3 text-[12px] text-[var(--color-ink-muted)]">
            {TIER_COPY[effectiveTier].blurb}
          </p>
        </section>

        <section className="mb-4 rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
          <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
            Features
          </h2>
          <ul className="flex flex-col gap-1.5">
            {features.map((feature) => (
              <li
                key={feature.label}
                className="flex items-center justify-between text-[12px]"
              >
                <span
                  className={
                    feature.enabled
                      ? "text-[var(--color-ink)]"
                      : "text-[var(--color-ink-faint)]"
                  }
                >
                  {feature.label}
                </span>
                <span
                  className={
                    feature.enabled
                      ? "text-[var(--color-accent)]"
                      : "text-[var(--color-ink-faint)]"
                  }
                >
                  {feature.enabled ? "Available" : "Locked"}
                </span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-[var(--color-line)] pt-4 text-[12px]">
            <div>
              <dt className="text-[var(--color-ink-faint)]">Custom images</dt>
              <dd className="mt-0.5 font-medium">{limits.maxCustomImages}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-ink-faint)]">Saved kits</dt>
              <dd className="mt-0.5 font-medium">{limits.maxSavedKits}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
          <h2 className="mb-1 text-[13px] font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
            Two-factor protection
          </h2>
          <p className="mb-3 text-[12px] text-[var(--color-ink-muted)]">
            Require a one-time code before deleting a saved kit.
          </p>
          {twoFactorOn ? (
            <Badge tone="accent">Enabled</Badge>
          ) : (
            <div className="flex flex-wrap items-end gap-2">
              <Button onClick={() => void requestCode()}>Email me a code</Button>
              <input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="6-digit code"
                inputMode="numeric"
                className="h-8 w-32 rounded-[var(--radius-control)] border border-[var(--color-line)] bg-[var(--color-surface-sunken)] px-2 text-[12px] outline-none focus:border-[var(--color-line-strong)]"
              />
              <Button variant="primary" onClick={() => void verifyCode()}>
                Verify
              </Button>
            </div>
          )}
          {status ? (
            <p className="mt-3 text-[12px] text-[var(--color-ink-muted)]">{status}</p>
          ) : null}
        </section>
      </div>
    </main>
  );
}
