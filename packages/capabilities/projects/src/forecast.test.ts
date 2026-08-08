import { describe, expect, it } from "vitest";
import { forecastToCompletion } from "./forecast";
import type { Project } from "./model";

/** A two-chapter project with costs booked against it. */
function project(over: Partial<Project> = {}): Project {
  return {
    id: "prj_1",
    name: "Job",
    baselineCents: 200_00,
    baselineByChapter: [
      { chapter: "1", budgetCents: 100_00 },
      { chapter: "2", budgetCents: 100_00 },
    ],
    revenueCents: 300_00,
    costs: [],
    changeOrders: [],
    status: "active",
    createdAt: "2026-09-01",
    ...over,
  };
}

const cost = (chapter: string, kind: "committed" | "actual", amountCents: number) => ({
  id: `c_${chapter}_${kind}_${amountCents}`,
  kind,
  chapter,
  description: "",
  amountCents,
  date: "2026-09-10",
});

describe("cost at completion", () => {
  it("carries the observed cost per point of progress to the end", () => {
    // A quarter done for 40, so heading for 160 — not "40 of 100, comfortable".
    const f = forecastToCompletion(project({ costs: [cost("1", "actual", 40_00)] }), {
      progress: [{ chapter: "1", progressPct: 25 }],
    });
    const one = f.byChapter.find((c) => c.chapter === "1")!;
    expect(one.calculatedCents).toBe(160_00);
    expect(one.forecastCents).toBe(160_00);
    expect(one.varianceCents).toBe(60_00);
    expect(one.varianceBp).toBe(6000);
  });

  it("never forecasts below what is already spent or committed", () => {
    const f = forecastToCompletion(
      project({ costs: [cost("1", "actual", 5_00), cost("1", "committed", 150_00)] }),
      { progress: [{ chapter: "1", progressPct: 90 }] },
    );
    // The extrapolation says ~5.55; a signed order for 150 says otherwise, and
    // money already out of the door is not a projection.
    expect(f.byChapter.find((c) => c.chapter === "1")!.calculatedCents).toBe(150_00);
  });

  it("leaves the budget standing where nothing has started", () => {
    const f = forecastToCompletion(project(), { progress: [] });
    expect(f.forecastCents).toBe(200_00);
    expect(f.varianceCents).toBe(0);
  });

  it("stops extrapolating once the work is done", () => {
    const f = forecastToCompletion(project({ costs: [cost("1", "actual", 80_00)] }), {
      progress: [{ chapter: "1", progressPct: 100 }],
    });
    // Finished work costs what it cost.
    expect(f.byChapter.find((c) => c.chapter === "1")!.calculatedCents).toBe(80_00);
  });

  it("keeps the budget while nothing at all has been booked, at any progress", () => {
    for (const progressPct of [40, 100]) {
      const f = forecastToCompletion(project(), { progress: [{ chapter: "1", progressPct }] });
      // Forecasting zero would hand the project a profit it is about to lose
      // the moment the supplier invoices.
      expect(f.byChapter.find((c) => c.chapter === "1")!.calculatedCents).toBe(100_00);
      expect(f.forecastCents).toBe(200_00);
    }
  });

  it("marks an extrapolation off almost no progress as provisional", () => {
    const f = forecastToCompletion(project({ costs: [cost("1", "actual", 2_00)] }), {
      progress: [{ chapter: "1", progressPct: 2 }],
      minProgressPct: 10,
    });
    const one = f.byChapter.find((c) => c.chapter === "1")!;
    // The arithmetic is right and the number is still meaningless: 2 % of
    // progress cannot support a forecast, and saying so is the point.
    expect(one.calculatedCents).toBe(100_00);
    expect(one.provisional).toBe(true);
  });

  it("shows both figures when a human overrides the calculation", () => {
    const f = forecastToCompletion(project({ costs: [cost("1", "actual", 40_00)] }), {
      progress: [{ chapter: "1", progressPct: 25 }],
      overrides: [
        {
          chapter: "1",
          costCents: 110_00,
          reason: "The expensive part is already behind us",
          at: "2026-09-12",
        },
      ],
    });
    const one = f.byChapter.find((c) => c.chapter === "1")!;
    expect(one.calculatedCents).toBe(160_00);
    expect(one.adjustedCents).toBe(110_00);
    expect(one.adjustmentReason).toMatch(/expensive part/);
    expect(one.forecastCents).toBe(110_00);
  });

  it("ignores an override with no reason", () => {
    const f = forecastToCompletion(project({ costs: [cost("1", "actual", 40_00)] }), {
      progress: [{ chapter: "1", progressPct: 25 }],
      overrides: [{ chapter: "1", costCents: 110_00, reason: "   ", at: "2026-09-12" }],
    });
    const one = f.byChapter.find((c) => c.chapter === "1")!;
    // The reason is the only reviewable part of a judgement call; without it
    // the adjustment is indistinguishable from a typo.
    expect(one.adjustedCents).toBeNull();
    expect(one.forecastCents).toBe(160_00);
  });

  it("counts an approved change order into the chapter it belongs to", () => {
    const f = forecastToCompletion(
      project({
        changeOrders: [
          {
            id: "chg_1",
            chapter: "1",
            description: "Extra",
            deltaCents: 50_00,
            status: "approved",
            date: "2026-09-05",
          },
          {
            id: "chg_2",
            chapter: "1",
            description: "Proposed only",
            deltaCents: 90_00,
            status: "proposed",
            date: "2026-09-05",
          },
        ],
      }),
      { progress: [] },
    );
    // Approved raises the budget; proposed does not — nobody has agreed to it.
    expect(f.byChapter.find((c) => c.chapter === "1")!.budgetCents).toBe(150_00);
    expect(f.budgetCents).toBe(250_00);
  });

  it("reports the margin the job is heading for, not the one it was sold at", () => {
    const f = forecastToCompletion(project({ costs: [cost("1", "actual", 40_00)] }), {
      progress: [{ chapter: "1", progressPct: 25 }],
    });
    // Revenue 300, forecast cost 160 + 100 = 260.
    expect(f.forecastCents).toBe(260_00);
    expect(f.marginForecastCents).toBe(40_00);
    expect(f.marginForecastBp).toBe(1333);
  });

  it("flags the chapters whose overrun crosses the threshold, worst first", () => {
    const f = forecastToCompletion(
      project({
        // 40 at a quarter done → 160 (6000 bp over); 27 → 108 (800 bp over).
        // Both cross a 500 bp threshold, and the worse one is reported first.
        costs: [cost("1", "actual", 40_00), cost("2", "actual", 27_00)],
      }),
      {
        progress: [
          { chapter: "1", progressPct: 25 },
          { chapter: "2", progressPct: 25 },
        ],
        overrunThresholdBp: 500,
      },
    );
    expect(f.overrunChapters).toEqual(["1", "2"]);
  });

  it("stays quiet about a chapter running under budget", () => {
    const f = forecastToCompletion(project({ costs: [cost("1", "actual", 20_00)] }), {
      progress: [{ chapter: "1", progressPct: 50 }],
    });
    expect(f.byChapter.find((c) => c.chapter === "1")!.varianceCents).toBe(-60_00);
    expect(f.overrunChapters).toEqual([]);
  });
});
