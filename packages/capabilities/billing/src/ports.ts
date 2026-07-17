import type { BasisPoints, Cents, PortId } from "@repo/kernel";

/**
 * Ports the billing capability consumes. Adapters come from packs — billing
 * itself knows no tax law, no country, no sector.
 */
export const TAX_PORT: PortId = "tax@1";
export const INVOICE_CHAIN_PORT: PortId = "invoice-chain@1";
export const DOC_LABELS_PORT: PortId = "doc-labels@1";

export interface TaxLineInput {
  lineId: string;
  baseCents: Cents;
  /** Opaque hint set by the quote line (vertical vocabulary). */
  categoryHint?: string;
}

export interface TaxDeterminationInput {
  /** Law is resolved at this date — effective dating, mandate §6.3. */
  issueDate: string;
  lines: TaxLineInput[];
  /**
   * Opaque eligibility attributes (namespaced keys owned by packs). Billing
   * transports them; only the bound adapter interprets them.
   */
  attributes: Record<string, string | number | boolean>;
}

/** The decision AND its justification are persisted, never recomputed. */
export interface TaxJustification {
  ruleId: string;
  legalBasis: string;
  effectiveDate: string;
  providerId: string;
  providerVersion: string;
  legallyVerified: boolean;
  explanation: string;
  inputs: Record<string, unknown>;
}

export interface TaxLineDecision {
  lineId: string;
  taxCode: string;
  rateBp: BasisPoints;
  justification: TaxJustification;
}

export interface TaxPort {
  determine(input: TaxDeterminationInput): { perLine: TaxLineDecision[] };
}

/** Tamper-evidence chaining (e.g. jurisdictions with anti-fraud rules). */
export interface InvoiceSeal {
  seq: number;
  prevHash: string | null;
  hash: string;
  algorithm: string;
}

export interface InvoiceChainPort {
  seal(record: {
    tenantId: string;
    series: string;
    displayNumber: string;
    issueDate: string;
    totalCents: Cents;
    buyerTaxId?: string;
  }): Promise<InvoiceSeal>;
}

/** Human-facing document labels — language/wording is pack-supplied data. */
export interface DocLabels {
  invoiceTitle: string;
  rectificativeTitle: string;
  seller: string;
  buyer: string;
  taxIdLabel: string;
  date: string;
  description: string;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
  taxBase: string;
  taxLabel: string;
  total: string;
  rectifiesLabel: string;
}

export const DEFAULT_LABELS: DocLabels = {
  invoiceTitle: "Invoice",
  rectificativeTitle: "Corrective invoice",
  seller: "Seller",
  buyer: "Customer",
  taxIdLabel: "Tax ID",
  date: "Date",
  description: "Description",
  quantity: "Qty",
  unitPrice: "Unit price",
  lineTotal: "Amount",
  taxBase: "Tax base",
  taxLabel: "Tax",
  total: "Total",
  rectifiesLabel: "Rectifies",
};
