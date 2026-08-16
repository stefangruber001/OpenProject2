/* Canei Subirats — trilingual layer (ES · CA · EN).
 *
 * Every page declares its base language in <html lang="…">. The visitor's
 * choice is stored in localStorage ("caneiLang", default "es").
 *
 * The default is Spanish and stays Spanish until the dictionary can carry the
 * workspace. erp.html is authored in Spanish and builds most of its content in
 * JavaScript; those generated sentences have no entries, so defaulting to
 * English produces English chrome around Spanish content — worse than either
 * language on its own. See task #72. When the
 * chosen language differs from the page's base language, the whole document
 * is translated in place using the dictionary in i18n-dict.js:
 *   - text nodes and key attributes (placeholder / title / aria-label / value / alt)
 *   - exact-match phrases first, then regex rules for interpolated strings
 *   - a MutationObserver keeps dynamically rendered content translated
 *   - window.CANEI_I18N.translateNode(root) lets generated documents
 *     (print windows, previews) opt in with one call
 * A floating ES | CA | EN toggle is injected on every page.
 *
 * WHY SPANISH IS THE HUB (S3, decision 20). The dictionary is a set of
 * TRIPLES keyed on the Spanish string: `pairs` carries [es, en] and `ca`
 * carries es → ca. Any direction is then one lookup — including EN → CA,
 * which is the pairing that has no dictionary of its own and would otherwise
 * have to translate twice, through Spanish, and lose everything the first
 * hop failed to match. Spanish is the language the application is written
 * in, so it is the only key every string is guaranteed to have.
 *
 * A missing Catalan entry falls back to Spanish rather than to the raw key.
 * That is a deliberate degradation and not a licence: `tests/i18n/coverage.mjs`
 * fails the build on a string that has no Catalan, precisely because a silent
 * fallback is invisible to the person who introduced it.
 */
