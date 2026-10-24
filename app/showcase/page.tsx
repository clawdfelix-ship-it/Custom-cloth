import { ShowcaseGallery } from "@/components/editor/ShowcaseGallery";

export const dynamic = "force-dynamic";

export default async function ShowcasePage() {
  // The upstream fetch can legitimately fail or return a non-JSON body (a
  // cold start, a 500 from the API, a proxy error page). Reading it with
  // `response.json()` would throw and take the whole page down, so the body
  // is parsed defensively and the gallery degrades to an empty list.
  let entries: unknown[] = [];
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3111"}/api/showcase`,
      { cache: "no-store" },
    );
    if (response.ok) {
      const body = (await response.json()) as { entries?: unknown[] };
      entries = body.entries ?? [];
    }
  } catch {
    entries = [];
  }

  return <ShowcaseGallery entries={entries as ShowcaseEntry[]} />;
}

interface ShowcaseEntry {
  id: string;
  slug: string;
  title: string;
  game: string;
  preview: string | null;
  likes: number;
  createdAt: string;
}
