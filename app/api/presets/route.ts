import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

/**
 * Colour/pattern presets.
 *
 *   GET    /api/presets?game=FIFA
 *   POST   /api/presets
 *   DELETE /api/presets?id=<presetId>
 */

const presetSchema = z.object({
  name: z.string().min(1).max(80),
  game: z.enum(["FIFA", "PES", "FM"]).default("FIFA"),
  data: z.record(z.string(), z.unknown()),
});

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const game = url.searchParams.get("game");
  const presets = await prisma.preset.findMany({
    where: { userId: session.id, ...(game ? { game } : {}) },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ presets });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = presetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  const preset = await prisma.preset.create({
    data: {
      name: parsed.data.name,
      game: parsed.data.game,
      data: parsed.data.data as never,
      userId: session.id,
    },
  });
  return NextResponse.json({ preset }, { status: 201 });
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }
  const existing = await prisma.preset.findFirst({
    where: { id, userId: session.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  await prisma.preset.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
