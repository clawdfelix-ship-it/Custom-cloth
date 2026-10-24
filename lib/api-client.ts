/**
 * Client-side JSON reading that never surfaces a raw parse error.
 *
 * A fetch can legitimately come back with a body that is not JSON: a
 * 500 from a serverless function, an HTML error page, a 405, or an empty
 * body from a proxy. Calling `response.json()` on those throws
 * "Unexpected end of JSON input", which tells the user nothing.
 *
 * `readJsonSafe` never throws. It returns the status, the parsed body when
 * there is one, and a human-readable message for the UI.
 */

export interface JsonResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  /** Message safe to show to the user. */
  error: string | null;
}

export async function readJsonSafe<T = Record<string, unknown>>(
  response: Response,
): Promise<JsonResult<T>> {
  let data: T | null = null;
  try {
    data = (await response.json()) as T;
  } catch {
    data = null;
  }

  if (data && typeof data === "object" && "error" in data) {
    const raw = (data as { error?: unknown }).error;
    if (typeof raw === "string" && raw.trim()) {
      return { ok: false, status: response.status, data, error: raw };
    }
  }

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      data,
      error: `Request failed (${response.status}). Please try again.`,
    };
  }

  if (!data) {
    return {
      ok: false,
      status: response.status,
      data: null,
      error: "The server returned an empty response. Please try again.",
    };
  }

  return { ok: true, status: response.status, data, error: null };
}
