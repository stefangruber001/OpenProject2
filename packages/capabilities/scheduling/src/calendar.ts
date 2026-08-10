import { FactoryError } from "@repo/kernel";

/**
 * The working calendar every duration in this capability is measured in.
 *
 * The calendar is DATA, never knowledge: which weekdays are worked, and which
 * individual dates are closed, both arrive from tenant config or a
 * jurisdiction pack. A planning engine that knew one country's closures would
 * be a planning engine that could only be sold in that country — and the
 * five-day week is itself a local convention, not a fact.
 */
export interface WorkCalendar {
  /** Weekday numbers that are worked. 0 = Sunday … 6 = Saturday. */
  workingWeekdays: number[];
  /** Individual closed dates (ISO `yyyy-mm-dd`), whatever their reason. */
  nonWorkingDates: string[];
}

/**
 * The fallback for a plan that carries no calendar: every day is a working
 * day. Deliberately not a five-day week — defaulting to one would bake an
 * assumption about the tenant into a layer that is not allowed to hold any.
 */
export function everyDayCalendar(): WorkCalendar {
  return { workingWeekdays: [0, 1, 2, 3, 4, 5, 6], nonWorkingDates: [] };
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
/**
 * How far the calendar walkers will look for a working day before giving up.
 * A calendar can be configured with no working weekdays at all, or with a
 * closure long enough to swallow a plan; without a bound, every scheduling
 * call on such a calendar would hang instead of failing.
 */
const MAX_SEARCH_DAYS = 3660;

function assertIso(date: string): void {
  if (!ISO.test(date)) {
    throw new FactoryError("INVALID_STATE", `Date must be ISO yyyy-mm-dd, received "${date}".`);
  }
}

function toUtc(date: string): Date {
  assertIso(date);
  const ms = Date.parse(`${date}T00:00:00.000Z`);
  if (Number.isNaN(ms)) throw new FactoryError("INVALID_STATE", `Not a real date: "${date}".`);
  return new Date(ms);
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function shift(date: string, days: number): string {
  const d = toUtc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return toIso(d);
}

/** Whether the calendar works on that date. */
export function isWorkingDay(cal: WorkCalendar, date: string): boolean {
  const weekday = toUtc(date).getUTCDay();
  if (!cal.workingWeekdays.includes(weekday)) return false;
  return !cal.nonWorkingDates.includes(date);
}

/** The first working day on or after `date`. */
export function snapForward(cal: WorkCalendar, date: string): string {
  let cursor = date;
  for (let i = 0; i <= MAX_SEARCH_DAYS; i++) {
    if (isWorkingDay(cal, cursor)) return cursor;
    cursor = shift(cursor, 1);
  }
  throw noWorkingDay(date, "after");
}

/** The first working day on or before `date`. */
export function snapBack(cal: WorkCalendar, date: string): string {
  let cursor = date;
  for (let i = 0; i <= MAX_SEARCH_DAYS; i++) {
    if (isWorkingDay(cal, cursor)) return cursor;
    cursor = shift(cursor, -1);
  }
  throw noWorkingDay(date, "before");
}

/**
 * Move `steps` working days from `date`, snapping onto a working day first.
 * Negative steps move backwards, which is what a lead (a negative lag) is.
 * `steps: 0` is therefore "the working day this date belongs to", the answer
 * a dependency with no lag needs.
 */
export function addWorkingDays(cal: WorkCalendar, date: string, steps: number): string {
  let cursor = steps >= 0 ? snapForward(cal, date) : snapBack(cal, date);
  const dir = steps >= 0 ? 1 : -1;
  let remaining = Math.abs(steps);
  let guard = 0;
  while (remaining > 0) {
    cursor = shift(cursor, dir);
    if (isWorkingDay(cal, cursor)) remaining -= 1;
    guard += 1;
    if (guard > MAX_SEARCH_DAYS) throw noWorkingDay(date, dir > 0 ? "after" : "before");
  }
  return cursor;
}

/**
 * Working days in the inclusive range — the duration of a task that starts on
 * `start` and finishes on `finish`. Zero when the range is inverted, which is
 * how a milestone (start === finish, duration 0) stays representable.
 */
export function workingDaysInclusive(cal: WorkCalendar, start: string, finish: string): number {
  if (finish < start) return 0;
  let count = 0;
  let cursor = start;
  for (let i = 0; i <= MAX_SEARCH_DAYS && cursor <= finish; i++) {
    if (isWorkingDay(cal, cursor)) count += 1;
    cursor = shift(cursor, 1);
  }
  return count;
}

/**
 * Signed distance in working days: how many working-day steps separate `from`
 * and `to`. This is the unit floats and baseline drifts are reported in — a
 * plan that slips over a closure has not slipped by the days the calendar was
 * shut.
 */
export function workingDayOffset(cal: WorkCalendar, from: string, to: string): number {
  if (from === to) return 0;
  const forward = to > from;
  const [a, b] = forward ? [from, to] : [to, from];
  // The inclusive count of a..b counts both ends; the number of steps between
  // them is one less.
  const span = workingDaysInclusive(cal, a, b);
  const steps = Math.max(0, span - 1);
  return forward ? steps : -steps;
}

/**
 * The finish date of a task of `durationDays` working days starting on
 * `start`. Duration 0 is a milestone: it finishes the day it starts.
 */
export function finishOf(cal: WorkCalendar, start: string, durationDays: number): string {
  if (durationDays <= 0) return snapForward(cal, start);
  return addWorkingDays(cal, start, durationDays - 1);
}

/** The start date a task of `durationDays` needs in order to finish on `finish`. */
export function startFor(cal: WorkCalendar, finish: string, durationDays: number): string {
  if (durationDays <= 0) return snapBack(cal, finish);
  return addWorkingDays(cal, finish, -(durationDays - 1));
}

function noWorkingDay(date: string, direction: "after" | "before"): FactoryError {
  return new FactoryError(
    "INVALID_STATE",
    `The calendar has no working day within ${MAX_SEARCH_DAYS} days ${direction} ${date}. ` +
      `Check workingWeekdays and nonWorkingDates.`,
  );
}
