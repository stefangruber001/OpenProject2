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
  var projects = available && F.createProjects ? F.createProjects() : null;
  var rates = available && F.createRates ? F.createRates() : null;
  var recon = available && F.createReconciliation ? F.createReconciliation() : null;
  var comms = available && F.createComms ? F.createComms() : null;
  var extraction = available && F.createExtraction ? F.createExtraction() : null;

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
   * The accepted budget of a project, as the scheduling capability's work
   * breakdown (spec §3.3 "Carta Gantt del presupuesto", §4.3).
   *
   * This is a PROJECTION and nothing else. It reads the accepted version's
   * chapters and lines, asks the vertical pack how much of each unit gets done
   * in a day, and hands the result over; the capability decides durations,
   * order and dependencies, and the pack owns every rate. If a rate is missing
   * the item simply arrives without one and the derivation falls back to its
   * stated default, which is visible in the notes rather than hidden in a
   * plausible-looking bar.
   *
   * Lines still pending a price are left out: they are not in the customer's
   * document either, and a plan that schedules work nobody has agreed to buy
   * promises a date against nothing.
   */
  function workBreakdownOf(erp, projectId) {
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
    var items = [];
    chapters.forEach(function (c) {
      (c.lines || []).forEach(function (l) {
        if (l.pending) return;
        var qtyMilli = (l.subLines || []).length
          ? l.subLines.reduce(function (s, sl) {
              return s + Math.round(sl.qtyMilli * (1 + (sl.wastePct || 0) / 100));
            }, 0)
          : l.qtyMilli;
        items.push({
          ref: l.id,
          groupNum: c.num,
          groupName: c.name,
          itemNum: l.num,
          title: l.desc || l.customerWording || "",
          quantity: l.lumpSum ? undefined : qtyMilli / 1000,
          unit: l.unit,
          ratePerDay: rates
            ? rates.dailyOutputFor({ unit: l.unit, chapter: c.name }) || undefined
            : undefined,
        });
      });
    });
    // A project with no budget lines still has its frozen baseline chapters,
    // which is enough to lay out a plan at chapter granularity.
    if (!items.length && project.baseline && project.baseline.chapters) {
      project.baseline.chapters.forEach(function (c) {
        items.push({ ref: "chapter_" + c.num, groupNum: c.num, groupName: c.name, title: c.name });
      });
    }
    return items;
  }

  /**
   * Derive the plan for a project from its accepted budget, keeping whatever
   * only the site knows (progress, pinned dates, frozen baselines) for every
   * task that survives.
   */
  function planFromBudget(erp, projectId, opts) {
    if (!scheduling) return null;
    var items = workBreakdownOf(erp, projectId);
    if (!items.length) return null;
    var project = erp.project(projectId);
    var previous = planFor(erp.state, projectId);
    var derived = scheduling.service.fromWorkBreakdown(
      items,
      {
        from: (opts && opts.from) || (project.dates && project.dates.start) || erp.today,
        calendar: (opts && opts.calendar) || previous.calendar || DEFAULT_CALENDAR,
        granularity: (opts && opts.granularity) || "group",
        groupLagDays: opts && opts.groupLagDays,
        defaultDurationDays: (opts && opts.durationDays) || 5,
      },
      previous.tasks.length ? previous : undefined,
    );
    // Progress already recorded against the budget's own chapters is carried
    // onto the derived bars. Without this a freshly derived chart claims a job
    // that is half built has not started — and the two records of the same
    // fact would be visibly contradicting each other on the same screen.
    var recorded = {};
    try {
      erp.chapterProgress(projectId).forEach(function (c) {
        recorded[c.num] = c.progressPct;
      });
    } catch (e) {
      recorded = {};
    }
    return {
      notes: derived.notes,
      skipped: derived.skipped,
      plan: applyChapterProgress(derived.plan, recorded),
    };
  }

  /** Writes chapter progress onto whichever bars came from those chapters. */
  function applyChapterProgress(plan, byChapter) {
    return Object.assign({}, plan, {
      tasks: plan.tasks.map(function (t) {
        var m = /^group:(.+)$/.exec(t.sourceRef || "");
        if (!m || byChapter[m[1]] == null) return t;
        var pct = byChapter[m[1]];
        return Object.assign({}, t, {
          progressPct: pct,
          status: pct >= 100 ? "done" : pct > 0 ? "in_progress" : t.status,
        });
      }),
    });
  }

  /**
   * Record progress once, so both records of it agree.
   *
   * Progress is recorded in two places for two different reasons: the budget's
   * chapters, because certification and the economics are computed from them,
   * and the plan, because the chart and the actual-progress curve are. Letting
   * a user update one and not the other is how a project comes to be 80 % done
   * on one screen and 40 % on another, so a single action writes both. That is
   * a projection concern, which is why it lives here and not as a rule in
   * either the engine or the capability.
   */
  function recordProgress(erp, projectId, plan, taskId, pct, asOf) {
    var next = scheduling.service.setProgress(plan, taskId, pct, asOf || erp.today);
    var task = plan.tasks.find(function (t) {
      return t.id === taskId;
    });
    var m = task && /^group:(.+)$/.exec(task.sourceRef || "");
    if (m) {
      var state = pct >= 100 ? "done" : pct > 0 ? "inProgress" : "notStarted";
      try {
        erp.markProgress(projectId, m[1], state, pct, "operations");
      } catch (e) {
        // A bar with no chapter behind it any more must still update the
        // chart; the engine simply has nothing to record it against.
      }
    }
    return next;
  }

  /**
   * The engine's project as the projects capability's value.
   *
   * The COST baseline is the one projected, not the sale: this feeds cost at
   * completion, and forecasting revenue against a revenue baseline would only
   * ever tell you what you already sold it for.
   */
  function projectValue(erp, projectId) {
    var p = erp.project(projectId);
    var economics = erp.projectEconomics(projectId);
    var committed = erp.committedByChapter(projectId);
    var actualByChapter = {};
    erp.chapterEconomics(projectId).forEach(function (c) {
      actualByChapter[c.num] = c.actualCents;
    });
    var costs = [];
    /* Baseline chapters AND everything chapterEconomics knows beyond them.
       This used to iterate `p.baseline.chapters` alone, so a variation
       budget's chapter — real money, already spent — was silently dropped
       from the capability's cost list, and only the VIEW compensated with a
       hand-merge. The forecast then extrapolated a job that looked cheaper
       than it was. One list of chapter numbers, baseline first (their order
       is meaningful), the rest appended once. */
    var chapterNums = p.baseline.chapters.map(function (c) {
      // Object.keys below yields strings; a numeric baseline num must compare
      // equal to its own key or every chapter would be counted twice.
      return String(c.num);
    });
    Object.keys(actualByChapter)
      .concat(Object.keys(committed))
      .forEach(function (num) {
        if (chapterNums.indexOf(num) < 0) chapterNums.push(num);
      });
    chapterNums.forEach(function (num) {
      if (committed[num])
        costs.push({
          id: "cm_" + num,
          kind: "committed",
          chapter: num,
          description: "",
          amountCents: committed[num],
          date: erp.today,
        });
      if (actualByChapter[num])
        costs.push({
          id: "ac_" + num,
          kind: "actual",
          chapter: num,
          description: "",
          amountCents: actualByChapter[num],
          date: erp.today,
        });
    });
    return {
      id: p.id,
      name: p.code,
      customerRef: p.partyId,
      sourceQuoteId: p.budgetId || undefined,
      baselineCents: p.baseline.costCents,
      baselineByChapter: p.baseline.chapters.map(function (c) {
        return { chapter: c.num, budgetCents: c.costCents };
      }),
      revenueCents: economics.currentRevenueCents,
      costs: costs,
      changeOrders: erp.state.changes
        .filter(function (c) {
          return c.projectId === projectId;
        })
        .map(function (c) {
          return {
            id: c.id,
            chapter: c.chapterNum || "1",
            description: c.desc || "",
            deltaCents: c.costCents || 0,
            status: ["approved", "executed", "invoiced"].includes(c.status)
              ? "approved"
              : c.status === "rejected"
                ? "rejected"
                : "proposed",
            date: c.date || erp.today,
          };
        }),
      status: p.closed ? "closed" : "active",
      createdAt: p.dates && p.dates.start ? p.dates.start : erp.today,
    };
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

  var api = {
    /** False when the bundle failed to load; callers must degrade, not throw. */
    available: available,

    /** Surface version of the bundle, or null. Lets callers detect a stale artifact. */
    surfaceVersion: available ? F.SURFACE_VERSION : null,

    /* ---------------------------------------------------------------- *
     * Document capture — the INTERPRETATION half.
     *
     * `site/erp-ocr.js` turns a file into text; this turns that text into
     * candidate fields with a dot each. The split is deliberate: recognition
     * is 7 MB of browser infrastructure with no business meaning, and meaning
     * is domain code that must stay testable without a browser at all.
     *
     * Null when the bundle is missing, like every other surface here — a
     * capture screen must be able to say "manual entry only" rather than
     * throw.
     * ---------------------------------------------------------------- */
    extraction: extraction && {
      /** Recognised text in; fields, dots, provenance and checks out. */
      read: function (text, assumeIssueDate) {
        return extraction.read(text, assumeIssueDate);
      },
      /** Re-check after a person edits a value. Typed values are checked too. */
      recheck: function (result, corrections) {
        return extraction.recheck(result, corrections);
      },
      /** Which jurisdiction profile is bound. */
      profile: function () {
        return extraction.profile();
      },
    },

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

      /**
       * What each payment milestone's expected date WOULD be if it followed
       * the plan — money-chain item 14, the half that has to read a schedule.
       *
       * The mapping from a trigger to a date is the whole content:
       *
       *   atWorksStart  the plan's earliest planned start
       *   atStage       the end of the task the milestone names in `stageRef`
       *   onCompletion  the plan's finish
       *   onSignature   nothing — it is an event, not a date on a chart
       *   fixedDate     nothing — the engine refuses to move it anyway
       *
       * Returns a plain {idx: "YYYY-MM-DD"} map and writes nothing. Deciding
       * which of these may be applied belongs to `setInstallmentDates`, so a
       * proposal computed here can be shown to a person before it lands.
       */
      installmentDatesFromPlan: function (erp, projectId) {
        var out = {};
        try {
          if (!scheduling) return out;
          var project = erp.project(projectId);
          if (!project.contractId) return out;
          var contract = erp.state.contracts.find(function (c) {
            return c.id === project.contractId;
          });
          if (!contract) return out;
          // `api` rather than the ErpBridge global: this file is also
          // require()d in Node, where that global does not exist and the
          // ReferenceError would be swallowed by the catch below — a method
          // that silently returns nothing is worse than one that throws.
          var plan = api.scheduling.plans.get(erp.state, projectId);
          if (!plan || !plan.tasks || !plan.tasks.length) return out;
          var sch = api.scheduling.plans.schedule(plan);
          if (!sch) return out;
          var byId = {};
          (sch.tasks || plan.tasks).forEach(function (t) {
            byId[t.id] = t;
          });
          var starts = plan.tasks
            .map(function (t) {
              return (byId[t.id] && byId[t.id].plannedStart) || t.plannedStart;
            })
            .filter(Boolean)
            .sort();
          var start = starts[0] || null;
          contract.installments.forEach(function (i, idx) {
            if (i.trigger === "atWorksStart" && start) out[idx] = start;
            else if (i.trigger === "onCompletion" && sch.finish) out[idx] = sch.finish;
            else if (i.trigger === "atStage" && i.stageRef) {
              var t = plan.tasks.find(function (x) {
                return x.id === i.stageRef || x.sourceRef === i.stageRef;
              });
              var end = t && ((byId[t.id] && byId[t.id].plannedEnd) || t.plannedEnd);
              if (end) out[idx] = end;
            }
          });
        } catch (e) {
          return out;
        }
        return out;
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
        setProgress: function (plan, taskId, pct, asOf) {
          return scheduling.service.setProgress(plan, taskId, pct, asOf);
        },

        /** Progress recorded on the plan AND the budget chapter it came from. */
        recordProgress: function (erp, projectId, plan, taskId, pct, asOf) {
          return recordProgress(erp, projectId, plan, taskId, pct, asOf);
        },

        /**
         * Pull the budget's own chapter progress onto the plan's bars.
         *
         * The other direction of recordProgress, for when progress was entered
         * against a LINE — which is what a site actually reports, since nobody
         * knows what 40 % of a chapter is but everybody knows how many square
         * metres went up. The engine rolls the lines up into a chapter figure;
         * this carries that figure to the bar and writes it to the history, so
         * the curve sees the observation on the day it was made.
         */
        syncProgress: function (erp, projectId, plan, asOf) {
          if (!scheduling) return plan;
          var recorded = {};
          try {
            erp.chapterProgress(projectId).forEach(function (c) {
              recorded[c.num] = c.progressPct;
            });
          } catch (e) {
            return plan;
          }
          var next = plan;
          plan.tasks.forEach(function (t) {
            var m = /^group:(.+)$/.exec(t.sourceRef || "");
            if (!m || recorded[m[1]] == null || recorded[m[1]] === t.progressPct) return;
            next = scheduling.service.setProgress(next, t.id, recorded[m[1]], asOf || erp.today);
          });
          return next;
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

        /**
         * The real derivation from the accepted budget (§3.3, §4.3): chapters
         * and lines in, durations from quantity ÷ the pack's daily output,
         * dependencies chained, everything the site recorded preserved.
         * Returns {plan, notes, skipped} — the notes say how each duration was
         * arrived at, so the planner can see what was assumed.
         */
        fromBudget: function (erp, projectId, opts) {
          return planFromBudget(erp, projectId, opts);
        },

        /** Planned vs actual vs projected over time. See tracking.ts. */
        curve: function (plan, opts) {
          if (!scheduling || !plan.tasks.length) return null;
          return scheduling.service.progressCurve(plan, opts || {});
        },

        /** Which tasks are late, by how much, and whether the slip alerts. */
        risk: function (plan, opts) {
          if (!scheduling || !plan.tasks.length) return null;
          return scheduling.service.riskReport(plan, opts || {});
        },

        /** Calendar arithmetic for the chart's axis and its drag maths. */
        calendar: scheduling ? scheduling.calendar : null,

        /**
         * Apply an approved change order's schedule effect to the derived bar
         * for its chapter (§4.5: "actualiza ... la carta Gantt conservando la
         * línea base original").
         *
         * Deliberately a separate, explicit action rather than something
         * approveChange triggers on its own: the engine's approval only ever
         * touches the budget's own numbers, and folding a Gantt mutation into
         * that call would make one action responsible for two systems of
         * record. The baseline is "conserved" for free — a baseline is a
         * frozen snapshot in plan.baselines, and setDuration never touches it.
         * No-ops (returns the plan unchanged) when the chapter has no bar yet.
         */
        applyChapterDelay: function (plan, chapterNum, deltaDays) {
          if (!scheduling || !deltaDays) return plan;
          var task = plan.tasks.find(function (t) {
            return t.sourceRef === "group:" + chapterNum;
          });
          if (!task) return plan;
          var cal = plan.calendar || DEFAULT_CALENDAR;
          var current =
            typeof task.durationDays === "number"
              ? task.durationDays
              : scheduling.calendar.workingDaysInclusive(cal, task.plannedStart, task.plannedEnd);
          return scheduling.service.setDuration(plan, task.id, Math.max(1, current + deltaDays));
        },
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

    /* ------------------------------------------------------------------ *
     * Project economics: cost at completion (spec §4.4 "Proyección").
     *
     * @repo/capability-projects does the arithmetic; this file only projects
     * the engine's project into its value shape and puts the stored human
     * overrides beside it. The engine keeps reporting what HAS happened
     * (projectEconomics); this reports what it implies.
     * ------------------------------------------------------------------ */
    projects: {
      forecast: function (erp, projectId, opts) {
        if (!projects) return null;
        var p = erp.project(projectId);
        var overrides = [];
        var stored = p.forecastOverrides || {};
        Object.keys(stored).forEach(function (chapter) {
          overrides.push({
            chapter: chapter,
            costCents: stored[chapter].costCents,
            reason: stored[chapter].reason,
            at: stored[chapter].at,
            by: stored[chapter].by,
          });
        });
        return projects.forecast(projectValue(erp, projectId), {
          progress: erp.chapterProgress(projectId).map(function (c) {
            return { chapter: c.num, progressPct: c.progressPct };
          }),
          overrides: overrides,
          overrunThresholdBp: opts && opts.overrunThresholdBp,
          minProgressPct: opts && opts.minProgressPct,
        });
      },
    },

    /* ------------------------------------------------------------------ *
     * Bank reconciliation (spec §5.3).
     *
     * @repo/capability-reconciliation scores; this file decides what a
     * candidate IS. Money out looks at supplier bills and money in at issued
     * invoices — a distinction only the engine layer can make, which is
     * exactly why the capability does not try to.
     * ------------------------------------------------------------------ */
    reconciliation: {
      available: !!recon,
      /** Suggestions for one movement, best first. [] when the bundle is absent. */
      suggest: function (erp, movId) {
        if (!recon) return [];
        return recon.suggest(
          erp.movementValue(
            erp.state.movements.find(function (m) {
              return m.id === movId;
            }),
          ),
          erp.reconciliationCandidates(movId),
        );
      },
      /** Suggestions for every still-unexplained movement in a window. */
      suggestAll: function (erp, from, to) {
        if (!recon) return {};
        var out = {};
        erp.unreconciledMovements(from, to).forEach(function (m) {
          var s = recon.suggest(erp.movementValue(m), erp.reconciliationCandidates(m.id));
          if (s.length) out[m.id] = s;
        });
        return out;
      },
      /**
       * Pairs that are one transfer between the tenant's own accounts. Left
       * unlabelled these are counted twice — once as income, once as expense —
       * and every figure downstream is wrong in a way that still reconciles.
       */
      internalTransfers: function (erp, from, to) {
        if (!recon) return [];
        return recon.internalTransfers(
          erp.state.movements
            .filter(function (m) {
              return (
                !m.excludedFromPL &&
                (!from || m.accountingDate >= from) &&
                (!to || m.accountingDate <= to)
              );
            })
            .map(function (m) {
              return erp.movementValue(m);
            }),
        );
      },
      /** The confidence at or above which the view may offer one-click accept. */
      autoAcceptScore: recon ? recon.config.autoAcceptScore : 1,
    },

    /* ------------------------------------------------------------------ *
     * Communications (spec §5.7).
     *
     * The capability plans and renders; the engine stores templates, rules and
     * the queue. NOTHING here sends: `email-out@1`'s only bound adapter is the
     * log-only outbox, and the mandate's "no real emails" is a property of the
     * whole path rather than a promise made at one layer.
     * ------------------------------------------------------------------ */
    comms: {
      available: !!comms,
      /** Fill a template's `{{tokens}}`; unknown ones stay visible. */
      render: function (text, vars) {
        if (!comms) return text;
        return comms.render(text || "", vars || {});
      },
      /**
       * What the rules say should be queued that is not queued already.
       * Recomputed from current state, so a rule added today still sees the
       * invoice that went overdue last week.
       */
      pending: function (erp) {
        if (!comms) return [];
        var planned = comms.plan(erp.state.commsRules || [], erp.commsEvents(), erp.today);
        var existing = (erp.state.commsQueue || []).map(function (q) {
          return q.key;
        });
        return comms.unseen(planned, existing);
      },
      /** Everything the rules would produce, ignoring the queue — §5.7's simulation mode. */
      simulate: function (erp, rules) {
        if (!comms) return [];
        return comms.plan(rules || erp.state.commsRules || [], erp.commsEvents(), erp.today);
      },
    },

    /** Exposed for tests and the parity harness; not for view code. */
    _projections: {
      tasksToPlan: tasksToPlan,
      annexImagesOf: annexImagesOf,
      workBreakdownOf: workBreakdownOf,
      projectValue: projectValue,
    },
  };

  return api;
});
