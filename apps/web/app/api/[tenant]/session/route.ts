/**
 * "Who am I, and what may I do here?" — for the client, not the audit trail.
 *
 *   GET /api/~/session → { email, role, bankRead, workerId }
 *
 * Every mutating route resolves the acting user and checks their permission
 * server-side (`require_`), which is the enforcement that matters.
 * This route exists only because the WORKSPACE — a static file with no
 * server-side render — cannot know that answer any other way: it needs it to
 * decide whether to show a field, not whether to allow a write. Masking a
 * field the server would refuse to act on anyway is client-side politeness,
 * not the security boundary; a screen must not treat `bankRead: true` as
 * proof a later write will succeed.
 *
 * `role` reads "admin" for anybody `findUser` cannot place — the ERP_USERS
 * bootstrap accounts and the single-seat ERP_OPERATOR identity are exactly
 * that case, and both are already fully-trusted today (see lib/session.ts).
 * Reading them as "admin" here is not a new grant, only naming the access
 * they already have.
 */
import { guarded, json } from "@/lib/api";
import { tenantFor } from "@/lib/access";
import { requireUser } from "@/lib/session";
import { findUser } from "@/lib/user-admin";
import { roleMay } from "@/lib/users";
import { workerIdIn } from "@/lib/erp-scope";
import { loadErp } from "@/lib/erp-runtime";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ tenant: string }> }) {
  const { tenant: param } = await ctx.params;
  return guarded(async () => {
    const tenant = await tenantFor(req, param);
    const email = await requireUser(req);
    const u = await findUser(tenant, email);
    /* WHICH PERSON THIS ACCOUNT IS, when it is one. An account is tied to a
       worker by e-mail, because that is the identifier both records already
       carry — no column, no migration, and no second list of people to keep in
       step with the first. An account with no match simply has no hours of its
       own, which is the honest answer for an office login that never works on
       a site. */
    let workerId: string | null = null;
    try {
      const { erp } = await loadErp(tenant);
      workerId = workerIdIn(erp.toJSON(), email);
    } catch {
      /* A tenant with no document yet has no workers either. "Who am I" is
         still answerable; there is simply no person attached to it. */
    }
    return json({
      email,
      role: u?.role ?? "admin",
      bankRead: u ? roleMay(u.role, "party.bank.read") : true,
      workerId,
    });
  });
}
