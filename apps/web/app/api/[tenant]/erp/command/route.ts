/**
 * Run one ERP command against the stored document.
 *
 *   POST { command, args: [...], expectedVersion }
 *   → 200 { command, result, version, migrated }
 *   → 400 unknown command, wrong arity, or a business rule refused it
 *   → 409 STALE_WRITE — somebody else saved first; reload and retry
 *
 * The response does NOT echo the state back by default. The document is
 * ~0.74 MB after a simulated year of trading and grows ~64 KB a month; sending
 * it to a script that only wanted to record a payment is pure waste.
 *
 * `?include=state` asks for it, which is what an interactive client wants: it
 * renders from the whole document, so without this it would have to GET the
 * state straight after every command — the same bytes over two round trips
 * instead of one. The alternative, replaying the command against a local copy
 * of the engine, would be faster still and is exactly the kind of cleverness
 * that ends with two divergent versions of an invoice register and no way to
 * tell which is right.
 */
import { loadErp, runCommand } from "@/lib/erp-runtime";
import { requireUser } from "@/lib/session";
import { tenantFor } from "@/lib/access";
import { guarded, json } from "@/lib/api";
import { FactoryError } from "@repo/kernel";
import { may } from "@/lib/user-admin";
import { redactForWorker, workerIdIn } from "@/lib/erp-scope";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ tenant: string }> }) {
  const { tenant: param } = await ctx.params;
  return guarded(async () => {
    const user = await requireUser(req);
    // Resolved from the session, never taken from the URL: this is the write
    // path, so a guest reaching the real company here would be editing a real
    // invoice register.
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

    const { command, args, expectedVersion } = body as Record<string, unknown>;
    const outcome = await runCommand(
      tenant,
      {
        command: String(command),
        args: args as unknown[] | undefined,
        expectedVersion: expectedVersion as number | undefined,
      },
      user,
    );

    if (new URL(req.url).searchParams.get("include") !== "state") {
      return json({ tenant, ...outcome });
    }
    // Re-read rather than reuse the in-memory engine, so what the client
    // renders is what the database actually holds.
    const { erp } = await loadErp(tenant);
    const full = erp.toJSON();
    /* AND SENT UNDER THE SAME RULE AS THE GET.
       This branch returned the whole document to anybody allowed to run a
       command — which includes a site worker, who holds `erp.write.site` and
       may record his own hours. He would have received every invoice, every
       bank line and everybody's pay as the RESPONSE TO SAVING HIS OWN
       TIMESHEET. It was never reachable, only because no client had been
       written yet; the client that makes this endpoint useful is the same
       change that would have made the leak live.
       The test is the permission, not the role name, exactly as in the GET, so
       the two paths cannot drift into disagreeing about who sees what. */
    const scoped = !(await may(tenant, user, "erp.read.all"));
    const state = scoped ? redactForWorker(full, workerIdIn(full, user)) : full;
    return json({ tenant, ...outcome, scoped, state });
  });
}
