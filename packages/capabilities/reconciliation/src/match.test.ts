import { describe, expect, it } from "vitest";
import {
  findInternalTransfers,
  normalise,
  reconciliationConfigSchema,
  suggestForAll,
  suggestMatches,
  type BankMovement,
  type CandidateDoc,
} from "./index";

const cfg = (over: Record<string, unknown> = {}) => reconciliationConfigSchema.parse(over);

const mv = (over: Partial<BankMovement> & { id: string; amountCents: number }): BankMovement => ({
  date: "2026-03-20",
  text: "",
  ...over,
});

const doc = (
  over: Partial<CandidateDoc> & { id: string; amountCents: number; direction: "in" | "out" },
): CandidateDoc => ({
  kind: "doc",
  date: "2026-03-20",
  ...over,
});

describe("suggesting matches", () => {
  it("puts an exact same-day amount at the top with its reasons named", () => {
    const s = suggestMatches(
      mv({ id: "m1", amountCents: -119790 }),
      [doc({ id: "d1", amountCents: 119790, direction: "out" })],
      cfg(),
    );
    expect(s[0]).toMatchObject({ docIds: ["d1"], differenceCents: 0, combination: false });
    expect(s[0]!.reasons).toEqual(
      expect.arrayContaining(["directionAgrees", "exactAmount", "sameDate"]),
    );
    expect(s[0]!.confidence).toBeGreaterThanOrEqual(0.6);
  });

  it("refuses a document facing the wrong way, however well it matches", () => {
    // Money left the account; a document expecting money IN cannot explain it,
    // no matter that the amount and the date agree perfectly.
    const s = suggestMatches(
      mv({ id: "m1", amountCents: -50000 }),
      [doc({ id: "d1", amountCents: 50000, direction: "in" })],
      cfg(),
    );
    expect(s).toEqual([]);
  });

  it("refuses an amount outside tolerance rather than offering it weakly", () => {
    const s = suggestMatches(
      mv({ id: "m1", amountCents: -50000, text: "FRA 2026/A-1187" }),
      [doc({ id: "d1", amountCents: 40000, direction: "out", reference: "2026/A-1187" })],
      cfg(),
    );
    // A wrong answer wearing a reason is worse than no answer.
    expect(s).toEqual([]);
  });

  it("accepts a few cents of difference as the same money", () => {
    const s = suggestMatches(
      mv({ id: "m1", amountCents: -50030 }),
      [doc({ id: "d1", amountCents: 50000, direction: "out" })],
      cfg({ amountToleranceCents: 50 }),
    );
    expect(s[0]!.reasons).toContain("amountWithinTolerance");
    expect(s[0]!.differenceCents).toBe(30);
  });

  it("reads a reference through the punctuation a bank strips out", () => {
    const s = suggestMatches(
      mv({ id: "m1", amountCents: -50000, text: "TRANSF. /FRA 2026A1187 PAGO" }),
      [
        doc({ id: "plain", amountCents: 50000, direction: "out" }),
        doc({ id: "ref", amountCents: 50000, direction: "out", reference: "2026/A-1187" }),
      ],
      cfg(),
    );
    expect(s[0]!.docIds).toEqual(["ref"]);
    expect(s[0]!.reasons).toContain("referenceQuoted");
  });

  it("ignores a reference too short to mean anything", () => {
    const s = suggestMatches(
      mv({ id: "m1", amountCents: -50000, text: "COMPRA A12 SUPERMERCADO" }),
      [doc({ id: "d1", amountCents: 50000, direction: "out", reference: "A12" })],
      cfg(),
    );
    // "A12" appears in half the bank concepts ever written.
    expect(s[0]!.reasons).not.toContain("referenceQuoted");
  });

  it("recognises a counterparty through a truncated statement line", () => {
    const s = suggestMatches(
      mv({ id: "m1", amountCents: -50000, text: "PAGO MATERIALES VALL" }),
      [
        doc({ id: "other", amountCents: 50000, direction: "out", counterparty: "Fontanería Solé" }),
        doc({
          id: "mat",
          amountCents: 50000,
          direction: "out",
          counterparty: "Materiales Vallès S.A.",
        }),
      ],
      cfg(),
    );
    expect(s[0]!.docIds).toEqual(["mat"]);
    expect(s[0]!.reasons).toContain("counterpartyNamed");
  });

  it("does not let a legal form match everything", () => {
    const s = suggestMatches(
      mv({ id: "m1", amountCents: -50000, text: "PAGO ALGO SA" }),
      [doc({ id: "d1", amountCents: 50000, direction: "out", counterparty: "Otra Cosa SA" })],
      cfg(),
    );
    expect(s[0]!.reasons).not.toContain("counterpartyNamed");
  });

  it("decays the date signal instead of cutting it off at a cliff", () => {
    const near = suggestMatches(
      mv({ id: "m1", amountCents: -50000, date: "2026-03-20" }),
      [doc({ id: "d1", amountCents: 50000, direction: "out", date: "2026-03-19" })],
      cfg(),
    )[0]!;
    const far = suggestMatches(
      mv({ id: "m1", amountCents: -50000, date: "2026-03-20" }),
      [doc({ id: "d1", amountCents: 50000, direction: "out", date: "2026-03-14" })],
      cfg(),
    )[0]!;
    expect(near.confidence).toBeGreaterThan(far.confidence);
    expect(far.reasons).toContain("dateWithinTolerance");
  });

  it("still matches on amount alone when the date is far outside tolerance", () => {
    const s = suggestMatches(
      mv({ id: "m1", amountCents: -50000, date: "2026-06-01" }),
      [doc({ id: "d1", amountCents: 50000, direction: "out", date: "2026-01-01" })],
      cfg(),
    );
    // Weaker, but not discarded: a late payment is still that payment.
    expect(s).toHaveLength(1);
    expect(s[0]!.reasons).not.toContain("dateWithinTolerance");
    expect(s[0]!.confidence).toBeLessThan(0.6);
  });

  it("proposes a combination when no single document explains the movement", () => {
    const s = suggestMatches(
      mv({ id: "m1", amountCents: -30000 }),
      [
        doc({ id: "a", amountCents: 10000, direction: "out" }),
        doc({ id: "b", amountCents: 20000, direction: "out" }),
        doc({ id: "c", amountCents: 70000, direction: "out" }),
      ],
      cfg(),
    );
    expect(s[0]).toMatchObject({ combination: true, differenceCents: 0 });
    expect(s[0]!.docIds.sort()).toEqual(["a", "b"]);
  });

  it("prefers one document that fits over two that happen to add up", () => {
    const s = suggestMatches(
      mv({ id: "m1", amountCents: -30000 }),
      [
        doc({ id: "single", amountCents: 30000, direction: "out" }),
        doc({ id: "a", amountCents: 10000, direction: "out" }),
        doc({ id: "b", amountCents: 20000, direction: "out" }),
      ],
      cfg(),
    );
    // The simple explanation is the likelier one and belongs at the top.
    expect(s[0]!.docIds).toEqual(["single"]);
    expect(s[0]!.combination).toBe(false);
  });

  it("respects the combination-size ceiling", () => {
    const docs = [1, 2, 3, 4].map((n) =>
      doc({ id: `d${n}`, amountCents: 10000, direction: "out" as const }),
    );
    const capped = suggestMatches(
      mv({ id: "m1", amountCents: -40000 }),
      docs,
      cfg({ maxCombinationSize: 3 }),
    );
    expect(capped.every((x) => x.docIds.length <= 3)).toBe(true);
    const raised = suggestMatches(
      mv({ id: "m1", amountCents: -40000 }),
      docs,
      cfg({ maxCombinationSize: 4 }),
    );
    expect(raised.some((x) => x.docIds.length === 4)).toBe(true);
  });

  it("never proposes a combination when combining is switched off", () => {
    const s = suggestMatches(
      mv({ id: "m1", amountCents: -30000 }),
      [
        doc({ id: "a", amountCents: 10000, direction: "out" }),
        doc({ id: "b", amountCents: 20000, direction: "out" }),
      ],
      cfg({ maxCombinationSize: 1 }),
    );
    expect(s).toEqual([]);
  });

  it("matches against what is still open, not the document's face value", () => {
    const s = suggestMatches(
      mv({ id: "m1", amountCents: -20000 }),
      [doc({ id: "d1", amountCents: 100000, outstandingCents: 20000, direction: "out" })],
      cfg(),
    );
    expect(s[0]!.reasons).toContain("exactAmount");
  });

  it("skips a document with nothing left outstanding", () => {
    const s = suggestMatches(
      mv({ id: "m1", amountCents: -20000 }),
      [doc({ id: "d1", amountCents: 20000, outstandingCents: 0, direction: "out" })],
      cfg(),
    );
    expect(s).toEqual([]);
  });

  it("returns at most the configured number of suggestions", () => {
    const docs = Array.from({ length: 10 }, (_, i) =>
      doc({ id: `d${i}`, amountCents: 50000, direction: "out" as const }),
    );
    expect(
      suggestMatches(mv({ id: "m1", amountCents: -50000 }), docs, cfg({ maxSuggestions: 3 })),
    ).toHaveLength(3);
  });

  it("keys a whole statement by movement, leaving out what it cannot explain", () => {
    const all = suggestForAll(
      [mv({ id: "m1", amountCents: -50000 }), mv({ id: "m2", amountCents: -777 })],
      [doc({ id: "d1", amountCents: 50000, direction: "out" })],
      cfg(),
    );
    expect(Object.keys(all)).toEqual(["m1"]);
  });
});

