import { roundDivHalfUp, type Cents } from "@repo/kernel";
import type { Project } from "./model";

/**
 * Cost at completion: what the job will have cost by the end, not what it has
 * cost so far.
 *
 * The distinction is the whole point of this module. "Spent 40 000 against a
 * budget of 100 000" reads as comfortable and is meaningless on its own; the
 * useful sentence is "spent 40 000 to get a quarter of the way, so it is
 * heading for 160 000". Everything here exists to produce the second sentence
 * from figures the rest of the system already holds.
 *
 * Two rules keep it honest:
 *
 *   1. A forecast never comes in below what is already spent or already
 *      committed. Money out of the door is not a projection, and an estimate
 *      that quietly ignores a signed order is worse than no estimate.
 *   2. When a human overrides the calculation, BOTH numbers are reported and
 *      the reason is required. An adjustment that replaces the calculation
 *      leaves nobody able to see that a judgement was made — which is exactly
 *      the conversation the figure exists to start.
 */

/** How far along a chapter is, 0-100. Supplied by whatever tracks progress. */
export interface ChapterProgress {
  chapter: string;
  progressPct: number;
}

/** A human's replacement for the calculated figure. The reason is not optional. */
export interface ForecastOverride {
  chapter: string;
  costCents: Cents;
  reason: string;
  at: string;
  by?: string;
}

export interface ChapterForecast {
  chapter: string;
  budgetCents: Cents;
  committedCents: Cents;
  actualCents: Cents;
  progressPct: number;
  /** Extrapolated from the cost per unit of progress observed so far. */
  calculatedCents: Cents;
  /** The human's figure, or null when nobody has overridden anything. */
  adjustedCents: Cents | null;
  adjustmentReason: string | null;
  /** What the project should be planned against: the adjustment if there is one. */
  forecastCents: Cents;
  /** forecast − budget. Positive is an overrun. */
  varianceCents: Cents;
  varianceBp: number;
  /** True while the extrapolation rests on too little progress to mean much. */
  provisional: boolean;
}

export interface ProjectForecast {
  byChapter: ChapterForecast[];
  budgetCents: Cents;
  committedCents: Cents;
  actualCents: Cents;
  calculatedCents: Cents;
  forecastCents: Cents;
  varianceCents: Cents;
  varianceBp: number;
  revenueCents: Cents;
  /** revenue − forecast cost: the margin the job is actually heading for. */
  marginForecastCents: Cents;
  marginForecastBp: number;
  /** Chapters whose overrun crosses the caller's threshold, worst first. */
  overrunChapters: string[];
}

export interface ForecastInput {
  progress: ChapterProgress[];
  overrides?: ForecastOverride[];
  /** Basis points of the chapter budget an overrun must reach to be flagged. */
  overrunThresholdBp?: number;
  /**
   * Below this much progress the extrapolation is marked provisional. Dividing
   * a real cost by 2 % of progress produces a number with no information in
   * it, and presenting that as a forecast is how a project gets cancelled on
   * the strength of one early delivery note.
   */
  minProgressPct?: number;
}

const bp = (part: Cents, whole: Cents): number =>
  whole === 0 ? 0 : roundDivHalfUp(part * 10_000, Math.abs(whole));

const DEFAULT_OVERRUN_THRESHOLD_BP = 1000;
const DEFAULT_MIN_PROGRESS_PCT = 10;

/**
 * Cost at completion for one chapter.
 *
 * Finished work needs no extrapolation — it costs what it cost. Work not yet
 * started has nothing to extrapolate from, so the budget stands (raised to
 * whatever is already committed). In between, the observed cost per point of
 * progress is carried to 100.
 */
