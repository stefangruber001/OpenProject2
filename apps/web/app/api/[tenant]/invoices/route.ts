import { getTenantRuntime } from "@/lib/tenant-runtime";
import { guarded, json } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await ctx.params;
  return guarded(async () => {
    const rt = await getTenantRuntime(tenant);
    const invoices = await rt.billing!.list();
    return json({
      tenant,
      count: invoices.length,
      invoices: invoices.map((i) => ({
        id: i.id,
        displayNumber: i.displayNumber,
        kind: i.kind,
        issueDate: i.issueDate,
        buyer: i.buyer.name,
        baseCents: i.baseCents,
        taxCents: i.taxCents,
        totalCents: i.totalCents,
        taxSummary: i.taxSummary,
        seal: i.seal ? { seq: i.seal.seq, hash: i.seal.hash } : null,
      })),
    });
  });
}
