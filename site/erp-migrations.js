/* =============================================================================
   Schema migration ladder for the persisted ERP state blob.

   Why this exists: ERP.from(json) in erp-engine.js assigns the stored object
   straight onto this.state. That is fine while the shape never changes, and a
   live data-loss hazard the moment it does — a blob written by an older build
   simply arrives missing keys, and the first `state.foo.filter(...)` throws
   somewhere far from the cause. This module makes the shape change explicit,
   versioned and reversible-by-inspection.

   Two rules the whole programme depends on:

     1. NEVER rename or retype an existing key. Add a new one and migrate the
        readers. Almost every migration here should then be `s.x ??= default`,
        which is inherently safe to run against a partially-migrated blob.
     2. Every `up()` is PURE and IDEMPOTENT over a plain object. Running the
        ladder twice must equal running it once — that is what makes a crash
        halfway through recoverable rather than corrupting.

   Loadable from the browser (window.ErpMigrations) and from Node
   (module.exports) so tests/simulation/migrations-sim.mjs can replay a real
   captured v1 blob through it.
   ========================================================================== */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ErpMigrations = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /* A blob with no schemaVersion predates versioning and is, by definition, v1. */
  var IMPLICIT_V1 = 1;

  var MIGRATIONS = [
    {
      to: 2,
      name: "declare every top-level collection up front",
      /*
       * erp-engine.js's constructor declares 32 top-level keys, but four more
       * are created lazily the first time a feature is used: feedback,
       * supplierPerf, assignments and recurring. A blob saved before any of
       * those features was touched therefore comes back missing them, and the
       * readers that do `(state.assignments || [])` are defending against
       * exactly that. Declaring them here means readers can stop guessing.
       *
       * Also introduces the two collections the data foundation itself needs:
       * importConflicts (rows a legacy import refused to merge automatically)
       * and imports (which one-way imports have already run, so they never
       * run twice).
       */
      up: function (s) {
        if (!Array.isArray(s.feedback)) s.feedback = [];
        if (!Array.isArray(s.supplierPerf)) s.supplierPerf = [];
        if (!Array.isArray(s.assignments)) s.assignments = [];
        if (!Array.isArray(s.recurring)) s.recurring = [];
        if (!Array.isArray(s.importConflicts)) s.importConflicts = [];
        if (!s.imports || typeof s.imports !== "object") s.imports = {};
        return s;
      },
    },
    {
      to: 3,
      name: "per-project schedules",
      /*
       * `plans` holds one capability-owned Plan value per project, keyed by
       * project id: tasks with durations, the dependency network, the working
       * calendar and any frozen baselines.
       *
       * It lives in the same blob but is NOT engine state. erp-engine.js
       * neither writes it nor knows it exists; site/erp-bridge.js puts it
       * there and @repo/capability-scheduling owns its shape. That is the
       * strangler seam working as intended — the engine keeps serialising the
       * whole object, so a new area can persist alongside it without the old
       * code learning anything about the new.
       */
      up: function (s) {
        if (!s.plans || typeof s.plans !== "object" || Array.isArray(s.plans)) s.plans = {};
        return s;
      },
    },
    {
      to: 4,
      name: "graphic annex: settings per budget, image records per line",
      /*
       * Two shape changes the graphic annex needs, both additive.
       *
       * 1. `budget.annex` — the per-budget switch and images-per-page. Absent
       *    on every blob written before this build.
       * 2. `line.imageRefs` entries become RECORDS rather than bare strings.
       *    The field has existed since the first build and has always been an
       *    empty array in practice, but a bare string is what an early build
       *    would plausibly have written, and a caption and an internal-only
       *    flag have nowhere to live on a string.
       *
       * Rule 1 of this ladder says never retype an existing key — and this
       * does exactly that, which is why it is done as a widening rather than a
       * replacement: a string becomes {storageKey: <that string>}, so nothing
       * is lost and running the migration twice is a no-op (a record is left
       * alone). The readers were updated in the same commit.
       */
      up: function (s) {
        var budgets = Array.isArray(s.budgets) ? s.budgets : [];
        budgets.forEach(function (b) {
          if (!b.annex || typeof b.annex !== "object")
            b.annex = { enabled: true, imagesPerPage: 2 };
          (Array.isArray(b.versions) ? b.versions : []).forEach(function (v) {
            (Array.isArray(v.chapters) ? v.chapters : []).forEach(function (c) {
              (Array.isArray(c.lines) ? c.lines : []).forEach(function (l) {
                if (!Array.isArray(l.imageRefs)) {
                  l.imageRefs = [];
                  return;
                }
                l.imageRefs = l.imageRefs.map(function (img, i) {
                  if (img && typeof img === "object") return img;
                  return {
                    id: "img_legacy_" + l.id + "_" + i,
                    storageKey: String(img),
                    caption: "",
                    source: "upload",
                    internal: false,
                    mime: "image/jpeg",
                    sizeBytes: 0,
                    width: 0,
                    height: 0,
                  };
                });
              });
            });
          });
        });
        return s;
      },
    },
  ];

  var CURRENT_VERSION = MIGRATIONS.reduce(function (max, m) {
    return Math.max(max, m.to);
  }, IMPLICIT_V1);

  function versionOf(state) {
    var v = state && state.schemaVersion;
    return typeof v === "number" && isFinite(v) ? v : IMPLICIT_V1;
  }

  /** State is plain JSON by construction, so this is a faithful deep copy. */
  function clone(state) {
    return JSON.parse(JSON.stringify(state));
  }

  /**
   * Runs the ladder. Returns a NEW object; the input is never touched, so a
   * caller can keep the original around to write a backup.
   *
   * Throws if the blob is NEWER than this build understands. That case is the
   * dangerous one and it is real here: the web ships continuously to /preview
   * while the iOS/Android shells ship through store review, so a user can
   * easily open last week's app against this week's data. Refusing loudly is
   * the only honest option — silently "migrating" downwards would discard
   * whatever the newer build added.
   */
  function migrate(state) {
    var from = versionOf(state);
    if (from > CURRENT_VERSION) {
      throw new Error(
        "Stored data is schema v" +
          from +
          " but this build only understands v" +
          CURRENT_VERSION +
          ". Update the app — continuing would discard data written by the newer version.",
      );
    }

    var next = clone(state);
    var applied = [];
    for (var i = 0; i < MIGRATIONS.length; i++) {
      var m = MIGRATIONS[i];
      if (m.to > from) {
        next = m.up(next) || next;
        next.schemaVersion = m.to;
        applied.push(m.to);
      }
    }
    // A blob already at CURRENT_VERSION still gets the field stamped, so a
    // state built fresh by erp-seed.js (which knows nothing about versioning)
    // is indistinguishable from a migrated one downstream.
    next.schemaVersion = Math.max(versionOf(next), CURRENT_VERSION);

    return { state: next, from: from, to: next.schemaVersion, applied: applied };
  }

  return {
    CURRENT_VERSION: CURRENT_VERSION,
    IMPLICIT_V1: IMPLICIT_V1,
    MIGRATIONS: MIGRATIONS,
    versionOf: versionOf,
    migrate: migrate,
  };
});
