/* =============================================================================
   ErpBackend — where the company's data lives, as far as the UI is concerned.

   The workspace used to do two things at once: call an engine method, then
   write the whole state to IndexedDB. That works exactly as long as there is
   one person with one browser. The moment the data is shared, "apply locally,
   then save the whole document" means whoever saves last wins and nobody is
   told — which for an invoice register is not a bug, it is a lost afternoon.

   So the UI now issues COMMANDS, and a backend decides where they run:

     local  — the engine in this tab, persisted to IndexedDB via ErpStore.
              The offline demo, and what site/*.html has always been.
     remote — the engine on the server, persisted to PostgreSQL. Commands are
              POSTed with the version they were composed against, so a stale
              write is REFUSED rather than silently applied.

   Both expose the same three calls, so `erp.html` has one code path:

     load()                     → {erp, version, notice}
     command(name, args, opts)  → {erp, version, result}
     isRemote()

   Selecting the backend: a <meta name="erp-api"> tag, or `?api=` in the URL.
   PRESENCE is the signal, not the value — an empty value means "same origin",
   which is the normal case, because the server serves this page and its API
   together. Same origin is not a detail: it avoids CORS entirely and, when
   real accounts land, means one cookie covers the workspace and the API.

   With neither, it stays local — so opening the file directly still works and
   the published static site is unaffected.
   ========================================================================== */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ErpBackend = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /* The user recorded against local edits. On the server this is ignored and
     the session's identity is used instead — a name the client sends is a
     claim, not an identity. */
  var LOCAL_USER = "backoffice";

  /** Returns the API base ("" = same origin), or null to stay local. */
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

  /* ------------------------------------------------------------------ *
   * local — the engine in this tab
   * ------------------------------------------------------------------ */
  function LocalBackend() {
    this.erp = null;
    this.version = 0;
  }
  LocalBackend.prototype.isRemote = function () {
    return false;
  };
  LocalBackend.prototype.load = function () {
    var self = this;
    return ErpStore.loadState().then(function (loaded) {
      var notice = "";
      if (loaded.state) {
        self.erp = ErpEngine.ERP.from(loaded.state);
        if (loaded.migration && loaded.migration.applied.length)
          notice =
            "Datos actualizados al formato v" +
            loaded.migration.to +
            " (copia de seguridad guardada).";
      } else {
        self.erp = ErpSeed.build();
        // Nothing stored yet: write the seed so a reload finds it.
        ErpStore.saveState(self.erp.toJSON());
      }
      return { erp: self.erp, version: 0, notice: notice };
    });
  };
  LocalBackend.prototype.command = function (name, args) {
    var self = this;
    // Synchronous, but promised, so callers do not branch on the backend.
    return new Promise(function (res, rej) {
      var result;
      try {
        result = self.erp[name].apply(self.erp, (args || []).concat([LOCAL_USER]));
      } catch (e) {
        return rej(e);
      }
      ErpStore.saveState(self.erp.toJSON()).then(
        function () {
          res({ erp: self.erp, version: 0, result: result });
        },
        function (e) {
          // Storage failures used to be swallowed. On IndexedDB that was
          // survivable; as a habit it is how people lose work without being
          // told. Surface it.
          rej(
            new Error("No se han podido guardar los cambios: " + (e && e.message ? e.message : e)),
          );
        },
      );
    });
  };

  /* ------------------------------------------------------------------ *
   * remote — the engine on the server
   * ------------------------------------------------------------------ */
  function RemoteBackend(base, tenant) {
    this.base = base;
    this.tenant = tenant;
    this.erp = null;
    this.version = 0;
  }
  RemoteBackend.prototype.isRemote = function () {
    return true;
  };
  RemoteBackend.prototype._url = function (path, query) {
    return this.base + "/api/" + encodeURIComponent(this.tenant) + "/erp" + path + (query || "");
  };

  /** Turns a failed response into an Error carrying the server's own wording. */
  RemoteBackend.prototype._fail = function (res, body) {
    var msg = (body && body.message) || "Error " + res.status;
    // Strip the "[CODE] " prefix the server puts on FactoryError messages;
    // the code is on the object, and the user does not need to read it twice.
    var e = new Error(String(msg).replace(/^\[[A-Z_]+\]\s*/, ""));
    e.code = (body && body.error) || "HTTP_" + res.status;
    e.status = res.status;
    if (body && typeof body.currentVersion === "number") e.currentVersion = body.currentVersion;
    return e;
  };

  RemoteBackend.prototype.load = function () {
    var self = this;
    return fetch(this._url("/state"), { headers: { accept: "application/json" } })
      .then(function (res) {
        return res.json().then(function (body) {
          if (!res.ok) throw self._fail(res, body);
          return body;
        });
      })
      .then(function (body) {
        self.version = body.version;
        self.erp = ErpEngine.ERP.from(body.state);
        return {
          erp: self.erp,
          version: body.version,
          notice: body.seeded ? "" : "Sin datos todavía en el servidor.",
        };
      });
  };

  RemoteBackend.prototype.command = function (name, args) {
    var self = this;
    return fetch(this._url("/command", "?include=state"), {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      // `expectedVersion` is what makes a second person's edit safe: the server
      // refuses the write if the document moved since this client read it.
      body: JSON.stringify({
        command: name,
        args: args || [],
        expectedVersion: self.version,
      }),
    })
      .then(function (res) {
        return res.json().then(function (body) {
          if (!res.ok) throw self._fail(res, body);
          return body;
        });
      })
      .then(function (body) {
        self.version = body.version;
        self.erp = ErpEngine.ERP.from(body.state);
        return { erp: self.erp, version: body.version, result: body.result };
      });
  };

  /** Re-reads the server's copy after a conflict, discarding nothing local. */
  RemoteBackend.prototype.refresh = function () {
    return this.load();
  };
  LocalBackend.prototype.refresh = function () {
    return this.load();
  };

  return {
    /**
     * `tenant` is only consulted in remote mode.
     *
     * The default is "~", meaning "whichever company this session is entitled
     * to", which the server resolves. This file is served identically to
     * everybody — a member of staff and a customer trying the demonstration —
     * so naming a company in it would hand the real books to whoever opened the
     * page.
     */
    create: function (tenant) {
      var base = apiBase();
      // `base === ""` is remote-on-this-origin, which is the normal deployment;
      // only `null` means local. Hence the explicit null check.
      return base === null ? new LocalBackend() : new RemoteBackend(base, tenant || "~");
    },
    LOCAL_USER: LOCAL_USER,
    _internals: { apiBase: apiBase, LocalBackend: LocalBackend, RemoteBackend: RemoteBackend },
  };
});
