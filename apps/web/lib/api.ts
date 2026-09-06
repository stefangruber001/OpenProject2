import { isFactoryError } from "@repo/kernel";

/**
 * What every API answer must carry.
 *
 * NO-STORE, AND IT IS NOT BELT-AND-BRACES. Every answer here is shaped by WHO
 * ASKED: the session route says who you are, the state route is redacted per
 * role, the register is a different document for a site worker than for the
 * office. A response with no `Cache-Control`, no `Expires` and no validator is
 * one a browser may store and hand back later on the same device — to whoever
 * is signed in next.
 *
 * That is not hypothetical. `dynamic = "force-dynamic"` governs the SERVER's
 * own caching and emits no header at all: measured on a running build, these
 * responses went out with nothing but a content-type. An administrator signed
 * out on a phone, a site worker signed in, and the workspace painted the
 * administrator's name and permission from a stored copy of `/api/~/session`
 * while every write was correctly refused — the client and the server
 * disagreeing about who was holding the phone.
 *
 * The label was the visible half. The same silence applies to `/erp/state`,
 * where the stale copy is the invoice register and the bank lines that R2.3
 * exists to keep away from a site account.
 *
 * `private` as well as `no-store`: no-store is the instruction that matters,
 * and private says the quiet part to any intermediary that treats no-store
 * loosely — this is one person's data, never a shared cache's.
 */
const NO_STORE = "no-store, private";

/** Uniform JSON responses + FactoryError mapping for the tenant API. */
export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": NO_STORE,
    },
  });
}

/** For the few routes that answer with something other than JSON. */
export { NO_STORE };

export async function guarded(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (isFactoryError(e)) {
      const status =
        e.code === "UNAUTHENTICATED"
          ? 401
          : e.code === "NOT_FOUND" || e.code === "SPEC_INVALID"
            ? 404
            : e.code === "IMMUTABLE" || e.code === "INVALID_STATE" || e.code === "STALE_WRITE"
              ? 409
              : e.code === "INTEGRATION_FAILED"
                ? // Somebody else's server refused us. 400 would send the caller
                  // hunting for a mistake in a payload that was perfectly fine.
                  502
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