function calculatedFor(
  budgetCents: Cents,
  committedCents: Cents,
  actualCents: Cents,
  progressPct: number,
): Cents {
  const floor = Math.max(actualCents, committedCents);
  // Nothing booked against it yet. Whatever the progress says, the observed
  // cost carries no information — and "finished, nothing booked" almost always
  // means the bill has not arrived rather than that the work was free, so
  // forecasting zero would hand the project a profit it is about to lose. The
  // budget stands until something real contradicts it.
  if (actualCents <= 0) return Math.max(budgetCents, floor);
  // Finished work costs what it cost; there is nothing left to extrapolate.
  if (progressPct >= 100) return actualCents;
  if (progressPct <= 0) return Math.max(budgetCents, floor);
  const extrapolated = roundDivHalfUp(actualCents * 100, progressPct);
  return Math.max(extrapolated, floor);
}

export function forecastToCompletion(project: Project, input: ForecastInput): ProjectForecast {
  const threshold = input.overrunThresholdBp ?? DEFAULT_OVERRUN_THRESHOLD_BP;
  const minProgress = input.minProgressPct ?? DEFAULT_MIN_PROGRESS_PCT;
  const progressBy = new Map(input.progress.map((p) => [p.chapter, p.progressPct]));
  const overrideBy = new Map((input.overrides ?? []).map((o) => [o.chapter, o]));

  const chapters = new Set<string>([
    ...project.baselineByChapter.map((c) => c.chapter),
    ...project.costs.map((c) => c.chapter),
    ...project.changeOrders.filter((c) => c.status === "approved").map((c) => c.chapter),
  ]);

  const byChapter: ChapterForecast[] = [...chapters].map((chapter) => {
    const baseline = project.baselineByChapter.find((c) => c.chapter === chapter)?.budgetCents ?? 0;
    const approved = project.changeOrders
      .filter((c) => c.status === "approved" && c.chapter === chapter)
      .reduce((s, c) => s + c.deltaCents, 0);
    const budgetCents = baseline + approved;
    const committedCents = project.costs
      .filter((c) => c.kind === "committed" && c.chapter === chapter)
      .reduce((s, c) => s + c.amountCents, 0);
    const actualCents = project.costs
      .filter((c) => c.kind === "actual" && c.chapter === chapter)
      .reduce((s, c) => s + c.amountCents, 0);
    const progressPct = Math.max(0, Math.min(100, progressBy.get(chapter) ?? 0));

    const calculatedCents = calculatedFor(budgetCents, committedCents, actualCents, progressPct);
    const override = overrideBy.get(chapter);
    // An override without a reason is not an override: the reason is the only
    // part of it anyone can review later.
    const usable = override && override.reason.trim() ? override : undefined;
    const adjustedCents = usable ? usable.costCents : null;
    const forecastCents = adjustedCents ?? calculatedCents;
    const varianceCents = forecastCents - budgetCents;

    return {
      chapter,
      budgetCents,
      committedCents,
      actualCents,
      progressPct,
      calculatedCents,
      adjustedCents,
      adjustmentReason: usable ? usable.reason : null,
      forecastCents,
      varianceCents,
      varianceBp: bp(varianceCents, budgetCents),
      provisional: progressPct > 0 && progressPct < minProgress && adjustedCents === null,
    };
  });

  const total = (pick: (c: ChapterForecast) => Cents): Cents =>
    byChapter.reduce((s, c) => s + pick(c), 0);
  const budgetCents = total((c) => c.budgetCents);
  const forecastCents = total((c) => c.forecastCents);
  const varianceCents = forecastCents - budgetCents;
  const revenueCents = project.revenueCents;
  const marginForecastCents = revenueCents - forecastCents;

  return {
    byChapter,
    budgetCents,
    committedCents: total((c) => c.committedCents),
    actualCents: total((c) => c.actualCents),
    calculatedCents: total((c) => c.calculatedCents),
    forecastCents,
    varianceCents,
    varianceBp: bp(varianceCents, budgetCents),
    revenueCents,
    marginForecastCents,
    marginForecastBp: bp(marginForecastCents, revenueCents || budgetCents),
    overrunChapters: byChapter
      .filter((c) => c.varianceCents > 0 && c.varianceBp >= threshold)
      .sort((a, b) => b.varianceBp - a.varianceBp)
      .map((c) => c.chapter),
  };
}