(function () {
  "use strict";

  var LANGS = ["es", "ca", "en"];
  var NAMES = { es: "Español", ca: "Català", en: "English" };
  var SHORT = { es: "ES", ca: "CA", en: "EN" };

  var LS_KEY = "caneiLang"; // this device's choice ("" = follow the company)
  var CACHE_KEY = "caneiLangCompany"; // last company value seen, for first paint
  var COOKIE = "canei_lang";
  var API = "/api/~/erp/language";

  function valid(lang) {
    return LANGS.indexOf(lang) >= 0 ? lang : "";
  }
  function readLocal(key) {
    try {
      return localStorage.getItem(key) || "";
    } catch (e) {
      return "";
    }
  }
  function writeLocal(key, value) {
    try {
      if (value) localStorage.setItem(key, value);
      else localStorage.removeItem(key);
    } catch (e) {
      /* private mode — the choice lasts for this page only */
    }
  }

  /**
   * The device's choice lives in a COOKIE as well as in localStorage.
   *
   * The sign-in page is rendered on the server and carries no JavaScript, so it
   * can only know a preference the server can see. Keeping the choice in a
   * cookie means picking Català on the sign-in screen and picking it in the
   * workspace are the same act, recorded in the same place — rather than two
   * settings that drift apart and make the app look like it forgot.
   *
   * localStorage is still read, so anybody carrying a choice made by the
   * previous version does not silently lose it.
   */
  function readCookie(name) {
    var parts = ("; " + document.cookie).split("; " + name + "=");
    return parts.length === 2 ? valid(decodeURIComponent(parts.pop().split(";").shift())) : "";
  }
  function writeCookie(name, value) {
    var year = 60 * 60 * 24 * 365;
    document.cookie = value
      ? name + "=" + encodeURIComponent(value) + ";path=/;max-age=" + year + ";samesite=lax"
      : name + "=;path=/;max-age=0;samesite=lax";
  }

  var device = readCookie(COOKIE) || valid(readLocal(LS_KEY));
  var company = valid(readLocal(CACHE_KEY));
  var target = device || company || "es";

  var base = (document.documentElement.getAttribute("lang") || "en").slice(0, 2);
  if (LANGS.indexOf(base) < 0) base = "en";
  var active = target !== base; // do we need to translate this page?

  /* ---------- dictionary ---------- */
  var D = (typeof window !== "undefined" && window.CANEI_DICT) || {
    pairs: [],
    ca: {},
    rxEs2En: [],
    rxEn2Es: [],
    rxEs2Ca: [],
  };
  var CA = D.ca || {};
  var map = new Map();
  var rx = [];
  if (active) {
    // One pass over the triples, building a direct base → target map. The
    // Spanish form of each entry is the join key; `pairs` supplies English
    // and `ca` supplies Catalan, each falling back to Spanish when absent so
    // a partial entry degrades to a readable interface rather than a blank.
    for (var i = 0; i < D.pairs.length; i++) {
      var es = D.pairs[i][0];
      var forms = { es: es, en: D.pairs[i][1] || es, ca: CA[es] || es };
      var from = forms[base];
      var to = forms[target];
      // Never map a string onto itself, and never let a language that has no
      // entry of its own overwrite a real one already in the map.
      if (from && to && from !== to && !map.has(from)) map.set(from, to);
    }
    rx =
      base === "es"
        ? target === "en"
          ? D.rxEs2En || []
          : D.rxEs2Ca || []
        : target === "es"
          ? D.rxEn2Es || []
          : []; // EN → CA has no interpolation rules of its own; exact matches only
  }

  function tr(text) {
    if (!text) return null;
    var trimmed = text.trim();
    if (!trimmed) return null;
    var hit = map.get(trimmed);
    if (hit === undefined) {
      // collapse internal runs of whitespace (multi-line HTML text nodes)
      var collapsed = trimmed.replace(/\s+/g, " ");
      hit = map.get(collapsed);
    }
    if (hit === undefined) {
      for (var i = 0; i < rx.length; i++) {
        var m = rx[i];
        var re = m[0];
        re.lastIndex = 0;
        if (re.test(trimmed)) {
          re.lastIndex = 0;
          hit = trimmed.replace(re, m[1]);
          break;
        }
      }
    }
    if (hit === undefined || hit === trimmed) return null;
    // keep original leading / trailing whitespace
    var lead = text.match(/^\s*/)[0];
    var tail = text.match(/\s*$/)[0];
    return lead + hit + tail;
  }

  var ATTRS = ["placeholder", "title", "aria-label", "alt"];
  var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, CODE: 1, PRE: 0 };

  /**
   * `translate="no"` — the standard HTML opt-out, honoured for the subtree.
   *
   * It exists here for one specific and important case: a document addressed
   * to somebody else. A presupuesto is written in the CUSTOMER's language,
   * which is a field on the record; the toggle is the OPERATOR's language,
   * which is a preference of whoever happens to be at the screen. Without
   * this, a Spanish back-office user reading their interface in English would
   * see — and print — an English presupuesto for a Catalan customer. Marking
   * the document keeps the two ideas apart.
   */
  function noTranslate(node) {
    var el = node.nodeType === 1 ? node : node.parentNode;
    return !!(el && el.closest && el.closest('[translate="no"]'));
  }

  function translateNode(root) {
    if (!active || !root) return;
    var doc = root.ownerDocument || root;
    var walker = doc.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */, null);
    var n;
    while ((n = walker.nextNode())) {
      var pn = n.parentNode && n.parentNode.nodeName;
      if (pn && SKIP[pn]) continue;
      if (noTranslate(n)) continue;
      var out = tr(n.nodeValue);
      if (out !== null) n.nodeValue = out;
    }
    // THE ROOT ITSELF, not only its descendants.
    //
    // `querySelectorAll("*")` never returns the element it is called on. The
    // full pass starts at document.body, so that omission is invisible; the
    // MutationObserver hands this function each ADDED element, and for those
    // the omission is the whole bug. The workspace builds its section buttons
    // after boot with the label on the button — so the visible text was
    // translated (the text walker does start at root) and the aria-label was
    // not, and a screen reader on English read "Torre de control" while the
    // screen said "Control tower".
    var els = [];
    if (root.nodeType === 1) els.push(root);
    if ((root.nodeType === 1 || root.nodeType === 9) && root.querySelectorAll) {
      var kids = root.querySelectorAll("*");
      for (var q = 0; q < kids.length; q++) els.push(kids[q]);
    }
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (SKIP[el.nodeName]) continue;
      if (noTranslate(el)) continue;
      for (var a = 0; a < ATTRS.length; a++) {
        var v = el.getAttribute && el.getAttribute(ATTRS[a]);
        if (v) {
          var o = tr(v);
          if (o !== null) el.setAttribute(ATTRS[a], o);
        }
      }
      if (el.nodeName === "INPUT" && (el.type === "button" || el.type === "submit") && el.value) {
        var ov = tr(el.value);
        if (ov !== null) el.value = ov;
      }
    }
  }

  function translateAttr(el, name) {
    if (!active || !el.getAttribute) return;
    var v = el.getAttribute(name);
    if (v) {
      var o = tr(v);
      if (o !== null) el.setAttribute(name, o);
    }
  }

  /* ---------- initial pass + observer ---------- */
  var pending = false;
  function fullPass() {
    if (!active) return;
    observerOff();
    translateNode(document.body);
    var t = tr(document.title);
    if (t !== null) document.title = t;
    document.documentElement.setAttribute("lang", target);
    observerOn();
  }

  var mo = null;
  function observerOn() {
    if (!active || !window.MutationObserver) return;
    if (!mo)
      mo = new MutationObserver(function (muts) {
        if (pending) return;
        pending = true;
        // batch: one microtask handles all mutations of this frame
        Promise.resolve().then(function () {
          pending = false;
          observerOff();
          for (var i = 0; i < muts.length; i++) {
            var m = muts[i];
            if (m.type === "characterData") {
              if (noTranslate(m.target)) continue;
              var out = tr(m.target.nodeValue);
              if (out !== null) m.target.nodeValue = out;
            } else if (m.type === "attributes") {
              if (noTranslate(m.target)) continue;
              translateAttr(m.target, m.attributeName);
            } else {
              for (var j = 0; j < m.addedNodes.length; j++) {
                var node = m.addedNodes[j];
                if (noTranslate(node)) continue;
                if (node.nodeType === 3) {
                  var o = tr(node.nodeValue);
                  if (o !== null) node.nodeValue = o;
                } else if (node.nodeType === 1) translateNode(node);
              }
            }
          }
          observerOn();
        });
      });
    mo.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ATTRS.concat(["value"]),
    });
  }
  function observerOff() {
    if (mo) mo.disconnect();
  }

  /* ---------- choosing ---------- */

  /**
   * Adopt a language.
   *
   * `scope` is "device" or "company". A company change is written to the server
   * and only then applied, because a switch that appears to work and did not
   * reach the server is the failure this project keeps meeting: everyone else
   * carries on in the old language while the person who changed it believes
   * they changed it for everyone.
   */
  function set(lang, scope) {
    lang = valid(lang) || "";
    if (scope === "company") {
      return fetch(API, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ language: lang || "es" }),
      }).then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        writeLocal(CACHE_KEY, lang || "es");
        // A company change also clears this device's override, or the person
        // who just set the company language would be the one person who does
        // not see it.
        writeLocal(LS_KEY, "");
        writeCookie(COOKIE, "");
        location.reload();
      });
    }
    writeLocal(LS_KEY, lang);
    writeCookie(COOKIE, lang);
    location.reload();
    return Promise.resolve();
  }

  /** Ask the server what the company language is, and follow it if we should. */
  function syncCompany() {
    if (!window.fetch || location.protocol === "file:") return;
    // ONLY WHERE THERE IS A SERVER TO ASK. These same files are published as a
    // static copy with no API behind them, and a fetch that 404s is not a
    // silent no-op: the browser logs it as a console error, on every page, for
    // every visitor. `ErpDocs.isRemote()` is the app's existing answer to "am I
    // talking to the server", so it is the one used here rather than a second
    // guess that could disagree with it.
    var docs = window.ErpDocs;
    if (!docs || typeof docs.isRemote !== "function" || !docs.isRemote()) return;
    fetch(API, { credentials: "same-origin", headers: { accept: "application/json" } })
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (body) {
        var value = body && valid(body.language);
        if (!value || value === company) return;
        writeLocal(CACHE_KEY, value);
        // Only reload when it actually changes what this page is showing. A
        // device override means the company value is cached for later and
        // nothing on screen moves.
        if (!device && value !== target) location.reload();
      })
      .catch(function () {
        /* offline, or the static copy with no API behind it */
      });
  }

  /* ---------- toggle pill ---------- */
  function injectToggle() {
    if (document.getElementById("canei-lang-pill")) return;
    var css =
      "#canei-lang-pill{position:fixed;bottom:calc(14px + env(safe-area-inset-bottom,0px));left:14px;z-index:99999;display:flex;gap:0;" +
      "background:rgba(255,255,255,.92);backdrop-filter:blur(8px);border:1px solid #dde5d6;border-radius:999px;" +
      "box-shadow:0 2px 4px rgba(24,32,16,.06),0 14px 30px -18px rgba(24,32,16,.3);overflow:hidden;" +
      "font:600 11px Inter,system-ui,sans-serif;letter-spacing:.06em}" +
      "#canei-lang-pill button{appearance:none;border:0;background:transparent;color:#8b8f80;padding:7px 12px;" +
      "cursor:pointer;font:inherit;transition:.15s}" +
      "#canei-lang-pill button.on{background:linear-gradient(120deg,#31532a,#48733c 70%);color:#fff}" +
      "@media print{#canei-lang-pill{display:none}}" +
      "@media(max-width:560px){#canei-lang-pill{bottom:calc(10px + env(safe-area-inset-bottom,0px));left:10px}#canei-lang-pill button{padding:6px 10px}}";
    var st = document.createElement("style");
    st.textContent = css;
    document.head.appendChild(st);
    var pill = document.createElement("div");
    pill.id = "canei-lang-pill";
    pill.setAttribute("role", "group");
    pill.setAttribute("aria-label", "Idioma · Llengua · Language");
    // A language switcher that translates its own labels tells you what you
    // already chose instead of what you can choose.
    pill.setAttribute("translate", "no");
    LANGS.forEach(function (lang) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = SHORT[lang];
      b.title = NAMES[lang];
      b.setAttribute("aria-label", NAMES[lang]);
      if (lang === target) {
        b.className = "on";
        b.setAttribute("aria-current", "true");
      }
      b.addEventListener("click", function () {
        if (lang === target) return;
        set(lang, "device");
      });
      pill.appendChild(b);
    });
    document.body.appendChild(pill);
  }

  /* ---------- boot ---------- */
  function boot() {
    injectToggle();
    fullPass();
    syncCompany();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window.CANEI_I18N = {
    LANGS: LANGS,
    NAMES: NAMES,
    lang: function () {
      return target;
    },
    deviceChoice: function () {
      return device;
    },
    companyLanguage: function () {
      return company;
    },
    base: base,
    active: active,
    set: set,
    translateNode: translateNode,
    tr: tr,
  };
})();
