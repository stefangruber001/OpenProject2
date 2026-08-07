/**
 * The company's ERP document.
 *
 * GET returns `{state, version}`. The version is not decoration: it is what the
 * client must quote back on the next command, and it is how a second person
 * editing the same records gets told rather than silently losing their work.
 */
import { loadErp } from "@/lib/erp-runtime";
import { guarded, json } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await ctx.params;
  return guarded(async () => {
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
