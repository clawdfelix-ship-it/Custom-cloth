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
