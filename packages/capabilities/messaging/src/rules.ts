/**
 * When a message goes out, and whether anyone looks at it first.
 *
 * A rule is `event → condition → template → recipient → timing → channel`,
 * which is exactly the shape §5.7 asks for and, more usefully, the shape a
 * person can read back: "when a quote is sent, and seven days have passed with
 * no reply, draft the follow-up template to the customer, by email."
 *
 * THE DEFAULT IS `draft`, AND THAT IS THE POINT. `mode: "auto"` exists because
 * some messages genuinely should not wait for a human — but it has to be typed
 * out, per rule, by someone who meant it. A messaging system whose default is
 * "send" is one bad condition away from mailing every customer at once, and
 * the blast radius of that is the company's reputation rather than a stack
 * trace. Nothing here sends anything either way: this module PLANS, the outbox
 * port sends, and in dev that port is the log-only one.
 */

export type CommsChannel = "email" | "whatsapp" | "sms";
export type CommsMode = "draft" | "auto";

export interface CommsRule {
  id: string;
  /** Human name, shown in the rule list. */
  label?: string;
  /** Lifecycle event key, e.g. "quote-sent". Matched exactly. */
  event: string;
  /** Template key. Resolved by the caller against its own template library. */
  template: string;
  /** Who it goes to, as a role the caller resolves: "customer", "supplier"… */
  recipient?: string;
  /**
   * Days after the event before it fires. Zero means "as soon as the event
   * happens"; several rules on the same event with different offsets are how
   * "at 3, 10 and 20 days" is expressed.
   */
  afterDays?: number;
  channel?: CommsChannel;
  /**
   * `draft` queues it for a person to approve. `auto` marks it ready to go
   * without one. See the note above about which is the default and why.
   */
  mode?: CommsMode;
  /**
   * Optional guard, evaluated against the event's own facts. Absent means
   * "always". Kept to a named flag rather than an expression language: a rule
   * a non-programmer cannot read is a rule nobody audits.
   */
  requiresFlag?: string;
  /** Absent-or-true means active; false is a rule kept but switched off. */
  active?: boolean;
}

export const COMMS_RULE_DEFAULTS = {
  recipient: "customer",
  afterDays: 0,
  channel: "email" as CommsChannel,
  mode: "draft" as CommsMode,
  active: true,
};

/**
 * Fills a stored rule's gaps. Plain, not zod: the browser bundle plans rules,
 * and a validation library has no business travelling into a phone to default
 * four fields. The zod version, for validating a tenant file, is in model.ts.
 */
export function resolveRule(
  rule: CommsRule,
): Required<Omit<CommsRule, "label" | "requiresFlag">> & Pick<CommsRule, "label" | "requiresFlag"> {
  return {
    id: rule.id,
    label: rule.label,
    event: rule.event,
    template: rule.template,
    recipient: rule.recipient ?? COMMS_RULE_DEFAULTS.recipient,
    afterDays: rule.afterDays ?? COMMS_RULE_DEFAULTS.afterDays,
    channel: rule.channel ?? COMMS_RULE_DEFAULTS.channel,
    mode: rule.mode ?? COMMS_RULE_DEFAULTS.mode,
    requiresFlag: rule.requiresFlag,
    active: rule.active ?? COMMS_RULE_DEFAULTS.active,
  };
}

/** Something that happened, with enough on it to fill a template. */
export interface CommsEvent {
  /** Matched against a rule's `event`. */
  event: string;
  /** The record this is about — invoice id, project id. Carried through, never read. */
  subjectRef: string;
  /** The day it happened. `afterDays` counts from here. */
  date: string;
  /** Addresses by recipient role: {customer: "a@b.c"}. */
  recipients?: Record<string, string>;
  /** Template variables, and the flags a rule's `requiresFlag` can test. */
  vars?: Record<string, string | number>;
  flags?: Record<string, boolean>;
}

/** One message a rule says should exist. Nothing has been sent. */
export interface PlannedMessage {
  ruleId: string;
  event: string;
  subjectRef: string;
  template: string;
  recipient: string;
  /** Resolved address, or null when the caller supplied none for that role. */
  to: string | null;
  channel: CommsChannel;
  /** The day it is due — the event's date plus the rule's offset. */
  dueDate: string;
  /** `draft` needs a person; `auto` does not. Never means "already sent". */
  mode: CommsMode;
  vars: Record<string, string | number>;
  /** True once `dueDate` has arrived. Earlier ones sit in the queue. */
  due: boolean;
  /** Why it is NOT plannable, when that is the case. */
  blocked?: "noRecipient";
}

function addDays(dateIso: string, days: number): string {
  const d = new Date(dateIso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * What the rules say should be queued, given what has happened.
 *
 * Pure and repeatable: the same events and the same rules produce the same
 * plan, every time, which is what makes "test a rule in simulation mode"
 * (§5.7) meaningful rather than a second implementation of the same logic.
 *
 * A rule whose recipient has no address is still planned, and marked
 * `blocked: "noRecipient"`. Dropping it silently would leave a customer
 * un-chased and nobody able to see why — the whole reason the queue is a
 * screen and not a background job.
 */
export function planMessages(
  rules: CommsRule[],
  events: CommsEvent[],
  options: { asOf: string },
): PlannedMessage[] {
  const planned: PlannedMessage[] = [];
  for (const event of events) {
    for (const raw of rules) {
      const rule = resolveRule(raw);
      if (!rule.active) continue;
      if (rule.event !== event.event) continue;
      if (rule.requiresFlag && !event.flags?.[rule.requiresFlag]) continue;

      const dueDate = addDays(event.date, rule.afterDays);
      const to = event.recipients?.[rule.recipient] ?? null;
      planned.push({
        ruleId: rule.id,
        event: rule.event,
        subjectRef: event.subjectRef,
        template: rule.template,
        recipient: rule.recipient,
        to,
        channel: rule.channel,
        dueDate,
        mode: rule.mode,
        vars: event.vars ?? {},
        due: dueDate <= options.asOf,
        ...(to ? {} : { blocked: "noRecipient" as const }),
      });
    }
  }
  // Soonest first, then by rule, so the queue reads as a timeline and two runs
  // over the same data never disagree about the order.
  return planned.sort(
    (a, b) =>
      (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0) ||
      (a.ruleId < b.ruleId ? -1 : a.ruleId > b.ruleId ? 1 : 0),
  );
}

/**
 * Which planned messages are not already accounted for.
 *
 * `existing` is the set of `ruleId|subjectRef` keys the caller has already
 * queued, sent or cancelled. Without this, re-running the rules after every
 * change would re-queue the same reminder daily until somebody muted the whole
 * system — the classic way a notification feature gets switched off for good.
 */
export function newMessages(
  planned: PlannedMessage[],
  existing: Iterable<string>,
): PlannedMessage[] {
  const seen = new Set(existing);
  return planned.filter((p) => !seen.has(`${p.ruleId}|${p.subjectRef}`));
}

/** The key `newMessages` de-duplicates on. Exported so callers cannot drift from it. */
export function messageKey(m: { ruleId: string; subjectRef: string }): string {
  return `${m.ruleId}|${m.subjectRef}`;
}
