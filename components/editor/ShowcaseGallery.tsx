"use client";

import { useMemo, useState } from "react";

interface ShowcaseEntry {
  id: string;
  slug: string;
  title: string;
  game: string;
  preview: string | null;
  likes: number;
  createdAt: string;
}

export function ShowcaseGallery({ entries }: { entries: ShowcaseEntry[] }) {
  const [game, setGame] = useState<string>("");

  const visible = useMemo(
    () => (game ? entries.filter((entry) => entry.game === game) : entries),
    [entries, game],
  );

  const games = useMemo(
    () => Array.from(new Set(entries.map((entry) => entry.game))),
    [entries],
  );

  return (
    <main className="min-h-dvh bg-[var(--color-surface-sunken)]">
      <header className="flex h-12 items-center gap-3 border-b border-[var(--color-line)] bg-[var(--color-surface)] px-4">
        <a href="/editor" className="text-[13px] font-semibold hover:underline">
          Zenex Sports Custom
        </a>
        <span className="text-[12px] text-[var(--color-ink-faint)]">/ Showcase</span>
        <div className="ml-auto flex items-center gap-2">
          {games.map((value) => (
            <button
              key={value}
              onClick={() => setGame(game === value ? "" : value)}
              className={`h-7 rounded-[var(--radius-chip)] border px-3 text-[12px] font-medium transition-colors ${
                game === value
                  ? "border-[var(--color-accent)]/50 bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                  : "border-[var(--color-line)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-6">
        <h1 className="mb-1 text-[16px] font-semibold">Community showcase</h1>
        <p className="mb-5 text-[12px] text-[var(--color-ink-muted)]">
          {visible.length} published kit{visible.length === 1 ? "" : "s"}
        </p>

        {visible.length === 0 ? (
          <div className="rounded-[var(--radius-panel)] border border-dashed border-[var(--color-line-strong)] p-12 text-center">
            <p className="text-[13px] text-[var(--color-ink-muted)]">
              Nothing published yet. Design a kit and publish it from your saved
              kits.
            </p>
            <a href="/editor" className="mt-3 inline-block">
              <span className="inline-flex h-8 items-center rounded-[var(--radius-control)] bg-[var(--color-accent)] px-3 text-[12px] font-medium text-[var(--color-accent-ink)]">
                Open the editor
              </span>
            </a>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {visible.map((entry) => (
              <li
                key={entry.id}
                className="overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-surface)]"
              >
                <div className="aspect-square w-full bg-[var(--color-surface-sunken)]">
                  {entry.preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={entry.preview}
                      alt={entry.title}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[11px] text-[var(--color-ink-faint)]">
                      No preview
                    </div>
                  )}
                </div>
                <div className="p-2.5">
                  <p className="truncate text-[12px] font-medium">{entry.title}</p>
                  <p className="mt-0.5 flex items-center gap-2 text-[11px] text-[var(--color-ink-faint)]">
                    <span>{entry.game}</span>
                    <span>·</span>
                    <span>{entry.likes} likes</span>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
