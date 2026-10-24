import { ShowcaseGallery } from "@/components/editor/ShowcaseGallery";

export const dynamic = "force-dynamic";

export default async function ShowcasePage() {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3111"}/api/showcase`,
    { cache: "no-store" },
  ).catch(() => null);

  const entries = response && response.ok ? ((await response.json()) as { entries: unknown[] }).entries : [];

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
