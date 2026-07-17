import { getTenantRuntime } from "@/lib/tenant-runtime";
import { guarded, json } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ tenant: string; id: string }> }) {
  const { tenant, id } = await ctx.params;
  return guarded(async () => {
    const rt = await getTenantRuntime(tenant);
    return json(await rt.quoting!.get(id));
  });
}
