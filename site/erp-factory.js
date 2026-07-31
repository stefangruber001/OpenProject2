/* GENERATED — do not edit by hand. Rebuild: pnpm --filter @repo/erp-browser build */
"use strict";
var ErpFactory = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
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
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // src/index.ts
  var index_exports = {};
  __export(index_exports, {
    BrowserIdGen: () => BrowserIdGen,
    SURFACE_VERSION: () => SURFACE_VERSION,
    createScheduling: () => createScheduling,
    defaultPorts: () => defaultPorts
  });

  // ../kernel/src/errors.ts
  var FactoryError = class extends Error {
    constructor(code, message, details) {
      super(`[${code}] ${message}`);
      __publicField(this, "code");
      __publicField(this, "details");
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

  // ../capabilities/scheduling/src/service.ts
  var STATUSES = ["planned", "in_progress", "done", "blocked"];
  var SchedulingService = class {
    constructor(deps) {
      __publicField(this, "deps", deps);
    }
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
        milestone: input.milestone ?? false
      };
      return { ...plan, tasks: [...plan.tasks, task] };
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
    constructor() {
      __publicField(this, "counter", 0);
    }
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
      service: svc
    };
  }
  var SURFACE_VERSION = 1;
  return __toCommonJS(index_exports);
})();
