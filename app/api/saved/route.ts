import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { z } from "zod";
import { apiHandler, readJson } from "@/lib/api";

/**
 * Saved kits API.
 *
 * Mirrors the reference implementation's `saved.php` surface but speaks JSON:
 *
 *   GET    /api/saved?mode=list&filter=&sorting=&published=
 *   GET    /api/saved?id=<kitId>
 *   POST   /api/saved            create
 *   PATCH  /api/saved?id=<kitId> update
 *   DELETE /api/saved?id=<kitId> delete (requires two_factor_code when enabled)
 */

const createSchema = z.object({
  name: z.string().min(1).max(120),
  game: z.enum(["FIFA", "PES", "FM"]).default("FIFA"),
  template: z.string().min(1).max(64).default("eafc-regular"),
  settings: z.record(z.string(), z.unknown()),
  preview: z.string().max(2_000_000).optional(),
});

function maxKitsForTier(tier: number): number {
  return tier === 2 ? 1000 : tier === 1 ? 100 : 3;
}

export const GET = apiHandler("saved", async (request: Request) => {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const mode = url.searchParams.get("mode") ?? "list";
  const filter = url.searchParams.get("filter") ?? "";
  const sorting = url.searchParams.get("sorting") ?? "newest";
  const game = url.searchParams.get("game");

  if (id) {
    const kit = await prisma.savedKit.findFirst({
      where: { id, userId: session.id },
    });
    if (!kit) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ kit });
  }

  const orderBy =
    sorting === "oldest"
      ? { createdAt: "asc" as const }
      : sorting === "name"
        ? { name: "asc" as const }
        : sorting === "name_desc"
          ? { name: "desc" as const }
          : { createdAt: "desc" as const };

  const kits = await prisma.savedKit.findMany({
    where: {
      userId: session.id,
      ...(game ? { game } : {}),
      ...(filter
        ? {
            name: {
              contains: filter,
              mode: "insensitive" as const,
            },
          }
        : {}),
    },
    orderBy,
    take: 96,
  });

  // Report the limit the signed-in user actually has, so the client does
  // not have to duplicate the tier table.
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { tier: true, premium: true },
  });
  const tier = user?.tier ?? 0;
  const effectiveTier = tier === 0 && user?.premium ? 1 : tier;

  return NextResponse.json({
    kits,
    mode,
    count: kits.length,
    tiers: { maxSavedKits: maxKitsForTier(effectiveTier) },
  });
});

export const POST = apiHandler("saved", async (request: Request) => {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsedBody = await readJson(request);
  if (!parsedBody.ok) {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = createSchema.safeParse(parsedBody.value);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { tier: true, premium: true },
  });
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const effectiveTier = user.tier === 0 && user.premium ? 1 : user.tier;
  const maxKits = maxKitsForTier(effectiveTier);
  const existing = await prisma.savedKit.count({
    where: { userId: session.id },
  });
  if (existing >= maxKits) {
    return NextResponse.json(
      { error: "kit_limit_reached", limit: maxKits },
      { status: 403 },
    );
  }

  const kit = await prisma.savedKit.create({
    data: {
      name: parsed.data.name,
      game: parsed.data.game,
      template: parsed.data.template,
      settings: parsed.data.settings as never,
      preview: parsed.data.preview ?? null,
      userId: session.id,
    },
  });

  return NextResponse.json({ kit }, { status: 201 });
});

export const PATCH = apiHandler("saved", async (request: Request) => {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  const parsedBody = await readJson(request);
  if (!parsedBody.ok) {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = createSchema.partial().safeParse(parsedBody.value);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const existing = await prisma.savedKit.findFirst({
    where: { id, userId: session.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const kit = await prisma.savedKit.update({
    where: { id },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.game !== undefined ? { game: parsed.data.game } : {}),
      ...(parsed.data.template !== undefined ? { template: parsed.data.template } : {}),
      ...(parsed.data.settings !== undefined
        ? { settings: parsed.data.settings as never }
        : {}),
      ...(parsed.data.preview !== undefined ? { preview: parsed.data.preview } : {}),
    },
  });

  return NextResponse.json({ kit });
});

export const DELETE = apiHandler("saved", async (request: Request) => {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const twoFactorCode = url.searchParams.get("two_factor_code");
  if (!id) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { twoFactorOn: true },
  });
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (user.twoFactorOn) {
    if (!twoFactorCode) {
      return NextResponse.json(
        { error: "two_factor_required" },
        { status: 428 },
      );
    }
    const valid = await verifyTwoFactorCode(session.id, twoFactorCode);
    if (!valid) {
      return NextResponse.json(
        { error: "two_factor_invalid" },
        { status: 403 },
      );
    }
  }

  const existing = await prisma.savedKit.findFirst({
    where: { id, userId: session.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await prisma.savedKit.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});

/** Validate a one-time emailed code. */
async function verifyTwoFactorCode(
  userId: string,
  code: string,
): Promise<boolean> {
  const record = await prisma.twoFactorCode.findFirst({
    where: { userId, used: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!record) return false;
  if (record.code !== code.trim()) return false;
  await prisma.twoFactorCode.update({
    where: { id: record.id },
    data: { used: true },
  });
  return true;
}
