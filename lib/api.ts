import { NextResponse } from "next/server";

/**
 * Shared helpers for JSON API routes.
 *
 * Why this exists: an unhandled exception inside a Next.js route handler
 * produces a 500 response with an EMPTY body. Client code that calls
 * `response.json()` on that body throws "Unexpected end of JSON input",
 * which hides the real cause behind a confusing parse error.
 *
 * Two rules follow from that:
 *   1. Every route is wrapped in `apiHandler`, so a thrown error always
 *      becomes a JSON body with a useful message.
 *   2. Every request body is read through `readJson`, so a malformed or
 *      empty body becomes a 400 instead of an unhandled throw.
 */

export type RouteHandler = (request: Request) => Promise<Response>;

/**
 * Wrap a route handler so unexpected errors are reported as JSON.
 *
 * The error is logged with the route name so the real cause is still
 * available in the function logs.
 */
export function apiHandler(name: string, handler: RouteHandler): RouteHandler {
  return async (request: Request) => {
    try {
      return await handler(request);
    } catch (error) {
      console.error(
        `[api:${name}] ${request.method} ${request.url} failed:`,
        error,
      );
      const status = prismaStatus(error);
      if (status === 404) {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }
      if (status === 409) {
        return NextResponse.json(
          { error: "already_exists" },
          { status: 409 },
        );
      }
      return NextResponse.json(
        {
          error: "server_error",
          message: "The server could not complete the request.",
        },
        { status: 500 },
      );
    }
  };
}

export type JsonBody =
  | { ok: true; value: unknown }
  | { ok: false };

/**
 * Read and parse a JSON request body.
 *
 * Returns `{ ok: false }` for an empty or malformed body instead of
 * throwing, so callers can answer with a 400.
 */
/**
 * Translate a Prisma error into a status a client can act on.
 *
 * Without this, "record not found" (P2025) and "unique constraint" (P2002)
 * surface as 500s even though they are ordinary client mistakes.
 */
function prismaStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const code = (error as { code?: unknown }).code;
  if (code === "P2025") return 404;
  if (code === "P2002") return 409;
  return null;
}

export async function readJson(request: Request): Promise<JsonBody> {
  let text: string;
  try {
    text = await request.text();
  } catch {
    return { ok: false };
  }
  if (!text.trim()) {
    return { ok: false };
  }
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}
