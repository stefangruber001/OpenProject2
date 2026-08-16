import { resolveAt, type Cents, type EffectivePeriod } from "@repo/kernel";
import type { ExtractionProfile, TaxIdCheck } from "@repo/capability-extraction";
import { IVA_GENERAL_BP, IVA_REDUCIDO_BP, IVA_SUPERREDUCIDO_BP } from "../tax/rates";
import { PACK_ID, PACK_VERSION } from "../tax/adapter";
import { checkIban, checkSpanishTaxId } from "./taxid";

/**
 * How documents are written here, as data for the generic extractor.
 *
 * Everything in this file is jurisdiction knowledge and therefore belongs in a
 * jurisdiction pack: the decimal comma and thousands point, dd/mm/yyyy and the
 * long form with month names, what a NIF/CIF/NIE looks like and whether one is
 * real, the words a Spanish supplier invoice uses for each field, and which
 * VAT rates were in force on a given date.
 *
 * The extractor knows none of it. Swapping this adapter for another country's
 * is the whole extent of "make the reader work there".
 */

const MONTHS: Record<string, string> = {
  enero: "01",
  febrero: "02",
  marzo: "03",
  abril: "04",
  mayo: "05",
  junio: "06",
  julio: "07",
  agosto: "08",
  septiembre: "09",
  setembre: "09",
  octubre: "10",
  noviembre: "11",
  diciembre: "12",
  // Catalan, because invoices in this market arrive in both languages.
  gener: "01",
  febrer: "02",
  març: "03",
  marc: "03",
  abril_ca: "04",
  maig: "05",
  juny: "06",
  juliol: "07",
  agost: "08",
  octubre_ca: "10",
  novembre: "11",
  desembre: "12",
};

const MONTH_ALTERNATION = Object.keys(MONTHS)
  .filter((m) => !m.includes("_"))
  .join("|");

/**
 * "1.234,56" and "1234,56" are money; "1.234" alone is ambiguous with a
 * thousands-grouped integer, so the decimal part is required. A document that
 * writes whole euros without decimals loses nothing: the totals check simply
 * has less to work with, which is honest.
 */
function parseAmountCents(raw: string): Cents | null {
  const cleaned = raw.replace(/[€\s]/g, "").replace(/^[+]/, "");
  const m = /^(-?)(\d{1,3}(?:\.\d{3})*|\d+),(\d{2})$/.exec(cleaned);
  if (!m) return null;
  const units = Number(m[2]!.replace(/\./g, ""));
  const cents = Number(m[3]);
  const value = units * 100 + cents;
  return m[1] === "-" ? -value : value;
}

function parseDate(raw: string): string | null {
  const text = raw.trim().toLowerCase();

  const numeric = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(text);
  if (numeric) {
    const day = numeric[1]!.padStart(2, "0");
    const month = numeric[2]!.padStart(2, "0");
    let year = numeric[3]!;
    // Two digits: this century. A supplier invoice from 1926 is not the case
    // to optimise for, and guessing silently is worse than guessing plainly.
    if (year.length === 2) year = `20${year}`;
    return isRealDate(year, month, day) ? `${year}-${month}-${day}` : null;
  }

  const long = new RegExp(
    `^(\\d{1,2})\\s+(?:de\\s+)?(${MONTH_ALTERNATION})\\s+(?:de[l]?\\s+)?(\\d{4})$`,
  ).exec(text);
  if (long) {
    const month = MONTHS[long[2]!];
    if (!month) return null;
    const day = long[1]!.padStart(2, "0");
    return isRealDate(long[3]!, month, day) ? `${long[3]}-${month}-${day}` : null;
  }

  return null;
}

function isRealDate(year: string, month: string, day: string): boolean {
  const d = new Date(`${year}-${month}-${day}T00:00:00Z`);
  return (
    !Number.isNaN(d.getTime()) &&
    d.getUTCFullYear() === Number(year) &&
    d.getUTCMonth() + 1 === Number(month) &&
    d.getUTCDate() === Number(day)
  );
}

