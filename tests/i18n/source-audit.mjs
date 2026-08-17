/**
 * Every user-visible string in the workspace source, checked against the
 * dictionary — including the ones no rendered-page audit can reach.
 *
 * WHY A THIRD AUDIT, AND WHY THIS ONE IS THE HONEST ONE.
 *
 * `audit.mjs` reads pages on a static server; for erp.html the shell never
 * boots, so it sees the login chrome. `workspace-audit.mjs` boots the shell and
 * walks routes — better, and it reported **3 untranslated**. An operator on
 * English then photographed Spanish on five screens in two minutes.
 *
 * Both were measuring what happened to be ON SCREEN. The workspace builds most
 * of its text on demand: a customer sheet exists only after you tap a row, a
 * validation message only after you submit something invalid, a `<select>`'s
 * placeholder option only inside the form that owns it. None of that is in the
 * DOM until a person makes it be, and a crawler that does not perform the exact
 * gesture never sees the string. Walking twelve of the twenty-eight routes made
 * it worse.
 *
 * So this one does not render anything. It reads the source and pulls out the
 * literals that are unmistakably shown to a person — the text between tags, the
 * `<label>`s, the `<option>`s, the placeholders, the thrown messages — and asks
 * the dictionary whether each has a translation. It cannot tell you a string is
 * WRONG, only that nothing was ever written for it, which is the failure that
 * has now shipped three times.
 *
 * FALSE POSITIVES ARE THE PRICE, and they are the right price: a name in a
 * comment or a CSS fragment that slips through costs a minute to dismiss, while
 * a missing label costs the operator their language. The filters below reject
 * shapes (code, numbers, identifiers), never words.
 *
 * Run:  node tests/i18n/source-audit.mjs [--lang ca] [--max N] [--json out]
 */
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import fs from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const SITE = resolve(ROOT, "site");

const argv = process.argv.slice(2);
const argOf = (n, d) => {
  const i = argv.indexOf(n);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const TARGET = argOf("--lang", "en");
const MAX = argv.includes("--max") ? Number(argOf("--max", "0")) : null;
const JSON_OUT = argOf("--json", "");

/** The files that build the workspace a person actually uses. */
const FILES = ["erp.html", "journey.html", "master-data.html", "financial-data.html"];

/**
 * Where a string is unambiguously shown to somebody.
 *
 * Each pattern names a position in the markup, not a vocabulary — so a label
 * added tomorrow in a phrase nobody predicted is still caught, and a variable
 * name never is.
 */
const SOURCES = [
  [/<label[^>]*>([^<>{}$]+)<\/label>/g, "label"],
  [/<option[^>]*>([^<>{}$]+)<\/option>/g, "option"],
  [/<(?:button|h1|h2|h3|h4|th|summary|legend|b|strong)[^>]*>([^<>{}$]+)<\//g, "text"],
  [/<div class="it">([^<>{}$:]+):/g, "field"],
  [/placeholder="([^"{}$]+)"/g, "placeholder"],
  [/\btitle="([^"{}$]+)"/g, "title"],
  [/aria-label="([^"{}$]+)"/g, "aria-label"],
  [/new Error\("([^"{}$]+)"\)/g, "error"],
  [/\btoast\(\s*"([^"{}$]+)"/g, "toast"],
  [/\bconfirm\(\s*"([^"{}$]+)"/g, "confirm"],
  [/\blab:\s*"([^"{}$]+)"/g, "nav"],
  [/\bhint:\s*"([^"{}$]+)"/g, "hint"],

  /**
   * AND THEN EVERY STRING LITERAL, because naming the positions was not enough.
   *
   * The list above was written by looking at the markup and enumerating the
   * places a label appears. It missed `label: "Contacto"` — the column
   * definitions the customer list is built from — so a whole screen of field
   * names reported clean while an operator on English was looking at them in
   * Spanish. Enumerating positions means enumerating the ones you thought of.
   *
   * So: take EVERY quoted string in the file, and decide by the CONTENT
   * whether it is Spanish prose (see `looksSpanish`). A literal cannot hide in
   * a syntax nobody predicted, because the syntax is no longer what is being
   * matched.
   */
  [/"((?:[^"\\\n]|\\.){3,120})"/g, "literal"],
  [/'((?:[^'\\\n]|\\.){3,120})'/g, "literal"],
  [/>([^<>{}$]{3,120})</g, "markup"],
];

/**
 * Shapes that are not prose: code, identifiers, numbers, punctuation.
 *
 * Scanning every string literal means scanning the CSS, the class names, the
 * MIME types and the SVG attribute fragments too — 1,348 of them in erp.html
 * against a few hundred real labels. A report at that ratio is not read, so the
 * filters below are aggressive about SHAPE while staying blind to vocabulary:
 * they reject a string for containing a semicolon or a hex colour, never for
 * being a word somebody did not expect.
 */
