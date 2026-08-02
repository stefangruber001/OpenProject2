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
  var docs = available && F.createDocs ? F.createDocs() : null;

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

  /**
   * The working calendar a new schedule starts from.
   *
   * This is a HOST default, and it is allowed to be one: erp.html is outside
   * the boundary matrix, so it may hold local convention. The capability
   * itself knows no weekend and no closure — it falls back to a seven-day
   * week — which is why the value has to be supplied from here. When tenant
   * config grows a calendar (working days + the closures that apply to that
   * tenant), this constant is the single line that reads it instead.
   */
  var DEFAULT_CALENDAR = { workingWeekdays: [1, 2, 3, 4, 5], nonWorkingDates: [] };

  /**
   * Per-project schedules live in state.plans (schema v3), keyed by project
   * id. The engine does not know they are there: it serialises the whole
   * state object, so a capability-owned value can persist beside engine data
   * without the old code learning anything about the new.
   */
  function planFor(state, projectId) {
    var stored = state && state.plans && state.plans[projectId];
    if (stored && Array.isArray(stored.tasks)) return stored;
    return { tasks: [], dependencies: [], calendar: DEFAULT_CALENDAR, baselines: [] };
  }

  function storePlan(state, projectId, plan) {
    if (!state.plans || typeof state.plans !== "object") state.plans = {};
    state.plans[projectId] = plan;
    return plan;
  }

  /**
   * A starting schedule from the project's accepted budget chapters: one task
   * per chapter, in order, each finish-to-start behind the previous one.
   *
   * Deliberately a SEED, not the real generation. Session 10a builds the true
   * budget→plan derivation (quantities, line-level durations, the baseline
   * that the contract freezes). This exists so a chart opened on a real
   * project has something to show other than an empty grid, and it is only
   * ever run when the user asks for it.
   */
  function seedFromChapters(erp, projectId, opts) {
    if (!scheduling) return null;
    var svc = scheduling.service;
    var project = erp.project(projectId);
    var chapters = [];
    try {
      if (project.budgetId) {
        chapters = erp
          .version(project.budgetId, project.acceptedVersionId)
          .chapters.filter(function (c) {
            return c.section === "base";
          });
      }
    } catch (e) {
      chapters = [];
    }
    if (!chapters.length && project.baseline && project.baseline.chapters) {
      chapters = project.baseline.chapters;
    }
    if (!chapters.length) return null;

    var start = (opts && opts.from) || (project.dates && project.dates.start) || erp.today;
    var days = (opts && opts.durationDays) || 5;
    var plan = svc.setCalendar(
      { tasks: [], dependencies: [], baselines: [] },
      (opts && opts.calendar) || DEFAULT_CALENDAR,
    );
    var previousId = null;
    chapters.forEach(function (c) {
      plan = svc.addTask(plan, {
        title: c.num + ". " + c.name,
        plannedStart: start,
        plannedEnd: start,
        durationDays: days,
        projectRef: projectId,
        sourceRef: "chapter:" + c.num,
      });
      var added = plan.tasks[plan.tasks.length - 1];
      if (previousId) plan = svc.link(plan, { predecessorId: previousId, successorId: added.id });
      previousId = added.id;
    });
    return svc.recalculate(plan, start);
  }

  /**
   * A rendered customer document -> the annex composer's input.
   *
   * The projection reads the DOCUMENT, not the version, and that is the whole
   * point: the document has already dropped the lines that do not print (the
   * ones still pending a price) and the images marked internal, so the annex
   * can never illustrate a line the customer never saw. Nothing is filtered
   * again here.
   */
  function annexImagesOf(doc) {
    var out = [];
    (doc.chapters || []).forEach(function (c) {
      (c.lines || []).forEach(function (l) {
        (l.imageRefs || []).forEach(function (img, i) {
          out.push({
            ref: img.storageKey,
            groupNum: c.num,
            groupName: c.name,
            itemNum: l.num,
            itemLabel: l.desc,
            caption: img.caption || "",
            order: i,
          });
        });
      });
    });
    return out;
  }

  /**
   * Downscales and re-encodes a picture before it is stored.
   *
   * Infrastructure, not a rule: a phone camera produces 4-12 MB per shot, and
   * a quotation with a dozen of them would be unusable over a mobile
   * connection and slow to open on the device that took them. The numbers are
   * the host's choice, which is why they live here rather than in a
   * capability.
   *
   * Degrades to the original file if anything in the pipeline is unavailable —
   * an uncompressed picture is a size problem, a lost picture is a data
   * problem, and only one of those is worth failing over.
   */
  function compressImage(file, opts) {
    var maxEdge = (opts && opts.maxEdge) || 1600;
    var quality = (opts && opts.quality) || 0.72;
    var fallback = function () {
      return Promise.resolve({ blob: file, mime: file.type || "image/jpeg", width: 0, height: 0 });
    };
    if (typeof createImageBitmap !== "function" || typeof document === "undefined")
      return fallback();
    return createImageBitmap(file)
      .then(function (bmp) {
        var scale = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height));
        var w = Math.max(1, Math.round(bmp.width * scale));
        var h = Math.max(1, Math.round(bmp.height * scale));
        var canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(bmp, 0, 0, w, h);
        bmp.close && bmp.close();
        return new Promise(function (res) {
          canvas.toBlob(
            function (blob) {
              // Keep whichever is smaller: re-encoding an already-small PNG
              // screenshot as a JPEG can easily make it bigger.
              if (!blob || blob.size >= file.size)
                res({ blob: file, mime: file.type || "image/jpeg", width: w, height: h });
              else res({ blob: blob, mime: "image/jpeg", width: w, height: h });
            },
            "image/jpeg",
            quality,
          );
        });
      })
      .catch(fallback);
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

      /**
       * The contract's payment milestones for a project, as points on the
       * same timeline as the plan (spec §3.3). A pure projection of engine
       * data: the chart draws them, nothing schedules them, and the plan
       * never contains them — they belong to the contract, not the planner.
       */
      paymentMilestones: function (erp, projectId) {
        try {
          var project = erp.project(projectId);
          if (!project.contractId) return [];
          var contract = erp.state.contracts.find(function (c) {
            return c.id === project.contractId;
          });
          if (!contract) return [];
          return contract.installments
            .filter(function (i) {
              return !!i.expectedDate;
            })
            .map(function (i, idx) {
              return {
                label: contract.number + " · hito " + (idx + 1),
                date: i.expectedDate,
                amountCents: i.amountCents,
                invoiced: i.status === "invoiced",
              };
            });
        } catch (e) {
          return [];
        }
      },

      /* ---------------------------------------------------------------- *
       * Project schedules (the chart in Proyectos → Seguimiento técnico).
       *
       * Every method here is a pass-through to @repo/capability-scheduling
       * plus the one thing the capability cannot do, being pure: put the
       * result back in the state blob. No arithmetic happens in this file and
       * none may happen in the view — dates, floats, the critical path and
       * baseline drift all come from the engine, so there is exactly one
       * implementation of each to be wrong.
       * ---------------------------------------------------------------- */
      plans: {
        defaultCalendar: function () {
          return { workingWeekdays: DEFAULT_CALENDAR.workingWeekdays.slice(), nonWorkingDates: [] };
        },

        /** The stored plan for a project, or an empty one on the host calendar. */
        get: function (state, projectId) {
          return planFor(state, projectId);
        },

        /** Write a plan back into the blob. The caller still owns persistence. */
        save: function (state, projectId, plan) {
          return storePlan(state, projectId, plan);
        },

        /** Dates, floats and the critical path. Null when the bundle is absent. */
        schedule: function (plan, from) {
          if (!scheduling) return null;
          return scheduling.service.schedule(plan, from);
        },

        /** Apply the schedule to the plan's own dates. */
        recalculate: function (plan, from) {
          if (!scheduling) return plan;
          return scheduling.service.recalculate(plan, from);
        },

        addTask: function (plan, input) {
          return scheduling.service.addTask(plan, input);
        },
        removeTask: function (plan, taskId) {
          return scheduling.service.removeTask(plan, taskId);
        },
        rename: function (plan, taskId, title) {
          return scheduling.service.renameTask(plan, taskId, title);
        },
        link: function (plan, input) {
          return scheduling.service.link(plan, input);
        },
        unlink: function (plan, dependencyId) {
          return scheduling.service.unlink(plan, dependencyId);
        },
        move: function (plan, taskId, start) {
          return scheduling.service.moveTask(plan, taskId, start);
        },
        unpin: function (plan, taskId) {
          return scheduling.service.unpin(plan, taskId);
        },
        setDuration: function (plan, taskId, days) {
          return scheduling.service.setDuration(plan, taskId, days);
        },
        setProgress: function (plan, taskId, pct) {
          return scheduling.service.setProgress(plan, taskId, pct);
        },
        setCalendar: function (plan, calendar) {
          return scheduling.service.setCalendar(plan, calendar);
        },
        freezeBaseline: function (plan, label, asOf) {
          return scheduling.service.freezeBaseline(plan, label, asOf);
        },
        compareToBaseline: function (plan, baselineId) {
          if (!scheduling || !(plan.baselines || []).length) return null;
          return scheduling.service.compareToBaseline(plan, baselineId);
        },

        /** One task per accepted-budget chapter, chained. See seedFromChapters. */
        seedFromChapters: function (erp, projectId, opts) {
          return seedFromChapters(erp, projectId, opts);
        },

        /** Calendar arithmetic for the chart's axis and its drag maths. */
        calendar: scheduling ? scheduling.calendar : null,
      },
    },

    /* ------------------------------------------------------------------ *
     * Documents: the graphic annex (spec §3.3 Improvement #1).
     *
     * @repo/capability-docs decides what goes on which page, in what order and
     * under what reference; this file only projects the engine's rendered
     * document into its input, and supplies the one thing a pure capability
     * cannot: a browser to shrink a photograph with.
     * ------------------------------------------------------------------ */
    docs: {
      /**
       * The annex for a rendered customer document. Returns a disabled, empty
       * annex when the bundle is missing, so a view can always call it.
       */
      annex: function (doc) {
        if (!docs || !doc) return { enabled: false, pages: [], plateCount: 0, markedItems: [] };
        return docs.compose(annexImagesOf(doc), doc.annex);
      },
      /** Defaults filled in and out-of-range values pulled back into range. */
      annexOptions: function (raw) {
        if (!docs) return { enabled: true, imagesPerPage: 2 };
        return docs.annexOptions(raw);
      },
      compressImage: compressImage,
    },

    /** Exposed for tests and the parity harness; not for view code. */
    _projections: { tasksToPlan: tasksToPlan, annexImagesOf: annexImagesOf },
  };
});