describe("normalise", () => {
  it("strips case, accents and punctuation so two systems agree", () => {
    expect(normalise("Fra. 2026/A-1187")).toBe("FRA2026A1187");
    expect(normalise("Materiales Vallès, S.A.")).toBe("MATERIALESVALLESSA");
  });
});

describe("internal transfers", () => {
  it("pairs equal and opposite movements across two accounts", () => {
    const found = findInternalTransfers(
      [
        mv({ id: "out", amountCents: -100000, date: "2026-03-20", accountRef: "A" }),
        mv({ id: "in", amountCents: 100000, date: "2026-03-21", accountRef: "B" }),
      ],
      cfg(),
    );
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      outMovementId: "out",
      inMovementId: "in",
      amountCents: 100000,
      daysApart: 1,
    });
  });

  it("does not pair two opposite movements on the SAME account", () => {
    // That is a payment and its refund, not money moving between accounts.
    const found = findInternalTransfers(
      [
        mv({ id: "out", amountCents: -100000, accountRef: "A" }),
        mv({ id: "in", amountCents: 100000, accountRef: "A" }),
      ],
      cfg(),
    );
    expect(found).toEqual([]);
  });

  it("takes the nearest candidate and never reuses one", () => {
    const found = findInternalTransfers(
      [
        mv({ id: "out1", amountCents: -100000, date: "2026-03-20", accountRef: "A" }),
        mv({ id: "out2", amountCents: -100000, date: "2026-03-20", accountRef: "A" }),
        mv({ id: "in1", amountCents: 100000, date: "2026-03-20", accountRef: "B" }),
        mv({ id: "in2", amountCents: 100000, date: "2026-03-24", accountRef: "B" }),
      ],
      cfg(),
    );
    expect(found).toHaveLength(2);
    expect(found[0]).toMatchObject({ outMovementId: "out1", inMovementId: "in1", daysApart: 0 });
    expect(found[1]).toMatchObject({ outMovementId: "out2", inMovementId: "in2" });
  });

  it("says WHY it paired them, not just that it did", () => {
    const [pair] = findInternalTransfers(
      [
        mv({ id: "out", amountCents: -100000, date: "2026-03-20", accountRef: "A" }),
        mv({ id: "in", amountCents: 100000, date: "2026-03-20", accountRef: "B" }),
      ],
      cfg(),
    );
    expect(pair!.reasons).toEqual(
      expect.arrayContaining(["oppositeAmount", "differentAccounts", "sameDate"]),
    );
    expect(pair!.ambiguous).toBe(false);
    expect(pair!.alternatives).toBe(0);
  });

  /* THE PAIR THAT IS ONLY A GUESS. A real quarter repeats amounts — the same
     weekly transfer, the same round top-up — and "nearest by date" then picks
     one of several equally good candidates and says nothing about the others.
     Marking the wrong two is invisible afterwards: the amounts still net to
     zero. So the count of rivals travels with the proposal. */
  it("counts the look-alikes it had to choose between", () => {
    const found = findInternalTransfers(
      [
        mv({ id: "out", amountCents: -60000, date: "2026-03-20", accountRef: "A" }),
        mv({ id: "in1", amountCents: 60000, date: "2026-03-20", accountRef: "B" }),
        mv({ id: "in2", amountCents: 60000, date: "2026-03-21", accountRef: "C" }),
        mv({ id: "in3", amountCents: 60000, date: "2026-03-22", accountRef: "B" }),
      ],
      cfg(),
    );
    expect(found[0]!.inMovementId).toBe("in1");
    expect(found[0]!.alternatives).toBe(2);
    expect(found[0]!.ambiguous).toBe(true);
  });

  it("is not ambiguous when the rivals are ruled out by amount or account", () => {
    const found = findInternalTransfers(
      [
        mv({ id: "out", amountCents: -60000, date: "2026-03-20", accountRef: "A" }),
        mv({ id: "in1", amountCents: 60000, date: "2026-03-20", accountRef: "B" }),
        // Same amount, same account as the outgoing: a refund, not a transfer.
        mv({ id: "in2", amountCents: 60000, date: "2026-03-20", accountRef: "A" }),
        // Different amount, beyond tolerance.
        mv({ id: "in3", amountCents: 61000, date: "2026-03-20", accountRef: "C" }),
      ],
      cfg(),
    );
    expect(found[0]!.inMovementId).toBe("in1");
    expect(found[0]!.ambiguous).toBe(false);
  });

  it("names the near-miss amount as within tolerance rather than opposite", () => {
    const [pair] = findInternalTransfers(
      [
        mv({ id: "out", amountCents: -100030, date: "2026-03-22", accountRef: "A" }),
        mv({ id: "in", amountCents: 100000, date: "2026-03-20", accountRef: "B" }),
      ],
      cfg(),
    );
    expect(pair!.reasons).toContain("amountWithinTolerance");
    expect(pair!.reasons).toContain("dateWithinTolerance");
    expect(pair!.reasons).not.toContain("oppositeAmount");
    expect(pair!.reasons).not.toContain("sameDate");
  });

  it("ignores a pair too far apart in time to be one transfer", () => {
    const found = findInternalTransfers(
      [
        mv({ id: "out", amountCents: -100000, date: "2026-01-01", accountRef: "A" }),
        mv({ id: "in", amountCents: 100000, date: "2026-03-01", accountRef: "B" }),
      ],
      cfg(),
    );
    expect(found).toEqual([]);
  });
});

