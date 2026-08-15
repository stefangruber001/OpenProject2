/* Canei Subirats — the language layer (Español · Català · English).
 *
 * HOW A PAGE GETS TRANSLATED. Every page declares the language it was authored
 * in via <html lang="…">. If the chosen language differs, the whole document is
 * rewritten in place from the dictionary in i18n-dict.js: text nodes first, then
 * the attributes a person can read (placeholder / title / aria-label / alt) and
 * button values, then a MutationObserver keeps anything rendered later in the
 * same language. Generated documents (print windows, previews) opt in with one
 * call to CANEI_I18N.translateNode(root).
 *
 * WHICH LANGUAGE, AND WHO DECIDES. There are two answers and they are different
 * on purpose:
 *
 *   the company language — one setting for the whole company, kept on the
 *     server next to everything else the company owns. Changing it in the ERP
 *     changes it for everyone, on every device, which is what "global" has to
 *     mean or it is not global.
 *   this device — an override, kept locally, for the person who wants English
 *     on their own phone without imposing it. Set from the sign-in screen or
 *     from the switcher. Choosing "Company" gives the device back.
 *
 * Resolution is therefore: device override, else company language, else the
 * page's own language. The company value arrives asynchronously (it is a
 * fetch), so the FIRST paint uses a cached copy — otherwise every load would
 * flash the wrong language while the network went and asked.
 *
 * WHY A DICTIONARY AND NOT KEYS. The pages are authored in Spanish prose, in
 * HTML and in JavaScript that builds sentences at runtime. Retrofitting message
 * keys would mean rewriting every page; translating the rendered text means the
 * translation layer can be complete without the pages knowing it exists. The
 * cost is that a new sentence needs a new entry — which is why
 * tests/i18n/audit.mjs renders every page in every language and fails CI on
 * anything that comes out identical in two of them.
 */
