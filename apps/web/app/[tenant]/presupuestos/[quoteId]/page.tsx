import Link from "next/link";
import { notFound } from "next/navigation";
import { formatMoney, isFactoryError } from "@repo/kernel";
import type { ReformasConfig } from "@repo/pack-vertical-construction-reformas";
import { getTenantRuntime } from "@/lib/tenant-runtime";
import { acceptPresupuesto, addPartida, emitirFactura, reviseQuote } from "../actions";

export const dynamic = "force-dynamic";

const input =
  "rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900";
const label = "flex flex-col gap-1 text-xs font-medium text-neutral-600 dark:text-neutral-400";
const button =
  "rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900";

export default async function PresupuestoPage(props: {
  params: Promise<{ tenant: string; quoteId: string }>;
}) {
  const { tenant, quoteId } = await props.params;
  let rt;
  let quote;
  try {
    rt = await getTenantRuntime(tenant);
    quote = await rt.quoting!.get(quoteId);
  } catch (e) {
    if (isFactoryError(e)) notFound();
    throw e;
  }
  const { locale, currency } = rt.resolved.kernelConfig;
  const money = (c: number) => formatMoney(c, currency, locale);
  const vertical = rt.resolved.config.vertical as ReformasConfig;
  const t = vertical.terminology;
  const isDraft = quote.status === "draft";
  const baseLines = quote.lines.filter((l) => !l.optional);
  const optLines = quote.lines.filter((l) => l.optional);

  const addAction = addPartida.bind(null, tenant, quoteId);
  const acceptAction = acceptPresupuesto.bind(null, tenant, quoteId);
  const reviseAction = reviseQuote.bind(null, tenant, quoteId);
  const invoiceAction = emitirFactura.bind(null, tenant, quoteId);

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-1">
        <Link href={`/${tenant}`} className="text-xs text-neutral-500 underline underline-offset-2">
          ← {rt.resolved.kernelConfig.branding.tradeName ?? tenant}
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{quote.title}</h1>
        <p className="text-sm text-neutral-500">
          {t.quote} v{quote.version} ·{" "}
          <span className={isDraft ? "text-amber-600" : "text-green-700"}>
            {isDraft ? "borrador" : `aceptado (${quote.acceptedAt?.slice(0, 10)})`}
          </span>
          {quote.revisionOf ? ` · revisión de ${quote.revisionOf}` : ""}
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
          {t.line}s ({baseLines.length})
        </h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-neutral-300 text-left text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-700">
              <th className="py-1.5 pr-2">Concepto</th>
              <th className="py-1.5 pr-2 text-right">Cantidad</th>
              <th className="py-1.5 pr-2 text-right">Precio ud.</th>
              <th className="py-1.5 text-right">Importe</th>
            </tr>
          </thead>
          <tbody>
            {baseLines.map((l) => (
              <tr key={l.id} className="border-b border-neutral-200 dark:border-neutral-800">
                <td className="py-1.5 pr-2">{l.description}</td>
                <td className="py-1.5 pr-2 text-right">
                  {(l.qtyMillis / 1000).toLocaleString(locale)} {l.unit}
                </td>
                <td className="py-1.5 pr-2 text-right">{money(l.unitCents)}</td>
                <td className="py-1.5 text-right font-medium">{money(l.totalCents)}</td>
              </tr>
            ))}
            {baseLines.length === 0 && (
              <tr>
                <td colSpan={4} className="py-2 text-neutral-500">
                  Añade la primera {t.line.toLowerCase()} abajo.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {optLines.length > 0 && (
          <>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Trabajos opcionales (fuera del total base)
            </h3>
            <table className="w-full text-sm">
              <tbody>
                {optLines.map((l) => (
                  <tr
                    key={l.id}
                    className="border-b border-dashed border-neutral-200 dark:border-neutral-800"
                  >
                    <td className="py-1.5 pr-2">{l.description}</td>
                    <td className="py-1.5 pr-2 text-right">
                      {(l.qtyMillis / 1000).toLocaleString(locale)} {l.unit}
                    </td>
                    <td className="py-1.5 pr-2 text-right">{money(l.unitCents)}</td>
                    <td className="py-1.5 text-right font-medium">{money(l.totalCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <div className="flex justify-end gap-6 border-t-2 border-neutral-900 pt-2 text-sm dark:border-neutral-100">
          <span>
            Base: <b>{money(quote.baseCents)}</b>
          </span>
          {quote.optionalCents > 0 && (
            <span className="text-neutral-500">
              Opcionales: <b>{money(quote.optionalCents)}</b>
            </span>
          )}
        </div>
      </section>

      {isDraft && (
        <section className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900/40">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-500">
            Añadir {t.line.toLowerCase()} — elegir, no teclear
          </h2>
          <form action={addAction} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className={`${label} col-span-2`}>
              Capítulo
              <select name="chapter" className={input} defaultValue={vertical.chapters[0]}>
                {vertical.chapters.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className={`${label} col-span-2`}>
              Descripción
              <input
                name="description"
                required
                placeholder="p. ej. Alicatado azulejo 20×60"
                className={input}
              />
            </label>
            <label className={label}>
              Unidad
              <select name="unit" className={input} defaultValue="m²">
                {vertical.defaultUnits.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </label>
            <label className={label}>
              Unidades
              <input
                name="unidades"
                type="number"
                step="0.001"
                defaultValue={1}
                className={input}
              />
            </label>
            <label className={label}>
              Largo (m)
              <input name="largo" type="number" step="0.01" placeholder="—" className={input} />
            </label>
            <label className={label}>
              Ancho (m)
              <input name="ancho" type="number" step="0.01" placeholder="—" className={input} />
            </label>
            <label className={label}>
              Precio unitario (€)
              <input name="precio" type="number" step="0.01" required className={input} />
            </label>
            <label className="col-span-2 flex items-end gap-2 pb-1 text-sm">
              <input type="checkbox" name="optional" className="size-4" />
              Opcional (fuera del total base)
            </label>
            <div className="flex items-end">
              <button type="submit" className={button}>
                Añadir
              </button>
            </div>
          </form>
        </section>
      )}

      {isDraft && quote.lines.length > 0 && (
        <section className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/30">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-green-800 dark:text-green-300">
            Aceptación del cliente
          </h2>
          <form action={acceptAction} className="flex flex-col gap-2">
            {optLines.length > 0 && (
              <div className="flex flex-col gap-1 text-sm">
                {optLines.map((l) => (
                  <label key={l.id} className="flex items-center gap-2">
                    <input type="checkbox" name="options" value={l.id} className="size-4" />
                    Incluir opcional: {l.description} ({money(l.totalCents)})
                  </label>
                ))}
              </div>
            )}
            <button type="submit" className={button + " self-start"}>
              Marcar como aceptado
            </button>
          </form>
        </section>
      )}

      {!isDraft && (
        <section className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900/40">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
              Emitir factura
            </h2>
            <form action={reviseAction}>
              <button type="submit" className="text-xs underline underline-offset-2">
                Crear revisión (v{quote.version + 1})
              </button>
            </form>
          </div>
          <form action={invoiceAction} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <label className={`${label} col-span-2`}>
              Cliente
              <input name="buyerName" required className={input} />
            </label>
            <label className={label}>
              NIF
              <input name="buyerTaxId" className={input} />
            </label>
            <label className={`${label} col-span-2`}>
              Dirección
              <input name="buyerAddress" className={input} />
            </label>
            <label className={label}>
              Destinatario
              <select name="recipient" className={input} defaultValue="individual-private">
                <option value="individual-private">Particular</option>
                <option value="community-of-owners">Comunidad de propietarios</option>
                <option value="business">Empresa</option>
              </select>
            </label>
            <label className="flex items-end gap-2 pb-1 text-sm">
              <input type="checkbox" name="privateUse" defaultChecked className="size-4" />
              Vivienda de uso particular
            </label>
            <label className={label}>
              Antigüedad vivienda (años)
              <input name="ageYears" type="number" defaultValue={15} className={input} />
            </label>
            <label className={label}>
              Materiales (% base)
              <input
                name="materialsPct"
                type="number"
                step="0.1"
                defaultValue={35}
                className={input}
              />
            </label>
            <div className="col-span-2 flex items-end sm:col-span-3">
              <button type="submit" className={button}>
                Emitir factura (IVA decidido por regla, con justificación)
              </button>
            </div>
          </form>
        </section>
      )}
    </main>
  );
}
