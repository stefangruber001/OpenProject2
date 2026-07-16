import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { FixedClock, SeqIdGen, resolveTenant, type ResolvedTenant } from "@repo/kernel";
import { renderInvoiceHtml, type Invoice } from "@repo/capability-billing";
import {
  HINT_WORKS_ON_DWELLING,
  dwellingWorksAttributes,
  medicionQtyMillis,
  type ReformasConfig,
} from "@repo/pack-vertical-construction-reformas";
import { buildServices } from "./composition";
import { registries } from "./registry";

/**
 * The P1 walking-skeleton slice (mandate §9): presupuesto → factura with
 * effective-dated VAT + persisted justification → document. Deterministic:
 * fixed clock, sequential ids — same spec, same artifacts (principle 7).
 */
export interface DemoResult {
  outDir: string;
  resolved: ResolvedTenant;
  quoteId: string;
  invoiceEligible: Invoice;
  invoiceBusiness: Invoice;
  files: string[];
}

export const DEMO_DATE = "2026-07-16";

export function runDemo(specPath: string, outBase = "out"): DemoResult {
  const spec = parse(readFileSync(specPath, "utf8")) as { tenant?: string };
  const resolved = resolveTenant(spec, registries);
  const services = buildServices(resolved, {
    clock: new FixedClock(DEMO_DATE),
    idGen: new SeqIdGen(),
  });
  const quoting = services.quoting!;
  const billing = services.billing!;
  const vertical = resolved.config.vertical as ReformasConfig;
  const t = vertical.terminology;

  // --- Presupuesto: reforma de baño for a private homeowner ----------------
  const quote = quoting.create(`${t.quote} — Reforma de baño, C/ Mayor 12, Madrid`);
  const partidas = [
    {
      description: "Demolición de alicatado y retirada de escombros",
      unit: "m²",
      medicion: { unidades: 1, largo: 5, ancho: 2.5 },
      unitCents: 18_40,
    },
    {
      description: "Alicatado de paredes con azulejo cerámico 20×60",
      unit: "m²",
      medicion: { unidades: 5, largo: 2.5, ancho: 1.98 },
      unitCents: 32_00,
    },
    {
      description: "Instalación de fontanería completa de baño",
      unit: "ud",
      medicion: { unidades: 1 },
      unitCents: 1_850_00,
    },
  ];
  for (const p of partidas) {
    quoting.addLine(quote.id, {
      description: p.description,
      unit: p.unit,
      qtyMillis: medicionQtyMillis(p.medicion),
      unitCents: p.unitCents,
      taxCategoryHint: HINT_WORKS_ON_DWELLING,
      meta: { [t.measurement.toLowerCase()]: p.medicion },
    });
  }
  const accepted = quoting.accept(quote.id);

  // Factura 1 — eligible dwelling renovation (reduced rate path).
  const invoiceEligible = billing.issueFromQuote(accepted, {
    buyer: { name: "María García López", taxId: "00000000T", address: "C/ Mayor 12, Madrid" },
    seriesId: "FAC",
    attributes: dwellingWorksAttributes({
      recipient: "individual-private",
      dwellingPrivateUse: true,
      dwellingCompletedYearsAgo: 15,
      materialsShareBp: vertical.materialsShareDefaultBp,
    }),
  });

  // Factura 2 — same kind of works for a business client (general rate path).
  const office = quoting.create(`${t.quote} — Reforma de oficina, C/ Alcalá 200`);
  quoting.addLine(office.id, {
    description: "Reforma integral de oficina (partida alzada)",
    unit: "PA",
    qtyMillis: 1000,
    unitCents: 5_000_00,
    taxCategoryHint: HINT_WORKS_ON_DWELLING,
  });
  const invoiceBusiness = billing.issueFromQuote(quoting.accept(office.id), {
    buyer: { name: "Alcalá Consulting S.L.", taxId: "B11111111", address: "C/ Alcalá 200, Madrid" },
    seriesId: "FAC",
    attributes: dwellingWorksAttributes({
      recipient: "business",
      dwellingPrivateUse: false,
      dwellingCompletedYearsAgo: 30,
      materialsShareBp: vertical.materialsShareDefaultBp,
    }),
  });

  // --- Artifacts ------------------------------------------------------------
  const outDir = join(outBase, resolved.spec.tenant);
  mkdirSync(outDir, { recursive: true });
  const files: string[] = [];
  const emit = (name: string, content: string) => {
    const path = join(outDir, name);
    writeFileSync(path, content);
    files.push(path);
  };
  const json = (v: unknown) => JSON.stringify(v, null, 2);

  emit("RESOLUTION.json", json(resolved.report));
  emit(`presupuesto-${accepted.id}.json`, json(accepted));
  for (const inv of [invoiceEligible, invoiceBusiness]) {
    emit(`factura-${inv.displayNumber}.json`, json(inv));
    emit(
      `factura-${inv.displayNumber}.html`,
      renderInvoiceHtml(inv, services.labels, resolved.kernelConfig.locale),
    );
  }
  emit("chain.json", json([invoiceEligible.seal, invoiceBusiness.seal]));
  emit("events.json", json(services.events.list()));

  return { outDir, resolved, quoteId: accepted.id, invoiceEligible, invoiceBusiness, files };
}