(function () {
  "use strict";

  var LANGS = ["es", "ca", "en"];
  var NAMES = { es: "Español", ca: "Català", en: "English" };
  var SHORT = { es: "ES", ca: "CA", en: "EN" };

  var DEVICE_KEY = "caneiLang"; // "" | "es" | "ca" | "en"  ("" = follow company)
  var CACHE_KEY = "caneiLangCompany"; // last company value seen, for first paint
  var COOKIE = "canei_lang";
  var API = "/api/~/erp/language";

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
  function valid(lang) {
    return LANGS.indexOf(lang) >= 0 ? lang : "";
  }

  /**
   * The device's choice lives in a COOKIE, not in localStorage.
   *
   * The sign-in page is rendered on the server and carries no JavaScript, so it
   * can only know a preference the server can see. Keeping the choice in a
   * cookie means picking Català on the sign-in screen and picking it in the
   * workspace are the same act, recorded in the same place — rather than two
   * settings that drift apart and make the app look like it forgot.
   *
   * localStorage is still read once, so anybody carrying a choice made by the
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

  var device = readCookie(COOKIE) || valid(readLocal(DEVICE_KEY));
  var company = valid(readLocal(CACHE_KEY));
  var base = (document.documentElement.getAttribute("lang") || "es").slice(0, 2);
  if (!valid(base)) base = "es";

  var target = device || company || base;
  var active = target !== base;

  /* ---------- dictionary ---------- */
  var D = (typeof window !== "undefined" && window.CANEI_DICT) || {};
  var map = new Map();
  var rx = [];

  /**
   * Build the lookup for base → target.
   *
   * Spanish is the pivot. `pairs` is ES↔EN and `ca` is ES↔CA, so an English
   * page asked for Catalan is translated EN→ES→CA by composition rather than by
   * a third list nobody would keep in step with the other two.
   */
  function buildMap() {
    map = new Map();
    rx = [];
    if (!active) return;

    var pairs = D.pairs || [];
    var cat = D.ca || [];
    var es2en = new Map(),
      en2es = new Map(),
      es2ca = new Map(),
      ca2es = new Map();
    var i;
    for (i = 0; i < pairs.length; i++) {
      if (!es2en.has(pairs[i][0])) es2en.set(pairs[i][0], pairs[i][1]);
      if (!en2es.has(pairs[i][1])) en2es.set(pairs[i][1], pairs[i][0]);
    }
    for (i = 0; i < cat.length; i++) {
      if (!es2ca.has(cat[i][0])) es2ca.set(cat[i][0], cat[i][1]);
      if (!ca2es.has(cat[i][1])) ca2es.set(cat[i][1], cat[i][0]);
    }

    var toEs = base === "es" ? null : base === "en" ? en2es : ca2es; /* first hop, into Spanish */
    var fromEs = target === "es" ? null : target === "en" ? es2en : es2ca;

    if (!toEs && fromEs) {
      map = fromEs;
    } else if (toEs && !fromEs) {
      map = toEs;
    } else if (toEs && fromEs) {
      // Compose through Spanish. Only entries that survive both hops are
      // usable; a half-translated phrase would be worse than the original.
      toEs.forEach(function (spanish, source) {
        var out = fromEs.get(spanish);
        if (out !== undefined) map.set(source, out);
      });
    }

    // Regex rules for sentences with numbers or names in them. Same pivot rule,
    // except composition is not attempted: chaining two patterns produces
    // nonsense far more often than it produces a sentence.
    if (base === "es" && target === "en") rx = D.rxEs2En || [];
    else if (base === "es" && target === "ca") rx = D.rxEs2Ca || [];
    else if (base === "en" && target === "es") rx = D.rxEn2Es || [];
    else if (base === "en" && target === "ca") rx = D.rxEn2Ca || [];
  }
  buildMap();

  function tr(text) {
    if (!text) return null;
    var trimmed = text.trim();
    if (!trimmed) return null;
    var hit = map.get(trimmed);
    if (hit === undefined) {
      var collapsed = trimmed.replace(/\s+/g, " ");
      hit = map.get(collapsed);
    }
    if (hit === undefined) {
      for (var i = 0; i < rx.length; i++) {
        var re = rx[i][0];
        re.lastIndex = 0;
        if (re.test(trimmed)) {
          re.lastIndex = 0;
          hit = trimmed.replace(re, rx[i][1]);
          break;
        }
      }
    }
    if (hit === undefined || hit === trimmed) return null;
    var lead = text.match(/^\s*/)[0];
    var tail = text.match(/\s*$/)[0];
    return lead + hit + tail;
  }

  var ATTRS = ["placeholder", "title", "aria-label", "alt"];
  var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, CODE: 1 };

  function translateNode(root) {
    if (!active || !root) return;
    var doc = root.ownerDocument || root;
    var walker = doc.createTreeWalker(root, 4 /* SHOW_TEXT */, null);
    var n;
    while ((n = walker.nextNode())) {
      var pn = n.parentNode && n.parentNode.nodeName;
      if (pn && SKIP[pn]) continue;
      // The switcher names languages in their own tongue and must never be
      // translated — "Català" is Català in every language.
      if (n.parentElement && n.parentElement.closest && n.parentElement.closest("#canei-lang-pill"))
        continue;
      var out = tr(n.nodeValue);
      if (out !== null) n.nodeValue = out;
    }
    var els =
      root.nodeType === 1 || root.nodeType === 9
        ? root.querySelectorAll
          ? root.querySelectorAll("*")
          : []
        : [];
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (SKIP[el.nodeName]) continue;
      if (el.closest && el.closest("#canei-lang-pill")) continue;
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
    if (el.closest && el.closest("#canei-lang-pill")) return;
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
        Promise.resolve().then(function () {
          pending = false;
          observerOff();
          for (var i = 0; i < muts.length; i++) {
            var m = muts[i];
            if (m.type === "characterData") {
              var out = tr(m.target.nodeValue);
              if (out !== null) m.target.nodeValue = out;
            } else if (m.type === "attributes") {
              translateAttr(m.target, m.attributeName);
            } else {
              for (var j = 0; j < m.addedNodes.length; j++) {
                var node = m.addedNodes[j];
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
      })
        .then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          writeLocal(CACHE_KEY, lang || "es");
          // A company change also clears this device's override, or the person
          // who just set the company language would be the one person who does
          // not see it.
          writeLocal(DEVICE_KEY, "");
          writeCookie(COOKIE, "");
          location.reload();
        })
        .catch(function (e) {
          return Promise.reject(e);
        });
    }
    writeLocal(DEVICE_KEY, lang);
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

  /* ---------- the switcher ---------- */
  function injectSwitcher() {
    if (document.getElementById("canei-lang-pill")) return;
    var css =
      "#canei-lang-pill{position:fixed;bottom:calc(14px + env(safe-area-inset-bottom,0px));left:14px;z-index:99999;" +
      "display:flex;gap:2px;padding:3px;background:rgba(255,255,255,.94);backdrop-filter:blur(10px);" +
      "border:1px solid #dde5d6;border-radius:999px;box-shadow:0 2px 4px rgba(24,32,16,.06),0 14px 30px -18px rgba(24,32,16,.34);" +
      "font:600 11px Inter,system-ui,-apple-system,sans-serif;letter-spacing:.06em}" +
      "#canei-lang-pill button{appearance:none;border:0;background:transparent;color:#8b8f80;padding:6px 11px;" +
      "cursor:pointer;font:inherit;border-radius:999px;transition:background .16s,color .16s}" +
      "#canei-lang-pill button:hover{color:#31532a}" +
      "#canei-lang-pill button.on{background:linear-gradient(120deg,#31532a,#48733c 70%);color:#fff}" +
      "@media print{#canei-lang-pill{display:none}}" +
      "@media(max-width:560px){#canei-lang-pill{bottom:calc(10px + env(safe-area-inset-bottom,0px));left:10px}" +
      "#canei-lang-pill button{padding:6px 9px}}";
    var st = document.createElement("style");
    st.textContent = css;
    document.head.appendChild(st);

    var pill = document.createElement("div");
    pill.id = "canei-lang-pill";
    pill.setAttribute("role", "group");
    pill.setAttribute("aria-label", "Idioma · Llengua · Language");
    // `translate="no"` and the skip rule above are belt and braces: a language
    // switcher that translates its own labels tells you what you already chose
    // instead of what you can choose.
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
    injectSwitcher();
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
