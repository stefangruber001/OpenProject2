/**
 * Run one ERP command against the stored document.
 *
 *   POST { command, args: [...], expectedVersion }
 *   → 200 { command, result, version, migrated }
 *   → 400 unknown command, wrong arity, or a business rule refused it
 *   → 409 STALE_WRITE — somebody else saved first; reload and retry
 *
 * The response deliberately does NOT echo the state back. The document is
 * ~0.74 MB after a simulated year of trading and grows ~64 KB a month; sending
 * it on every keystroke-driven mutation would make the app feel broken over a
 * domestic connection. The client already knows what it changed, and can GET
 * the state when it needs to resynchronise.
 */
import { runCommand } from "@/lib/erp-runtime";
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
    return json({ tenant, ...outcome });
  });
}
