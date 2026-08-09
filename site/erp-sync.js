/* =============================================================================
   ErpSync — notices when the company's data changed somewhere else.

   THE PROBLEM THIS SOLVES, in the operator's words: "I need to refresh 178-105
   every time when I did an update on the app."

   That was not a bug in the saving. The phone wrote to the server correctly and
   the laptop read from the server correctly — once, when its page loaded, and
   then never again. A page that loaded at nine o'clock went on showing the nine
   o'clock register all morning, with nothing on screen admitting it. Stale and
   confident is a worse failure than stale and honest, because the operator has
   no reason to doubt what they are looking at.

   HOW. One small request — GET /api/~/erp/version — returns just the version
   number of each document. Anything watching a document compares that against
   the version it is holding, and only then does any real work. The request is
   made when the page comes back to the front, when the window regains focus,
   and on a slow timer while the page is actually visible. Never while hidden:
   a tab left open for a week should not talk to the server for a week.

   WHAT HAPPENS ON A CHANGE. Two different situations, deliberately treated
   differently:

     coming back to a page you left  → refresh it, if nothing is in progress
     a change arriving while you work → say so, and let the operator choose

   The second must never reload by itself. Somebody halfway through typing an
   address does not want the page replaced underneath them, however fresh the
   replacement is. "Nothing in progress" is checked, not assumed: no cursor in a
   field, no open drawer. When in doubt this offers rather than acts — the worst
   case of offering is a bar the operator ignores, and the worst case of acting
   is destroyed work.

   Local mode (the published read-only copies, or opening the files directly)
   has no server to ask, so all of this stays switched off.
   ========================================================================== */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ErpSync = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var SELF_TENANT = "~";

  /* Same detection as erp-store.js and erp-docs.js: PRESENCE of the marker the
     server injects, not its value. Kept in step with them by being the same
     four lines rather than by anyone remembering. */
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

  var watchers = [];
  var timer = null;
  var failures = 0;
  var lastHiddenAt = 0;
  /* The newest version we have already told the operator about. Tracked by
     NUMBER rather than by a boolean "are we showing the bar", because those two
     are not the same question and conflating them silences the second piece of
     news: dismiss the bar once and a flag would suppress every later change
     too, leaving a page that has given up warning you it is stale. */
  var announced = 0;

  var POLL_MS = 25000;

  /* Anything matching this means the operator is in the middle of something.
     `.drawer.on` / `.scrim.on` are the workspace's own overlay convention;
     `[data-erp-busy]` is the escape hatch for a page that knows better than a
     selector can. */
  var busySelector = "dialog[open], .drawer.on, .scrim.on, .modal.on, .sheet.on, [data-erp-busy]";

  function versionsUrl() {
    return REMOTE + "/api/" + SELF_TENANT + "/erp/version";
  }

  /** Is the operator visibly in the middle of something? */
  function pageIsBusy() {
    try {
      var a = document.activeElement;
      if (a && (a.isContentEditable || /^(input|textarea|select)$/i.test(a.tagName || ""))) {
        return true;
      }
      return !!document.querySelector(busySelector);
    } catch (e) {
      // Cannot tell → assume busy. The failure modes are not symmetric.
      return true;
    }
  }

  /**
   * A quiet bar offering to refresh. Top-centred and, crucially, inside a
   * `pointer-events:none` frame with only the bar itself clickable.
   *
   * A full-width bar pinned to an edge has burned this project once already: it
   * covered the language toggle and the save/cancel row on the pages that have
   * them, so a notice about data quietly blocked the controls for changing it.
   */
  function offerRefresh(version) {
    if (document.getElementById("canei-stale")) return;
    // Already said this. A newer version is new news and gets said again.
    if (version && version <= announced) return;
    if (version) announced = version;
    try {
      var frame = document.createElement("div");
      frame.id = "canei-stale";
      frame.setAttribute(
        "style",
        "position:fixed;left:0;right:0;top:0;z-index:2147482000;display:flex;" +
          "justify-content:center;padding:10px 12px;pointer-events:none",
      );

      var pill = document.createElement("div");
      pill.setAttribute(
        "style",
        "pointer-events:auto;display:flex;align-items:center;gap:12px;" +
          "background:#31532a;color:#fff;border-radius:999px;padding:9px 10px 9px 18px;" +
          "font:600 13px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;" +
          "box-shadow:0 10px 28px -12px rgba(20,22,15,.7);max-width:100%",
      );

      var text = document.createElement("span");
      text.textContent = "There is newer data on the server.";
      pill.appendChild(text);

      var go = document.createElement("button");
      go.textContent = "Refresh";
      go.setAttribute(
        "style",
        "background:#f2c230;color:#14160f;border:0;font:700 13px/1 inherit;" +
          "padding:8px 14px;border-radius:999px;cursor:pointer",
      );
      go.onclick = function () {
        location.reload();
      };
      pill.appendChild(go);

      var close = document.createElement("button");
      close.textContent = "✕";
      close.setAttribute("aria-label", "Dismiss");
      close.setAttribute(
        "style",
        "background:transparent;color:rgba(255,255,255,.75);border:0;font:700 14px/1 inherit;" +
          "padding:6px 8px;cursor:pointer",
      );
      close.onclick = function () {
        // Dismissed, not resolved: the page is still stale and `announced`
        // remembers which version was dismissed, so this exact news is not
        // repeated — and the next save by anybody raises it again.
        frame.remove();
      };
      pill.appendChild(close);

      frame.appendChild(pill);
      document.body.appendChild(frame);
    } catch (e) {
      /* a notice must never be the thing that breaks the page */
    }
  }

  /** What to do about a document that moved. */
  function react(info) {
    if (info && info.returning && !pageIsBusy()) {
      location.reload();
      return;
    }
    offerRefresh(info && info.version);
  }

  function probe(returning) {
    if (REMOTE === null || !watchers.length) return Promise.resolve();
    return fetch(versionsUrl(), {
      credentials: "same-origin",
      headers: { accept: "application/json" },
    })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (body) {
        failures = 0;
        var versions = (body && body.versions) || {};
        watchers.forEach(function (w) {
          var server = versions[w.key];
          if (typeof server !== "number") return;
          var mine;
          try {
            mine = w.current() || 0;
          } catch (e) {
            return;
          }
          // Strictly forward. A server version BEHIND ours is our own save that
          // has not been read back yet, which is not news; treating it as a
          // change would make every save trigger a refresh of itself.
          if (server > mine) w.changed(server, { returning: !!returning, version: server });
        });
      })
      .catch(function () {
        // Silent on purpose. A poll that cannot reach the server is not
        // something the operator can act on, and the SAVE path already shouts
        // when a write fails — which is the failure that costs work.
        failures += 1;
      });
  }

  function tick() {
    // Back off after repeated failures rather than hammering a server that is
    // down, but never so far that recovery goes unnoticed.
    var factor = failures > 2 ? Math.min(8, Math.pow(2, failures - 2)) : 1;
    timer = setTimeout(function () {
      var run =
        typeof document !== "undefined" && document.visibilityState === "hidden"
          ? Promise.resolve()
          : probe(false);
      run.then(tick);
    }, POLL_MS * factor);
  }

  function begin() {
    if (timer !== null || REMOTE === null) return;
    tick();

    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") {
        lastHiddenAt = Date.now();
        return;
      }
      // "Returning" only if the page was genuinely away. Flicking to another
      // window for a second and back is not an invitation to reload.
      probe(Date.now() - lastHiddenAt > 1500);
    });

    window.addEventListener("focus", function () {
      probe(false);
    });

    window.addEventListener("pageshow", function (e) {
      // Restored from the back/forward cache: the DOM is exactly as it was
      // before, which for a data page means exactly as WRONG as it was before.
      if (e && e.persisted) probe(true);
    });
  }

  return {
    isRemote: function () {
      return REMOTE !== null;
    },
    /**
     * Watch one document.
     *   key     — the name the server publishes ("state", "caneiMasterData", …)
     *   current — returns the version this page is holding
     *   changed — called with (serverVersion, {returning}) when the server is ahead
     */
    watch: function (key, current, changed) {
      if (REMOTE === null) return;
      watchers.push({ key: key, current: current, changed: changed || react });
      begin();
    },
    /** The default reaction, exposed so a caller can defer to it. */
    react: react,
    pageIsBusy: pageIsBusy,
    /** For a page whose overlays this module cannot recognise. */
    busyWhen: function (selector) {
      busySelector = selector;
    },
    /** Ask now (used by tests, and by anything that knows it just changed). */
    check: function () {
      return probe(false);
    },
  };
});
