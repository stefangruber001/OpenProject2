/**
 * The company's ERP document.
 *
 * GET returns `{state, version}`. The version is not decoration: it is what the
 * client must quote back on the next command, and it is how a second person
 * editing the same records gets told rather than silently losing their work.
 */
import { loadErp, saveErpDocument } from "@/lib/erp-runtime";
import { requireUser } from "@/lib/session";
import { tenantFor } from "@/lib/access";
import { guarded, json } from "@/lib/api";
import { FactoryError } from "@repo/kernel";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ tenant: string }> }) {
  const { tenant: param } = await ctx.params;
  return guarded(async () => {
    // Resolved, not trusted: a guest asking for the real company is refused here,
    // and `~` becomes whichever company this session is entitled to.
    const tenant = await tenantFor(_req, param);
    const { erp, version, migrated } = await loadErp(tenant);
    return json({
      tenant,
      version,
      // Empty at version 0 — a tenant with no data yet, not an error. The
      // client seeds or imports; the server does not invent records.
      seeded: version > 0,
      migrated,
      state: erp.toJSON(),
    });
  });
}

/**
 * Save the whole document.
 *
 *   PUT { state, expectedVersion } → 200 { version, migrated }
 *                                  → 409 STALE_WRITE, somebody else saved first
 *
 * This is what the workspace uses: it holds the engine in the page, applies a
 * change locally and stores the result. See `saveErpDocument` for what the
 * server does and does not vouch for — the short version is that the version
 * check and the migration ladder are the server's, and the arithmetic is the
 * client's.
 */
export async function PUT(req: Request, ctx: { params: Promise<{ tenant: string }> }) {
  const { tenant: param } = await ctx.params;
  return guarded(async () => {
    const user = await requireUser(req);
    // Resolved from the session, never from the URL. This is the write path; a
    // guest reaching the real company here would be editing a real register.
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
    const { state, expectedVersion } = body as Record<string, unknown>;

    const saved = await saveErpDocument(tenant, state, expectedVersion, user);
    return json({ tenant, ...saved });
  });
}
