import { getTenantRuntime } from "@/lib/tenant-runtime";
import { guarded, json } from "@/lib/api";

export const dynamic = "force-dynamic";

/** The tenant's composition report: packs, capabilities, bound ports. */
export async function GET(_req: Request, ctx: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await ctx.params;
  return guarded(async () => {
    const rt = await getTenantRuntime(tenant);
    return json(rt.resolved.report);
  });
}
