import { NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { sendTwoFactorCode } from "@/lib/auth/mailer";
import { apiHandler, readJson } from "@/lib/api";

/**
 * Two-factor verification.
 *
 *   POST /api/auth/two-factor          -> send a code to the signed-in user
 *   POST /api/auth/two-factor?verify=1 -> verify a submitted code
 */

const CODE_TTL_MINUTES = 10;

export const POST = apiHandler("auth/two-factor", async (request: Request) => {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const verifying = url.searchParams.get("verify") === "1";

  if (!verifying) {
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    await prisma.twoFactorCode.create({
      data: {
        userId: session.id,
        code,
        expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60_000),
      },
    });
    const result = await sendTwoFactorCode(
      session.email,
      session.username,
      code,
    );
    return NextResponse.json({
      sent: true,
      delivered: result.delivered,
      ...(result.devCode ? { devCode: result.devCode } : {}),
    });
  }

  const parsed = await readJson(request);
  if (!parsed.ok) {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const body = (parsed.value ?? {}) as { code?: string };

  const code = (body.code ?? "").trim();
  if (!code) {
    return NextResponse.json({ error: "missing_code" }, { status: 400 });
  }

  const record = await prisma.twoFactorCode.findFirst({
    where: { userId: session.id, used: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });

  if (!record || record.code !== code) {
    return NextResponse.json({ error: "invalid_code" }, { status: 403 });
  }

  await prisma.twoFactorCode.update({
    where: { id: record.id },
    data: { used: true },
  });

  return NextResponse.json({ ok: true });
});
