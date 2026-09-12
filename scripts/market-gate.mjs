/**
 * ACCEPTANCE GATE FOR THE MARKET ROADMAP ARTEFACTS.
 *
 * The operator's one operational instruction for the unattended run was "if
 * the data is empty, wait and restart again". This is that instruction made
 * mechanical: an artefact is accepted only if it exists, is long enough to be
 * a real answer, carries every section its phase was asked for, and contains
 * none of the ways a model says "I did not do this" while producing a file.
 *
 * Run:  node scripts/market-gate.mjs <phase> <file>
 * Exit: 0 accepted · 1 rejected, with the reasons on stdout so the retry can
 *       quote them back to the agent.
 */
import fs from "node:fs";

const [, , phase, file] = process.argv;
if (!phase || !file) {
  console.error("usage: node scripts/market-gate.mjs <phase> <file>");
  process.exit(2);
}

/* Sections each phase must carry. Loose, case-insensitive substrings of a
   heading or a bold label — the gate guards against an empty or truncated
   answer, not against a disagreeable one. */
const MUST = {
  0: ["part a", "part b", "part c", "open questions"],
  1: ["market definition", "cnae", "tam", "sweet spot", "adjacency"],
  2: ["icp", "cultural", "administrative", "geographic", "economic", "l0", "rubric"],
  3: [
    "verifactu",
    "crea y crece",
    "sii",
    "subcontrat",
    "modelo 303",
    "kit digital",
    "urgency",
    "non-regulatory",
  ],
  "4a": ["sabi", "borme", "gdpr", "permit", "caateeb"],
  "4c": ["error rate"],
  5: ["tier a", "tier b", "tier c", "tier d", "clv"],
  6: ["payback", "against", "pricing"],
  7: ["configuration surface", "15", "cost per layer", "margin", "compounding"],
  8: ["channel", "sequencing", "meddpicc", "sales cycle", "catalan", "objection"],
  9: ["first-touch", "follow-up", "linkedin", "leave-behind", "pitch", "referral"],
  10: ["kill criteria", "gdpr", "baseline"],
  11: ["pre-mortem", "sizing", "layer", "icp", "value", "experiment"],
  12: ["thesis", "90-day", "falsification"],
};
const MIN_WORDS = { "4c": 500, 9: 1200 };
const BANNED = ["i cannot ", "as an ai", "[todo]", "tbd", "{{", "lorem ipsum"];
const BANNED_6 = ["streamline", "efficiency", "digital transformation", " solution"];

const fail = [];
if (!fs.existsSync(file)) {
  console.log(`✗ ${file} does not exist`);
  process.exit(1);
}
const raw = fs.readFileSync(file, "utf8");
const low = raw.toLowerCase();

if (phase === "4b") {
  const rows = raw.split("\n").filter((l) => l.trim());
  let parsed = 0;
  const bad = [];
  for (const [i, l] of rows.entries()) {
    try {
      const o = JSON.parse(l);
      if (!o.legal_name || !Array.isArray(o.source_urls) || !o.source_urls.length)
        bad.push(`row ${i + 1}: missing legal_name or source_urls`);
      else parsed += 1;
    } catch {
      bad.push(`row ${i + 1}: not JSON`);
    }
  }
  if (parsed < 40) fail.push(`${parsed} valid rows, need at least 40`);
  if (bad.length > rows.length * 0.1)
    fail.push(`${bad.length} bad rows: ${bad.slice(0, 5).join("; ")}`);
} else {
  const words = raw.split(/\s+/).filter(Boolean).length;
  const min = MIN_WORDS[phase] || 1500;
  if (words < min) fail.push(`${words} words, need at least ${min}`);
  for (const m of MUST[phase] || [])
    if (!low.includes(m)) fail.push(`missing section or term: "${m}"`);
  for (const b of BANNED) if (low.includes(b)) fail.push(`contains "${b.trim()}"`);
  if (phase === "6")
    for (const b of BANNED_6)
      if (low.includes(b)) fail.push(`banned word for this phase: "${b.trim()}"`);
  if (phase === "3") {
    // Every instrument named must either be cited or flagged UNVERIFIED.
    const instruments = ["11/2021", "1007/2023", "18/2022"];
    for (const ins of instruments)
      if (!raw.includes(ins)) fail.push(`instrument ${ins} not discussed`);
    if (!/(BOE|AEAT|boe\.es|agenciatributaria)/i.test(raw) && !/UNVERIFIED/.test(raw))
      fail.push("no primary-source citation and no UNVERIFIED label anywhere");
  }
  if (phase === "9") {
    // Catalan must actually be present: a few markers a Spanish text never has.
    if (!/\b(amb|són|també|aquest|pressupost|obra|feina)\b/i.test(raw) || !/[·]l|l·l|ç/.test(raw))
      fail.push("no Catalan text detected (expected ela geminada, ç, or common Catalan words)");
    if (!/\[REQUIRES CUSTOMER CONSENT\]/.test(raw))
      fail.push("no [REQUIRES CUSTOMER CONSENT] placeholder");
  }
}

if (fail.length) {
  console.log(`✗ phase ${phase} · ${file}`);
  for (const f of fail) console.log("  · " + f);
  process.exit(1);
}
console.log(`✓ phase ${phase} · ${file} accepted`);
