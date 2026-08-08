/* =============================================================================
   ErpDocs — the per-screen documents, on the server when there is one.

   Master Data, Financial Data and the project folder each grew their own tiny
   IndexedDB helper: `idb()`, `idbGet(k)`, `idbSet(k, v)`, one database each.
   That is why a customer entered in Master Data on a laptop was not on the
   phone — it had never left the laptop, and nothing said so, because from the
   page's point of view the save succeeded.

   This keeps that exact shape:

       var store = ErpDocs.open("caneiMasterData");
       await store.get("data");        // was idbGet("data")
       await store.set("data", DATA);  // was idbSet("data", DATA)
       await store.del("k");

   so the pages change by three lines each and not one pixel. Where it goes is
   decided the same way as the ERP register, by the presence of the
   <meta name="erp-api"> tag the server injects:

       remote — /api/~/erp/doc/<database>, the company's copy, shared
       local  — IndexedDB, exactly as before, so the read-only published copies
                and opening the files directly still work

   The whole document is read once and written on change, which is what the
   pages already did to IndexedDB. The version the server returned is quoted on
   every write, so a save built on a stale read is REFUSED rather than silently
   overwriting somebody. On refusal the operator is told — a failed save that
   looks like a successful one is the failure this module exists to end.
   ========================================================================== */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ErpDocs = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

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

  function notify(title, detail) {
    try {
      if (document.getElementById("canei-doc-save-failed")) return;
      var bar = document.createElement("div");
      bar.id = "canei-doc-save-failed";
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
      /* the notifier must never be what breaks the page */
    }
  }

  /* ---------------------------------------------------------------- *
   * local — the original IndexedDB helper, unchanged in behaviour
   * ---------------------------------------------------------------- */
  function localStore(dbName, storeName) {
    function open() {
      return new Promise(function (res, rej) {
        var r = indexedDB.open(dbName, 1);
        r.onupgradeneeded = function () {
          if (!r.result.objectStoreNames.contains(storeName)) r.result.createObjectStore(storeName);
        };
        r.onsuccess = function () {
          res(r.result);
        };
        r.onerror = function () {
          rej(r.error);
        };
      });
    }
    function tx(mode, fn) {
      return open().then(function (db) {
        return new Promise(function (res, rej) {
          var rq = fn(db.transaction(storeName, mode).objectStore(storeName));
          rq.onsuccess = function () {
            res(rq.result);
          };
          rq.onerror = function () {
            rej(rq.error);
          };
        });
      });
    }
    return {
      isRemote: function () {
        return false;
      },
      get: function (k) {
        return tx("readonly", function (s) {
          return s.get(k);
        });
      },
      set: function (k, v) {
        return tx("readwrite", function (s) {
          return s.put(v, k);
        });
      },
      del: function (k) {
        return tx("readwrite", function (s) {
          return s.delete(k);
        });
      },
    };
  }

  /* ---------------------------------------------------------------- *
   * remote — one document on the server, read once, written on change
   * ---------------------------------------------------------------- */
  function remoteStore(dbName) {
    var url = REMOTE + "/api/" + SELF_TENANT + "/erp/doc/" + encodeURIComponent(dbName);
    var doc = null; // the whole document, once loaded
    var version = 0;
    var loading = null;
    var watching = false;

    function load() {
      if (doc) return Promise.resolve(doc);
      if (loading) return loading;
      loading = fetch(url, {
        credentials: "same-origin",
        headers: { accept: "application/json" },
      })
        .then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.json();
        })
        .then(function (body) {
          version = body.version || 0;
          doc = body.doc && typeof body.doc === "object" ? body.doc : {};
          watch();
          return doc;
        });
      return loading;
    }

    /**
     * Notice when this document changed somewhere else.
     *
     * Master Data entered on the phone used to sit on the server unseen by a
     * laptop whose page had already loaded — the same staleness as the main
     * register, and worse here, because these screens are exactly the ones
     * somebody fills in on one device and reads on another.
     *
     * Registered after the first successful read, so the comparison is against
     * a version we actually hold rather than against zero. `erp-sync.js` is
     * optional: without it the page behaves exactly as it did before.
     */
    function watch() {
      if (watching) return;
      var sync = typeof ErpSync !== "undefined" ? ErpSync : null;
      if (!sync || typeof sync.watch !== "function") return;
      watching = true;
      sync.watch(
        dbName,
        function () {
          return version;
        },
        function (serverVersion, info) {
          sync.react(info);
        },
      );
    }

    function flush() {
      return fetch(url, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ doc: doc, expectedVersion: version }),
      })
        .then(function (r) {
          return r.json().then(function (b) {
            return { ok: r.ok, status: r.status, body: b };
          });
        })
        .then(function (res) {
          if (res.ok) {
            version = res.body.version;
            return;
          }
          if (res.status === 409) {
            notify(
              "Otra persona ha guardado antes que usted.",
              "Recargue para ver sus cambios y vuelva a introducir los suyos.",
            );
          } else if (res.status === 401) {
            notify("Su sesión ha caducado.", "Vuelva a iniciar sesión.");
          } else {
            notify("No se ha podido guardar en el servidor.", (res.body && res.body.message) || "");
          }
          throw new Error("save refused: HTTP " + res.status);
        })
        .catch(function (e) {
          // A network failure rejects before there is any response, so it never
          // reaches the branch above and must be caught here — otherwise it is
          // indistinguishable from a save that worked.
          if (String(e && e.message).indexOf("save refused") !== 0) {
            notify("Sin conexión con el servidor.", "");
          }
          throw e;
        });
    }

    return {
      isRemote: function () {
        return true;
      },
      get: function (k) {
        return load().then(function (d) {
          return d[k];
        });
      },
      set: function (k, v) {
        return load().then(function (d) {
          d[k] = v;
          return flush();
        });
      },
      del: function (k) {
        return load().then(function (d) {
          delete d[k];
          return flush();
        });
      },
    };
  }

  return {
    isRemote: function () {
      return REMOTE !== null;
    },
    /** `storeName` is only used locally; remotely there is one document. */
    open: function (dbName, storeName) {
      return REMOTE !== null ? remoteStore(dbName) : localStore(dbName, storeName || "kv");
    },
  };
});
