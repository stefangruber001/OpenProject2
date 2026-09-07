/**
 * The site-worker boundary, tested where it actually lives.
 *
 * Both halves are pure functions of a document, which is deliberate: the rule
 * has to hold on the read (`GET /erp/state`) and on every write (`runCommand`),
 * and a rule expressed twice is a rule that will one day differ. Testing them
 * here needs no database and no session, so there is no excuse not to.
 */
import { describe, expect, it } from "vitest";
import { redactForWorker, workerIdIn } from "./erp-scope";
import { refuseOutsideOwnHours } from "./erp-runtime";

const doc = {
  today: "2026-09-05",
  company: { name: "Canei Subirats", iban: "ES00 1234" },
  workers: [
    {
      id: "w1",
      name: "Ignacio",
      email: "Ignacio@Canei.es ",
      kind: "selfEmployed",
      rateCents: 2000,
    },
    { id: "w2", name: "Andreu", email: "andreu@canei.es", kind: "employee", rateCents: 1800 },
  ],
  projects: [
    { id: "p1", code: "P-1" },
    { id: "p2", code: "P-2" },
    { id: "p3", code: "P-3" },
  ],
  assignments: [
    { workerId: "w1", projectId: "p1", from: "2026-01-01", to: "2026-12-31" },
    { workerId: "w2", projectId: "p2", from: "2026-01-01", to: "2026-12-31" },
  ],
  labour: [
    {
      id: "l1",
      workerId: "w1",
      projectId: "p1",
      date: "2026-09-02",
      hoursMilli: 6000,
      costCents: 12000,
    },
    {
      id: "l2",
      workerId: "w2",
      projectId: "p2",
      date: "2026-09-02",
      hoursMilli: 8000,
      costCents: 14400,
    },
    // an older entry of theirs, on a job they are no longer assigned to
    {
      id: "l3",
      workerId: "w1",
      projectId: "p3",
      date: "2026-05-04",
      hoursMilli: 4000,
      costCents: 8000,
    },
    // and a week of theirs that the office has approved
    {
      id: "l4",
      workerId: "w1",
      projectId: "p1",
      date: "2026-08-25",
      hoursMilli: 8000,
      locked: true,
    },
  ],
  invoices: [{ id: "i1", totalCents: 500000 }],
  bank: [{ id: "b1", balanceCents: 900000 }],
};

describe("which person an account is", () => {
  it("matches on e-mail, ignoring case and stray spacing", () => {
    expect(workerIdIn(doc, "ignacio@canei.es")).toBe("w1");
    expect(workerIdIn(doc, " ANDREU@canei.es ")).toBe("w2");
  });

  it("is nobody when the address belongs to no worker — an office login", () => {
    expect(workerIdIn(doc, "oficina@canei.es")).toBeNull();
    expect(workerIdIn(doc, "")).toBeNull();
  });
});

describe("the document a site worker is sent", () => {
  const mine = redactForWorker(doc, "w1");

  it("carries their own hours and nobody else's", () => {
    expect((mine.labour ?? []).map((l) => l.id)).toEqual(["l1", "l3", "l4"]);
  });

  it("carries no euro amount at all — not even their own cost", () => {
    const money = JSON.stringify(mine).match(/Cents/g) ?? [];
    expect(money).toHaveLength(0);
  });

  it("names only themself among the workers", () => {
    expect((mine.workers ?? []).map((w) => w.name)).toEqual(["Ignacio"]);
  });

  it("keeps the jobs they are on, plus any their own history points at", () => {
    expect((mine.projects ?? []).map((p) => p.code).sort()).toEqual(["P-1", "P-3"]);
  });

  it("is built rather than filtered, so tomorrow's field does not leak by default", () => {
    expect(mine.invoices).toBeUndefined();
    expect(mine.bank).toBeUndefined();
    expect(mine.company).toBeUndefined();
  });

  it("gives an unlinked account nothing rather than everything", () => {
    const none = redactForWorker(doc, null);
    expect(none.labour).toEqual([]);
    expect(none.workers).toEqual([]);
    expect(none.projects).toEqual([]);
  });
});

/** A stand-in for the engine, which this rule only ever asks for the document. */
const erpOf = (state: unknown) => ({ toJSON: () => state }) as never;

describe("what a site worker may write", () => {
  const on = (command: string, args: unknown[], user = "ignacio@canei.es") =>
    refuseOutsideOwnHours("t", user, command as never, args, erpOf(doc));

  it("lets them record their own hours on a job they are assigned to", async () => {
    await expect(
      on("recordHours", [{ workerId: "w1", projectId: "p1", date: "2026-09-03" }]),
    ).resolves.toBeUndefined();
  });

  it("refuses hours booked in somebody else's name", async () => {
    await expect(
      on("recordHours", [{ workerId: "w2", projectId: "p2", date: "2026-09-03" }]),
    ).rejects.toThrow(/only record your own hours/i);
  });

  it("refuses a job they are not on", async () => {
    await expect(
      on("recordHours", [{ workerId: "w1", projectId: "p2", date: "2026-09-03" }]),
    ).rejects.toThrow(/assigned to/i);
  });

  it("refuses a week the office has already approved", async () => {
    await expect(
      on("recordHours", [{ workerId: "w1", projectId: "p1", date: "2026-08-26" }]),
    ).rejects.toThrow(/already approved/i);
  });

  it("refuses to touch another person's entry", async () => {
    await expect(on("correctHours", ["l2", { hoursMilli: 1000 }])).rejects.toThrow(
      /only change your own/i,
    );
    await expect(on("deleteHours", ["l2"])).rejects.toThrow(/only change your own/i);
  });

  it("refuses to move an entry into an approved week, or onto a job they are not on", async () => {
    await expect(on("correctHours", ["l1", { date: "2026-08-26" }])).rejects.toThrow(
      /already approved/i,
    );
    await expect(on("correctHours", ["l1", { projectId: "p2" }])).rejects.toThrow(/assigned to/i);
  });

  it("refuses an account attached to no worker at all", async () => {
    await expect(
      on(
        "recordHours",
        [{ workerId: "w1", projectId: "p1", date: "2026-09-03" }],
        "oficina@canei.es",
      ),
    ).rejects.toThrow(/not linked to a worker/i);
  });
});
