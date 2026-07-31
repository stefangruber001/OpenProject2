/* =============================================================================
   ErpStore — the one place that talks to IndexedDB.

   Every page that reads the company dataset must go through here. That is not
   tidiness: IndexedDB versions are per-database, so if erp.html opened
   "caneiERP" at v2 while index.html still opened it at v1, the home page would
   throw VersionError and show nothing. One module, one version number.

   Database "caneiERP", version 2:
     kv     — the whole ERP state under "state" (UNCHANGED coordinates: every
              existing user's data is already there and must keep working),
              plus one-shot pre-migration backups under "state.backup.v<n>"
     blobs  — binary attachments keyed by storageKey                    [v2]
     meta   — small bookkeeping values, kept out of the state blob      [v2]

   The blobs store exists because the state blob is re-serialised on a 140 ms
   debounce. Putting images in it would serialise megabytes on every keystroke;
   the symptom reads as "the ERP is slow", not "we stored a JPEG wrong". So:
   binary lives in `blobs`, state holds storageKey strings only.
   ========================================================================== */
(function (root, factory) {
  if (typeof module === "object" && module.exports)
    module.exports = factory(require("./erp-migrations.js"));
  else root.ErpStore = factory(root.ErpMigrations);
})(typeof globalThis !== "undefined" ? globalThis : this, function (Migrations) {
  "use strict";

  var DB = "caneiERP";
  var DB_VERSION = 2;
  var KV = "kv";
  var BLOBS = "blobs";
  var META = "meta";
  var STATE_KEY = "state";

  var LEGACY_MASTER_DB = "caneiMasterData";

  function open() {
    return new Promise(function (res, rej) {
      var r = indexedDB.open(DB, DB_VERSION);
      r.onupgradeneeded = function (ev) {
        var db = r.result;
        // Never touch an existing store: v1 users already have `kv` populated.
        if (!db.objectStoreNames.contains(KV)) db.createObjectStore(KV);
        if (!db.objectStoreNames.contains(BLOBS)) db.createObjectStore(BLOBS);
        if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
        void ev;
      };
      r.onsuccess = function () {
        res(r.result);
      };
      r.onerror = function () {
        rej(r.error);
      };
    });
  }

  function tx(storeName, mode, fn) {
    return open().then(function (db) {
      return new Promise(function (res, rej) {
        var store = db.transaction(storeName, mode).objectStore(storeName);
        var req = fn(store);
        req.onsuccess = function () {
          res(req.result);
        };
        req.onerror = function () {
          rej(req.error);
        };
      });
    });
  }

  var get = function (s, k) {
    return tx(s, "readonly", function (o) {
      return o.get(k);
    });
  };
  var put = function (s, k, v) {
    return tx(s, "readwrite", function (o) {
      return o.put(v, k);
    });
  };
  var del = function (s, k) {
    return tx(s, "readwrite", function (o) {
      return o.delete(k);
    });
  };

  /**
   * Reads the stored state, runs the migration ladder, and persists the
   * result. Returns {state, migration} — or {state:null} when nothing is
   * stored yet, so the caller can seed.
   *
   * A one-shot copy of the pre-migration blob is written to
   * "state.backup.v<from>" before anything is changed. One line, and it turns
   * a catastrophic migration bug into a support conversation.
   */
  function loadState() {
    return get(KV, STATE_KEY).then(function (raw) {
      if (!raw) return { state: null, migration: null };

      var result = Migrations.migrate(raw); // throws if the blob is newer
      if (!result.applied.length) return { state: result.state, migration: result };

      return put(KV, "state.backup.v" + result.from, raw)
        .then(function () {
          return put(KV, STATE_KEY, result.state);
        })
        .then(function () {
          return { state: result.state, migration: result };
        });
    });
  }

  function saveState(state) {
    return put(KV, STATE_KEY, state);
  }

  /* ------------------------------------------------------------------ *
   * One-way import of the legacy master-data store
   * ------------------------------------------------------------------ */

  function norm(s) {
    return String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  /** Opens a legacy DB read-only WITHOUT creating or upgrading it. */
  function readLegacy(dbName, storeName, key) {
    return new Promise(function (res) {
      var r;
      try {
        r = indexedDB.open(dbName); // no version: never upgrades, never creates stores
      } catch (e) {
        return res(null);
      }
      r.onupgradeneeded = function () {
        // The database did not exist. Abort rather than leave an empty shell.
        try {
          r.transaction.abort();
        } catch (e) {
          /* ignore */
        }
        res(null);
      };
      r.onerror = function () {
        res(null);
      };
      r.onsuccess = function () {
        var db = r.result;
        if (!db.objectStoreNames.contains(storeName)) return res(null);
        try {
          var q = db.transaction(storeName, "readonly").objectStore(storeName).get(key);
          q.onsuccess = function () {
            res(q.result || null);
          };
          q.onerror = function () {
            res(null);
          };
        } catch (e) {
          res(null);
        }
      };
    });
  }

  /**
   * Maps a legacy master-data customer row onto the engine's party shape.
   * Field-for-field and deliberately dumb — anything requiring judgement is
   * a conflict, not a guess.
   */
  function customerToParty(c) {
    var status = String(c.status || "").toLowerCase();
    return {
      name: c.legalName || "",
      taxId: c.nif || "",
      partyType: c.type === "B2C" ? "individual" : "company",
      roles: ["customer"],
      contactPerson: c.contact || "",
      email: c.email || "",
      mobile: c.phone || "",
      billStreet: c.billAddress || "",
      billPostalCode: c.billPc || "",
      billCity: c.billCity || "",
      leadSource: c.source || "",
      notes: c.notes || "",
      active: status !== "inactive" && status !== "blocked",
    };
  }

  /**
   * Folds legacy `caneiMasterData` customers into the ERP party register.
   *
   * Non-destructive and one-way by design:
   *   - the source database is never written to and never deleted;
   *   - it runs once (recorded in state.imports) and is then a no-op;
   *   - anything ambiguous lands in state.importConflicts for a human, and is
   *     NEVER auto-merged. Silently overwriting a field a person typed is the
   *     one failure mode that would destroy trust in the dataset.
   *
   * `erp` is the live engine instance; parties are added through addParty so
   * validation, coding and the audit trail all fire normally.
   */
  /**
   * The decision logic, synchronous and free of IndexedDB — this is the part
   * that can damage a real dataset, so it is kept directly testable. The async
   * wrapper below only supplies the data.
   */
  function applyLegacyCustomers(erp, data) {
    var state = erp.state;
    if (state.imports && state.imports[LEGACY_MASTER_DB]) {
      return { ran: false, imported: 0, conflicts: 0, rows: 0 };
    }

    var rows = (data && data.customers) || [];
    if (!state.imports) state.imports = {};
    if (!Array.isArray(state.importConflicts)) state.importConflicts = [];

    var imported = 0;
    var conflicts = [];

    rows.forEach(function (c) {
      var candidate = customerToParty(c);
      var label = candidate.name || c.code || "(sin nombre)";

      if (!candidate.name) {
        conflicts.push({ source: LEGACY_MASTER_DB, ref: c.code || "", label: label, reason: "sinNombre" });
        return;
      }
      // Already present? Match the engine's own notion of duplicate.
      var existing = state.parties.filter(function (p) {
        return (
          p.active &&
          ((candidate.taxId && p.taxId === candidate.taxId) ||
            (candidate.name && norm(p.name) === norm(candidate.name)))
        );
      })[0];
      if (existing) {
        conflicts.push({
          source: LEGACY_MASTER_DB,
          ref: c.code || "",
          label: label,
          reason: "yaExiste",
          existingCode: existing.code,
        });
        return;
      }
      try {
        erp.addParty(candidate, "import");
        imported += 1;
      } catch (e) {
        // addParty enforces MDM-03 (tax id validity, duplicate tax id). One bad
        // row must never abort the rest of the import.
        conflicts.push({
          source: LEGACY_MASTER_DB,
          ref: c.code || "",
          label: label,
          reason: "rechazado",
          detail: String((e && e.message) || e).slice(0, 140),
        });
      }
    });

    state.importConflicts = state.importConflicts.concat(conflicts);
    state.imports[LEGACY_MASTER_DB] = {
      at: state.today,
      rows: rows.length,
      imported: imported,
      conflicts: conflicts.length,
    };
    return { ran: true, imported: imported, conflicts: conflicts.length, rows: rows.length };
  }

  function importLegacyMasterData(erp, opts) {
    if (erp.state.imports && erp.state.imports[LEGACY_MASTER_DB]) {
      return Promise.resolve({ ran: false, imported: 0, conflicts: 0, rows: 0 });
    }
    // The reader is injectable so tests can drive the logic without IndexedDB.
    var read =
      (opts && opts.read) ||
      function () {
        return readLegacy(LEGACY_MASTER_DB, "kv", "data");
      };
    return Promise.resolve(read()).then(function (data) {
      return applyLegacyCustomers(erp, data);
    });
  }

  return {
    DB: DB,
    DB_VERSION: DB_VERSION,
    STATE_KEY: STATE_KEY,
    open: open,
    loadState: loadState,
    saveState: saveState,
    putBlob: function (k, blob) {
      return put(BLOBS, k, blob);
    },
    getBlob: function (k) {
      return get(BLOBS, k);
    },
    deleteBlob: function (k) {
      return del(BLOBS, k);
    },
    getMeta: function (k) {
      return get(META, k);
    },
    setMeta: function (k, v) {
      return put(META, k, v);
    },
    importLegacyMasterData: importLegacyMasterData,
    /** Synchronous core of the import — used directly by tests/simulation/import-sim.mjs. */
    applyLegacyCustomers: applyLegacyCustomers,
    _internals: { customerToParty: customerToParty, readLegacy: readLegacy },
  };
});
