import { describe, expect, it } from "vitest";
import { isFactoryError } from "@repo/kernel";
import {
  addWorkingDays,
  everyDayCalendar,
  finishOf,
  isWorkingDay,
  snapBack,
  snapForward,
  startFor,
  workingDayOffset,
  workingDaysInclusive,
  type WorkCalendar,
} from "./calendar";

/** Mon–Fri, with two closed days inside the window under test. */
const fiveDay: WorkCalendar = {
  workingWeekdays: [1, 2, 3, 4, 5],
  nonWorkingDates: ["2026-08-05", "2026-08-06"],
};

describe("working calendar", () => {
  it("knows which days are worked", () => {
    // 2026-08-01 is a Saturday, 2026-08-03 a Monday.
    expect(isWorkingDay(fiveDay, "2026-08-01")).toBe(false);
    expect(isWorkingDay(fiveDay, "2026-08-03")).toBe(true);
    expect(isWorkingDay(fiveDay, "2026-08-05")).toBe(false); // closed date
    expect(isWorkingDay(everyDayCalendar(), "2026-08-01")).toBe(true);
  });

  it("snaps onto a working day in either direction", () => {
    expect(snapForward(fiveDay, "2026-08-01")).toBe("2026-08-03");
    expect(snapBack(fiveDay, "2026-08-01")).toBe("2026-07-31");
    expect(snapForward(fiveDay, "2026-08-05")).toBe("2026-08-07");
    expect(snapBack(fiveDay, "2026-08-06")).toBe("2026-08-04");
  });

  it("steps over weekends and closed dates", () => {
    // Mon 3rd + 1 working day = Tue 4th; +2 skips the two closed days to Fri 7th.
    expect(addWorkingDays(fiveDay, "2026-08-03", 1)).toBe("2026-08-04");
    expect(addWorkingDays(fiveDay, "2026-08-03", 2)).toBe("2026-08-07");
    // +3 crosses the weekend to Mon 10th.
    expect(addWorkingDays(fiveDay, "2026-08-03", 3)).toBe("2026-08-10");
  });

  it("steps backwards for leads", () => {
    expect(addWorkingDays(fiveDay, "2026-08-10", -1)).toBe("2026-08-07");
    expect(addWorkingDays(fiveDay, "2026-08-07", -2)).toBe("2026-08-03");
  });

  it("counts inclusive working days and signed offsets", () => {
    // Mon 3rd → Fri 7th is 3 working days (4th and 7th plus the 3rd; 5th/6th closed).
    expect(workingDaysInclusive(fiveDay, "2026-08-03", "2026-08-07")).toBe(3);
    expect(workingDaysInclusive(fiveDay, "2026-08-07", "2026-08-03")).toBe(0);
    expect(workingDayOffset(fiveDay, "2026-08-03", "2026-08-07")).toBe(2);
    expect(workingDayOffset(fiveDay, "2026-08-07", "2026-08-03")).toBe(-2);
    expect(workingDayOffset(fiveDay, "2026-08-03", "2026-08-03")).toBe(0);
  });

  it("derives finish from duration and start from finish", () => {
    // 3 working days from Mon 3rd occupy the 3rd, 4th and 7th — the 5th and
    // 6th are closed — so it finishes on the 7th, not three calendar days on.
    expect(finishOf(fiveDay, "2026-08-03", 3)).toBe("2026-08-07");
    expect(startFor(fiveDay, "2026-08-07", 3)).toBe("2026-08-03");
    // A milestone starts and finishes the same (working) day.
    expect(finishOf(fiveDay, "2026-08-03", 0)).toBe("2026-08-03");
    expect(finishOf(fiveDay, "2026-08-01", 0)).toBe("2026-08-03");
  });

  it("rejects a malformed date rather than guessing", () => {
    try {
      isWorkingDay(fiveDay, "3 August 2026");
      throw new Error("should throw");
    } catch (e) {
      expect(isFactoryError(e, "INVALID_STATE")).toBe(true);
    }
  });

  it("fails loudly on a calendar that never works instead of looping", () => {
    const closed: WorkCalendar = { workingWeekdays: [], nonWorkingDates: [] };
    try {
      snapForward(closed, "2026-08-03");
      throw new Error("should throw");
    } catch (e) {
      expect(isFactoryError(e, "INVALID_STATE")).toBe(true);
    }
  });
});
