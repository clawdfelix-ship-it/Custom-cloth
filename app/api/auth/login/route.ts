import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/session";

export async function POST(request: Request) {
  let body: { username?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { username, password } = body;
  if (!username || !password) {
    return NextResponse.json(
      { error: "missing_credentials" },
      { status: 400 },
    );
  }

  const user = await prisma.user.findFirst({
    where: { OR: [{ username }, { email: username }] },
  });

  // Always run a hash comparison so timing does not leak account existence.
  const passwordHash =
    user?.passwordHash ??
    "$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinva";
  const valid = await verifyPassword(password, passwordHash);

  if (!user || !valid) {
    return NextResponse.json(
      { error: "invalid_credentials" },
      { status: 401 },
    );
  }

  await setSessionCookie({
    id: user.id,
    username: user.username,
    email: user.email,
    tier: user.tier,
    premium: user.premium,
  });

  return NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      tier: user.tier,
      premium: user.premium,
    },
  });
}
