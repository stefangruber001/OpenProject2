// UI language is DATA, not a fork. Working language is English; Spanish and
// Catalan sets ship alongside it and are switched on before handover (their
// live site is Catalan-first with a Spanish toggle). This is SEPARATE from the
// tenant's fiscal locale (es-ES), which drives VAT + money formatting and never
// changes with the UI language. Flip the working language with UI_LANG=es|ca.
export const LANGS = ["en", "es", "ca"] as const;
export type Lang = (typeof LANGS)[number];

export const DEFAULT_UI_LANG: Lang = "en";

/** Active UI language: UI_LANG env (en|es|ca) or the English working default. */
export function activeLang(): Lang {
  const raw = (process.env.UI_LANG ?? "").toLowerCase();
  return (LANGS as readonly string[]).includes(raw) ? (raw as Lang) : DEFAULT_UI_LANG;
}

/** UI chrome strings. Domain vocabulary (quote/line term, chapters) comes from
 *  the vertical pack config, not here — see terminologyByLang / chapterLabels. */
export interface UiStrings {
  newQuotePlaceholder: string;
  createQuote: string;
  autoDemo: string;
  quotesHeading: (n: number) => string;
  invoicesHeading: (n: number) => string;
  noQuotes: string;
  noInvoices: string;
  ports: string;
  runtimeMemory: string;
  runtimeDb: string;
  footerNote: string;
  // presupuesto page
  draft: string;
  accepted: (date?: string) => string;
  revisionOf: (id: string) => string;
  lineHeading: (term: string, n: number) => string;
  colConcept: string;
  colQty: string;
  colUnitPrice: string;
  colAmount: string;
  addFirstLine: (term: string) => string;
  base: string;
  addLine: (term: string) => string;
  chapter: string;
  description: string;
  descriptionExample: string;
  unit: string;
  units: string;
  length: string;
  width: string;
  unitPrice: string;
  add: string;
  clientAcceptance: string;
  markAccepted: string;
  issueInvoice: string;
  createRevision: (v: number) => string;
  client: string;
  taxId: string;
  address: string;
  recipient: string;
  recipientIndividual: string;
  recipientCommunity: string;
  recipientBusiness: string;
  privateDwelling: string;
  dwellingAge: string;
  materialsPct: string;
  issueInvoiceCta: string;
}

const en: UiStrings = {
  newQuotePlaceholder: "New quote — project / address",
  createQuote: "Create quote",
  autoDemo: "Auto demo",
  quotesHeading: (n) => `Quotes (${n})`,
  invoicesHeading: (n) => `Invoices (${n})`,
  noQuotes: "No quotes yet.",
  noInvoices: "No invoices yet.",
  ports: "ports",
  runtimeMemory: "in-memory (dev)",
  runtimeDb: "PostgreSQL (RLS)",
  footerNote: "VAT decisions are persisted with their justification (ADR-0008).",
  draft: "draft",
  accepted: (date) => `accepted${date ? ` (${date})` : ""}`,
  revisionOf: (id) => `revision of ${id}`,
  lineHeading: (term, n) => `${term} (${n})`,
  colConcept: "Item",
  colQty: "Quantity",
  colUnitPrice: "Unit price",
  colAmount: "Amount",
  addFirstLine: (term) => `Add the first ${term} below.`,
  base: "Base",
  addLine: (term) => `Add ${term} — choose, don't type`,
  chapter: "Chapter",
  description: "Description",
  descriptionExample: "e.g. Ceramic tiling 20×60",
  unit: "Unit",
  units: "Units",
  length: "Length (m)",
  width: "Width (m)",
  unitPrice: "Unit price (€)",
  add: "Add",
  clientAcceptance: "Client acceptance",
  markAccepted: "Mark as accepted",
  issueInvoice: "Issue invoice",
  createRevision: (v) => `Create revision (v${v})`,
  client: "Client",
  taxId: "Tax ID",
  address: "Address",
  recipient: "Recipient",
  recipientIndividual: "Individual",
  recipientCommunity: "Community of owners",
  recipientBusiness: "Business",
  privateDwelling: "Private-use dwelling",
  dwellingAge: "Dwelling age (years)",
  materialsPct: "Materials (% of base)",
  issueInvoiceCta: "Issue invoice (VAT decided by rule, with justification)",
};

