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
    {
      to: 5,
      name: "per-project cost projections and their progress history",
      /*
       * Two additions, both belonging to the economic and technical tracking
       * of a job in progress.
       *
       * `project.forecastOverrides` holds a human's replacement for a
       * calculated cost at completion, keyed by chapter, each with the reason
       * that justifies it. Absent means "nobody has overridden anything",
       * which is the honest default and not the same as an override of zero.
       *
       * `plan.progressLog` is the append-only record of how far each task had
       * got on a date. It is declared here rather than left to appear on first
       * write because it is the only part of a plan that CANNOT be
       * reconstructed afterwards: dates and the critical path recompute from
       * the network at any time, but "how much was done by the end of March"
       * exists only if somebody wrote it down in March. A reader that has to
       * guess whether the key is missing or the history is genuinely empty
       * cannot tell an unrecorded month from an idle one.
       */
      up: function (s) {
        (Array.isArray(s.projects) ? s.projects : []).forEach(function (p) {
          if (!p.forecastOverrides || typeof p.forecastOverrides !== "object")
            p.forecastOverrides = {};
        });
        if (s.plans && typeof s.plans === "object" && !Array.isArray(s.plans)) {
          Object.keys(s.plans).forEach(function (k) {
            var plan = s.plans[k];
            if (plan && typeof plan === "object" && !Array.isArray(plan.progressLog))
              plan.progressLog = [];
          });
        }
        return s;
      },
    },
    {
      to: 6,
      name: "purchases lifecycle, subcontracts, and locked labour weeks",
      /*
       * Session 10b (§4.1 Compras, §4.2 Subcontratos, §4.6 Personal y Horas).
       * Every addition here is a new, previously-absent field or collection —
       * nothing existing is renamed, retyped or reinterpreted.
       *
       *   state.subcontracts   — new collection, one record per awarded trade.
       *   purchase.receipts / .sentAt / .acceptedAt / .expectedArrival /
       *     .cancelledAt       — the lifecycle purchaseStatus() derives from;
       *     absent reads as "draft", exactly as it always implicitly did.
       *   change.chapterNum / .sentAt — additive; a change with no chapterNum
       *     already fell back to "1" wherever it was read (see erp-bridge.js's
       *     projectValue), so leaving it null here changes no prior behaviour.
       *   labour.locked / .approvedAt / .approvedBy — an existing entry reads
       *     as unlocked, which is the only sane default for hours that were
       *     recorded before "approving a week" existed as an action.
       *   worker.docs          — new, empty array.
       */
      up: function (s) {
        if (!Array.isArray(s.subcontracts)) s.subcontracts = [];
        if (s.series && typeof s.series === "object" && !s.series.subcontract)
          s.series.subcontract = { prefix: "SUB-", next: 1, issued: [] };
        (Array.isArray(s.purchases) ? s.purchases : []).forEach(function (pu) {
          if (!Array.isArray(pu.receipts)) pu.receipts = [];
          if (!("sentAt" in pu)) pu.sentAt = null;
          if (!("acceptedAt" in pu)) pu.acceptedAt = null;
          if (!("expectedArrival" in pu)) pu.expectedArrival = null;
          if (!("cancelledAt" in pu)) pu.cancelledAt = null;
          if (!("cancelReason" in pu)) pu.cancelReason = "";
        });
        (Array.isArray(s.changes) ? s.changes : []).forEach(function (c) {
          if (!("chapterNum" in c)) c.chapterNum = null;
          if (!("sentAt" in c)) c.sentAt = null;
        });
        (Array.isArray(s.labour) ? s.labour : []).forEach(function (l) {
          if (!("locked" in l)) l.locked = false;
          if (!("approvedAt" in l)) l.approvedAt = null;
          if (!("approvedBy" in l)) l.approvedBy = null;
        });
        (Array.isArray(s.workers) ? s.workers : []).forEach(function (w) {
          if (!Array.isArray(w.docs)) w.docs = [];
        });
        return s;
      },
    },
    {
      to: 7,
      name: "reconciliation periods, communications, gestoría follow-up",
      /*
       * Session 11 (§5.3 Conciliación, §5.6 Gestoría, §5.7 Comunicaciones).
       * Five new top-level collections and one map, all additive.
       *
       *   bankPeriods         closed/reopened reconciliation windows. Empty
       *                       means "nothing has been closed", which is the
       *                       only honest reading of a blob written before
       *                       closing a period was a thing you could do.
       *   commsTemplates      the template library; versions are rows, not
       *   commsRules          edits in place (see updateCommsTemplate).
       *   commsQueue          drafted/approved/cancelled messages. NOTHING in
       *                       here has ever been sent by this system.
       *   gestoriaQueries     what the accountant asked, and the answer.
       *   exceptionsAccepted  keyed justifications for GES-07 exceptions; a
       *                       map rather than an array because the key is the
       *                       identity and re-justifying should replace.
       */
      up: function (s) {
        if (!Array.isArray(s.bankPeriods)) s.bankPeriods = [];
        if (!Array.isArray(s.commsTemplates)) s.commsTemplates = [];
        if (!Array.isArray(s.commsRules)) s.commsRules = [];
        if (!Array.isArray(s.commsQueue)) s.commsQueue = [];
        if (!Array.isArray(s.gestoriaQueries)) s.gestoriaQueries = [];
        if (
          !s.exceptionsAccepted ||
          typeof s.exceptionsAccepted !== "object" ||
          Array.isArray(s.exceptionsAccepted)
        )
          s.exceptionsAccepted = {};
        return s;
      },
    },
    {
      to: 8,
      name: "alert management, opportunity decisions, project priority",
      /*
       * Session 12 (§2.1 Torre de Control, §2.2 Mi Día). Three additions, all
       * additive; nothing here is a new top-level collection erp-engine.js's
       * constructor doesn't already declare, except the two the alert manager
       * needs.
       *
       *   alertRules        one row per alert CONDITION (see ALERT_META in
       *                     erp-engine.js), lazily filled in by
       *                     ensureAlertRules() rather than by this migration —
       *                     a code added in a later session should not need
       *                     ANOTHER migration just to get a rule row. An
       *                     absent array still reads as "everything enabled,
       *                     no threshold overridden", which is exactly what a
       *                     blob written before rules existed should mean.
       *   alertOverrides    assign/due/snooze/resolve/task-link per alert,
       *                     keyed by alertKey(). A map, not an array, for the
       *                     same reason exceptionsAccepted (v7) is one: the
       *                     key is the identity.
       *   opportunity.decidedAt   when a won/lost decision was made — needed
       *                     for "Contratadas/Perdidas últimos 12 meses" (§2.1)
       *                     to mean something for an opportunity decided
       *                     before this field existed. Backfilled to the
       *                     opportunity's creation date, the only date an old
       *                     record actually has; a decision recorded from now
       *                     on gets its own, more accurate, real date.
       *   project.priority  a pin, defaulting to false — an existing project
       *                     was never marked priority because the feature
       *                     did not exist, which is exactly what false means.
       */
      up: function (s) {
        if (!Array.isArray(s.alertRules)) s.alertRules = [];
        if (
          !s.alertOverrides ||
          typeof s.alertOverrides !== "object" ||
          Array.isArray(s.alertOverrides)
        )
          s.alertOverrides = {};
        (Array.isArray(s.opportunities) ? s.opportunities : []).forEach(function (o) {
          if (!("decidedAt" in o)) o.decidedAt = ["won", "lost"].includes(o.status) ? o.date : null;
        });
        (Array.isArray(s.projects) ? s.projects : []).forEach(function (p) {
          if (!("priority" in p)) p.priority = false;
        });
        return s;
      },
    },
    {
      to: 9,
      name: "customer record: creation date in, activityLine out",
      /*
       * The ONLY migration in this ladder that REMOVES a key, and it does so
       * deliberately rather than by accident — which is why migrations-sim's
       * additive guard names this exact path as an allowed removal instead of
       * being relaxed. Read that allowance as the change record.
       *
       *   party.activityLine   DROPPED. A línea de actividad describes the
       *                        WORK, not the person paying for it: the same
       *                        customer can have a bathroom, a damp survey and
       *                        a shop fit-out. It stays on budgets and projects
       *                        (profitability("activityLine") groups projects
       *                        by it and is untouched); on the customer it was
       *                        a second, weaker copy that could disagree with
       *                        the job's own line. Nothing reads it any more.
       *   party.createdAt      added — the "alta" date the customer list shows.
       *                        Backfilled to null, not to today: a record
       *                        migrated from an older blob genuinely has no
       *                        known creation date, and inventing one would put
       *                        a confident wrong date on every historic client.
       *                        The UI renders null as "—".
       *   party.contactPerson / .landline  declared as strings if absent, so
       *                        the new columns never read undefined.
       */
      up: function (s) {
        (Array.isArray(s.parties) ? s.parties : []).forEach(function (p) {
          delete p.activityLine;
          if (!("createdAt" in p)) p.createdAt = null;
          if (typeof p.contactPerson !== "string") p.contactPerson = "";
          if (typeof p.landline !== "string") p.landline = "";
        });
        return s;
      },
    },
    {
      to: 10,
      name: "owner-maintained lists, price detail, line provenance (S3)",
      /*
       *   state.lists           added — units, leadSources, lossReasons and
       *                         paymentMethods move out of code and into the
       *                         document, so DMC-03/04/05 can maintain them.
       *                         Seeded from the engine's own defaults (see
       *                         listSeed below) rather than left empty: a
       *                         company that migrated must come out with the
       *                         same vocabulary it had five minutes ago, not
       *                         with four empty pickers.
       *   prices[].taxRateBp    added, gaps 6-9. taxRateBp is null, NOT 0 —
       *   prices[].supplierRef  a historic price row genuinely does not record
       *   prices[].wasteCents   which rate applied, and stamping 0% would be a
       *   prices[].minOrder     confident wrong answer on every one of them.
       *   prices[].projectRef   The screen renders null as "—".
       *   prices[].notes        wasteCents defaults to 0 because it is an
       *                         amount that was genuinely absent, not unknown.
       *   line.sourceFile       added, gap 12 — provenance for a line that
       *   line.sourceSheet      came from an uploaded workbook. Empty string
       *   line.chapterOriginal  on every existing line, which is the truth:
       *                         they were typed here, not imported.
       */
      up: function (s) {
        if (!s.lists || typeof s.lists !== "object" || Array.isArray(s.lists)) s.lists = {};
        var seed = listSeed();
        Object.keys(seed).forEach(function (kind) {
          if (!Array.isArray(s.lists[kind])) s.lists[kind] = seed[kind];
        });

        (Array.isArray(s.prices) ? s.prices : []).forEach(function (p) {
          if (!("taxRateBp" in p)) p.taxRateBp = null;
          if (typeof p.supplierRef !== "string") p.supplierRef = "";
          if (typeof p.wasteCents !== "number") p.wasteCents = 0;
          if (!("minOrder" in p)) p.minOrder = null;
          if (typeof p.projectRef !== "string") p.projectRef = "";
          if (typeof p.notes !== "string") p.notes = "";
        });

        (Array.isArray(s.budgets) ? s.budgets : []).forEach(function (b) {
          (Array.isArray(b.versions) ? b.versions : []).forEach(function (v) {
            (Array.isArray(v.chapters) ? v.chapters : []).forEach(function (c) {
              (Array.isArray(c.lines) ? c.lines : []).forEach(function (l) {
                if (typeof l.sourceFile !== "string") l.sourceFile = "";
                if (typeof l.sourceSheet !== "string") l.sourceSheet = "";
                if (typeof l.chapterOriginal !== "string") l.chapterOriginal = "";
              });
            });
          });
        });
        return s;
      },
    },
    {
      to: 11,
      name: "catalogue: chapter tree, brand/model/quality (S3, DMC-01)",
      /*
       * A separate step rather than more keys inside v10, because v10 had
       * already been written to blobs by the time DMC-01 needed these. A blob
       * stamped 10 never re-runs 10, so anything appended to it afterwards
       * would silently never reach the documents that most needed it — which
       * is the exact failure the ladder exists to prevent.
       *
       *   lists.itemChapters       added — DMC-01's chapter tree, seeded from
       *                            the engine's defaults. Its ARRAY ORDER is
       *                            the display order, which is what makes the
       *                            tree draggable without a second sort field
       *                            that could disagree with it.
       *   catalogue[].brand        added, empty. Empty is the truth: nobody
       *   catalogue[].model        recorded a brand for these, and inventing
       *   catalogue[].quality      one would put a claim in a document that
       *                            is used to settle arguments on site.
       */
      up: function (s) {
        if (!s.lists || typeof s.lists !== "object" || Array.isArray(s.lists)) s.lists = {};
        if (!Array.isArray(s.lists.itemChapters)) {
          var seed = listSeed();
          s.lists.itemChapters = seed.itemChapters || [];
        }
        (Array.isArray(s.catalogue) ? s.catalogue : []).forEach(function (i) {
          if (typeof i.brand !== "string") i.brand = "";
          if (typeof i.model !== "string") i.model = "";
          if (typeof i.quality !== "string") i.quality = "";
        });
        return s;
      },
    },
    {
      to: 12,
      name: "visits get a lifecycle: scheduled vs. done (S4, COM-02)",
      /*
       * Every visit that reached this blob was created by the OLD addVisit —
       * an already-completed capture in one step, because there was no
       * screen that could schedule one first. COM-02 needs to tell a
       * scheduled visit from a done one, so every existing visit is
       * backfilled as "done" (the true state of every visit written before
       * this session) rather than left ambiguous.
       *
       *   status        "done" — never "scheduled": nothing before this
       *                 session could produce a scheduled-but-not-yet-done
       *                 visit, since the concept did not exist.
       *   scheduledAt   backfilled to `date`. It is the closest honest
       *   completedAt   answer — the visit's own record IS when it was
       *                 captured, and stamping both to that day is a fact,
       *                 not a guess, for a visit that was always same-day.
       *   owner         "operations" — every existing visit's actual owner
       *                 by convention (site staff go on visits); not
       *                 recorded per-visit until this session.
       *   propertyId    null — was never captured on the visit itself
       *                 before now (only on the opportunity).
       *   budgetId      null — no visit has ever been linked to the budget
       *                 it produced; that link is new in this session.
       */
      up: function (s) {
        (Array.isArray(s.visits) ? s.visits : []).forEach(function (v) {
          if (typeof v.status !== "string") v.status = "done";
          if (typeof v.scheduledAt !== "string") v.scheduledAt = v.date || null;
          if (typeof v.completedAt !== "string") v.completedAt = v.date || null;
          if (typeof v.owner !== "string") v.owner = "operations";
          if (!("propertyId" in v)) v.propertyId = null;
          if (!("budgetId" in v)) v.budgetId = null;
        });
        return s;
      },
    },
    {
      to: 13,
      name: "budget rows record whether their number was typed (S5, COM-03)",
      /*
       * COM-03 lets an estimator type a chapter's or a line's number and keeps
       * it through every later reorder (`_renumber` skips rows flagged
       * `manualNum`). Every row that reached this blob was numbered
       * automatically — there was no way to type one — so they are all
       * backfilled `false`, which is a fact about them rather than a default.
       *
       * It matters that this is explicit. `undefined` is falsy and would
       * behave identically today, but a row with no field cannot be told from
       * a row someone answered "no" for, and the next person to read a stored
       * document should not have to know which build wrote it.
       *
       * EVERY version, not just the current one: a frozen version is still
       * rendered — reissued, diffed, printed — and a document whose rows have
       * a different shape depending on when it was sent is exactly the kind of
       * quiet inconsistency this ladder exists to prevent.
       */
      up: function (s) {
        (Array.isArray(s.budgets) ? s.budgets : []).forEach(function (b) {
          (Array.isArray(b.versions) ? b.versions : []).forEach(function (v) {
            (Array.isArray(v.chapters) ? v.chapters : []).forEach(function (c) {
              if (typeof c.manualNum !== "boolean") c.manualNum = false;
              (Array.isArray(c.lines) ? c.lines : []).forEach(function (l) {
                if (typeof l.manualNum !== "boolean") l.manualNum = false;
              });
            });
          });
        });
        return s;
      },
    },
  ];

  /**
   * The seed for `state.lists`, taken from the engine rather than copied.
   *
   * Two copies of this data would drift, and the failure mode is quiet: a
   * migrated company and a new one would start with different units and
   * nobody would notice until a printed document disagreed. `erp-engine.js`
   * loads before this file in the browser and is `require`-able in Node, so
   * there is no ordering problem to work around — only a fallback for the
   * case where it genuinely is not there, which keeps the ladder runnable in
   * isolation rather than throwing mid-migration.
   */
  function listSeed() {
    var E = null;
    try {
      E =
        (typeof module === "object" && module.exports && require("./erp-engine.js")) ||
        (typeof globalThis !== "undefined" && globalThis.ErpEngine) ||
        null;
    } catch (e) {
      E = typeof globalThis !== "undefined" ? globalThis.ErpEngine || null : null;
    }
    var defaults = E && E.LIST_DEFAULTS;
    if (!defaults) return { units: [], leadSources: [], lossReasons: [], paymentMethods: [] };
    var out = {};
    Object.keys(defaults).forEach(function (kind) {
      out[kind] = defaults[kind].map(function (e) {
        return { code: e.code, es: e.es, ca: e.ca, active: true };
      });
    });
    return out;
  }

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
