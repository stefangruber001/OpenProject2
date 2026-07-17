import { getTenantRuntime } from "@/lib/tenant-runtime";
import { controlTower } from "@/lib/control-tower";
import { guarded, json } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * Live control-tower overview computed by the real capability services over
 * durably-persisted aggregates. Seeds a synthetic dataset on first call.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await ctx.params;
  return guarded(async () => {
    const rt = await getTenantRuntime(tenant);
    return json(await controlTower(rt));
  });
}
