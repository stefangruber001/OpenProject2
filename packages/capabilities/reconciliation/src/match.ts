import type { Cents } from "@repo/kernel";
import type {
  BankMovement,
  CandidateDoc,
  InternalTransfer,
  MatchReason,
  MatchSuggestion,
  ReconciliationConfig,
  TransferReason,
} from "./model";

/**
 * Scoring a bank line against the documents that might explain it.
 *
 * The scoring is deterministic and every contribution is named, because the
 * output of this module is not a decision — it is an argument. A person
 * accepts or rejects it, and they can only do that if they can see what it
 * rests on. "0.86" tells them nothing; "exact amount, reference quoted in the
 * concept, three days apart" tells them everything.
 *
 * Weights, and why:
 *   amount        0.45  The strongest single signal. Two documents for exactly
 *                       the same amount on the same account is uncommon; the
 *                       same amount to the cent is usually the same money.
 *   date          0.20  Corroborating, never decisive. A transfer ordered on
 *                       Friday lands on Tuesday, so this degrades gently.
 *   reference     0.30  Nearly as strong as amount when present, because a
 *                       document number quoted in a bank concept was typed by
 *                       someone with that document in front of them.
 *   counterparty  0.15  Weak: bank counterparty text is truncated, upper-cased
 *                       and full of legal-form noise.
 *   direction     gate  Money out cannot pay a document expecting money in.
 *                       Not a weight — a filter.
 *
 * They sum above 1 on purpose; the total is clamped. A match can be certain on
 * amount and reference alone, and demanding that it also be near in date and
 * name before reaching high confidence would just push good matches below the
 * one-click threshold.
 */

const W_AMOUNT_EXACT = 0.45;
const W_AMOUNT_NEAR = 0.3;
const W_DATE_SAME = 0.2;
const W_DATE_NEAR = 0.12;
const W_REFERENCE = 0.3;
const W_COUNTERPARTY = 0.15;

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));
const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Whole days between two ISO dates, unsigned. */
export function daysBetween(a: string, b: string): number {
  const ms = Date.parse(a + "T00:00:00Z") - Date.parse(b + "T00:00:00Z");
  return Number.isFinite(ms) ? Math.abs(Math.round(ms / 86_400_000)) : Number.MAX_SAFE_INTEGER;
}

/**
 * Upper-cases and strips everything that is not a letter or a digit.
 *
 * Bank concepts arrive as "TRANSF. /FRA 2026/A-1187 MATERIALES VALLES SA" —
 * punctuation, spacing and case are all noise, and a reference only matches if
 * you remove them first. "2026/A-1187" and "2026A1187" are the same reference
 * written by two systems that disagree about separators.
 */
