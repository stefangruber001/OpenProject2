/* GENERATED — do not edit by hand. Rebuild: pnpm --filter @repo/erp-browser build */
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  BrowserIdGen: () => BrowserIdGen,
  SURFACE_VERSION: () => SURFACE_VERSION,
  createDocs: () => createDocs,
  createScheduling: () => createScheduling,
  defaultPorts: () => defaultPorts
});
module.exports = __toCommonJS(index_exports);

// ../capabilities/docs/src/annex.ts
var ANNEX_DEFAULT_ENABLED = true;
var ANNEX_DEFAULT_IMAGES_PER_PAGE = 2;
var ANNEX_MAX_IMAGES_PER_PAGE = 12;
function resolveAnnexOptions(o) {
  const raw = Number(o?.imagesPerPage);
  const perPage = Number.isFinite(raw) ? Math.min(ANNEX_MAX_IMAGES_PER_PAGE, Math.max(1, Math.round(raw))) : ANNEX_DEFAULT_IMAGES_PER_PAGE;
  return {
    enabled: typeof o?.enabled === "boolean" ? o.enabled : ANNEX_DEFAULT_ENABLED,
    imagesPerPage: perPage
  };
}
function compareNumbering(a, b) {
  const pa = String(a).split(".");
  const pb = String(b).split(".");
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const sa = pa[i];
    const sb = pb[i];
    if (sa === void 0) return -1;
    if (sb === void 0) return 1;
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
function composeAnnex(images, options) {
  const opts = resolveAnnexOptions(options);
  if (!opts.enabled || images.length === 0) {
    return { enabled: opts.enabled, pages: [], plateCount: 0, markedItems: [] };
  }
  const ordered = images.map((img, i) => ({ img, i })).sort((a, b) => {
    const g = compareNumbering(a.img.groupNum, b.img.groupNum);
    if (g !== 0) return g;
    const it = compareNumbering(a.img.itemNum, b.img.itemNum);
    if (it !== 0) return it;
    const o = (a.img.order ?? 0) - (b.img.order ?? 0);
    if (o !== 0) return o;
    return a.i - b.i;
  }).map((x) => x.img);
  const perItem = /* @__PURE__ */ new Map();
  for (const img of ordered) perItem.set(img.itemNum, (perItem.get(img.itemNum) ?? 0) + 1);
  const seen = /* @__PURE__ */ new Map();
  const plates = ordered.map((img) => {
    const siblings = perItem.get(img.itemNum) ?? 1;
    const n = (seen.get(img.itemNum) ?? 0) + 1;
    seen.set(img.itemNum, n);
    return {
      ref: img.ref,
      groupNum: img.groupNum,
      groupName: img.groupName,
      itemNum: img.itemNum,
      itemLabel: img.itemLabel,
      caption: img.caption ?? "",
      sequence: siblings > 1 ? n : null,
      siblings
    };
  });
  const pages = [];
  for (let i = 0; i < plates.length; i += opts.imagesPerPage) {
    pages.push({
      number: pages.length + 1,
      plates: plates.slice(i, i + opts.imagesPerPage)
    });
  }
  return {
    enabled: true,
    pages,
    plateCount: plates.length,
    markedItems: [...perItem.keys()].sort(compareNumbering)
  };
}

// ../kernel/src/errors.ts
var FactoryError = class extends Error {
  code;
  details;
  constructor(code, message, details) {
    super(`[${code}] ${message}`);
    this.name = "FactoryError";
    this.code = code;
    this.details = details;
  }
};

// ../kernel/src/clock.ts
var SystemClock = class {
  todayIso() {
    return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  }
  nowIso() {
    return (/* @__PURE__ */ new Date()).toISOString();
  }
};

// ../capabilities/scheduling/src/calendar.ts
function everyDayCalendar() {
  return { workingWeekdays: [0, 1, 2, 3, 4, 5, 6], nonWorkingDates: [] };
}
var ISO = /^\d{4}-\d{2}-\d{2}$/;
var MAX_SEARCH_DAYS = 3660;
function assertIso(date) {
  if (!ISO.test(date)) {
    throw new FactoryError("INVALID_STATE", `Date must be ISO yyyy-mm-dd, received "${date}".`);
  }
}
function toUtc(date) {
  assertIso(date);
  const ms = Date.parse(`${date}T00:00:00.000Z`);
  if (Number.isNaN(ms)) throw new FactoryError("INVALID_STATE", `Not a real date: "${date}".`);
  return new Date(ms);
}
function toIso(d) {
  return d.toISOString().slice(0, 10);
}
function shift(date, days) {
  const d = toUtc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return toIso(d);
}
function isWorkingDay(cal, date) {
  const weekday = toUtc(date).getUTCDay();
  if (!cal.workingWeekdays.includes(weekday)) return false;
  return !cal.nonWorkingDates.includes(date);
}
function snapForward(cal, date) {
  let cursor = date;
  for (let i = 0; i <= MAX_SEARCH_DAYS; i++) {
    if (isWorkingDay(cal, cursor)) return cursor;
    cursor = shift(cursor, 1);
  }
  throw noWorkingDay(date, "after");
}
function snapBack(cal, date) {
  let cursor = date;
  for (let i = 0; i <= MAX_SEARCH_DAYS; i++) {
    if (isWorkingDay(cal, cursor)) return cursor;
    cursor = shift(cursor, -1);
  }
  throw noWorkingDay(date, "before");
}
function addWorkingDays(cal, date, steps) {
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
function workingDaysInclusive(cal, start, finish) {
  if (finish < start) return 0;
  let count = 0;
  let cursor = start;
  for (let i = 0; i <= MAX_SEARCH_DAYS && cursor <= finish; i++) {
    if (isWorkingDay(cal, cursor)) count += 1;
    cursor = shift(cursor, 1);
  }
  return count;
}
function workingDayOffset(cal, from, to) {
  if (from === to) return 0;
  const forward = to > from;
  const [a, b] = forward ? [from, to] : [to, from];
  const span = workingDaysInclusive(cal, a, b);
  const steps = Math.max(0, span - 1);
  return forward ? steps : -steps;
}
function finishOf(cal, start, durationDays) {
  if (durationDays <= 0) return snapForward(cal, start);
  return addWorkingDays(cal, start, durationDays - 1);
}
function startFor(cal, finish, durationDays) {
  if (durationDays <= 0) return snapBack(cal, finish);
  return addWorkingDays(cal, finish, -(durationDays - 1));
}
function noWorkingDay(date, direction) {
  return new FactoryError(
    "INVALID_STATE",
    `The calendar has no working day within ${MAX_SEARCH_DAYS} days ${direction} ${date}. Check workingWeekdays and nonWorkingDates.`
  );
}

// ../capabilities/scheduling/src/cpm.ts
function calendarOf(plan) {
  return plan.calendar ?? everyDayCalendar();
}
function durationOf(cal, task) {
  if (task.milestone) return 0;
  if (typeof task.durationDays === "number") return Math.max(0, Math.round(task.durationDays));
  return Math.max(1, workingDaysInclusive(cal, task.plannedStart, task.plannedEnd));
}
function topologicalOrder(tasks, deps) {
  const indegree = /* @__PURE__ */ new Map();
  const successors = /* @__PURE__ */ new Map();
  for (const t of tasks) {
    indegree.set(t.id, 0);
    successors.set(t.id, []);
  }
  for (const d of deps) {
    if (!indegree.has(d.predecessorId) || !indegree.has(d.successorId)) {
      throw new FactoryError(
        "NOT_FOUND",
        `Dependency ${d.id} points at a task that is not in the plan.`,
        { predecessorId: d.predecessorId, successorId: d.successorId }
      );
    }
    successors.get(d.predecessorId).push(d.successorId);
    indegree.set(d.successorId, (indegree.get(d.successorId) ?? 0) + 1);
  }
  const ready = tasks.filter((t) => (indegree.get(t.id) ?? 0) === 0).map((t) => t.id);
  const order = [];
  while (ready.length) {
    const id = ready.shift();
    order.push(id);
    for (const s of successors.get(id) ?? []) {
      const left = (indegree.get(s) ?? 0) - 1;
      indegree.set(s, left);
      if (left === 0) ready.push(s);
    }
  }
  if (order.length !== tasks.length) {
    const stuck = tasks.filter((t) => !order.includes(t.id)).map((t) => t.id);
    throw new FactoryError(
      "INVALID_STATE",
      `The dependencies form a cycle: ${stuck.join(" \u2192 ")}.`,
      {
        taskIds: stuck
      }
    );
  }
  return order;
}
function computeSchedule(plan, opts = {}) {
  const cal = calendarOf(plan);
  const tasks = plan.tasks;
  const deps = plan.dependencies ?? [];
  if (!tasks.length) {
    const anchor = snapForward(cal, opts.from ?? "1970-01-01");
    return { start: anchor, finish: anchor, tasks: [], criticalPath: [] };
  }
  const order = topologicalOrder(tasks, deps);
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const predsOf = /* @__PURE__ */ new Map();
  const succsOf = /* @__PURE__ */ new Map();
  for (const t of tasks) {
    predsOf.set(t.id, []);
    succsOf.set(t.id, []);
  }
  for (const d of deps) {
    predsOf.get(d.successorId).push(d);
    succsOf.get(d.predecessorId).push(d);
  }
  const anchors = tasks.map((t) => t.earliestStart ?? t.plannedStart);
  const planStart = snapForward(cal, opts.from ?? anchors.reduce((a, b) => a < b ? a : b));
  const start = /* @__PURE__ */ new Map();
  const finish = /* @__PURE__ */ new Map();
  for (const id of order) {
    const task = byId.get(id);
    const duration = durationOf(cal, task);
    let earliest = snapForward(cal, task.earliestStart ?? planStart);
    for (const d of predsOf.get(id) ?? []) {
      const ps = start.get(d.predecessorId);
      const pf = finish.get(d.predecessorId);
      let candidate;
      if (d.type === "FS") candidate = addWorkingDays(cal, pf, 1 + d.lagDays);
      else if (d.type === "SS") candidate = addWorkingDays(cal, ps, d.lagDays);
      else candidate = startFor(cal, addWorkingDays(cal, pf, d.lagDays), duration);
      if (candidate > earliest) earliest = candidate;
    }
    start.set(id, earliest);
    finish.set(id, finishOf(cal, earliest, duration));
  }
  const planFinish = order.map((id) => finish.get(id)).reduce((a, b) => a > b ? a : b);
  const lateStart = /* @__PURE__ */ new Map();
  const lateFinish = /* @__PURE__ */ new Map();
  for (const id of [...order].reverse()) {
    const task = byId.get(id);
    const duration = durationOf(cal, task);
    let latestFinish = planFinish;
    for (const d of succsOf.get(id) ?? []) {
      const ss = lateStart.get(d.successorId);
      const sf = lateFinish.get(d.successorId);
      let candidate;
      if (d.type === "FS") candidate = addWorkingDays(cal, ss, -(1 + d.lagDays));
      else if (d.type === "SS")
        candidate = finishOf(cal, addWorkingDays(cal, ss, -d.lagDays), duration);
      else candidate = addWorkingDays(cal, sf, -d.lagDays);
      if (candidate < latestFinish) latestFinish = candidate;
    }
    lateFinish.set(id, latestFinish);
    lateStart.set(id, startFor(cal, latestFinish, duration));
  }
  const scheduled = order.map((id) => {
    const task = byId.get(id);
    const float = workingDayOffset(cal, start.get(id), lateStart.get(id));
    return {
      taskId: id,
      start: start.get(id),
      finish: finish.get(id),
      durationDays: durationOf(cal, task),
      lateStart: lateStart.get(id),
      lateFinish: lateFinish.get(id),
      totalFloatDays: float,
      critical: float <= 0
    };
  });
  return {
    start: scheduled.map((s) => s.start).reduce((a, b) => a < b ? a : b, planStart),
    finish: planFinish,
    tasks: scheduled,
    criticalPath: scheduled.filter((s) => s.critical).map((s) => s.taskId)
  };
}
function applySchedule(plan, schedule) {
  const byId = new Map(schedule.tasks.map((s) => [s.taskId, s]));
  return {
    ...plan,
    tasks: plan.tasks.map((t) => {
      const s = byId.get(t.id);
      return s ? { ...t, plannedStart: s.start, plannedEnd: s.finish } : t;
    })
  };
}

// ../capabilities/scheduling/src/baseline.ts
function freezeBaseline(plan, input) {
  const existing = plan.baselines ?? [];
  if (existing.some((b) => b.label === input.label)) {
    throw new FactoryError(
      "IMMUTABLE",
      `A baseline labelled "${input.label}" already exists and cannot be replaced.`
    );
  }
  const cal = calendarOf(plan);
  const tasks = plan.tasks.map((t) => ({
    taskId: t.id,
    title: t.title,
    start: t.plannedStart,
    finish: t.plannedEnd,
    durationDays: durationOf(cal, t),
    milestone: t.milestone
  }));
  const finish = tasks.length ? tasks.map((t) => t.finish).reduce((a, b) => a > b ? a : b) : input.frozenAt;
  const baseline = {
    id: input.id,
    label: input.label,
    frozenAt: input.frozenAt,
    finish,
    tasks
  };
  return { ...plan, baselines: [...existing, baseline] };
}
function compareToBaseline(plan, baselineId) {
  const baselines = plan.baselines ?? [];
  if (!baselines.length) {
    throw new FactoryError("NOT_FOUND", "The plan has no baseline to compare against.");
  }
  const baseline = baselineId ? baselines.find((b) => b.id === baselineId) : baselines[baselines.length - 1];
  if (!baseline) {
    throw new FactoryError("NOT_FOUND", `Baseline ${baselineId} not found.`);
  }
  const cal = calendarOf(plan);
  const current = new Map(plan.tasks.map((t) => [t.id, t]));
  const drifts = [];
  for (const b of baseline.tasks) {
    const now = current.get(b.taskId);
    if (!now) {
      drifts.push({
        taskId: b.taskId,
        title: b.title,
        status: "removed",
        startDriftDays: 0,
        finishDriftDays: 0,
        durationDriftDays: -b.durationDays
      });
      continue;
    }
    const startDrift = workingDayOffset(cal, b.start, now.plannedStart);
    const finishDrift = workingDayOffset(cal, b.finish, now.plannedEnd);
    drifts.push({
      taskId: b.taskId,
      title: now.title,
      status: finishDrift > 0 ? "late" : finishDrift < 0 ? "ahead" : "on_plan",
      startDriftDays: startDrift,
      finishDriftDays: finishDrift,
      durationDriftDays: durationOf(cal, now) - b.durationDays
    });
  }
  const known = new Set(baseline.tasks.map((t) => t.taskId));
  for (const t of plan.tasks) {
    if (known.has(t.id)) continue;
    drifts.push({
      taskId: t.id,
      title: t.title,
      status: "added",
      startDriftDays: 0,
      finishDriftDays: 0,
      durationDriftDays: durationOf(cal, t)
    });
  }
  const currentFinish = plan.tasks.length ? plan.tasks.map((t) => t.plannedEnd).reduce((a, b) => a > b ? a : b) : baseline.finish;
  return {
    baselineId: baseline.id,
    label: baseline.label,
    baselineFinish: baseline.finish,
    currentFinish,
    finishDriftDays: workingDayOffset(cal, baseline.finish, currentFinish),
    tasks: drifts
  };
}

// ../capabilities/scheduling/src/service.ts
var STATUSES = ["planned", "in_progress", "done", "blocked"];
var SchedulingService = class {
  constructor(deps) {
    this.deps = deps;
  }
  deps;
  empty() {
    return { tasks: [] };
  }
  addTask(plan, input) {
    if (input.plannedEnd < input.plannedStart) {
      throw new FactoryError("INVALID_STATE", "plannedEnd is before plannedStart.");
    }
    const task = {
      id: this.deps.idGen.next("task"),
      projectRef: input.projectRef,
      title: input.title,
      assignee: input.assignee,
      plannedStart: input.plannedStart,
      plannedEnd: input.plannedEnd,
      status: "planned",
      progressPct: 0,
      milestone: input.milestone ?? false,
      durationDays: input.durationDays,
      earliestStart: input.earliestStart,
      sourceRef: input.sourceRef
    };
    return { ...plan, tasks: [...plan.tasks, task] };
  }
  /**
   * Remove a task and every dependency that touched it. The cleanup is the
   * point: a dependency left pointing at a deleted task makes the next
   * schedule throw, so deletion has to be a single operation the engine owns
   * rather than two the caller must remember to pair.
   */
  removeTask(plan, taskId) {
    if (!plan.tasks.some((t) => t.id === taskId)) {
      throw new FactoryError("NOT_FOUND", `Task ${taskId} not found.`);
    }
    return {
      ...plan,
      tasks: plan.tasks.filter((t) => t.id !== taskId),
      dependencies: (plan.dependencies ?? []).filter(
        (d) => d.predecessorId !== taskId && d.successorId !== taskId
      )
    };
  }
  renameTask(plan, taskId, title) {
    const clean = title.trim();
    if (!clean) throw new FactoryError("INVALID_STATE", "A task needs a title.");
    return this.mutate(plan, taskId, (t) => ({ ...t, title: clean }));
  }
  setStatus(plan, taskId, status) {
    return this.mutate(plan, taskId, (t) => ({
      ...t,
      status,
      progressPct: status === "done" ? 100 : t.progressPct
    }));
  }
  setProgress(plan, taskId, pct) {
    const clamped = Math.max(0, Math.min(100, Math.round(pct)));
    return this.mutate(plan, taskId, (t) => ({
      ...t,
      progressPct: clamped,
      status: clamped === 100 ? "done" : t.status === "planned" ? "in_progress" : t.status
    }));
  }
  reschedule(plan, taskId, plannedStart, plannedEnd) {
    if (plannedEnd < plannedStart)
      throw new FactoryError("INVALID_STATE", "plannedEnd is before plannedStart.");
    return this.mutate(plan, taskId, (t) => ({ ...t, plannedStart, plannedEnd }));
  }
  /* ---------------------------------------------------------------------
     Network: calendar, dependencies, and the recalculation they drive.
     Every one of these returns a new Plan — the capability stays pure and
     the host owns persistence.
     --------------------------------------------------------------------- */
  /** Replace the working calendar. Durations are re-read against it on the next pass. */
  setCalendar(plan, calendar) {
    if (!calendar.workingWeekdays.length) {
      throw new FactoryError("INVALID_STATE", "A calendar needs at least one working weekday.");
    }
    return { ...plan, calendar };
  }
  /**
   * Tie two tasks together. The link is rejected if it would close a cycle —
   * checked by scheduling the result, so the answer comes from the same code
   * that would have to live with it.
   */
  link(plan, input) {
    const { predecessorId, successorId } = input;
    if (predecessorId === successorId) {
      throw new FactoryError("INVALID_STATE", "A task cannot depend on itself.");
    }
    for (const id of [predecessorId, successorId]) {
      if (!plan.tasks.some((t) => t.id === id)) {
        throw new FactoryError("NOT_FOUND", `Task ${id} not found.`);
      }
    }
    const deps = plan.dependencies ?? [];
    const type = input.type ?? "FS";
    if (deps.some(
      (d) => d.predecessorId === predecessorId && d.successorId === successorId && d.type === type
    )) {
      throw new FactoryError(
        "INVALID_STATE",
        `Those two tasks are already linked ${type}; edit the existing dependency instead.`
      );
    }
    const dep = {
      id: this.deps.idGen.next("dep"),
      predecessorId,
      successorId,
      type,
      lagDays: Math.round(input.lagDays ?? 0)
    };
    const next = { ...plan, dependencies: [...deps, dep] };
    computeSchedule(next);
    return next;
  }
  unlink(plan, dependencyId) {
    const deps = plan.dependencies ?? [];
    if (!deps.some((d) => d.id === dependencyId)) {
      throw new FactoryError("NOT_FOUND", `Dependency ${dependencyId} not found.`);
    }
    return { ...plan, dependencies: deps.filter((d) => d.id !== dependencyId) };
  }
  /** Change how long a task takes, in working days. Milestones stay at zero. */
  setDuration(plan, taskId, durationDays) {
    if (durationDays < 0) {
      throw new FactoryError("INVALID_STATE", "Duration cannot be negative.");
    }
    return this.mutate(plan, taskId, (t) => ({
      ...t,
      durationDays: t.milestone ? 0 : Math.round(durationDays)
    }));
  }
  /**
   * Pin a task to a date — what dragging a bar means. It becomes a
   * start-no-earlier-than constraint rather than a fixed date, so the task
   * still moves if a predecessor pushes it later; it simply stops drifting
   * earlier than the date a human chose.
   */
  moveTask(plan, taskId, start) {
    return this.mutate(plan, taskId, (t) => ({ ...t, earliestStart: start }));
  }
  /** Drop the pin and let the task float back to its earliest possible date. */
  unpin(plan, taskId) {
    return this.mutate(plan, taskId, (t) => ({ ...t, earliestStart: void 0 }));
  }
  /** Both CPM passes: dates, floats and the critical path. Does not mutate. */
  schedule(plan, from) {
    return computeSchedule(plan, { from });
  }
  /**
   * Rewrite every task's planned dates from the schedule. This is what makes
   * the plan's finish move on its own when a task is dragged, a duration
   * changes or a link is added.
   */
  recalculate(plan, from) {
    return applySchedule(plan, computeSchedule(plan, { from }));
  }
  /** The plan's finish — the date the last task ends. */
  finishDate(plan, from) {
    return computeSchedule(plan, { from }).finish;
  }
  /** Tasks with no float, in dependency order. */
  criticalPath(plan, from) {
    const ids = computeSchedule(plan, { from }).criticalPath;
    const byId = new Map(plan.tasks.map((t) => [t.id, t]));
    return ids.map((id) => byId.get(id)).filter(Boolean);
  }
  /* ---------------------------------------------------------------------
     Baselines
     --------------------------------------------------------------------- */
  /** Freeze the plan under a label — approval, contract signature, revision. */
  freezeBaseline(plan, label, asOf) {
    return freezeBaseline(plan, {
      id: this.deps.idGen.next("bl"),
      label,
      frozenAt: asOf ?? this.deps.clock.todayIso()
    });
  }
  /** Current dates against a frozen baseline, in working days. */
  compareToBaseline(plan, baselineId) {
    return compareToBaseline(plan, baselineId);
  }
  /** Tasks past their planned end and not done, soonest end first. */
  overdue(plan, asOf) {
    const today = asOf ?? this.deps.clock.todayIso();
    return plan.tasks.filter((t) => t.status !== "done" && t.plannedEnd < today).sort((a, b) => a.plannedEnd < b.plannedEnd ? -1 : 1);
  }
  byAssignee(plan, assignee) {
    return plan.tasks.filter((t) => t.assignee === assignee);
  }
  summary(plan) {
    return STATUSES.map((status) => ({
      status,
      count: plan.tasks.filter((t) => t.status === status).length
    }));
  }
  mutate(plan, taskId, fn) {
    const idx = plan.tasks.findIndex((t) => t.id === taskId);
    if (idx === -1) throw new FactoryError("NOT_FOUND", `Task ${taskId} not found.`);
    return { ...plan, tasks: plan.tasks.map((t, i) => i === idx ? fn(t) : t) };
  }
};

// src/index.ts
var BrowserIdGen = class {
  counter = 0;
  next(prefix) {
    const uuid = globalThis.crypto?.randomUUID?.();
    if (uuid) return `${prefix}_${uuid}`;
    this.counter += 1;
    const rand = Math.random().toString(36).slice(2, 10);
    return `${prefix}_${Date.now().toString(36)}${this.counter.toString(36)}${rand}`;
  }
};
function defaultPorts() {
  return { clock: new SystemClock(), idGen: new BrowserIdGen() };
}
function createScheduling(ports = defaultPorts()) {
  const svc = new SchedulingService({
    clock: ports.clock,
    idGen: ports.idGen,
    config: {}
  });
  return {
    /** An empty plan value — callers own persistence, as capabilities are pure. */
    empty() {
      return svc.empty();
    },
    /** Count of tasks per status, in a fixed status order. */
    summary(plan) {
      return svc.summary(plan);
    },
    /** Not-done tasks past their planned end, soonest first. */
    overdue(plan, asOf) {
      return svc.overdue(plan, asOf);
    },
    /**
     * Calendar arithmetic, exposed because a chart genuinely needs it: to
     * shade the closed days on its axis and to convert a pixel drag into a
     * date. Without this the view would reimplement working-day maths beside
     * the engine that owns it, and the two would drift apart on the first
     * closure someone adds.
     */
    calendar: {
      everyDay: everyDayCalendar,
      isWorkingDay,
      addWorkingDays,
      workingDaysInclusive,
      workingDayOffset
    },
    service: svc
  };
}
function createDocs() {
  return {
    /** Fills in the defaults and pulls out-of-range values back into range. */
    annexOptions(raw) {
      return resolveAnnexOptions(raw);
    },
    /** Lays the given images out as annex pages, in document order. */
    compose(images, options) {
      return composeAnnex(images, options);
    }
  };
}
var SURFACE_VERSION = 4;
