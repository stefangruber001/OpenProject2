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
  var LS_KEY = "caneiLang";
  var target = "es";
  try {
    target = localStorage.getItem(LS_KEY) || "es";
  } catch (e) {
    /* storage unavailable → stay on base */
  }
  if (LANGS.indexOf(target) < 0) target = "es";

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
    var els =
      root.nodeType === 1 || root.nodeType === 9
        ? root.querySelectorAll
          ? root.querySelectorAll("*")
          : []
        : [];
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

  /* ---------- language, chosen in Configuración ----------
     There used to be a fixed pill bottom-left of every page. It was always
     reachable, and always in the way: it floated over content on every
     screen, and one document viewer already had to reserve blank space
     underneath itself purely to stop the pill covering the end of a contract.
     A preference set once or twice a year does not earn permanent screen
     space, so the choice moved into Configuración (DMC-09) and this module
     just exposes the setter. The satellite pages carry no switch of their
     own — they read the same `localStorage` key, so a choice made in the ERP
     is the choice they honour. */
  function setLang(lang) {
    if (LANGS.indexOf(lang) < 0 || lang === target) return false;
    try {
      localStorage.setItem(LS_KEY, lang);
    } catch (e) {}
    location.reload();
    return true;
  }

  /* ---------- boot ---------- */
  function boot() {
    fullPass();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window.CANEI_I18N = {
    lang: function () {
      return target;
    },
    langs: LANGS.slice(),
    set: setLang,
    base: base,
    active: active,
    translateNode: translateNode,
    tr: tr,
  };
})();
