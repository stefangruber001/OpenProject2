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

import { SchedulingService } from "@repo/capability-scheduling";
import type { Plan, StatusSummary, Task, TaskStatus } from "@repo/capability-scheduling";
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
 * Today this exposes only read-side derivations, because the areas it could
 * own are still owned by site/erp-engine.js (see site/erp-ownership.json).
 * Session 5 of the programme grows this capability into the calendar/CPM
 * engine behind the Gantt; this surface is where that arrives.
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
    service: svc,
  };
}

export type { Plan, StatusSummary, Task, TaskStatus };

/**
 * Bumped by hand when the shape of this surface changes in a way
 * site/erp-bridge.js must notice. Not a build stamp — a build stamp would
 * churn the committed bundle on every commit and defeat the CI drift check.
 */
export const SURFACE_VERSION = 1;