describe("one click needs the name, not just the number (B1)", () => {
  /* The case the acceptance review named: everything agrees except who was
     paid. Exact amount, same day, and the document's own reference sitting in
     the bank concept — which is what happens when a payment reference is
     copied from the wrong invoice — reaches 0.95 against a threshold of 0.8.
     High confidence, and the wrong supplier. */
  const lookalike = () =>
    suggestMatches(
      mv({
        id: "m1",
        amountCents: -121000,
        date: "2026-03-20",
        text: "TRANSFERENCIA /FRA 2026-A-1187",
      }),
      [
        doc({
          id: "b1",
          amountCents: 121000,
          direction: "out",
          reference: "2026-A-1187",
          counterparty: "Materiales Vallès SA",
          date: "2026-03-20",
        }),
      ],
      cfg(),
    );

  it("scores it high and still refuses to make it one click", () => {
    const [top] = lookalike();
    expect(top!.confidence).toBeGreaterThanOrEqual(0.8);
    expect(top!.reasons).toContain("exactAmount");
    expect(top!.reasons).not.toContain("counterpartyNamed");
    expect(top!.autoAcceptable).toBe(false);
  });

  it("offers one click once the line names the counterparty too", () => {
    const [top] = suggestMatches(
      mv({
        id: "m1",
        amountCents: -121000,
        date: "2026-03-20",
        text: "TRANSFERENCIA MATERIALES VALLES /FRA 2026-A-1187",
      }),
      [
        doc({
          id: "b1",
          amountCents: 121000,
          direction: "out",
          reference: "2026-A-1187",
          counterparty: "Materiales Vallès SA",
          date: "2026-03-20",
        }),
      ],
      cfg(),
    );
    expect(top!.reasons).toContain("counterpartyNamed");
    expect(top!.autoAcceptable).toBe(true);
  });

  it("still needs the score: the name alone is not enough", () => {
    /* Counterparty named, amount a little off and nothing else agreeing —
       0.15 + 0.30 = 0.45, well under the threshold. The gate is a conjunction
       in both directions. */
    const [top] = suggestMatches(
      mv({ id: "m1", amountCents: -121030, date: "2026-04-30", text: "PAGO MATERIALES VALLES" }),
      [
        doc({
          id: "b1",
          amountCents: 121000,
          direction: "out",
          counterparty: "Materiales Vallès SA",
          date: "2026-03-20",
        }),
      ],
      cfg(),
    );
    expect(top!.reasons).toContain("counterpartyNamed");
    expect(top!.confidence).toBeLessThan(0.8);
    expect(top!.autoAcceptable).toBe(false);
  });
});

describe("config", () => {
  it("defaults to a week of slack, half a euro, and three documents", () => {
    expect(cfg()).toEqual({
      dateToleranceDays: 7,
      amountToleranceCents: 50,
      autoAcceptScore: 0.8,
      maxCombinationSize: 3,
      maxSuggestions: 5,
    });
  });
});
