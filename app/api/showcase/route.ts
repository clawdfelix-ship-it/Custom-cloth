import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { z } from "zod";
import { apiHandler, readJson } from "@/lib/api";

/**
 * Public showcase gallery.
 *
 *   GET    /api/showcase?game=FIFA&take=48
 *   POST   /api/showcase          publish a saved kit
 *   DELETE /api/showcase?id=<id>  unpublish (owner only)
 */

const publishSchema = z.object({
  kitId: z.string().min(1),
  title: z.string().min(1).max(120),
});

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export const GET = apiHandler("showcase", async (request: Request) => {
  const url = new URL(request.url);
  const game = url.searchParams.get("game");
  const take = Math.min(Number(url.searchParams.get("take") ?? 48), 96);

  const entries = await prisma.showcase.findMany({
    where: game ? { game } : undefined,
    orderBy: { createdAt: "desc" },
    take,
  });

  return NextResponse.json({ entries, count: entries.length });
});

export const POST = apiHandler("showcase", async (request: Request) => {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsedBody = await readJson(request);
  if (!parsedBody.ok) {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = publishSchema.safeParse(parsedBody.value);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const kit = await prisma.savedKit.findFirst({
    where: { id: parsed.data.kitId, userId: session.id },
  });
  if (!kit) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const base = slugify(parsed.data.title) || kit.id;
  const slug = `${base}-${kit.id.slice(-6)}`;

  const existing = await prisma.showcase.findFirst({
    where: { kitId: kit.id },
  });
  if (existing) {
    return NextResponse.json(
      { error: "already_published", entry: existing },
      { status: 409 },
    );
  }

  const entry = await prisma.showcase.create({
    data: {
      kitId: kit.id,
      slug,
      title: parsed.data.title,
      game: kit.game,
      settings: kit.settings as never,
      preview: kit.preview,
    },
  });

  await prisma.savedKit.update({
    where: { id: kit.id },
    data: { published: true },
  });

  return NextResponse.json({ entry }, { status: 201 });
});

export const DELETE = apiHandler("showcase", async (request: Request) => {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  const entry = await prisma.showcase.findUnique({ where: { id } });
  if (!entry) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const owner = await prisma.savedKit.findUnique({
    where: { id: entry.kitId },
    select: { userId: true },
  });
  if (!owner || owner.userId !== session.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await prisma.showcase.delete({ where: { id } });
  await prisma.savedKit.update({
    where: { id: entry.kitId },
    data: { published: false },
  });

  return NextResponse.json({ ok: true });
});
