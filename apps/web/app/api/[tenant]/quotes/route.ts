import { getTenantRuntime } from "@/lib/tenant-runtime";
import { guarded, json } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await ctx.params;
  return guarded(async () => {
    const rt = await getTenantRuntime(tenant);
    const quotes = await rt.quoting!.list();
    return json({
      tenant,
      count: quotes.length,
      quotes: quotes.map((q) => ({
        id: q.id,
        title: q.title,
        version: q.version,
        status: q.status,
        baseCents: q.baseCents,
        optionalCents: q.optionalCents,
        lines: q.lines.length,
      })),
    });
  });
}
