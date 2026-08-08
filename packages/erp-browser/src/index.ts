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

import { composeAnnex, resolveAnnexOptions } from "@repo/capability-docs";
import type {
  Annex,
  AnnexImageInput,
  AnnexOptions,
  AnnexPage,
  AnnexPlate,
} from "@repo/capability-docs";
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
  CurveOptions,
  Dependency,
  DependencyType,
  DeriveOptions,
  DerivedPlan,
  Plan,
  ProgressCurve,
  ProgressEntry,
  RiskOptions,
  RiskReport,
  Schedule,
  ScheduledTask,
  StatusSummary,
  Task,
  TaskStatus,
  WorkCalendar,
  WorkItem,
} from "@repo/capability-scheduling";
import {
  findInternalTransfers,
  resolveReconciliationConfig,
  suggestForAll,
  suggestMatches,
} from "@repo/capability-reconciliation";
import type {
  BankMovement,
  CandidateDoc,
  InternalTransfer,
  MatchSuggestion,
  ReconciliationConfig,
} from "@repo/capability-reconciliation";
import { messageKey, newMessages, planMessages, renderTemplate } from "@repo/capability-messaging";
import type { CommsEvent, CommsRule, PlannedMessage } from "@repo/capability-messaging";
import { ProjectsService, forecastToCompletion } from "@repo/capability-projects";
import type {
  ChapterForecast,
  ForecastInput,
  ForecastOverride,
  Project,
  ProjectForecast,
} from "@repo/capability-projects";
// A PACK, in the browser bundle, on purpose. This package is a host: it may
// compose packs as well as capabilities, and how fast a trade works is sector
// knowledge that has to come from somewhere other than the planner. The import
// is the zod-free `rates` subpath — a validation library has no business
// travelling into a phone to look up a number in a table.
import { dailyOutputFor } from "@repo/pack-vertical-construction-reformas/rates";
import type { DailyOutputTable, RateLookup } from "@repo/pack-vertical-construction-reformas/rates";
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

/**
 * Project economics surface.
 *
 * Only the forecast is exposed. The rest of `@repo/capability-projects` — the
 * baseline, the cost ledger, the change orders — is still owned by
 * site/erp-engine.js (see site/erp-ownership.json), and wrapping methods whose
 * data lives somewhere else would be a surface pretending to own something.
 * Cost at completion is different: it is a derivation the engine never had,
 * so nothing has to move for it to be correct.
 */
export function createProjects(ports: FactoryPorts = defaultPorts()) {
  const svc = new ProjectsService({
    clock: ports.clock,
    idGen: ports.idGen,
    config: { marginFloorBp: 1200 },
  });
  return {
    /** Where the cost is heading, per chapter and in total. */
    forecast(project: Project, input: ForecastInput): ProjectForecast {
      return forecastToCompletion(project, input);
    },
    service: svc,
  };
}

/**
 * Sector rates, from the vertical pack.
 *
 * The one thing in this file that is not a capability, and the reason is the
 * point: a quantity becomes a duration only once something says how much of
 * that unit gets done in a day, and that is knowledge about a trade, not about
 * planning. The capability divides; the pack supplies the divisor.
 */
export function createRates() {
  return {
    /** Daily output for a line, or null when nothing in the tables applies. */
    dailyOutputFor(lookup: RateLookup): number | null {
      return dailyOutputFor(lookup);
    },
  };
}

/**
 * Bank-reconciliation surface.
 *
 * Pure scoring — no clock, no ids, no store — so the whole capability is
 * exposed rather than a chosen slice of it: there is nothing here that could
 * mean something different in a browser than it does on a server.
 */
export function createReconciliation(config?: Partial<ReconciliationConfig> | null) {
  const cfg = resolveReconciliationConfig(config);
  return {
    config: cfg,
    /** What might explain one movement, best first. */
    suggest(movement: BankMovement, candidates: CandidateDoc[]): MatchSuggestion[] {
      return suggestMatches(movement, candidates, cfg);
    },
    /** The same for a whole statement, keyed by movement id. */
    suggestAll(
      movements: BankMovement[],
      candidates: CandidateDoc[],
    ): Record<string, MatchSuggestion[]> {
      return suggestForAll(movements, candidates, cfg);
    },
    /** Pairs that are one transfer between the tenant's own accounts. */
    internalTransfers(movements: BankMovement[]): InternalTransfer[] {
      return findInternalTransfers(movements, cfg);
    },
  };
}

/**
 * Communications surface: templates rendered, rules planned. Nothing sent.
 *
 * Sending stays behind `email-out@1`, whose only bound adapter is the log-only
 * outbox — see the note in messaging/rules.ts about why the default is always
 * a draft a person approves.
 */
export function createComms() {
  return {
    /** Fill `{{tokens}}`; unknown ones are left visible rather than blanked. */
    render(template: string, vars: Record<string, string | number>): string {
      return renderTemplate(template, vars);
    },
    /** What the rules say should be queued, given what has happened. */
    plan(rules: CommsRule[], events: CommsEvent[], asOf: string): PlannedMessage[] {
      return planMessages(rules, events, { asOf });
    },
    /** Drop anything the caller has already queued, sent or cancelled. */
    unseen(planned: PlannedMessage[], existingKeys: string[]): PlannedMessage[] {
      return newMessages(planned, existingKeys);
    },
    /** The de-duplication key, exported so callers cannot drift from it. */
    key: messageKey,
  };
}

/**
 * Documents surface.
 *
 * Only the annex composer is exposed: it is the part a browser genuinely calls
 * today (the document preview lays out its picture pages with it). The metadata
 * register stays behind `service` in spirit — it is not here because nothing in
 * the browser reaches for it yet, and a surface that grows methods before their
 * callers exist is a surface nobody can safely change later.
 */
export function createDocs() {
  return {
    /** Fills in the defaults and pulls out-of-range values back into range. */
    annexOptions(raw: AnnexOptions | undefined | null): Required<AnnexOptions> {
      return resolveAnnexOptions(raw);
    },
    /** Lays the given images out as annex pages, in document order. */
    compose(images: AnnexImageInput[], options?: AnnexOptions): Annex {
      return composeAnnex(images, options);
    },
  };
}

export type { Annex, AnnexImageInput, AnnexOptions, AnnexPage, AnnexPlate };

export type {
  Baseline,
  BaselineComparison,
  ChapterForecast,
  CurveOptions,
  DailyOutputTable,
  Dependency,
  DependencyType,
  DeriveOptions,
  DerivedPlan,
  ForecastInput,
  ForecastOverride,
  Plan,
  ProgressCurve,
  ProgressEntry,
  Project,
  ProjectForecast,
  RateLookup,
  RiskOptions,
  RiskReport,
  Schedule,
  ScheduledTask,
  StatusSummary,
  Task,
  TaskStatus,
  WorkCalendar,
  WorkItem,
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
 * 4 — `createDocs` added: the image-annex composer the document preview needs.
 * 5 — `createProjects` (cost at completion) and `createRates` (the vertical
 *     pack's daily output) added, and `service` gained the work-breakdown
 *     derivation, the progress curve and the risk report.
 * 6 — `createReconciliation` (statement matching) and `createComms` (template
 *     rendering and rule planning) added.
 */
export const SURFACE_VERSION = 6;
