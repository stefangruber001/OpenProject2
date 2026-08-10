import { describe, expect, it } from "vitest";
import { commsRuleSchema } from "./model";
import {
  messageKey,
  newMessages,
  planMessages,
  resolveRule,
  COMMS_RULE_DEFAULTS,
  type CommsEvent,
  type CommsRule,
} from "./rules";

const rule = (
  over: Partial<CommsRule> & { id: string; event: string; template: string },
): CommsRule => commsRuleSchema.parse(over) as CommsRule;

const event = (over: Partial<CommsEvent> & { event: string; subjectRef: string }): CommsEvent => ({
  date: "2026-03-01",
  recipients: { customer: "cliente@example.com" },
  ...over,
});

describe("planning messages from rules", () => {
  it("plans one message per matching rule, with the event's variables", () => {
    const plan = planMessages(
      [rule({ id: "r1", event: "quote-sent", template: "quote-followup" })],
      [event({ event: "quote-sent", subjectRef: "PRE-1", vars: { number: "PRE-1" } })],
      { asOf: "2026-03-01" },
    );
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({
      ruleId: "r1",
      template: "quote-followup",
      to: "cliente@example.com",
      subjectRef: "PRE-1",
      vars: { number: "PRE-1" },
    });
  });

  it("defaults to draft, never to sending", () => {
    // The single most important default in this module: a rule that does not
    // say "auto" queues for a person. Asserted on BOTH paths, because the
    // tenant-file schema and the runtime resolver are two separate pieces of
    // code that must never disagree about this one.
    expect(rule({ id: "r1", event: "e", template: "t" }).mode).toBe("draft");
    expect(resolveRule({ id: "r1", event: "e", template: "t" }).mode).toBe("draft");
    expect(COMMS_RULE_DEFAULTS.mode).toBe("draft");
  });

  it("counts the delay from the event's own date", () => {
    const plan = planMessages(
      [rule({ id: "r1", event: "quote-sent", template: "t", afterDays: 7 })],
      [event({ event: "quote-sent", subjectRef: "PRE-1", date: "2026-03-01" })],
      { asOf: "2026-03-05" },
    );
    expect(plan[0]!.dueDate).toBe("2026-03-08");
    expect(plan[0]!.due).toBe(false);
  });

  it("marks a message due once its date has arrived", () => {
    const plan = planMessages(
      [rule({ id: "r1", event: "invoice-overdue", template: "t", afterDays: 3 })],
      [event({ event: "invoice-overdue", subjectRef: "FAC-1", date: "2026-03-01" })],
      { asOf: "2026-03-10" },
    );
    expect(plan[0]!.due).toBe(true);
  });

  it("expresses 'at 3, 10 and 20 days' as three rules on one event", () => {
    const plan = planMessages(
      [3, 10, 20].map((d) =>
        rule({ id: `r${d}`, event: "invoice-overdue", template: "chase", afterDays: d }),
      ),
      [event({ event: "invoice-overdue", subjectRef: "FAC-1", date: "2026-03-01" })],
      { asOf: "2026-03-12" },
    );
    expect(plan.map((p) => p.dueDate)).toEqual(["2026-03-04", "2026-03-11", "2026-03-21"]);
    expect(plan.map((p) => p.due)).toEqual([true, true, false]);
  });

  it("ignores a rule that is switched off", () => {
    const plan = planMessages(
      [rule({ id: "r1", event: "e", template: "t", active: false })],
      [event({ event: "e", subjectRef: "X" })],
      { asOf: "2026-03-01" },
    );
    expect(plan).toEqual([]);
  });

  it("ignores an event no rule is listening for", () => {
    const plan = planMessages(
      [rule({ id: "r1", event: "quote-sent", template: "t" })],
      [event({ event: "something-else", subjectRef: "X" })],
      { asOf: "2026-03-01" },
    );
    expect(plan).toEqual([]);
  });

  it("honours a rule's guard flag", () => {
    const rules = [rule({ id: "r1", event: "e", template: "t", requiresFlag: "unpaid" })];
    expect(
      planMessages(rules, [event({ event: "e", subjectRef: "X", flags: { unpaid: true } })], {
        asOf: "2026-03-01",
      }),
    ).toHaveLength(1);
    expect(
      planMessages(rules, [event({ event: "e", subjectRef: "X", flags: { unpaid: false } })], {
        asOf: "2026-03-01",
      }),
    ).toEqual([]);
    expect(
      planMessages(rules, [event({ event: "e", subjectRef: "X" })], { asOf: "2026-03-01" }),
    ).toEqual([]);
  });

  it("plans a message with no address and says so, rather than dropping it", () => {
    const plan = planMessages(
      [rule({ id: "r1", event: "e", template: "t" })],
      [{ event: "e", subjectRef: "X", date: "2026-03-01", recipients: {} }],
      { asOf: "2026-03-01" },
    );
    // A silently dropped chase is a customer nobody chased and nobody can see.
    expect(plan[0]).toMatchObject({ to: null, blocked: "noRecipient" });
  });

  it("resolves the recipient role the rule asks for", () => {
    const plan = planMessages(
      [rule({ id: "r1", event: "e", template: "t", recipient: "supplier" })],
      [
        event({
          event: "e",
          subjectRef: "X",
          recipients: { customer: "c@x.com", supplier: "s@x.com" },
        }),
      ],
      { asOf: "2026-03-01" },
    );
    expect(plan[0]!.to).toBe("s@x.com");
  });

  it("orders the queue as a timeline, deterministically", () => {
    const plan = planMessages(
      [
        rule({ id: "late", event: "e", template: "t", afterDays: 20 }),
        rule({ id: "early", event: "e", template: "t", afterDays: 1 }),
      ],
      [event({ event: "e", subjectRef: "X" })],
      { asOf: "2026-03-01" },
    );
    expect(plan.map((p) => p.ruleId)).toEqual(["early", "late"]);
  });
});

describe("not re-queuing what already exists", () => {
  const plan = () =>
    planMessages(
      [rule({ id: "r1", event: "e", template: "t" })],
      [event({ event: "e", subjectRef: "FAC-1" }), event({ event: "e", subjectRef: "FAC-2" })],
      { asOf: "2026-03-01" },
    );

  it("filters out what the caller has already handled", () => {
    const fresh = newMessages(plan(), ["r1|FAC-1"]);
    expect(fresh.map((m) => m.subjectRef)).toEqual(["FAC-2"]);
  });

  it("keeps everything when nothing has been handled", () => {
    expect(newMessages(plan(), [])).toHaveLength(2);
  });

  it("builds the de-duplication key the same way the caller must", () => {
    // Exported precisely so a caller cannot invent a subtly different key and
    // re-queue the same reminder every single day until someone mutes it all.
    expect(messageKey({ ruleId: "r1", subjectRef: "FAC-1" })).toBe("r1|FAC-1");
    expect(newMessages(plan(), plan().map(messageKey))).toEqual([]);
  });
});