function parsePercentBp(raw: string): number | null {
  const m = /^(\d{1,2})(?:[.,](\d{1,2}))?\s?%$/.exec(raw.trim());
  if (!m) return null;
  const whole = Number(m[1]) * 100;
  const frac = m[2] ? Number(m[2].padEnd(2, "0")) : 0;
  return whole + frac;
}

function checkTaxId(raw: string): TaxIdCheck | null {
  const result = checkSpanishTaxId(raw);
  return result ? { value: result.value, valid: result.valid } : null;
}

export const ES_EXTRACTION_PROFILE: ExtractionProfile = {
  id: `${PACK_ID}/extraction`,
  version: PACK_VERSION,

  keywords: {
    issuerName: ["razon social", "emisor", "proveedor", "expedido por", "datos del emisor"],
    issuerTaxId: ["nif", "cif", "n.i.f", "c.i.f", "nie", "identificacion fiscal"],
    docNumber: [
      "factura n",
      "n factura",
      "numero de factura",
      "num factura",
      "factura numero",
      "n de documento",
      "albaran n",
    ],
    issueDate: ["fecha de factura", "fecha factura", "fecha de emision", "fecha emision", "fecha"],
    dueDate: ["vencimiento", "fecha de vencimiento", "vence el", "forma de pago vencimiento"],
    netAmount: ["base imponible", "base", "subtotal", "importe neto"],
    taxAmount: ["cuota iva", "iva", "i.v.a", "cuota"],
    withholdingAmount: ["retencion", "irpf", "ret. irpf", "retencion irpf"],
    totalAmount: ["total factura", "total a pagar", "importe total", "total"],
    iban: ["iban", "cuenta", "cta", "domiciliacion"],
    orderRef: ["pedido", "n pedido", "su pedido", "obra", "referencia obra", "presupuesto n"],
  },

  patterns: {
    // Money: optional euro sign, thousands points, decimal comma.
    amount: /-?\s?\d{1,3}(?:\.\d{3})*,\d{2}\s?€?|-?\s?\d+,\d{2}\s?€?/g,
    date: new RegExp(
      `\\b\\d{1,2}[/.\\-]\\d{1,2}[/.\\-]\\d{2,4}\\b|\\b\\d{1,2}\\s+de\\s+(?:${MONTH_ALTERNATION})\\s+de[l]?\\s+\\d{4}\\b`,
      "gi",
    ),
    taxId: /\b[A-Z]?\d{7,8}[-\s]?[A-Z0-9]\b/g,
    percent: /\b\d{1,2}(?:[.,]\d{1,2})?\s?%/g,
    accountNumber: /\bES\d{2}[\s]?(?:\d{4}[\s]?){5}\b/g,
    docNumber: /\b[A-Z]{0,4}[-/]?\d{2,}[-/]?\d*\b/g,
  },

  parseAmountCents,
  parseDate,
  parsePercentBp,
  checkTaxId,
  checkAccountNumber(raw) {
    return checkIban(raw);
  },

  /**
   * The rates that were law on that date, resolved from the pack's own
   * effective-dated tables — never a constant. A document from before a rate
   * change must be checked against the rate of its own day.
   */
  expectedTaxRatesBp(issueDateIso: string): number[] {
    const at = (table: readonly EffectivePeriod<number>[], what: string): number | null => {
      try {
        return resolveAt(table, issueDateIso, what).value;
      } catch {
        // A date before the earliest encoded era: the tables refuse to guess,
        // and so does this. The rate check simply reports "unknown" rather
        // than inventing a rate to compare against.
        return null;
      }
    };
    return [
      at(IVA_GENERAL_BP, "general rate"),
      at(IVA_REDUCIDO_BP, "reduced rate"),
      at(IVA_SUPERREDUCIDO_BP, "super-reduced rate"),
      // Exempt and reverse-charge documents state no tax at all.
      0,
    ].filter((r): r is number => r !== null);
  },
};