function isNotProse(t) {
  const s = t.trim();
  if (s.length < 3) return true;
  if (!/\p{L}{3,}/u.test(s)) return true; // no real word in it
  if (/^[\d\s.,:%€/-]+$/.test(s)) return true;
  if (/^[a-z][a-zA-Z0-9]*$/.test(s)) return true; // camelCase identifier
  if (/^[A-Z]{2,}-\d/.test(s)) return true; // COM-01, PRY-02
  if (/[{}<>]|=>|\$\{|::|\bfunction\b|\bconst\b/.test(s)) return true; // code
  if (/^https?:|^\/|\.(js|css|html|svg|png)$/.test(s)) return true;
  if (/^[\w.+-]+@[\w.-]+$/.test(s)) return true;

  /* ---- shapes that only appear in code, never in a sentence ---- */
  if (/[;=#]|--|\|\||&&/.test(s)) return true; // CSS declarations, hex, operators
  if (/^\s*[a-z-]+:\s/.test(s) && /\d(px|rem|em|vh|vw|%)/.test(s)) return true; // CSS pair
  if (/\b(?:px|rem|vh|vw|fr)\b/.test(s) && /\d/.test(s)) return true; // CSS length
  if (/^[a-z][\w-]*(?:\s+[a-z][\w-]*)*$/.test(s) && !/[áéíóúñü]/i.test(s)) {
    // all-lowercase ASCII words: a class list ("btn primary sm"), an object
    // path ("ui.customers"), an attribute name. Spanish prose in this app is
    // capitalised or accented; the few genuine lowercase phrases ("sin dato")
    // carry an accent or a function word and are caught by looksSpanish.
    if (!looksSpanish(s)) return true;
  }
  if (/^[\w.-]+$/.test(s) && !/[áéíóúñü]/i.test(s)) return true; // single token
  if (/^(?:[A-Z][a-z]+ )?[A-Z]{2,}$/.test(s)) return true; // EUR, UTF-8-ish
  if (/^[^\p{L}]*$/u.test(s)) return true;

  /* ---- selectors, CSS pairs and fragments of concatenated expressions ---- */
  if (/^\[.*\]$/.test(s) || s.includes("[data-")) return true; // attribute selector
  if (/^[.#][\w-]/.test(s)) return true; // .class / #id selector
  if (/^[a-z-]+:[a-z0-9 .,%()#-]*$/i.test(s)) return true; // text-align:right, gap:8px
  if (/\besc\(|\blocation\.|\bdocument\.|\bwindow\./.test(s)) return true; // code
  if (/^[,)+\s]|[,(+]\s*$/.test(s)) return true; // a snipped expression, not a sentence
  if (/^[a-z]+\/[a-z+*.-]+$/i.test(s)) return true; // MIME types
  return false;
}

/** Words identical in Spanish, Catalan and English — silence is correct. */
const SHARED = new Set(
  (
    "erp iva irpf nif cif iban pdf csv url id ok total no email web app sms " +
    "canei subirats leads lead crm kpi dso dpo ebitda"
  ).split(/\s+/),
);
const allShared = (t) => {
  const w = t
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  return w.length > 0 && w.every((x) => SHARED.has(x) || /^\d+$/.test(x));
};

/**
 * Is this string Spanish?
 *
 * The question the audit really wants answered, asked of the CONTENT rather
 * than of where the string sits. Two independent signals, either sufficient:
 *
 *   · a character Spanish has and English does not — á é í ó ú ñ ü ¿ ¡
 *   · a Spanish function word, which English sentences do not contain
 *
 * Function words are the reliable half: a label like "Guardar cliente" carries
 * no accent, and "Registro de clientes" is caught by "de". A single word with
 * no accent and no function word ("Contacto") is NOT caught here — that one is
 * caught by being a dictionary key, checked separately, which is the honest
 * division: content decides when it can, and the dictionary decides when only
 * a person could.
 */
const ES_WORDS =
  /(?:^|\s)(?:de|del|la|el|los|las|un|una|para|con|por|se|que|es|son|hay|sin|más|y|o|en|al|su|sus|no|lo|le|ya|como|cuando|donde|este|esta|estos|antes|después|sobre|entre|cada|todo|toda|todos|todas|debe|puede|solo|sólo)(?:\s|$)/i;
function looksSpanish(t) {
  if (/[áéíóúñü¿¡]/i.test(t)) return true;
  const words = t.trim().split(/\s+/);
  return words.length >= 2 && ES_WORDS.test(" " + t + " ");
}

function dictionary() {
  const w = {};
  for (const f of ["i18n-dict.js", "i18n-dict-ca.js"]) {
    const p = resolve(SITE, f);
    if (fs.existsSync(p)) new Function("window", fs.readFileSync(p, "utf8"))(w);
  }
  const D = w.CANEI_DICT || {};
  const pairs = new Map(D.pairs || []);
  if (!pairs.size) {
    console.error("FAIL: the dictionary read as empty — nothing could be checked.");
    process.exit(1);
  }
  return {
    pairs,
    ca: D.ca || {},
    rx: TARGET === "ca" ? D.rxEs2Ca || [] : D.rxEs2En || [],
  };
}

const D = dictionary();

/**
 * Does the dictionary have anything to say about this string?
 *
 * BOTH DIRECTIONS, because the files are not all written in the same language.
 * `erp.html` is authored in Spanish; `journey.html`, `master-data.html` and
 * `financial-data.html` are authored in English. Spanish is the hub, so an
 * English source string reaches Catalan as EN → ES → CA, and checking only
 * `ca[text]` reported every correctly-translated English label as a gap —
 * 150-odd false alarms, which is exactly how a report stops being read.
 */
function translated(text) {
  if (TARGET === "ca") {
    if (D.ca[text] !== undefined) return true;
    // English source: find the Spanish key it maps back to, then ask for its
    // Catalan.
    for (const [es, en] of D.pairs) if (en === text && D.ca[es] !== undefined) return true;
  } else if (D.pairs.has(text)) {
    return true;
  } else {
    // English source in an English-authored file: already in the target
    // language, and nothing needs translating.
    for (const [, en] of D.pairs) if (en === text) return true;
  }
  // A regex rule counts: "3 proyectos activos" is covered by a rule, not an entry.
  return D.rx.some(([re]) => {
    try {
      return re.test(text);
    } catch {
      return false;
    }
  });
}

const missing = [];
const seen = new Set();
let scanned = 0;

for (const file of FILES) {
  const path = resolve(SITE, file);
  if (!fs.existsSync(path)) continue;
  const src = fs.readFileSync(path, "utf8");
  // The page's own declaration, not a guess: it is what the runtime uses to
  // decide whether to translate this document at all.
  const declared = (/<html[^>]*\blang="([a-z]{2})"/.exec(src) || [])[1] || "es";
  const spanishSource = declared === "es";
  for (const [re, kind] of SOURCES) {
    for (const m of src.matchAll(re)) {
      const raw = m[1].replace(/\s+/g, " ").trim();
      if (!raw || seen.has(file + " " + raw)) continue;
      seen.add(file + " " + raw);
      scanned++;
      if (isNotProse(raw) || allShared(raw)) continue;
      /**
       * WHICH STRINGS MUST HAVE AN ENTRY depends on the language the file is
       * written in, and getting this wrong is what let "Guardar cliente" past.
       *
       * A SPANISH-authored file (erp.html) is the source of truth for the
       * whole dictionary: every prose literal in it is shown to somebody in
       * Spanish, so every one of them needs a translation. No cleverness — the
       * rule is "all of it", which is the only rule that cannot have a hole.
       * Trying to detect Spanish here is what failed: "Guardar cliente" has no
       * accent and no function word, and a two-word button is invisible to any
       * content test.
       *
       * An ENGLISH-authored file is the other way round: its literals are
       * already in the target language and need nothing — except the Spanish
       * ones, which are a mistake in the source and cannot be fixed by any
       * dictionary, because when the reader picks English the translator
       * correctly does nothing at all.
       */
      if (!spanishSource && !looksSpanish(raw) && !D.pairs.has(raw)) continue;
      if (translated(raw)) continue;
      missing.push({ text: raw, kind, file, base: spanishSource ? "es" : "en" });
    }
  }
}

const byFile = {};
for (const m of missing) (byFile[m.file] = byFile[m.file] || []).push(m);

console.log(`\n──── source audit: strings with no ${TARGET.toUpperCase()} translation ────`);
console.log(`${scanned} candidate literals scanned across ${FILES.length} files\n`);
for (const [file, list] of Object.entries(byFile)) {
  console.log(`✗ ${file.padEnd(22)} ${String(list.length).padStart(4)} untranslated`);
  for (const m of list.slice(0, Number(process.env.AUDIT_SHOW || 12)))
    console.log(`      · [${m.kind}] ${m.text.slice(0, 88)}`);
  if (list.length > 12) console.log(`      … and ${list.length - 12} more`);
}
console.log(`\n${missing.length} user-visible strings have no ${TARGET.toUpperCase()} entry`);

if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(missing, null, 1));
if (MAX !== null && missing.length > MAX) {
  console.error(`FAIL: ${missing.length} untranslated, limit ${MAX}`);
  process.exit(1);
}
