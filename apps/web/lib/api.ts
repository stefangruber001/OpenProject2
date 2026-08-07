import { isFactoryError } from "@repo/kernel";

/** Uniform JSON responses + FactoryError mapping for the tenant API. */
export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export async function guarded(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (isFactoryError(e)) {
      const status =
        e.code === "NOT_FOUND" || e.code === "SPEC_INVALID"
          ? 404
          : e.code === "IMMUTABLE" || e.code === "INVALID_STATE" || e.code === "STALE_WRITE"
            ? 409
            : // BAD_REQUEST and everything else: the caller's problem. It is
              // deliberately NOT 404 — a client cannot act on "not found" when
              // what actually happened is a malformed body or an unknown command.
              400;
      // `details` carries what the caller needs to recover — a STALE_WRITE says
      // which version won, so the client can reload rather than guess.
      return json({ error: e.code, message: e.message, ...(e.details ?? {}) }, status);
    }
    throw e;
  }
}
