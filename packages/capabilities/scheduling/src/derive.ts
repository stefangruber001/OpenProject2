import { everyDayCalendar, finishOf, snapForward, type WorkCalendar } from "./calendar";
import type { Dependency, Plan, Task } from "./model";

/**
 * Deriving a plan from a work breakdown.
 *
 * A quoted job already contains its own schedule in outline: the groups are
 * the order the work happens in, and each item's quantity says how long it
 * takes once you know how much of that unit gets done in a day. Retyping that
 * into a chart is both tedious and the moment the plan starts diverging from
 * what was sold — so the plan is DERIVED, and the derivation is repeatable.
 *
 * Repeatable matters more than it sounds. Task ids come from the caller's own
 * references rather than from a generator, so deriving the same breakdown
 * twice yields the same ids. That is what lets a plan be re-derived after the
 * quote changes without losing the progress recorded against the tasks that
 * survived — and it is why this module needs no id generator and stays pure.
 *
 * Nothing here knows what a group is, what a unit means, or how fast anyone
 * works: quantities, units and rates all arrive from the caller. The daily
 * output of a trade is sector knowledge and belongs in a pack.
 */

export interface WorkItem {
  /**
   * Stable, caller-owned reference. Becomes both the task id and its
   * sourceRef, so a bar in a chart can always be traced back to the line it
   * came from.
   */
  ref: string;
  /** Ordering key for the group this item belongs to, e.g. "2". */
  groupNum: string;
  groupName: string;
  /** The item's own number within its group, e.g. "2.3". */
  itemNum?: string;
  title: string;
  /** How much work there is, in whole units. */
  quantity?: number;
  unit?: string;
  /** How much of that unit is completed in one working day. */
  ratePerDay?: number;
  /** An explicit duration wins over anything derived from a quantity. */
  durationDays?: number;
  assignee?: string;
  /** Excluded from the plan entirely — an item that is not going to be built. */
  skip?: boolean;
}

export interface DeriveOptions {
  /** The first working day the work may start on. */
  from: string;
  calendar?: WorkCalendar;
  /**
   * `group` gives one bar per group — the shape a customer recognises.
   * `item` gives one bar per line, which is what a site manager needs.
   */
  granularity?: "group" | "item";
  /** Used when an item states neither a duration nor a quantity and a rate. */
  defaultDurationDays?: number;
  /**
   * Working days of lag between one group and the next. Negative overlaps
   * them, which is how real work is actually sequenced — but the default is
   * zero, because an overlap the planner did not ask for is a promise nobody
   * made.
   */
  groupLagDays?: number;
}

/** What the derivation decided, so a caller can explain it rather than assert it. */
export interface DerivedTaskNote {
  taskId: string;
  title: string;
  durationDays: number;
  /** How the duration was arrived at. */
  basis: "explicit" | "quantity" | "default";
  quantity?: number;
  unit?: string;
  ratePerDay?: number;
}

export interface DerivedPlan {
  plan: Plan;
  notes: DerivedTaskNote[];
  /** Items the caller asked to skip, or that carried no title. */
  skipped: string[];
}

const DEFAULT_DURATION_DAYS = 5;

/**
 * Compares two dotted numbers numerically, so 2.10 follows 2.9 rather than
 * sitting between 2.1 and 2.2. A plan whose bars are in a different order
 * from the document they came from is worse than no plan.
 */
function compareNumbering(a: string, b: string): number {
  const pa = String(a).split(".");
  const pb = String(b).split(".");
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const sa = pa[i];
    const sb = pb[i];
    if (sa === undefined) return -1;
    if (sb === undefined) return 1;
    const na = Number(sa);
    const nb = Number(sb);
    if (Number.isFinite(na) && Number.isFinite(nb)) {
      if (na !== nb) return na - nb;
    } else if (sa !== sb) {
      return sa < sb ? -1 : 1;
    }
  }
  return 0;
}

/** Working days for one item: explicit, else quantity ÷ rate, else the default. */
function durationFor(
  item: WorkItem,
  defaultDays: number,
): { days: number; basis: DerivedTaskNote["basis"] } {
  if (typeof item.durationDays === "number" && Number.isFinite(item.durationDays)) {
    return { days: Math.max(1, Math.round(item.durationDays)), basis: "explicit" };
  }
  const qty = Number(item.quantity);
  const rate = Number(item.ratePerDay);
  if (Number.isFinite(qty) && qty > 0 && Number.isFinite(rate) && rate > 0) {
    // Ceiling, not rounding: half a day of tiling still occupies a day on site.
    return { days: Math.max(1, Math.ceil(qty / rate)), basis: "quantity" };
  }
  return { days: Math.max(1, Math.round(defaultDays)), basis: "default" };
}

