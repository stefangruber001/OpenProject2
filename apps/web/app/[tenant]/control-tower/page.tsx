import Link from "next/link";
import { notFound } from "next/navigation";
import { formatMoney, isFactoryError } from "@repo/kernel";
import { getTenantRuntime } from "@/lib/tenant-runtime";
import { controlTower } from "@/lib/control-tower";

export const dynamic = "force-dynamic";

/** Live owner dashboard rendered from the real capability services (durable
 *  aggregates). The premium white theme uses the tenant's brand tokens. */
export default async function ControlTowerPage(props: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await props.params;
  let rt;
  let ov;
  try {
    rt = await getTenantRuntime(tenant);
    ov = await controlTower(rt);
  } catch (e) {
    if (isFactoryError(e, "NOT_FOUND") || isFactoryError(e, "SPEC_INVALID")) notFound();
    throw e;
  }
  const { locale, currency, branding } = rt.resolved.kernelConfig;
  const green = branding.palette?.brandGreen ?? "#48733c";
  const money = (c: number) => formatMoney(c, currency, locale);

  const pipelineValue = ov.pipeline.reduce((s, p) => s + p.valueCents, 0);
  const revenue = ov.projects.reduce((s, p) => s + p.revenueCents, 0);
  const margin = ov.projects.reduce((s, p) => s + p.marginCents, 0);
  const marginPct = revenue ? Math.round((margin / revenue) * 1000) / 10 : 0;

  const kpis = [
    {
      k: "Pipeline value",
      v: money(pipelineValue),
      s: `${ov.pipeline.reduce((n, p) => n + p.count, 0)} open leads`,
    },
    { k: "Active projects", v: String(ov.projects.length), s: "with financials" },
    { k: "Portfolio margin", v: `${marginPct}%`, s: money(margin) },
    { k: "Receivables", v: money(ov.receivablesOutstandingCents), s: "outstanding" },
    { k: "Payables", v: money(ov.payablesOutstandingCents), s: "to pay" },
    { k: "Committed (PO)", v: money(ov.committedCents), s: "purchase orders" },
  ];

  const card =
    "rounded-2xl border border-neutral-200/80 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900";

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-1">
        <Link href={`/${tenant}`} className="text-xs text-neutral-500 underline underline-offset-2">
          ← {branding.tradeName ?? tenant}
        </Link>
        <h1 className="font-serif text-3xl font-semibold tracking-tight" style={{ color: green }}>
          Control Tower
        </h1>
        <p className="text-sm text-neutral-500">
          Live from {ov.capabilities} composed capabilities ·{" "}
          {ov.durable ? "PostgreSQL (RLS)" : "in-memory (dev)"} · computed by the real services over
          durable aggregates.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map((x) => (
          <div key={x.k} className={`${card} p-4`}>
            <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              {x.k}
            </div>
            <div className="mt-1 font-serif text-xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
              {x.v}
            </div>
            <div className="mt-0.5 text-[11px] text-neutral-500">{x.s}</div>
          </div>
        ))}
      </section>

      <section className={`${card} p-5`}>
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-neutral-500">
          Projects — financial control
        </h2>
        <table className="w-full text-sm">
          <thead>
            <tr
              className="border-b-2 text-left text-[10px] uppercase tracking-wide text-neutral-500"
              style={{ borderColor: green }}
            >
              <th className="py-1.5 pr-2">Project</th>
              <th className="py-1.5 pr-2 text-right">Baseline</th>
              <th className="py-1.5 pr-2 text-right">Committed</th>
              <th className="py-1.5 pr-2 text-right">Actual</th>
              <th className="py-1.5 pr-2 text-right">Revenue</th>
              <th className="py-1.5 text-right">Margin</th>
            </tr>
          </thead>
          <tbody>
            {ov.projects.map((p) => (
              <tr key={p.id} className="border-b border-neutral-200 dark:border-neutral-800">
                <td className="py-2 pr-2 font-medium">{p.name}</td>
                <td className="py-2 pr-2 text-right tabular-nums">{money(p.baselineCents)}</td>
                <td className="py-2 pr-2 text-right tabular-nums">{money(p.committedCents)}</td>
                <td className="py-2 pr-2 text-right tabular-nums">{money(p.actualCents)}</td>
                <td className="py-2 pr-2 text-right tabular-nums">{money(p.revenueCents)}</td>
                <td className="py-2 text-right font-semibold tabular-nums" style={{ color: green }}>
                  {money(p.marginCents)} · {Math.round(p.marginBp / 100)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className={`${card} p-5`}>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-neutral-500">
            Sales pipeline
          </h2>
          <ul className="flex flex-col gap-2 text-sm">
            {ov.pipeline.map((p) => (
              <li key={p.stage} className="flex items-center justify-between">
                <span className="capitalize text-neutral-600 dark:text-neutral-300">{p.stage}</span>
                <span className="tabular-nums">
                  <b>{p.count}</b>{" "}
                  {p.valueCents > 0 && (
                    <span className="text-neutral-500">· {money(p.valueCents)}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className={`${card} p-5`}>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-neutral-500">
            Overdue tasks &amp; access
          </h2>
          {ov.overdueTasks.length === 0 ? (
            <p className="text-sm text-neutral-500">No overdue tasks.</p>
          ) : (
            <ul className="mb-3 flex flex-col gap-1 text-sm">
              {ov.overdueTasks.map((t) => (
                <li key={t.title} className="flex items-center justify-between">
                  <span className="text-amber-700 dark:text-amber-500">⚠ {t.title}</span>
                  <span className="text-xs text-neutral-500">due {t.plannedEnd}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-neutral-200 pt-2 text-xs text-neutral-500 dark:border-neutral-800">
            Roles: administration can issue invoices ({ov.access.wifeCanIssueInvoice ? "✓" : "—"});
            operations can record visits ({ov.access.husbandCanRecordVisit ? "✓" : "—"}), cannot
            issue invoices ({ov.access.husbandCanIssueInvoice ? "✓" : "—"}).
          </div>
        </section>
      </div>

      <footer className="text-xs text-neutral-500">
        Synthetic seed data · figures computed live by
        projects/receivables/payables/crm/procurement/scheduling/access.
      </footer>
    </main>
  );
}
