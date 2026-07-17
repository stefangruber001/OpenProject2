import { describe, expect, it } from "vitest";
import { isFactoryError } from "@repo/kernel";
import { messagingConfigSchema } from "./model";
import { LogOnlyOutbox, MessagingService, renderTemplate } from "./service";

const cfg = messagingConfigSchema.parse({
  from: "team@example.com",
  signature: "The Team",
  templates: [
    {
      event: "welcome",
      subject: "Hello {{name}} — {{ref}}",
      body: "Dear {{name}},\n\nYour reference is {{ref}} for {{amount}}.\n\nRegards,\n{{signature}}\n{{from}}",
    },
  ],
});

describe("renderTemplate", () => {
  it("substitutes known tokens and leaves unknown ones visible", () => {
    expect(renderTemplate("Hi {{name}} / {{missing}}", { name: "Ana" })).toBe(
      "Hi Ana / {{missing}}",
    );
  });
});

describe("MessagingService.draft", () => {
  it("auto-generates a ready-to-send draft from an event + variables", () => {
    const svc = new MessagingService(cfg);
    const d = svc.draft({
      event: "welcome",
      to: "ana@example.com",
      vars: { name: "Ana", ref: "R-7", amount: "100" },
    });
    expect(d.status).toBe("draft");
    expect(d.subject).toBe("Hello Ana — R-7");
    expect(d.body).toContain("Your reference is R-7 for 100");
    expect(d.body).toContain("The Team"); // signature injected
    expect(d.from).toBe("team@example.com");
  });

  it("throws when no template matches the event", () => {
    const svc = new MessagingService(cfg);
    try {
      svc.draft({ event: "nope", to: "x@example.com" });
      throw new Error("should have thrown");
    } catch (e) {
      expect(isFactoryError(e, "NO_TEMPLATE")).toBe(true);
    }
  });
});

describe("MessagingService.send (log-only)", () => {
  it("sends through the outbox, records it, and never marks it delivered", async () => {
    const outbox = new LogOnlyOutbox(() => "2026-07-17T09:00:00Z");
    const svc = new MessagingService(cfg, outbox);
    const draft = svc.draft({
      event: "welcome",
      to: "ana@example.com",
      vars: { name: "Ana", ref: "R-7", amount: "100" },
    });

    const { draft: sent, receipt } = await svc.send(draft);

    expect(sent.status).toBe("sent");
    expect(receipt.delivered).toBe(false); // safe mode — nothing left the system
    expect(receipt.mode).toBe("log-only");
    expect(outbox.sent).toHaveLength(1);
    expect(outbox.sent[0]?.to).toBe("ana@example.com");
    expect(receipt.id).toBe("mail-1");
    expect(receipt.acceptedAt).toBe("2026-07-17T09:00:00Z");
  });

  it("refuses to send when no outbox is bound", async () => {
    const svc = new MessagingService(cfg);
    const draft = svc.draft({
      event: "welcome",
      to: "ana@example.com",
      vars: { name: "Ana", ref: "R-7", amount: "1" },
    });
    await expect(svc.send(draft)).rejects.toSatisfy((e: unknown) => isFactoryError(e, "NO_OUTBOX"));
  });
});
