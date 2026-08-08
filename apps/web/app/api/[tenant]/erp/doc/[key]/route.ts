/**
 * The auxiliary documents — Master Data, Financial Data, the project folder.
 *
 *   GET /api/<tenant>/erp/doc/<name>            → { doc, version }
 *   PUT /api/<tenant>/erp/doc/<name>            → { version }
 *       { doc, expectedVersion }                → 409 if somebody saved first
 *
 * These screens each kept their own IndexedDB database, which is the whole
 * reason a customer entered in Master Data on a laptop could not be found on a
 * phone: it had never left the laptop. Same table as the ERP register, a
 * different key, and the same refusal on a stale write.
 *
 * `<name>` is checked against a closed list before it reaches storage. Taking a
 * key straight from the URL would let any signed-in caller create unbounded
 * rows under a tenant just by asking for names that do not exist.
 */
import { loadAuxDocument, saveAuxDocument } from "@/lib/erp-runtime";
import { requireUser } from "@/lib/session";
import { tenantFor } from "@/lib/access";
import { guarded, json } from "@/lib/api";
import { FactoryError } from "@repo/kernel";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ tenant: string; key: string }> }) {
  const { tenant: param, key } = await ctx.params;
  return guarded(async () => {
    const tenant = await tenantFor(req, param);
    const { doc, version } = await loadAuxDocument(tenant, key);
    return json({ tenant, key, version, doc });
  });
}

export async function PUT(req: Request, ctx: { params: Promise<{ tenant: string; key: string }> }) {
  const { tenant: param, key } = await ctx.params;
  return guarded(async () => {
    const user = await requireUser(req);
    // Resolved from the session, never from the URL — this is the write path.
    const tenant = await tenantFor(req, param);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new FactoryError("BAD_REQUEST", "Body must be JSON.");
    }
    if (typeof body !== "object" || body === null) {
      throw new FactoryError("BAD_REQUEST", "Body must be a JSON object.");
    }
    const { doc, expectedVersion } = body as Record<string, unknown>;

    const saved = await saveAuxDocument(tenant, key, doc, expectedVersion, user);
    return json({ tenant, key, ...saved });
  });
}
