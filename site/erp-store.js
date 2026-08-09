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

  /* ==================================================================== *
   * WHERE THE DOCUMENT LIVES
   *
   * Two modes, decided once at load:
   *
   *   local   — IndexedDB in this browser. Opening the files directly, and the
   *             published read-only copies, still work exactly as before.
   *   remote  — the server, over /api/<tenant>/erp/state. The document is the
   *             company's, so every device sees the same one.
   *
   * The switch is the PRESENCE of a <meta name="erp-api"> tag (or ?api=), which
   * the server injects into the pages it serves and nothing else does. Presence,
   * not value: an empty value means "same origin", which is the normal case
   * because the server serves these pages and the API together — no CORS, and
   * one session cookie covers both.
   *
   * This lives in the store rather than in each page on purpose. Every screen
   * already reads and writes through ErpStore, so putting the decision here
   * moves ALL of them onto the server at once, without a line changing in any
   * page — which also means the UI cannot drift into talking to two different
   * places depending on which screen you are on.
   *
   * Tenant is "~", not a name: the server resolves it from the session to the
   * company that session is entitled to. A client that names its own tenant is
   * a client that can ask for somebody else's.
   * ==================================================================== */
  var SELF_TENANT = "~";

  function apiBase() {
    try {
      var params = new URLSearchParams(location.search);
      if (params.has("api")) return (params.get("api") || "").replace(/\/$/, "");
      var m = document.querySelector('meta[name="erp-api"]');
      if (m) return (m.getAttribute("content") || "").replace(/\/$/, "");
      return null;
    } catch (e) {
      return null;
    }
  }

  var REMOTE = typeof document !== "undefined" ? apiBase() : null;

  /* The version this browser last read. It is quoted on every save, and the
     server refuses a save built on a stale one. That refusal is the entire
     reason two people can use this at the same time. */
  var remoteVersion = 0;

  function stateUrl() {
    return REMOTE + "/api/" + SELF_TENANT + "/erp/state";
  }

  /**
   * Notice when somebody else changed the register.
   *
   * The page reads the document once and then shows it, which was fine while
   * the document lived in this browser and only this browser could change it.
   * With the document on the server and the same company using a phone and a
   * laptop, a page that never re-reads is a page that is confidently wrong —
   * which is exactly what the operator hit: data entered on the phone was not
   * on the laptop until they reloaded by hand.
   *
   * Registered here rather than in each page, for the same reason the
   * local/remote decision lives here: one place, and every screen gets it.
   * `erp-sync.js` is optional — a page without it simply does not watch, and
   * the published read-only copies have no server to watch anyway.
   */
  var watching = false;

  function watchRemote() {
    if (REMOTE === null || watching) return;
    watching = true;
    // Looked up by name and guarded: this module is also loaded under Node by
    // the simulations, where there is no such global and no page to refresh.
    var sync = typeof ErpSync !== "undefined" ? ErpSync : null;
    if (!sync || typeof sync.watch !== "function") return;
    sync.watch(
      "state",
      function () {
        return remoteVersion;
      },
      function (serverVersion, info) {
        sync.react(info);
      },
    );
  }

  /**
   * Tell the operator when a save did not reach the server.
   *
   * `persist()` in the workspace is fire-and-forget (`.catch(() => {})`), which
   * is correct for a local database that does not fail, and quietly wrong for a
   * network that does. Without this, a lost connection or a conflicting save
   * looks exactly like a successful one: the form closes, the row is on screen,
   * and the record is nowhere. So the store raises it itself rather than hoping
   * every call site remembers to.
   */
  function saveFailed(title, detail) {
    try {
      if (document.getElementById("canei-save-failed")) return;
      var bar = document.createElement("div");
      bar.id = "canei-save-failed";
      bar.setAttribute(
        "style",
        "position:fixed;left:0;right:0;top:0;z-index:2147483000;background:#8f2d1b;color:#fff;" +
          "font:600 13.5px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;" +
          "padding:12px 16px;display:flex;gap:12px;align-items:center;justify-content:center;" +
          "flex-wrap:wrap;text-align:center;box-shadow:0 6px 18px rgba(0,0,0,.25)",
      );
      var msg = document.createElement("span");
      msg.innerHTML =
        "⚠️ <b>" + title + "</b> " + (detail || "") + " Sus últimos cambios NO están guardados.";
      bar.appendChild(msg);
      var again = document.createElement("button");
      again.textContent = "Recargar";
      again.setAttribute(
        "style",
        "background:#fff;color:#8f2d1b;border:0;font-weight:800;padding:7px 14px;" +
          "border-radius:999px;cursor:pointer",
      );
      again.onclick = function () {
        location.reload();
      };
      bar.appendChild(again);
      document.body.appendChild(bar);
    } catch (e) {
      /* never let the notifier be the thing that breaks the page */
    }
  }

  function remoteLoadState() {
    return fetch(stateUrl(), {
      credentials: "same-origin",
      headers: { accept: "application/json" },
    })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (body) {
        remoteVersion = body.version || 0;
        // Only after a successful read: watching before we know our own version
        // would compare the server against zero and refresh immediately.
        watchRemote();
        // The server migrates on the way out, so the ladder does NOT run again
        // here. It is pure and idempotent, but running it per client means
        // running it a different number of times per person, which is not a
        // property worth having in an invoice register.
        //
        // An empty company comes back as a valid empty document, not null.
        // Returning null would make the workspace seed its demonstration data —
        // onto the live server, into the real register. Empty and honest beats
        // populated and fictional.
        return { state: body.state || null, migration: null, remote: true };
      });
  }

  function remoteSaveState(state) {
    return fetch(stateUrl(), {
      method: "PUT",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ state: state, expectedVersion: remoteVersion }),
    })
      .then(function (r) {
        return r.json().then(function (body) {
          return { ok: r.ok, status: r.status, body: body };
        });
      })
      .then(function (res) {
        if (res.ok) {
          remoteVersion = res.body.version;
          return res.body;
        }
        if (res.status === 409) {
          saveFailed(
            "Otra persona ha guardado antes que usted.",
            "Recargue para ver sus cambios y vuelva a introducir los suyos.",
          );
        } else if (res.status === 401) {
          saveFailed("Su sesión ha caducado.", "Vuelva a iniciar sesión.");
        } else {
          saveFailed(
            "No se ha podido guardar en el servidor.",
            (res.body && res.body.message) || "",
          );
        }
        throw new Error("save refused: HTTP " + res.status);
      })
      .catch(function (e) {
        // A network failure never reaches the branch above — it rejects before
        // there is a response at all — so it is caught here rather than being
        // mistaken for a successful save.
        if (String(e && e.message).indexOf("save refused") !== 0) {
          saveFailed("Sin conexión con el servidor.", "");
        }
        throw e;
      });
  }

  /* ------------------------------------------------------------------ *
   * Attachments (the site photographs)
   *
   * These were the last thing still living only in the browser, and the way
   * they failed is worth remembering: the quote LINE referencing a photograph
   * synced to every device perfectly, and the photograph did not. The laptop
   * rendered "(imagen no disponible)" for a picture that plainly existed on the
   * phone that took it. Nothing errored, because from each device's point of
   * view nothing had gone wrong — the state blob held a `storageKey`, and the
   * bytes behind it existed on exactly one machine, in a browser store no
   * backup ever saw.
   *
   * Bytes on the wire rather than base64 in JSON: these go straight into an
   * <img>, and base64 costs a third more storage plus a decode on every read.
   * ------------------------------------------------------------------ */

  function blobUrl(key) {
    return REMOTE + "/api/" + SELF_TENANT + "/erp/blob/" + encodeURIComponent(key);
  }

  function remotePutBlob(key, blob) {
    return fetch(blobUrl(key), {
      method: "PUT",
      credentials: "same-origin",
      headers: { "content-type": blob.type || "application/octet-stream" },
      body: blob,
    })
      .then(function (r) {
        if (r.ok) return r.json();
        return r.json().then(
          function (b) {
            throw new Error((b && b.message) || "HTTP " + r.status);
          },
          function () {
            throw new Error("HTTP " + r.status);
          },
        );
      })
      .catch(function (e) {
        // Loud, because the alternative is a photograph the operator believes
        // they filed. The line referencing it would still save.
        saveFailed("No se ha podido subir la imagen.", (e && e.message) || "");
        throw e;
      });
  }

  function remoteGetBlob(key) {
    return fetch(blobUrl(key), { credentials: "same-origin" }).then(function (r) {
      if (r.status === 404) return null; // a missing picture is not an error
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.blob();
    });
  }

  function remoteDeleteBlob(key) {
    return fetch(blobUrl(key), { method: "DELETE", credentials: "same-origin" }).then(function (r) {
      if (!r.ok && r.status !== 404) throw new Error("HTTP " + r.status);
    });
  }

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
    if (REMOTE !== null) return remoteLoadState();
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
    if (REMOTE !== null) return remoteSaveState(state);
    return put(KV, STATE_KEY, state);
  }

  /* ------------------------------------------------------------------ *
   * One-way import of the legacy master-data store
   * ------------------------------------------------------------------ */

  function norm(s) {
    return (
      String(s || "")
        .toLowerCase()
        .normalize("NFD")
        // \u-escaped, not the literal combining marks. Written literally, this
        // range is a run of non-ASCII bytes whose meaning depends on the encoding
        // the script happens to be read as — and a <script src> with no charset
        // of its own inherits the DOCUMENT's. Serve this file to a page that
        // forgets <meta charset>, or through anything that re-encodes it, and the
        // range becomes "Range out of order in character class": a hard
        // SyntaxError that takes the whole module with it, on a line about
        // accents. ASCII escapes cannot be mangled.
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim()
    );
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
        conflicts.push({
          source: LEGACY_MASTER_DB,
          ref: c.code || "",
          label: label,
          reason: "sinNombre",
        });
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
    /**
     * True when the document lives on the server.
     *
     * Callers need this for one reason above all: what to do when loading
     * FAILS. Locally, falling back to a fresh seeded document is right — there
     * is nothing to lose and a blank page helps nobody. Remotely it is the
     * worst possible move, because the next debounced save would PUT that
     * demonstration data straight over the company's register. A dropped
     * connection must not be able to erase an invoice register.
     */
    isRemote: function () {
      return REMOTE !== null;
    },
    /**
     * Where the server is, for the few screens that call an endpoint this
     * store does not wrap — DMC-08 Usuarios, whose records are not part of the
     * company document.
     *
     * Exposed rather than letting those screens read the <meta> tag
     * themselves. sync-workspace.mjs decides a page is already marked by
     * looking for that exact string, so a page that merely MENTIONS it gets
     * skipped and ends up served without the marker — which silently drops it
     * to browser storage. Asked for once, here, that cannot happen.
     */
    apiBase: function () {
      return REMOTE;
    },
    /** The version this browser last read; the server refuses a stale save. */
    version: function () {
      return remoteVersion;
    },
    open: open,
    loadState: loadState,
    saveState: saveState,
    putBlob: function (k, blob) {
      return REMOTE !== null ? remotePutBlob(k, blob) : put(BLOBS, k, blob);
    },
    getBlob: function (k) {
      return REMOTE !== null ? remoteGetBlob(k) : get(BLOBS, k);
    },
    deleteBlob: function (k) {
      return REMOTE !== null ? remoteDeleteBlob(k) : del(BLOBS, k);
    },
    /**
     * Where a stored attachment can be fetched from directly, or null when it
     * lives in this browser and has no address.
     *
     * Worth having rather than always going through `getBlob`: an <img src>
     * pointed at this streams and caches like any other image, whereas
     * downloading the bytes to build an object URL holds every picture on the
     * screen in memory for as long as the page is open.
     */
    blobUrl: function (k) {
      return REMOTE !== null ? blobUrl(k) : null;
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
