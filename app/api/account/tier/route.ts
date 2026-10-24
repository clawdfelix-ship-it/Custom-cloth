import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { apiHandler, readJson } from "@/lib/api";

/**
 * Membership tier.
 *
 *   GET  /api/account/tier          -> current tier + limits
 *   POST /api/account/tier          -> set tier (admin only)
 *
 * The tier drives feature gating in the editor. Payment integration is
 * intentionally left out of this route so the tier can be driven by an
 * admin console or a future billing webhook.
 */

const ADMIN_EMAILS = (process.env.PLATFORM_ADMIN_EMAILS ?? "")
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

const TIERS = [0, 1, 2];

export const GET = apiHandler("account/tier", async () => {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    tier: session.tier,
    premium: session.premium,
    email: session.email,
    isAdmin: ADMIN_EMAILS.includes(session.email.toLowerCase()),
  });
});

export const POST = apiHandler("account/tier", async (request: Request) => {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const isAdmin = ADMIN_EMAILS.includes(session.email.toLowerCase());
  if (!isAdmin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const parsed = await readJson(request);
  if (!parsed.ok) {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const body = (parsed.value ?? {}) as { tier?: number; email?: string };

  const targetEmail = (body.email ?? session.email).toLowerCase();
  const tier = body.tier;

  if (tier === undefined || !TIERS.includes(tier)) {
    return NextResponse.json(
      { error: "invalid_tier", allowed: TIERS },
      { status: 400 },
    );
  }

  const user = await prisma.user.update({
    where: { email: targetEmail },
    data: { tier },
    select: { id: true, username: true, email: true, tier: true },
  });

  return NextResponse.json({ user });
});
