/* =============================================================================
   @repo/erp-browser — the browser-facing surface of the typed capability layer.

   This is a HOST package (like packages/factory and apps/web): it may compose
   capabilities and packs, and the boundary linter does not constrain it. It
   deliberately owns the two things a browser needs that the factory's Node
   host provides differently:

     1. Port implementations that are safe in a WKWebView / Android WebView.
     2. A small, stable global surface (window.ErpFactory) that site/
        erp-bridge.js can call without knowing how capabilities are wired.

   What it is NOT: business logic. Every rule lives in a capability or a pack.
   If you find yourself writing a domain rule here, it belongs one layer down.
   ========================================================================== */

import {
  SchedulingService,
  addWorkingDays,
  everyDayCalendar,
  isWorkingDay,
  workingDayOffset,
  workingDaysInclusive,
} from "@repo/capability-scheduling";
import type {
  Baseline,
  BaselineComparison,
  Dependency,
  DependencyType,
  Plan,
  Schedule,
  ScheduledTask,
  StatusSummary,
  Task,
  TaskStatus,
  WorkCalendar,
} from "@repo/capability-scheduling";
import { SystemClock, type ClockPort, type IdGenPort } from "@repo/kernel";

/**
 * Id generation that survives a WebView.
 *
 * The kernel's RandomIdGen calls `globalThis.crypto.randomUUID()`, which is
 * undefined in a non-secure context and in older WKWebView builds — there it
 * would throw at first use and take the whole page down with it. The static
 * ERP is loaded from GitHub Pages inside two native shells we do not control
 * the WebView version of, so the browser host injects its own generator and
 * degrades instead of throwing.
 *
 * Ids only need to be unique within one device's dataset, never globally, so
 * the fallback is deliberately cheap rather than cryptographic.
 */
export class BrowserIdGen implements IdGenPort {
  private counter = 0;

  next(prefix: string): string {
    const uuid = globalThis.crypto?.randomUUID?.();
    if (uuid) return `${prefix}_${uuid}`;
    this.counter += 1;
    const rand = Math.random().toString(36).slice(2, 10);
    return `${prefix}_${Date.now().toString(36)}${this.counter.toString(36)}${rand}`;
  }
}

export interface FactoryPorts {
  clock: ClockPort;
  idGen: IdGenPort;
}

/** Default ports for a real browser session. Tests/Node may pass their own. */
export function defaultPorts(): FactoryPorts {
  return { clock: new SystemClock(), idGen: new BrowserIdGen() };
}

/**
 * Scheduling surface.
 *
 * The named methods here are the read-side derivations the ERP calls today;
 * the areas they touch are still owned by site/erp-engine.js (see
 * site/erp-ownership.json). The calendar/CPM/baseline engine that landed in
 * the capability is reached through `service`, deliberately un-wrapped: the
 * chart that consumes it does not exist yet, and wrapping an API before its
 * caller exists is how a surface acquires methods nobody ever calls.
 */
export function createScheduling(ports: FactoryPorts = defaultPorts()) {
  const svc = new SchedulingService({
    clock: ports.clock,
    idGen: ports.idGen,
    config: {},
  });

  return {
    /** An empty plan value — callers own persistence, as capabilities are pure. */
    empty(): Plan {
      return svc.empty();
    },
    /** Count of tasks per status, in a fixed status order. */
    summary(plan: Plan): StatusSummary[] {
      return svc.summary(plan);
    },
    /** Not-done tasks past their planned end, soonest first. */
    overdue(plan: Plan, asOf?: string): Task[] {
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
      workingDayOffset,
    },
    service: svc,
  };
}

export type {
  Baseline,
  BaselineComparison,
  Dependency,
  DependencyType,
  Plan,
  Schedule,
  ScheduledTask,
  StatusSummary,
  Task,
  TaskStatus,
  WorkCalendar,
};

/**
 * Bumped by hand when the shape of this surface changes in a way
 * site/erp-bridge.js must notice. Not a build stamp — a build stamp would
 * churn the committed bundle on every commit and defeat the CI drift check.
 *
 * 2 — `service` gained the calendar/CPM/baseline engine. A caller reaching
 *     for `service.schedule` against a version-1 artifact would find nothing
 *     there, which is exactly the staleness this number exists to catch.
 * 3 — `calendar` namespace added for the chart's axis and drag arithmetic.
 */
export const SURFACE_VERSION = 3;
