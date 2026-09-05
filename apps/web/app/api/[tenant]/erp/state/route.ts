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
import { may } from "@/lib/user-admin";
import { redactForWorker, workerIdIn } from "@/lib/erp-scope";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ tenant: string }> }) {
  const { tenant: param } = await ctx.params;
  return guarded(async () => {
    // Resolved, not trusted: a guest asking for the real company is refused here,
    // and `~` becomes whichever company this session is entitled to.
    const tenant = await tenantFor(_req, param);
    const email = await requireUser(_req);
    const { erp, version, migrated } = await loadErp(tenant);
    const full = erp.toJSON();
    /* A SITE WORKER IS SENT A DIFFERENT DOCUMENT, not the same one with screens
       hidden over it. Hiding a tab decides what is drawn; this decides what is
       SENT, and until it existed an account meant to see its own hours received
       every invoice, every bank line and everybody's pay in one response. The
       test is the permission, not the role name, so a fifth role inherits the
       rule by holding — or not holding — `erp.read.all`. */
    const scoped = !(await may(tenant, email, "erp.read.all"));
    const state = scoped ? redactForWorker(full, workerIdIn(full, email)) : full;
    return json({
      tenant,
      version,
      // Empty at version 0 — a tenant with no data yet, not an error. The
      // client seeds or imports; the server does not invent records.
      seeded: version > 0,
      migrated,
      scoped,
      state,
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
    /* THE OTHER DOOR. This route takes a whole document computed by the client
       and stores it, so an account allowed to use it can write anything the ERP
       can hold — which makes every narrower permission elsewhere decorative
       while it stays open to everybody. A site worker writes through
       `POST /erp/command`, where each call is checked one at a time. */
    if (!(await may(tenant, user, "erp.write")))
      throw new FactoryError(
        "UNAUTHENTICATED",
        "This account may record its own hours, but not save the whole document. " +
          "Use the hours commands.",
      );

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
