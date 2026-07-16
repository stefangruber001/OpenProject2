import { createHash } from "node:crypto";
import { canonicalJson } from "@repo/kernel";
import type { InvoiceChainPort, InvoiceSeal } from "@repo/capability-billing";

/**
 * Per-tenant invoice hash chain: append-only, tamper-evident. This is the
 * structural precursor to the Verifactu "registro de facturación" chain; the
 * certified record layout + QR land as an iteration here (LEGAL_REVIEW.md #1,
 * gated until then).
 */
export class EsInvoiceChainAdapter implements InvoiceChainPort {
  private prevHash: string | null = null;
  private seq = 0;

  seal(record: {
    tenantId: string;
    series: string;
    displayNumber: string;
    issueDate: string;
    totalCents: number;
    buyerTaxId?: string;
  }): InvoiceSeal {
    this.seq += 1;
    const payload = canonicalJson({ ...record, seq: this.seq, prevHash: this.prevHash });
    const hash = createHash("sha256").update(payload).digest("hex");
    const seal: InvoiceSeal = {
      seq: this.seq,
      prevHash: this.prevHash,
      hash,
      algorithm: "SHA-256",
    };
    this.prevHash = hash;
    return seal;
  }
}
