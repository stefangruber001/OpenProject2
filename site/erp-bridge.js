/* =============================================================================
   ErpBridge — the strangler-fig seam between the legacy engine and the typed
   capability layer.

   The whole migration rests on one rule:

       delegation flows NEW -> OLD, never OLD -> NEW.

   erp-bridge.js may read site/erp-engine.js state and call window.ErpFactory.
   erp-engine.js must never know this file exists. That is what keeps
   tests/simulation/*.mjs — which require("../../site/erp-engine.js") directly
   — passing unchanged for the whole programme, and it is why the engine can
   be strangled area by area without a flag day.

   Responsibilities (and nothing else):
     1. PROJECTIONS — turn the engine's plain state into the value-typed input
        a capability wants, and put the result back under a namespaced key.
     2. CALL SURFACE — one place erp.html calls, so views never touch
        ErpFactory or the engine's internals directly.
     3. OWNERSHIP — read site/erp-ownership.json's contract in spirit: an area
        is served here only once its capability genuinely owns it.

   What this file must NOT contain: business rules. A rule here is a rule in
   neither the engine nor a capability — the worst of both. Push it down.
   ========================================================================== */
(function (root, factory) {
  if (typeof module === "object" && module.exports)
    module.exports = factory(require("./erp-factory.cjs"));
  else root.ErpBridge = factory(root.ErpFactory);
})(typeof globalThis !== "undefined" ? globalThis : this, function (F) {
  "use strict";

  // The bundle is a hard dependency of the pages that load this file, but a
  // missing/blocked script must degrade rather than take the whole ERP down —
  // erp.html renders the entire business on it.
  var available = !!(F && F.createScheduling);

  var scheduling = available ? F.createScheduling() : null;

  /* ------------------------------------------------------------------ *
   * Projections: engine state -> capability values
   * ------------------------------------------------------------------ */

  /**
   * Engine tasks (DAS-07) are {id, owner, due, status:"open"|"done", title}.
   * The scheduling capability speaks {plannedStart, plannedEnd, assignee,
   * status, progressPct, milestone}. Engine tasks carry a single date, so it
   * serves as both start and end — a one-day task.
   *
   * Ids are carried through unchanged so anything derived here can be mapped
   * straight back to the engine record it came from.
   */
  function tasksToPlan(state) {
    var tasks = (state && state.tasks) || [];
    return {
      tasks: tasks.map(function (t) {
        var done = t.status === "done";
        return {
          id: t.id,
          projectRef: t.projectId || undefined,
          title: t.title || "",
          assignee: t.owner || undefined,
          plannedStart: t.due,
          plannedEnd: t.due,
          status: done ? "done" : "planned",
          progressPct: done ? 100 : 0,
          milestone: false,
        };
      }),
    };
  }

  /* ------------------------------------------------------------------ *
   * Call surface
   * ------------------------------------------------------------------ */

  return {
    /** False when the bundle failed to load; callers must degrade, not throw. */
    available: available,

    /** Surface version of the bundle, or null. Lets callers detect a stale artifact. */
    surfaceVersion: available ? F.SURFACE_VERSION : null,

    scheduling: {
      /**
       * Task counts by status, computed by @repo/capability-scheduling rather
       * than by ad-hoc filtering in a view. Returns [] when unavailable.
       *
       * This is the first real call across the seam. It is deliberately a
       * read-side derivation of data the engine still owns: it proves the
       * whole path (typed capability -> esbuild bundle -> browser global ->
       * bridge -> view) without moving ownership of anything, which is what
       * makes it safe to land before any capability is ready to own an area.
       */
      taskSummary: function (state) {
        if (!scheduling) return [];
        return scheduling.summary(tasksToPlan(state));
      },

      /** Not-done tasks past their due date, soonest first. [] when unavailable. */
      overdueTasks: function (state, asOf) {
        if (!scheduling) return [];
        return scheduling.overdue(tasksToPlan(state), asOf || (state && state.today));
      },
    },

    /** Exposed for tests and the parity harness; not for view code. */
    _projections: { tasksToPlan: tasksToPlan },
  };
});
