import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/session";
import { apiHandler } from "@/lib/api";

export const POST = apiHandler("auth/logout", async () => {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
});
