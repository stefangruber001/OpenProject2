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
          : e.code === "IMMUTABLE" || e.code === "INVALID_STATE"
            ? 409
            : 400;
      return json({ error: e.code, message: e.message }, status);
    }
    throw e;
  }
}
