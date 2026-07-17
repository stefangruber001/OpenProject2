import { createHash } from "node:crypto";
import { canonicalJson, InMemoryKeyValueStore, type KeyValueStore } from "@repo/kernel";
import type { InvoiceChainPort, InvoiceSeal } from "@repo/capability-billing";

interface ChainHead {
  seq: number;
  prevHash: string | null;
}

const HEAD_KEY = "es.invoice-chain.head";

/**
 * Per-tenant invoice hash chain: append-only, tamper-evident. Chain state
 * lives in an injected KeyValueStore (in-memory today; the durable adapter
 * drops in via the same contract). This is the structural precursor to the
 * Verifactu "registro de facturación" chain; the certified record layout + QR
 * land as an iteration here (LEGAL_REVIEW.md #1, gated until then).
 */
export class EsInvoiceChainAdapter implements InvoiceChainPort {
  constructor(private readonly state: KeyValueStore = new InMemoryKeyValueStore()) {}

  async seal(record: {
    tenantId: string;
    series: string;
    displayNumber: string;
    issueDate: string;
    totalCents: number;
    buyerTaxId?: string;
  }): Promise<InvoiceSeal> {
    const head = ((await this.state.get(HEAD_KEY)) as ChainHead | undefined) ?? {
      seq: 0,
      prevHash: null,
    };
    const seq = head.seq + 1;
    const payload = canonicalJson({ ...record, seq, prevHash: head.prevHash });
    const hash = createHash("sha256").update(payload).digest("hex");
    await this.state.set(HEAD_KEY, { seq, prevHash: hash } satisfies ChainHead);
    return { seq, prevHash: head.prevHash, hash, algorithm: "SHA-256" };
  }
}
