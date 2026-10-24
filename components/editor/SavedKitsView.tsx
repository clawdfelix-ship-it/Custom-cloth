"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Select } from "@/components/ui/Panel";
import { readJsonSafe } from "@/lib/api-client";

interface KitRow {
  id: string;
  name: string;
  game: string;
  template: string;
  settings: unknown;
  preview: string | null;
  published: boolean;
  createdAt: string;
}

const SORTS = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "name", label: "Name (asc.)" },
  { value: "name_desc", label: "Name (desc.)" },
];

export function SavedKitsView({
  username,
  tier,
  premium,
}: {
  username: string;
  tier: number;
  premium: boolean;
}) {
  const [kits, setKits] = useState<KitRow[]>([]);
  const [sorting, setSorting] = useState("newest");
  const [filter, setFilter] = useState("");
  const [game, setGame] = useState<string>("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const params = new URLSearchParams({ mode: "list", sorting });
      if (filter) params.set("filter", filter);
      if (game) params.set("game", game);
      const response = await fetch(`/api/saved?${params.toString()}`);
      const result = await readJsonSafe<{ kits?: KitRow[] }>(response);
      if (!result.ok) throw new Error(result.error ?? "Failed to load kits.");
      setKits(result.data?.kits ?? []);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to load kits.");
    } finally {
      setBusy(false);
    }
  }, [sorting, filter, game]);

  useEffect(() => {
    void load();
  }, [load]);

  const publish = async (kit: KitRow) => {
    setStatus("Publishing…");
    try {
      const response = await fetch("/api/showcase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kitId: kit.id, title: kit.name }),
      });
      const result = await readJsonSafe<{ error?: string }>(response);
      if (!result.ok) throw new Error(result.error ?? "Publish failed.");
      setStatus(`Published "${kit.name}" to the showcase.`);
      await load();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Publish failed.");
    }
  };

  const remove = async (kit: KitRow) => {
    if (!confirm(`Delete "${kit.name}"?`)) return;
    setStatus("Deleting…");
    try {
      const response = await fetch(`/api/saved?id=${kit.id}`, { method: "DELETE" });
      if (response.status === 428) {
        const code = prompt("Two-factor code (check your email):");
        if (!code) return;
        const retry = await fetch(
          `/api/saved?id=${kit.id}&two_factor_code=${encodeURIComponent(code)}`,
          { method: "DELETE" },
        );
        if (!retry.ok) throw new Error("Verification failed.");
      } else if (!response.ok) {
        const result = await readJsonSafe<{ error?: string }>(response);
        throw new Error(result.error ?? "Delete failed.");
      }
      setStatus("Kit deleted.");
      await load();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Delete failed.");
    }
  };

  const tierLabel = tier === 2 ? "Tier 2" : tier === 1 ? "Tier 1" : premium ? "Premium" : "Free";

  return (
    <main className="min-h-dvh bg-[var(--color-surface-sunken)]">
      <header className="flex h-12 items-center gap-3 border-b border-[var(--color-line)] bg-[var(--color-surface)] px-4">
        <a href="/editor" className="text-[13px] font-semibold hover:underline">
          Zenex Sports Custom
        </a>
        <span className="text-[12px] text-[var(--color-ink-faint)]">/ Saved kits</span>
        <div className="ml-auto flex items-center gap-2">
          <Badge tone={tier > 0 || premium ? "accent" : "neutral"}>
            {username} · {tierLabel}
          </Badge>
          <a href="/account">
            <Button>Account</Button>
          </a>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-6">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <h1 className="text-[16px] font-semibold">My kits</h1>
          <span className="text-[12px] text-[var(--color-ink-muted)]">
            {kits.length} saved
          </span>
          <div className="ml-auto flex items-end gap-2">
            <label className="flex flex-col gap-1 text-[11px] text-[var(--color-ink-muted)]">
              Game
              <Select
                value={game}
                onChange={setGame}
                options={[
                  { value: "", label: "All" },
                  { value: "FIFA", label: "FIFA" },
                  { value: "PES", label: "PES" },
                  { value: "FM", label: "FM" },
                ]}
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-[var(--color-ink-muted)]">
              Sort
              <Select value={sorting} onChange={setSorting} options={SORTS} />
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-[var(--color-ink-muted)]">
              Search
              <input
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="Kit name…"
                className="h-8 w-40 rounded-[var(--radius-control)] border border-[var(--color-line)] bg-[var(--color-surface-sunken)] px-2 text-[12px] outline-none focus:border-[var(--color-line-strong)]"
              />
            </label>
            <Button onClick={() => void load()} disabled={busy}>
              Refresh
            </Button>
          </div>
        </div>

        {status ? (
          <p className="mb-3 text-[12px] text-[var(--color-ink-muted)]">{status}</p>
        ) : null}

        {kits.length === 0 ? (
          <div className="rounded-[var(--radius-panel)] border border-dashed border-[var(--color-line-strong)] p-10 text-center">
            <p className="text-[13px] text-[var(--color-ink-muted)]">
              No kits saved yet.
            </p>
            <a href="/editor" className="mt-3 inline-block">
              <Button variant="primary">Open the editor</Button>
            </a>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {kits.map((kit) => (
              <li
                key={kit.id}
                className="rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-surface)] p-3"
              >
                <div className="mb-2 flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{kit.name}</p>
                    <p className="text-[11px] text-[var(--color-ink-faint)]">
                      {kit.game} · {kit.template} ·{" "}
                      {new Date(kit.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  {kit.published ? <Badge tone="accent">Published</Badge> : null}
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => void publish(kit)} disabled={kit.published}>
                    Publish
                  </Button>
                  <Button variant="danger" onClick={() => void remove(kit)}>
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
