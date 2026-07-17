import { FactoryError } from "@repo/kernel";
import type { EmailDraft, MessagingConfig } from "./model";
import type { EmailOutbox, EmailReceipt, OutgoingEmail } from "./ports";

/** Substitute `{{key}}` tokens; unknown tokens are left intact (visible). */
export function renderTemplate(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key: string) =>
    key in vars ? String(vars[key]) : `{{${key}}}`,
  );
}

export interface DraftInput {
  /** Event key matching a configured template. */
  event: string;
  to: string;
  /** Variables filled into the template placeholders. */
  vars?: Record<string, string | number>;
}

/**
 * Auto-drafts email from lifecycle events and sends through an injected outbox.
 * The "Send" button in the UI maps to exactly one call: `send(draft)`.
 */
export class MessagingService {
  constructor(
    private readonly config: MessagingConfig,
    private readonly outbox?: EmailOutbox,
  ) {}

  templateFor(event: string) {
    return this.config.templates.find((t) => t.event === event);
  }

  /** Build a ready-to-send draft from an event + variables. No sending. */
  draft(input: DraftInput): EmailDraft {
    const tpl = this.templateFor(input.event);
    if (!tpl) {
      throw new FactoryError(
        "NO_TEMPLATE",
        `No email template configured for event "${input.event}".`,
        { event: input.event },
      );
    }
    const vars: Record<string, string | number> = {
      from: this.config.from,
      signature: this.config.signature,
      ...(input.vars ?? {}),
    };
    return {
      event: input.event,
      to: input.to,
      from: this.config.from,
      subject: renderTemplate(tpl.subject, vars),
      body: renderTemplate(tpl.body, vars),
      status: "draft",
    };
  }

  /** The single Send action — routed through the bound outbox port. */
  async send(draft: EmailDraft): Promise<{ draft: EmailDraft; receipt: EmailReceipt }> {
    if (!this.outbox) {
      throw new FactoryError(
        "NO_OUTBOX",
        `No ${"email-out@1"} adapter bound; a draft can be prepared but not sent.`,
      );
    }
    const receipt = await this.outbox.send({
      to: draft.to,
      from: draft.from,
      subject: draft.subject,
      body: draft.body,
    });
    return { draft: { ...draft, status: "sent" }, receipt };
  }
}

/**
 * Dev / safe-mode adapter: records outgoing mail and returns a receipt marked
 * `delivered:false`. It has NO network path — nothing can leave the system.
 * Clock/id are injected so it is deterministic and testable (kernel style).
 */
export class LogOnlyOutbox implements EmailOutbox {
  readonly sent: OutgoingEmail[] = [];
  private seq = 0;

  constructor(
    private readonly now: () => string = () => "",
    private readonly nextId: (seq: number) => string = (seq) => `mail-${seq}`,
  ) {}

  async send(email: OutgoingEmail): Promise<EmailReceipt> {
    this.sent.push(email);
    this.seq += 1;
    return {
      id: this.nextId(this.seq),
      acceptedAt: this.now(),
      delivered: false,
      mode: "log-only",
      detail: "recorded, not delivered (dev safe mode) — no provider bound",
    };
  }
}
