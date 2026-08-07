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
import { guarded, json } from "@/lib/api";
import { FactoryError } from "@repo/kernel";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await ctx.params;
  return guarded(async () => {
    const user = requireUser();

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
    return json({ tenant, ...outcome, state: erp.toJSON() });
  });
}