export function normalise(text: string): string {
  return String(text ?? "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9]/g, "");
}

/**
 * Is `reference` quoted inside the movement's text?
 *
 * Short references are refused outright. A three-character reference matches
 * something in nearly every bank concept ever written, and a suggestion built
 * on that is worse than no suggestion: it is a wrong answer wearing a reason.
 */
function referenceQuoted(movementText: string, reference: string | undefined): boolean {
  if (!reference) return false;
  const ref = normalise(reference);
  if (ref.length < 4) return false;
  return normalise(movementText).includes(ref);
}

/**
 * Does the movement's text name the counterparty?
 *
 * Matched on the longest word of the name rather than the whole string,
 * because a statement truncates: "MATERIALES VALLES S.A." arrives as
 * "MATERIALES VALL". Words of three characters or fewer are dropped — "S.A.",
 * "DE", "Y" match everything and mean nothing.
 */
function counterpartyNamed(movementText: string, counterparty: string | undefined): boolean {
  if (!counterparty) return false;
  const haystack = normalise(movementText);
  const words = counterparty
    .split(/\s+/)
    .map(normalise)
    .filter((w) => w.length > 3);
  if (!words.length) return false;
  return words.some((w) => haystack.includes(w));
}

/** Money out pays an "out" document; money in settles an "in" one. */
function directionAgrees(movement: BankMovement, doc: CandidateDoc): boolean {
  return movement.amountCents < 0 ? doc.direction === "out" : doc.direction === "in";
}

const openAmount = (doc: CandidateDoc): Cents =>
  typeof doc.outstandingCents === "number" ? doc.outstandingCents : doc.amountCents;

/** Score one movement against one set of documents. Returns null when direction disagrees. */
function score(
  movement: BankMovement,
  docs: CandidateDoc[],
  config: ReconciliationConfig,
): MatchSuggestion | null {
  if (!docs.length) return null;
  if (!docs.every((d) => directionAgrees(movement, d))) return null;

  const reasons: MatchReason[] = ["directionAgrees"];
  const target = Math.abs(movement.amountCents);
  const total = docs.reduce((s, d) => s + openAmount(d), 0);
  const differenceCents = target - total;
  const gap = Math.abs(differenceCents);

  let points = 0;
  if (gap === 0) {
    points += W_AMOUNT_EXACT;
    reasons.push("exactAmount");
  } else if (gap <= config.amountToleranceCents) {
    points += W_AMOUNT_NEAR;
    reasons.push("amountWithinTolerance");
  } else {
    // Beyond tolerance this is simply not the same money. Returning a
    // low-confidence suggestion here would fill the screen with noise that a
    // person has to read and dismiss one line at a time.
    return null;
  }

  // The nearest document carries the date signal: in a combination the others
  // are usually a run of invoices settled together, and the earliest of them
  // says little about when the payment was ordered.
  const nearestDays = Math.min(...docs.map((d) => daysBetween(movement.date, d.date)));
  if (nearestDays === 0) {
    points += W_DATE_SAME;
    reasons.push("sameDate");
  } else if (nearestDays <= config.dateToleranceDays) {
    // Linear decay across the tolerance window rather than a cliff: seven days
    // and eight days are not different in kind, and a threshold there would
    // make the ranking jump for no reason a user could explain.
    points += W_DATE_NEAR * (1 - nearestDays / (config.dateToleranceDays + 1));
    reasons.push("dateWithinTolerance");
  }

  if (docs.some((d) => referenceQuoted(movement.text, d.reference))) {
    points += W_REFERENCE;
    reasons.push("referenceQuoted");
  }
  if (docs.some((d) => counterpartyNamed(movement.text, d.counterparty))) {
    points += W_COUNTERPARTY;
    reasons.push("counterpartyNamed");
  }

  const confidence = round2(clamp01(points));
  /**
   * ONE CLICK NEEDS THE NAME, NOT JUST THE NUMBER.
   *
   * Acceptance review, B1: never auto-accept a proposal whose counterparty
   * does not agree, however exact the amount. The score cannot express that on
   * its own — exact amount, same date and a reference quoted in the concept
   * reach 0.95 against a default threshold of 0.8 with the counterparty
   * contributing nothing, and 0.95 is precisely the shape of paying supplier A
   * while supplier B's invoice number sits in the bank concept. That is not a
   * far-fetched case: it is what a copied payment reference looks like.
   *
   * So the gate is a conjunction, not a higher number. Raising the threshold
   * to 0.96 would have suppressed genuine one-click matches that DO name the
   * counterparty and merely fall a little short elsewhere, which is the wrong
   * trade in the other direction. The proposal is still offered and can still
   * be accepted — it just is not the button the eye lands on.
   */
  const autoAcceptable =
    confidence >= config.autoAcceptScore && reasons.includes("counterpartyNamed");

  return {
    movementId: movement.id,
    docIds: docs.map((d) => d.id),
    confidence,
    reasons,
    differenceCents,
    combination: docs.length > 1,
    autoAcceptable,
  };
}

/**
 * Every subset of `docs` up to `maxSize`, smallest first.
 *
 * Deliberately exhaustive and deliberately bounded. Combination sizes above
 * three are both combinatorially expensive and, in practice, wrong: four
 * invoices adding to a round number is far more often a coincidence than a
 * batch payment, and proposing it teaches people to distrust the suggestions.
 */
function* subsets(docs: CandidateDoc[], maxSize: number): Generator<CandidateDoc[]> {
  const n = docs.length;
  for (let size = 2; size <= Math.min(maxSize, n); size++) {
    const idx = Array.from({ length: size }, (_, i) => i);
    for (;;) {
      yield idx.map((i) => docs[i]!);
      let k = size - 1;
      while (k >= 0 && idx[k]! === n - size + k) k--;
      if (k < 0) break;
      idx[k]!++;
      for (let j = k + 1; j < size; j++) idx[j] = idx[j - 1]! + 1;
    }
  }
}

/**
 * What might explain this movement, best first.
 *
 * Single documents are scored first and combinations second, and a single
 * always outranks a combination of equal confidence: one invoice that fits is
 * a simpler and more likely explanation than two that happen to add up, and
 * the person reading the list should see the simple answer at the top.
 */
export function suggestMatches(
  movement: BankMovement,
  candidates: CandidateDoc[],
  config: ReconciliationConfig,
): MatchSuggestion[] {
  const open = candidates.filter((d) => openAmount(d) > 0);

  const singles: MatchSuggestion[] = [];
  for (const doc of open) {
    const s = score(movement, [doc], config);
    if (s) singles.push(s);
  }

  const combos: MatchSuggestion[] = [];
  if (config.maxCombinationSize > 1) {
    // Only documents that could not explain it alone are worth combining, and
    // only the plausible ones: without this bound the subset walk over a busy
    // quarter's invoices is the slowest thing on the screen.
    const combinable = open
      .filter((d) => directionAgrees(movement, d))
      .filter((d) => openAmount(d) < Math.abs(movement.amountCents))
      .slice(0, 24);
    for (const subset of subsets(combinable, config.maxCombinationSize)) {
      const s = score(movement, subset, config);
      if (s) combos.push(s);
    }
  }

  return [...singles, ...combos]
    .sort(
      (a, b) =>
        b.confidence - a.confidence ||
        a.docIds.length - b.docIds.length ||
        Math.abs(a.differenceCents) - Math.abs(b.differenceCents),
    )
    .slice(0, config.maxSuggestions);
}

/** The same, for a whole statement. Keyed by movement id, empty entries dropped. */
export function suggestForAll(
  movements: BankMovement[],
  candidates: CandidateDoc[],
  config: ReconciliationConfig,
): Record<string, MatchSuggestion[]> {
  const out: Record<string, MatchSuggestion[]> = {};
  for (const m of movements) {
    const s = suggestMatches(m, candidates, config);
    if (s.length) out[m.id] = s;
  }
  return out;
}

/**
 * Pairs of movements that are one transfer between the caller's own accounts.
 *
 * These matter more than they look. An internal transfer that goes unlabelled
 * is counted twice — once as income and once as expense — and every revenue
 * and cost figure downstream is wrong by that amount, in a way that reconciles
 * perfectly and is invisible in any total.
 *
 * Matched on equal-and-opposite amounts, close dates, and DIFFERENT accounts:
 * two opposite movements on the same account are a payment and its refund, not
 * a transfer.
 */
export function findInternalTransfers(
  movements: BankMovement[],
  config: ReconciliationConfig,
): InternalTransfer[] {
  const outs = movements.filter((m) => m.amountCents < 0);
  const ins = movements.filter((m) => m.amountCents > 0);
  const taken = new Set<string>();
  const found: InternalTransfer[] = [];

  for (const out of outs) {
    let best: { mv: BankMovement; days: number } | null = null;
    // Every incoming that fits, not only the winner: how MANY fit is the
    // difference between a pair and a guess, and the caller cannot work that
    // out from a single answer.
    let fitting = 0;
    for (const inc of ins) {
      if (taken.has(inc.id)) continue;
      if (out.accountRef && inc.accountRef && out.accountRef === inc.accountRef) continue;
      if (Math.abs(Math.abs(out.amountCents) - inc.amountCents) > config.amountToleranceCents)
        continue;
      const days = daysBetween(out.date, inc.date);
      if (days > config.dateToleranceDays) continue;
      fitting++;
      if (!best || days < best.days) best = { mv: inc, days };
    }
    if (best) {
      taken.add(best.mv.id);
      const gap = Math.abs(Math.abs(out.amountCents) - best.mv.amountCents);
      const reasons: TransferReason[] = [
        gap === 0 ? "oppositeAmount" : "amountWithinTolerance",
        "differentAccounts",
      ];
      if (best.days === 0) reasons.push("sameDate");
      else reasons.push("dateWithinTolerance");
      found.push({
        outMovementId: out.id,
        inMovementId: best.mv.id,
        amountCents: Math.abs(out.amountCents),
        daysApart: best.days,
        reasons,
        /**
         * THE PAIR THAT IS ONLY A GUESS.
         *
         * A real quarter repeats amounts — the same 60,00 EUR transfer every
         * week, the same round top-up — and "nearest by date" then picks one
         * of several equally good candidates and says nothing. Marking that
         * pair moves two movements out of the queue and out of the profit
         * figures, and if it is the wrong two, both errors are invisible:
         * the amounts still net to zero. So the count of rivals travels with
         * the proposal, and a caller can refuse to accept in bulk what it
         * cannot tell apart.
         */
        alternatives: fitting - 1,
        ambiguous: fitting > 1,
      });
    }
  }
  return found;
}
