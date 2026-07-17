import type { PortId } from "@repo/kernel";

/**
 * Outbound email port. A tenant's real provider (SMTP/API) binds an adapter;
 * dev uses the log-only outbox in this package. The capability never contains a
 * provider — only the contract.
 */
export const EMAIL_OUT_PORT: PortId = "email-out@1";

/** A fully-rendered message handed to the outbox. */
export interface OutgoingEmail {
  to: string;
  from: string;
  subject: string;
  body: string;
}

/** What the outbox returns. `delivered:false` means accepted but not sent. */
export interface EmailReceipt {
  id: string;
  acceptedAt: string;
  delivered: boolean;
  /** e.g. "log-only" (dev) or a provider id once wired. */
  mode: string;
  detail?: string;
}

export interface EmailOutbox {
  send(email: OutgoingEmail): Promise<EmailReceipt>;
}