const es: UiStrings = {
  newQuotePlaceholder: "Nuevo presupuesto — obra / dirección",
  createQuote: "Crear presupuesto",
  autoDemo: "Demo automático",
  quotesHeading: (n) => `Presupuestos (${n})`,
  invoicesHeading: (n) => `Facturas (${n})`,
  noQuotes: "Sin presupuestos aún.",
  noInvoices: "Sin facturas aún.",
  ports: "puertos",
  runtimeMemory: "en memoria (dev)",
  runtimeDb: "PostgreSQL (RLS)",
  footerNote: "Las decisiones de IVA se persisten con su justificación (ADR-0008).",
  draft: "borrador",
  accepted: (date) => `aceptado${date ? ` (${date})` : ""}`,
  revisionOf: (id) => `revisión de ${id}`,
  lineHeading: (term, n) => `${term}s (${n})`,
  colConcept: "Concepto",
  colQty: "Cantidad",
  colUnitPrice: "Precio ud.",
  colAmount: "Importe",
  addFirstLine: (term) => `Añade la primera ${term.toLowerCase()} abajo.`,
  base: "Base",
  addLine: (term) => `Añadir ${term.toLowerCase()} — elegir, no teclear`,
  chapter: "Capítulo",
  description: "Descripción",
  descriptionExample: "p. ej. Alicatado azulejo 20×60",
  unit: "Unidad",
  units: "Unidades",
  length: "Largo (m)",
  width: "Ancho (m)",
  unitPrice: "Precio unitario (€)",
  add: "Añadir",
  clientAcceptance: "Aceptación del cliente",
  markAccepted: "Marcar como aceptado",
  issueInvoice: "Emitir factura",
  createRevision: (v) => `Crear revisión (v${v})`,
  client: "Cliente",
  taxId: "NIF",
  address: "Dirección",
  recipient: "Destinatario",
  recipientIndividual: "Particular",
  recipientCommunity: "Comunidad de propietarios",
  recipientBusiness: "Empresa",
  privateDwelling: "Vivienda de uso particular",
  dwellingAge: "Antigüedad vivienda (años)",
  materialsPct: "Materiales (% base)",
  issueInvoiceCta: "Emitir factura (IVA decidido por regla, con justificación)",
};

const ca: UiStrings = {
  newQuotePlaceholder: "Nou pressupost — obra / adreça",
  createQuote: "Crear pressupost",
  autoDemo: "Demo automàtica",
  quotesHeading: (n) => `Pressupostos (${n})`,
  invoicesHeading: (n) => `Factures (${n})`,
  noQuotes: "Encara no hi ha pressupostos.",
  noInvoices: "Encara no hi ha factures.",
  ports: "ports",
  runtimeMemory: "en memòria (dev)",
  runtimeDb: "PostgreSQL (RLS)",
  footerNote: "Les decisions d'IVA es persisteixen amb la seva justificació (ADR-0008).",
  draft: "esborrany",
  accepted: (date) => `acceptat${date ? ` (${date})` : ""}`,
  revisionOf: (id) => `revisió de ${id}`,
  lineHeading: (term, n) => `${term}s (${n})`,
  colConcept: "Concepte",
  colQty: "Quantitat",
  colUnitPrice: "Preu u.",
  colAmount: "Import",
  addFirstLine: (term) => `Afegeix la primera ${term.toLowerCase()} a sota.`,
  base: "Base",
  addLine: (term) => `Afegir ${term.toLowerCase()} — triar, no teclejar`,
  chapter: "Capítol",
  description: "Descripció",
  descriptionExample: "p. ex. Enrajolat 20×60",
  unit: "Unitat",
  units: "Unitats",
  length: "Llarg (m)",
  width: "Ample (m)",
  unitPrice: "Preu unitari (€)",
  add: "Afegir",
  clientAcceptance: "Acceptació del client",
  markAccepted: "Marcar com a acceptat",
  issueInvoice: "Emetre factura",
  createRevision: (v) => `Crear revisió (v${v})`,
  client: "Client",
  taxId: "NIF",
  address: "Adreça",
  recipient: "Destinatari",
  recipientIndividual: "Particular",
  recipientCommunity: "Comunitat de propietaris",
  recipientBusiness: "Empresa",
  privateDwelling: "Habitatge d'ús particular",
  dwellingAge: "Antiguitat habitatge (anys)",
  materialsPct: "Materials (% base)",
  issueInvoiceCta: "Emetre factura (IVA decidit per regla, amb justificació)",
};

const DICT: Record<Lang, UiStrings> = { en, es, ca };

/** Chrome strings for the active (or given) UI language. */
export function ui(lang: Lang = activeLang()): UiStrings {
  return DICT[lang];
}
