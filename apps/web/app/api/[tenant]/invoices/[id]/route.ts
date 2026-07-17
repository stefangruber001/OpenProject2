import { getTenantRuntime } from "@/lib/tenant-runtime";
import { guarded, json } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Full invoice JSON — incl. persisted tax decisions with legal justification. */
export async function GET(_req: Request, ctx: { params: Promise<{ tenant: string; id: string }> }) {
  const { tenant, id } = await ctx.params;
  return guarded(async () => {
    const rt = await getTenantRuntime(tenant);
    return json(await rt.billing!.get(id));
  });
}
