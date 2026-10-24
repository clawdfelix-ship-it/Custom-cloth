import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createUser, registerSchema } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/session";
import { apiHandler, readJson } from "@/lib/api";

export const POST = apiHandler("auth/register", async (request: Request) => {
  const parsed = await readJson(request);
  if (!parsed.ok) {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const result = registerSchema.safeParse(parsed.value);
  if (!result.success) {
    return NextResponse.json(
      {
        error: "invalid_input",
        issues: result.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 },
    );
  }

  if (result.data.password !== result.data.confirmPassword) {
    return NextResponse.json(
      { error: "password_mismatch" },
      { status: 400 },
    );
  }

  try {
    const user = await createUser(result.data);
    await setSessionCookie({
      id: user.id,
      username: user.username,
      email: user.email,
      tier: 0,
      premium: false,
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Registration failed.";
    return NextResponse.json({ error: message }, { status: 409 });
  }
});
