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
  var known = new Set(); // every key the dictionary HAS an opinion about
  var produced = new Set(); // every string translation can PRODUCE
  var alt = new Map(); // Spanish → target, for pages that are not Spanish but contain it
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
      // `known` records the key REGARDLESS of whether the two forms differ,
      // which `map` cannot: an entry whose Catalan is identical to its Spanish
      // is a decision somebody took, and the miss ledger below must not report
      // it as a gap. Without this the two cases — "nobody has translated this"
      // and "this word is the same in both languages" — are indistinguishable
      // from inside `tr()`, and the ledger would be mostly noise.
      if (from) known.add(from);
      // And the OUTPUT side, which the ledger needs for a different reason.
      //
      // A translated node is offered back to `tr()` — by the MutationObserver
      // watching the change this file just made, and by any re-render that
      // copies text already on screen. The second pass necessarily misses:
      // "Transactions" is not a key, it is an ANSWER. Recording it would fill
      // the report with strings that are already correct, in the target
      // language, which is precisely the noise that makes a report get
      // ignored — and the first crawl produced fourteen of them.
      if (to) produced.add(to);

      /**
       * THE MIXED-PAGE FALLBACK.
       *
       * `journey.html`, `master-data.html` and `financial-data.html` declare
       * `lang="en"` and are full of Spanish: "Cliente", "Estado", "Avance",
       * "Buscar por código o cliente", "Conectado al ERP.". With the base read
       * as English the only keys in the map are English ones, so those strings
       * are UNREACHABLE — not missing from the dictionary, unreachable through
       * it, and no number of new entries would ever have fixed them. Thirty-odd
       * of them sat on the financial screens looking exactly like a translation
       * gap.
       *
       * So a page whose base is not Spanish keeps a second map, keyed on the
       * Spanish form, consulted only after the declared base has missed. A
       * genuinely English string is not a Spanish key, so it cannot be caught
       * by this; and the primary map always wins, so nothing already working
       * changes. Fixing the three files' declared language instead would be the
       * tidier answer and a much larger change — this makes the interface
       * correct today and leaves that as cleanup, not as a prerequisite.
       */
      if (base !== "es" && es && to && es !== to && !alt.has(es)) alt.set(es, to);
      // And when the TARGET is Spanish, a Spanish string on such a page is
      // already in the right language. Say so, or the ledger reports every
      // Spanish label on those pages as untranslated for a Spanish reader.
      if (base !== "es" && target === "es" && es) produced.add(es);
      // A Spanish label whose target form is identical is a decision, here too.
      if (base !== "es" && es) known.add(es);
    }
    rx =
      base === "es"
        ? target === "en"
          ? D.rxEs2En || []
          : D.rxEs2Ca || []
        : target === "es"
          ? D.rxEn2Es || []
          : // EN → CA. This used to be an empty list, on the reasoning that
            // Spanish is the hub so every pairing is one lookup away. That
            // holds for EXACT matches and is false for interpolated ones: a
            // page authored in English ("16 rows", "3 records", "Net debt
            // 80.000 €") has no Spanish form to hub through, so a Catalan
            // reader saw English counts on every financial screen. The ledger
            // found forty of them in one crawl. The rules live beside the
            // Catalan column they belong to.
            D.rxEn2Ca || [];
    // Interpolated Spanish on a page declared English — same reason as `alt`,
    // same ordering: the declared base's rules are tried first and win.
    if (base !== "es" && target !== "es")
      rx = rx.concat((target === "ca" ? D.rxEs2Ca : D.rxEs2En) || []);
  }

  /* ---------- the miss ledger ----------------------------------------------
   *
   * WHY THIS EXISTS, and why it replaces four scanners.
   *
   * Until now, finding untranslated text meant guessing from outside: scan the
   * source for literals, or render two languages and diff them. Both are
   * reconstructions of something this file already knows for certain. `tr()`
   * is called with every user-visible string the moment before it is painted,
   * and when it returns null it has just decided, with complete information,
   * that it cannot translate that string. That verdict was thrown away.
   *
   * The scanners each missed real gaps because they enumerate PLACES a string
   * might live — a route, a `<label>`, a quoted literal — and a screen reached
   * by pressing a button inside a modal is in none of those lists. The photo
   * that prompted this was exactly that: an invoice-issuing form no route
   * walker opens. A ledger kept by the translator has no such blind spot,
   * because it does not look for strings at all; it records the ones that
   * arrive. Whatever the operator can see, `tr()` has already been asked about.
   *
   * Cost is one Map lookup on a path that already did several, and the ledger
   * is capped so a runaway render cannot grow it without bound.
   */
  var MISS_CAP = 4000;
  var misses = new Map(); // text → { text, n, where }
  var lastMiss = false; // did the most recent tr() call record a gap?

  /**
   * Is this string something a person would expect to be translated?
   *
   * Every rule here is a place the ledger stops looking, so each one is a
   * SHAPE — a date, a code, a number with a unit — never a word. Excusing a
   * word would hide the one string somebody needs to see.
   */
  var NOT_PROSE = [
    /^[\s\p{P}\p{S}\d]*$/u, // punctuation, symbols and digits only
    /^[\d.,\s]+(€|%|h|kg|m²|m³|m|ud|u)?$/iu, // a quantity, with or without a unit
    /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/, // a date
    /^\d{1,2}:\d{2}$/, // a time
    /^[A-Z]{1,5}-?\d{2,}[-/]?[\d-]*$/, // a document reference
    /^[\w.+-]+@[\w.-]+$/, // an address
    /^https?:\/\//, // a link
    /^[A-Z0-9]{6,}$/, // an identifier
  ];
  function translatable(s) {
    if (s.length < 2 || s.length > 200) return false;
    if (!/\p{L}{2}/u.test(s)) return false; // no word in it at all
    for (var i = 0; i < NOT_PROSE.length; i++) if (NOT_PROSE[i].test(s)) return false;
    return true;
  }

  function record(text, where) {
    lastMiss = false;
    if (known.has(text)) return; // translated to itself on purpose
    if (produced.has(text)) return; // already the answer, not a question
    if (!translatable(text)) return;
    lastMiss = true;
    var e = misses.get(text);
    if (e) {
      e.n++;
      return;
    }
    if (misses.size >= MISS_CAP) return;
    misses.set(text, { text: text, n: 1, where: where || "" });
  }

  /** Where on the page a string was found, in a form a person can act on. */
  function locate(node) {
    var el = node && (node.nodeType === 1 ? node : node.parentElement);
    var path = [];
    for (var i = 0; el && i < 4; i++) {
      var bit = el.nodeName.toLowerCase();
      if (el.id) {
        path.unshift(bit + "#" + el.id);
        break;
      }
      var cls = (el.getAttribute && el.getAttribute("class")) || "";
      if (cls) bit += "." + cls.trim().split(/\s+/)[0];
      path.unshift(bit);
      el = el.parentElement;
    }
    return (location.hash || "") + " " + path.join(">");
  }

  function tr(text, where) {
    if (!text) return null;
    var trimmed = text.trim();
    if (!trimmed) return null;
    lastMiss = false;
    var hit = map.get(trimmed);
    if (hit === undefined) {
      // collapse internal runs of whitespace (multi-line HTML text nodes)
      var collapsed = trimmed.replace(/\s+/g, " ");
      hit = map.get(collapsed);
    }
    // The Spanish-on-a-non-Spanish-page fallback. See where `alt` is built.
    if (hit === undefined && alt.size) {
      hit = alt.get(trimmed);
      if (hit === undefined) hit = alt.get(collapsed);
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

    /**
     * THE DECORATION PASS — and the reason most of the workspace stayed Spanish
     * while its dictionary said otherwise.
     *
     * The screens compose their field rows in one breath:
     *
     *     <div class="it">Teléfono: <b>${phone}</b> · Móvil: <b>${mobile}</b></div>
     *
     * so the text nodes handed to this function are `"Teléfono: "` and
     * `" · Móvil: "` — never `"Teléfono"`. The dictionary HAS "Teléfono" →
     * "Phone" and had it all along; the lookup simply never asked, because a
     * trailing colon makes it a different string. Whole screens of labels,
     * every one of them already translated, rendered in Spanish for want of
     * one punctuation mark.
     *
     * So on a miss, the surrounding punctuation is set aside, the word inside
     * is looked up, and the punctuation is put back exactly as it was. Only on
     * a MISS: an entry whose own key contains punctuation ("← Contenido",
     * "Cobros / Pagos (DSO / DPO)") still matches exactly, first, unchanged.
     */
    if (hit === undefined) {
      var parts = /^([^\p{L}\p{N}]*)([\s\S]*?)([^\p{L}\p{N}]*)$/u.exec(collapsed || trimmed);
      if (parts && parts[2] && parts[2].length > 1 && (parts[1] || parts[3])) {
        var core = map.get(parts[2]);
        if (core !== undefined && core !== parts[2]) hit = parts[1] + core + parts[3];
      }
    }

    /**
     * THE LABELLED-SEGMENT PASS — for rows where the label and the DATA share
     * one text node.
     *
     *     <div class="it">Teléfono: ${phone} · Móvil: ${mobile}</div>
     *
     * Nothing wraps those values, so the browser hands this function the whole
     * line: `"Teléfono: 934771208 · Móvil: 600111222"`. The phone number is
     * different for every customer, so there is no key any dictionary could
     * hold, and stripping punctuation does not help — the noise is in the
     * MIDDLE. Whole identity cards, address blocks and origin lines stayed
     * Spanish for this reason alone, on entries that existed.
     *
     * So the line is read the way a person reads it: split on "·" into
     * segments, and in each `Label: value` translate the label, and the value
     * too when the dictionary happens to know it (a lead source, a status).
     * Anything unknown is left exactly as it was — a phone number, a date and
     * a postcode pass straight through, which is what should happen to them.
     */
    if (hit === undefined && (collapsed || trimmed).indexOf(":") > 0) {
      var line = collapsed || trimmed;
      var touched = false;
      var rebuilt = line.split("·").map(function (seg) {
        var m2 = /^(\s*)([^:]{2,60}?)(\s*:\s*)([\s\S]*)$/.exec(seg);
        if (!m2) return seg;
        var lab = map.get(m2[2]);
        // The value is translated only when the dictionary has an opinion on
        // it, so data is never mangled by a partial match.
        var val = m2[4];
        var bare = val.trim();
        var valHit = map.get(bare);
        var newVal = valHit !== undefined && valHit !== bare ? val.replace(bare, valHit) : val;
        var newLab = lab !== undefined && lab !== m2[2] ? lab : m2[2];
        // Either half is enough. "IRPF: no aplica" has a label that is the same
        // word in all three languages and a value that is not — translating
        // only when the LABEL moved left that row in Spanish forever.
        if (newLab === m2[2] && newVal === val) return seg;
        touched = true;
        return m2[1] + newLab + m2[3] + newVal;
      });
      if (touched) hit = rebuilt.join("·");
    }

    if (hit === undefined || hit === trimmed) {
      // The one place in the application that knows, for certain and at the
      // moment it matters, that a visible string has no translation.
      record(collapsed || trimmed, where);
      return null;
    }
    // Whatever this call produced is now an ANSWER, and answers come back:
    // the observer sees the change, and a re-render copies text already on
    // screen. The pairs above cover the exact matches, but a string built by a
    // regex rule ("1–14 of 14 · page 1 of 1") or by the decoration pass exists
    // nowhere in the dictionary and would be reported as a gap in the language
    // it is already correct in.
    produced.add(hit);
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

  /* ---------- audit mode ----------------------------------------------------
   *
   * `?i18n=audit`, or localStorage `caneiI18nAudit=1` to keep it on across the
   * whole session. Every element holding an untranslated string is outlined,
   * and a counter in the corner lists them and copies the list to the
   * clipboard.
   *
   * This is the half of the tool that does not need a developer. Walking the
   * ERP with it on shows the gaps AS YOU MEET THEM, on the real screens, in
   * the real language, including the ones behind a button — which is the
   * failure mode every previous scanner had. It is off by default and leaves
   * no trace when off.
   */
  var AUDIT = false;
  try {
    AUDIT =
      active && (/[?&]i18n=audit\b/.test(location.search) || readLocal("caneiI18nAudit") === "1");
    if (/[?&]i18n=audit\b/.test(location.search)) writeLocal("caneiI18nAudit", "1");
    if (/[?&]i18n=off\b/.test(location.search)) writeLocal("caneiI18nAudit", "");
  } catch (e) {
    /* no location, no localStorage — audit stays off */
  }

  function mark(el) {
    if (el && el.setAttribute && !el.closest("#canei-lang-pill,#canei-i18n-hud"))
      el.setAttribute("data-i18n-miss", "");
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
      var out = tr(n.nodeValue, AUDIT ? locate(n) : "");
      if (out !== null) n.nodeValue = out;
      else if (AUDIT && lastMiss) mark(n.parentElement);
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
          var o = tr(v, AUDIT ? locate(el) + "[" + ATTRS[a] + "]" : "");
          if (o !== null) el.setAttribute(ATTRS[a], o);
          else if (AUDIT && lastMiss) mark(el);
        }
      }
      if (el.nodeName === "INPUT" && (el.type === "button" || el.type === "submit") && el.value) {
        var ov = tr(el.value, AUDIT ? locate(el) + "[value]" : "");
        if (ov !== null) el.value = ov;
        else if (AUDIT && lastMiss) mark(el);
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

  /**
   * Adopt a language chosen somewhere ELSE in the app.
   *
   * THE PHONE IS WHY THIS EXISTS. The native shell is six tabs, and each tab is
   * its own web view with its own document. Choosing English in Tower reloads
   * Tower and nothing else, so Projects — already loaded, still Spanish — looked
   * like the app had forgotten the choice a second after making it. The choice
   * was never lost: the cookie and localStorage are shared across the tabs, and
   * only the already-rendered documents were stale.
   *
   * So each document checks, whenever it comes back to the front, whether the
   * stored choice still matches what it rendered with, and reloads if it does
   * not. `applied` is the value THIS document used, so after the reload the two
   * agree and it cannot loop.
   *
   * `storage` covers real browser tabs, which do get that event. Separate web
   * views in the native shell do not, which is why visibility and pageshow are
   * the ones that carry the fix on the phone.
   */
  function currentChoice() {
    return readCookie(COOKIE) || valid(readLocal(LS_KEY)) || valid(readLocal(CACHE_KEY)) || "es";
  }

  function followLanguageChosenElsewhere() {
    var applied = target;
    var check = function () {
      if (document.visibilityState === "hidden") return;
      if (currentChoice() !== applied) location.reload();
    };
    document.addEventListener("visibilitychange", check);
    window.addEventListener("pageshow", check);
    window.addEventListener("focus", check);
    window.addEventListener("storage", check);
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

  /* ---------- the audit heads-up display ---------- */
  function missList() {
    var out = [];
    misses.forEach(function (e) {
      out.push(e);
    });
    out.sort(function (a, b) {
      return b.n - a.n || (a.text < b.text ? -1 : 1);
    });
    return out;
  }

  function injectHud() {
    if (!AUDIT || document.getElementById("canei-i18n-hud")) return;
    var st = document.createElement("style");
    st.textContent =
      "[data-i18n-miss]{outline:2px dashed #e5484d!important;outline-offset:1px;background:rgba(229,72,77,.08)!important}" +
      "#canei-i18n-hud{position:fixed;bottom:14px;right:14px;z-index:99999;max-width:min(420px,92vw);" +
      "background:#1d1f1a;color:#fff;border-radius:12px;box-shadow:0 18px 40px -14px rgba(0,0,0,.6);" +
      "font:12px/1.45 Inter,system-ui,sans-serif;overflow:hidden}" +
      "#canei-i18n-hud header{display:flex;gap:8px;align-items:center;padding:9px 12px;background:#e5484d;font-weight:700}" +
      "#canei-i18n-hud header span{flex:1}" +
      "#canei-i18n-hud button{appearance:none;border:0;border-radius:6px;background:rgba(255,255,255,.18);" +
      "color:#fff;font:inherit;font-weight:600;padding:3px 8px;cursor:pointer}" +
      "#canei-i18n-hud ol{margin:0;padding:8px 12px 10px 28px;max-height:38vh;overflow:auto}" +
      "#canei-i18n-hud li{margin:0 0 3px;word-break:break-word}" +
      "#canei-i18n-hud li i{color:#a9b0a0;font-style:normal}" +
      "@media print{#canei-i18n-hud,[data-i18n-miss]{outline:0!important;display:none}}";
    document.head.appendChild(st);

    var hud = document.createElement("div");
    hud.id = "canei-i18n-hud";
    hud.setAttribute("translate", "no");
    hud.innerHTML =
      '<header><span></span><button data-a="copy">Copiar</button>' +
      '<button data-a="off">✕</button></header><ol></ol>';
    document.body.appendChild(hud);

    var head = hud.querySelector("span");
    var list = hud.querySelector("ol");
    var render = function () {
      var all = missList();
      head.textContent = all.length + " sin traducir · " + SHORT[target];
      list.innerHTML = "";
      all.slice(0, 60).forEach(function (e) {
        var li = document.createElement("li");
        li.textContent = e.text.slice(0, 110);
        if (e.n > 1) {
          var i = document.createElement("i");
          i.textContent = " ×" + e.n;
          li.appendChild(i);
        }
        list.appendChild(li);
      });
    };
    hud.addEventListener("click", function (ev) {
      var a = ev.target.getAttribute && ev.target.getAttribute("data-a");
      if (a === "off") {
        writeLocal("caneiI18nAudit", "");
        location.href = location.pathname + "?i18n=off" + location.hash;
      } else if (a === "copy") {
        var text = missList()
          .map(function (e) {
            return e.text;
          })
          .join("\n");
        if (navigator.clipboard) navigator.clipboard.writeText(text);
        ev.target.textContent = "✓";
      }
    });
    render();
    setInterval(render, 1200);
  }

  /* ---------- boot ---------- */
  function boot() {
    injectToggle();
    fullPass();
    injectHud();
    syncCompany();
    // Registered even when this page needs no translating: a Spanish page has
    // to notice a switch to Catalan just as much as the other way round, and
    // `active` is false in exactly that case.
    followLanguageChosenElsewhere();
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
    /**
     * Every user-visible string this page could not translate, most frequent
     * first. The crawler in tests/i18n/miss-crawl.mjs reads exactly this, and
     * so can anybody with a console open on the live site.
     */
    misses: missList,
    resetMisses: function () {
      misses.clear();
    },
    auditing: function () {
      return AUDIT;
    },
  };
})();