/**
 * Turns a work breakdown into a scheduled-shaped plan: one task per group or
 * per item, chained finish-to-start in the order the breakdown gives, with a
 * lag between groups.
 *
 * The dates it writes are a first pass laid out end to end; the caller is
 * expected to run the plan through `computeSchedule`/`recalculate`, which is
 * what actually resolves the network. Doing that here would duplicate the CPM
 * engine badly.
 */
export function planFromWorkBreakdown(items: WorkItem[], options: DeriveOptions): DerivedPlan {
  const cal = options.calendar ?? everyDayCalendar();
  const granularity = options.granularity ?? "group";
  const defaultDays = options.defaultDurationDays ?? DEFAULT_DURATION_DAYS;
  const groupLag = options.groupLagDays ?? 0;
  const start = snapForward(cal, options.from);

  const skipped: string[] = [];
  const usable = items.filter((it) => {
    if (it.skip || !it.title) {
      skipped.push(it.ref);
      return false;
    }
    return true;
  });

  const ordered = usable
    .map((item, i) => ({ item, i }))
    .sort((a, b) => {
      const g = compareNumbering(a.item.groupNum, b.item.groupNum);
      if (g !== 0) return g;
      const it = compareNumbering(a.item.itemNum ?? "", b.item.itemNum ?? "");
      if (it !== 0) return it;
      return a.i - b.i;
    })
    .map((x) => x.item);

  const tasks: Task[] = [];
  const dependencies: Dependency[] = [];
  const notes: DerivedTaskNote[] = [];

  /** Chains a task behind the previous one and records it. */
  const push = (
    id: string,
    title: string,
    days: number,
    note: DerivedTaskNote,
    assignee: string | undefined,
    sourceRef: string,
    lag: number,
  ) => {
    const previous = tasks[tasks.length - 1];
    tasks.push({
      id,
      title,
      assignee,
      // A first pass, deliberately: every task starts where the work could
      // start, and the CPM engine then pushes it out behind its predecessors.
      plannedStart: start,
      plannedEnd: finishOf(cal, start, days),
      status: "planned",
      progressPct: 0,
      milestone: false,
      durationDays: days,
      sourceRef,
    });
    if (previous) {
      dependencies.push({
        id: `dep_${previous.id}__${id}`,
        predecessorId: previous.id,
        successorId: id,
        type: "FS",
        lagDays: lag,
      });
    }
    notes.push(note);
  };

  if (granularity === "item") {
    let lastGroup: string | null = null;
    for (const item of ordered) {
      const { days, basis } = durationFor(item, defaultDays);
      const lag = lastGroup !== null && lastGroup !== item.groupNum ? groupLag : 0;
      lastGroup = item.groupNum;
      push(
        `task_${item.ref}`,
        `${item.itemNum ? item.itemNum + " " : ""}${item.title}`,
        days,
        {
          taskId: `task_${item.ref}`,
          title: item.title,
          durationDays: days,
          basis,
          quantity: item.quantity,
          unit: item.unit,
          ratePerDay: item.ratePerDay,
        },
        item.assignee,
        item.ref,
        lag,
      );
    }
  } else {
    const groups = new Map<string, { name: string; days: number; refs: string[] }>();
    for (const item of ordered) {
      const { days } = durationFor(item, defaultDays);
      const g = groups.get(item.groupNum);
      // Items within a group run one after another, so their days add up.
      if (g) {
        g.days += days;
        g.refs.push(item.ref);
      } else {
        groups.set(item.groupNum, { name: item.groupName, days, refs: [item.ref] });
      }
    }
    let first = true;
    for (const [num, g] of groups) {
      const id = `task_group_${num}`;
      push(
        id,
        `${num}. ${g.name}`,
        g.days,
        { taskId: id, title: g.name, durationDays: g.days, basis: "quantity" },
        undefined,
        `group:${num}`,
        first ? 0 : groupLag,
      );
      first = false;
    }
  }

  return {
    plan: { tasks, dependencies, calendar: cal, baselines: [] },
    notes,
    skipped,
  };
}

/**
 * Re-derives a plan while keeping what only the site knows.
 *
 * A quote changes and the plan must follow it, but progress, the dates a
 * planner deliberately pinned and the frozen baselines are not in the quote
 * and cannot be re-derived from it. Tasks are matched by id — which is why the
 * derivation makes ids from the caller's references rather than generating
 * them — so a line that survived the change keeps everything recorded against
 * it, and one that did not simply disappears.
 */
export function mergeDerivedPlan(previous: Plan, derived: Plan): Plan {
  const before = new Map(previous.tasks.map((t) => [t.id, t]));
  return {
    ...derived,
    tasks: derived.tasks.map((t) => {
      const old = before.get(t.id);
      if (!old) return t;
      return {
        ...t,
        progressPct: old.progressPct,
        status: old.status,
        assignee: old.assignee ?? t.assignee,
        earliestStart: old.earliestStart,
      };
    }),
    // Baselines are promises already made; a re-derivation does not get to
    // rewrite them.
    baselines: previous.baselines ?? [],
    progressLog: previous.progressLog,
  };
}
