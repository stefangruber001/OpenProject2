import Link from "next/link";
import { notFound } from "next/navigation";
import { formatMoney, isFactoryError } from "@repo/kernel";
import { getTenantRuntime } from "@/lib/tenant-runtime";
import { ui } from "@/lib/i18n";
import { createDemoJob } from "./actions";
import { createPresupuesto } from "./presupuestos/actions";

export const dynamic = "force-dynamic";

export default async function TenantWorkspace(props: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await props.params;
  let rt;
  try {
    rt = await getTenantRuntime(tenant);
  } catch (e) {
    if (isFactoryError(e, "NOT_FOUND") || isFactoryError(e, "SPEC_INVALID")) notFound();
    throw e;
  }
  const { locale, currency, branding } = rt.resolved.kernelConfig;
  const money = (cents: number) => formatMoney(cents, currency, locale);
  const t = ui();
  const quotes = await rt.quoting!.list();
  const invoices = await rt.billing!.list();
  const issueAction = createDemoJob.bind(null, tenant);

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-10 px-6 py-12">
      <header className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-widest text-neutral-500">
          {tenant} · {rt.resolved.report.packs.map((p) => p.id).join(" + ")}
        </span>
        <h1 className="text-3xl font-bold tracking-tight">
          {branding.tradeName ?? branding.legalName}
        </h1>
        {branding.slogan && <p className="text-sm italic text-neutral-500">{branding.slogan}</p>}
        <p className="text-sm text-neutral-500">
          kernel {rt.resolved.kernelVersion} · {t.ports}:{" "}
          {rt.resolved.report.boundPorts.map((b) => b.port).join(", ")}
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <form action={createPresupuesto.bind(null, tenant)} className="flex items-center gap-2">
          <input
            name="title"
            required
            placeholder={t.newQuotePlaceholder}
            className="w-72 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          />
          <button
            type="submit"
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900"
          >
            {t.createQuote}
          </button>
        </form>
        <form action={issueAction}>
          <button
            type="submit"
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            {t.autoDemo}
          </button>
        </form>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
          {t.quotesHeading(quotes.length)}
        </h2>
        <ul className="divide-y divide-neutral-200 text-sm dark:divide-neutral-800">
          {quotes.map((q) => (
            <li key={q.id} className="flex items-baseline justify-between gap-4 py-2">
              <span>
                <Link
                  className="underline underline-offset-2"
                  href={`/${tenant}/presupuestos/${q.id}`}
                >
                  {q.title}
                </Link>{" "}
                <span className="text-xs uppercase text-neutral-400">
                  (v{q.version} · {q.status})
                </span>
              </span>
              <span className="shrink-0 font-medium">
                {money(q.baseCents)}
                {q.optionalCents > 0 && (
                  <span className="ml-1 text-xs text-neutral-400">
                    +{money(q.optionalCents)} {t.optionalShort}
                  </span>
                )}
              </span>
            </li>
          ))}
          {quotes.length === 0 && <li className="py-2 text-neutral-500">{t.noQuotes}</li>}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
          {t.invoicesHeading(invoices.length)}
        </h2>
        <ul className="divide-y divide-neutral-200 text-sm dark:divide-neutral-800">
          {invoices.map((inv) => (
            <li key={inv.id} className="flex items-baseline justify-between gap-4 py-2">
              <span>
                <Link
                  className="underline underline-offset-2"
                  href={`/${tenant}/facturas/${inv.id}`}
                >
                  {inv.displayNumber}
                </Link>{" "}
                — {inv.buyer.name}
                <span className="ml-2 text-xs text-neutral-400">
                  {inv.taxSummary.map((s) => `${s.rateBp / 100}%`).join(" + ")}
                  {inv.seal ? ` · seal #${inv.seal.seq}` : ""}
                </span>
              </span>
              <span className="shrink-0 font-medium">{money(inv.totalCents)}</span>
            </li>
          ))}
          {invoices.length === 0 && <li className="py-2 text-neutral-500">{t.noInvoices}</li>}
        </ul>
      </section>

      <footer className="mt-auto text-xs text-neutral-500">
        Runtime: {process.env.DATABASE_URL ? t.runtimeDb : t.runtimeMemory} · {t.footerNote}
      </footer>
    </main>
  );
}
