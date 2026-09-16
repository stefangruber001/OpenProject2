/**
 * THE ENRICHMENT PIPELINE — one command, whichever door is open.
 *
 * 73 of the 128 prospect firms have no telephone and 101 no email, and the
 * reason is not the research method: this session cannot fetch a web page.
 * `curl`, `WebFetch` and a real headless Chromium all fail against eInforma,
 * Empresite, Google and the firms' own sites. Only web SEARCH works, so the
 * enrichment so far has read search snippets — which is why the activity code
 * and the address filled well (a directory snippet carries them) and the
 * telephone and the email did not (they live on a contact page nobody opened).
 *
 * There are three doors, and they stack. This script implements all three as
 * interchangeable sources, PROBES which are open before doing anything, and
 * prints what it found. Flip a switch, re-run one command, and the cells fill.
 *
 *   direct  plain fetch of a registry page or the firm's own contact page.
 *           Opens when the cloud environment's Network access is set to Full
 *           (or to Custom including these hosts). Free, ~2 minutes.
 *   places  Google Places Text Search → Place Details. Opens when
 *           GOOGLE_PLACES_API_KEY is present. The canonical source for a local
 *           business's telephone; 128 firms sits inside the free monthly tier.
 *   search  the snippet route we already have. Always open. The floor, not a
 *           substitute — it is why the gap exists.
 *
 * WHAT IT WILL NOT DO. It never invents a value, never overwrites an audited
 * one, and records the URL every value came from. Precedence when the workbook
 * resolves a field: 04-PROSPECTS (audited) → 04d (this) → 04c → 04b.
 *
 * Usage:
 *   node scripts/market-enrich.mjs --probe          report open doors, write nothing
 *   node scripts/market-enrich.mjs --only "<name>"  one firm, for a smoke test
 *   node scripts/market-enrich.mjs                  all 128 → 04d-ENRICHED.jsonl
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "docs/market/barcelona");
const OUT = path.join(SRC, "04d-ENRICHED.jsonl");
const KEY = process.env.GOOGLE_PLACES_API_KEY || "";
const argv = process.argv.slice(2);
const PROBE = argv.includes("--probe");
const ONLY = (() => {
  const i = argv.indexOf("--only");
  return i >= 0 ? String(argv[i + 1] || "").toLowerCase() : "";
})();

const jsonl = (f) =>
  fs.existsSync(path.join(SRC, f))
    ? fs
        .readFileSync(path.join(SRC, f), "utf8")
        .split("\n")
        .filter((l) => l.trim())
        .map((l) => JSON.parse(l))
    : [];

const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\b(s\.?l\.?u?\.?|s\.?a\.?|s\.?c\.?p\.?|s\.?c\.?c\.?l\.?|sl|slu|sa|scp)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/* ------------------------------------------------------------------ probes */
const withTimeout = (ms, p) =>
  Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

/* THE DENIAL LOOKS LIKE A RESPONSE, WHICH IS HOW IT FOOLED THE FIRST VERSION
   OF THIS PROBE. The egress proxy answers a blocked host with a real HTTP 403
   carrying `x-deny-reason: host_not_allowed` and a ~100-byte plain-text body,
   so a probe that accepted "any status under 500" reported the door OPEN while
   every page was in fact refused. A door that cannot tell open from shut is
   worse than no door: it would have sent the operator to spend an afternoon on
   an enrichment that could not fetch anything. Blocked is now identified by
   the proxy's own header, and open requires 2xx AND a body big enough to be a
   page. */
const blocked = (r) =>
  r.headers.get("x-deny-reason") !== null || r.status === 403 || r.status === 407;

async function probeDirect() {
  const tried = [];
  for (const url of ["https://empresite.eleconomista.es/", "https://example.com/"]) {
    const host = new URL(url).hostname;
    try {
      const r = await withTimeout(12000, fetch(url, { redirect: "follow" }));
      if (blocked(r)) {
        tried.push(`${host}: ${r.headers.get("x-deny-reason") || r.status}`);
        continue;
      }
      if (r.ok) {
        const body = await r.text();
        if (body.length > 500) return { ok: true, via: host };
        tried.push(`${host}: ${body.length}-byte body, not a page`);
        continue;
      }
      tried.push(`${host}: HTTP ${r.status}`);
    } catch (e) {
      tried.push(`${host}: ${String(e.message).slice(0, 40)}`);
    }
  }
  return { ok: false, why: `egress blocked — ${tried.join(" · ")}` };
}

async function probePlaces() {
  if (!KEY) return { ok: false, why: "GOOGLE_PLACES_API_KEY not set" };
  try {
    const r = await withTimeout(
      12000,
      fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "X-Goog-Api-Key": KEY,
          "X-Goog-FieldMask": "places.id",
        },
        body: JSON.stringify({ textQuery: "reformas Barcelona", maxResultCount: 1 }),
      }),
    );
    if (r.ok) return { ok: true, via: "places.googleapis.com" };
    return { ok: false, why: `Places API answered ${r.status}` };
  } catch (e) {
    return { ok: false, why: `Places unreachable: ${String(e.message).slice(0, 60)}` };
  }
}

/* ------------------------------------------------------------ direct source
   Registry and own-site pages put the contact details in predictable places:
   a `tel:`/`mailto:` link, or schema.org microdata. Parsed with regexes rather
   than a DOM library on purpose — the workspace has no HTML parser and adding
   one to the lockfile for a prospecting script is not a trade worth making. */
const RX = {
  tel: /(?:href=["']tel:|itemprop=["']telephone["'][^>]*content=["'])\s*\+?([\d\s().-]{7,20})/gi,
  mail: /(?:href=["']mailto:|itemprop=["']email["'][^>]*content=["'])\s*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi,
  esPhone: /(?:^|[^\d])((?:\+34[\s.-]?)?[6789]\d{2}[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2})(?!\d)/g,
};
const cleanPhone = (s) => String(s).replace(/[^\d+]/g, "");
const plausiblePhone = (s) => {
  const d = cleanPhone(s).replace(/^\+34/, "");
  return d.length === 9 && /^[6789]/.test(d);
};

async function fetchText(url) {
  const r = await withTimeout(
    20000,
    fetch(url, {
      redirect: "follow",
      headers: { "user-agent": "Mozilla/5.0 (compatible; prospect-research)" },
    }),
  );
  if (blocked(r)) throw new Error(`blocked: ${r.headers.get("x-deny-reason") || r.status}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const ct = r.headers.get("content-type") || "";
  if (!/text|html|json/i.test(ct)) throw new Error(`content-type ${ct}`);
  return (await r.text()).slice(0, 800_000);
}

async function viaDirect(firm) {
  const found = {};
  const bases = [firm.website].filter(Boolean);
  if (!bases.length) return found;
  const base = bases[0].startsWith("http") ? bases[0] : "https://" + bases[0];
  // The contact page first: it is where a firm publishes what we are missing.
  const candidates = [
    base,
    ...["contacto", "contacte", "contact", "es/contacto", "quienes-somos"].map(
      (p) => base.replace(/\/+$/, "") + "/" + p,
    ),
  ];
  for (const url of candidates) {
    let html;
    try {
      html = await fetchText(url);
    } catch {
      continue;
    }
    if (!found.phone) {
      const m = [...html.matchAll(RX.tel)]
        .map((x) => x[1])
        .concat([...html.matchAll(RX.esPhone)].map((x) => x[1]));
      const good = m.map(cleanPhone).find(plausiblePhone);
      if (good) {
        found.phone = good;
        found.phone_source = url;
      }
    }
    if (!found.email) {
      const m = [...html.matchAll(RX.mail)].map((x) => x[1]);
      // A firm's own domain address beats a generic one it also lists.
      const host = new URL(base).hostname.replace(/^www\./, "");
      const own = m.find((a) => a.toLowerCase().endsWith("@" + host));
      const any = m.find((a) => !/example|sentry|wixpress|\.png|\.jpg/i.test(a));
      if (own || any) {
        found.email = (own || any).toLowerCase();
        found.email_source = url;
      }
    }
    if (found.phone && found.email) break;
  }
  return found;
}

/* ------------------------------------------------------------ places source
   Text Search resolves the firm to a place; Place Details returns the fields
   the pipeline is short of. The field mask is deliberate: it decides the
   billing tier, and asking for reviews would move it up one. */
async function viaPlaces(firm) {
  const q = [firm.legal_name, firm.municipality, "Barcelona"].filter(Boolean).join(", ");
  const s = await withTimeout(
    20000,
    fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Goog-Api-Key": KEY,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress",
      },
      body: JSON.stringify({
        textQuery: q,
        languageCode: "es",
        regionCode: "ES",
        maxResultCount: 3,
      }),
    }),
  );
  if (!s.ok) return {};
  const places = ((await s.json()) || {}).places || [];
  // Only accept a match whose name really is this firm; Maps will happily
  // return the town hall for a query it cannot satisfy.
  const want = norm(firm.legal_name);
  const hit = places.find((p) => {
    const got = norm(p.displayName?.text || "");
    return got && (got.includes(want) || want.includes(got));
  });
  if (!hit) return {};
  const d = await withTimeout(
    20000,
    fetch(`https://places.googleapis.com/v1/${hit.id}`, {
      headers: {
        "X-Goog-Api-Key": KEY,
        "X-Goog-FieldMask":
          "id,displayName,formattedAddress,nationalPhoneNumber,internationalPhoneNumber,websiteUri,rating,userRatingCount,regularOpeningHours.weekdayDescriptions,businessStatus",
      },
    }),
  );
  if (!d.ok) return {};
  const p = await d.json();
  const url = `https://www.google.com/maps/place/?q=place_id:${hit.id}`;
  const out = {};
  const put = (k, v) => {
    if (v !== undefined && v !== null && v !== "") {
      out[k] = v;
      out[k + "_source"] = url;
    }
  };
  put("phone", p.nationalPhoneNumber || p.internationalPhoneNumber);
  put("website", p.websiteUri);
  put("address", p.formattedAddress);
  put("rating", p.rating);
  put("reviews", p.userRatingCount);
  put("hours", (p.regularOpeningHours?.weekdayDescriptions || []).join(" · ") || undefined);
  // A closed business must never reach a call list.
  if (p.businessStatus && p.businessStatus !== "OPERATIONAL") {
    out.business_status = p.businessStatus;
    out.business_status_source = url;
  }
  return out;
}

/* --------------------------------------------------------------------- run */
const prospects = jsonl("04-PROSPECTS.jsonl");
const prior = jsonl("04c-ENRICHED.jsonl");
const byName = new Map(prior.map((r) => [norm(r.legal_name), r]));
const firms = prospects.map((p) => {
  const e = byName.get(norm(p.legal_name)) || {};
  return {
    legal_name: p.legal_name,
    nif: p.nif || e.nif || null,
    municipality: p.municipality || null,
    website: p.website || e.website || null,
    tier: e.tier || null,
    have: { phone: !!(p.phone || e.phone), email: !!(p.email || e.email) },
  };
});

const [direct, places] = await Promise.all([probeDirect(), probePlaces()]);
const live = [direct.ok && "direct", places.ok && "places", "search"].filter(Boolean);
console.log("──── enrichment doors ────");
console.log(`  direct : ${direct.ok ? "OPEN via " + direct.via : "closed — " + direct.why}`);
console.log(`  places : ${places.ok ? "OPEN via " + places.via : "closed — " + places.why}`);
console.log(`  search : OPEN (snippets only — this is what produced the current gaps)`);
const missingPhone = firms.filter((f) => !f.have.phone).length;
const missingEmail = firms.filter((f) => !f.have.email).length;
console.log(
  `\n${firms.length} firms · ${missingPhone} without a phone · ${missingEmail} without an email`,
);

if (PROBE) {
  console.log(
    direct.ok || places.ok
      ? "\nA door is open — run without --probe to fill."
      : "\nNothing to fill with. Open one:\n" +
          "  · Environment → Network access → Full  (free, ~2 min, opens `direct`)\n" +
          "  · Set GOOGLE_PLACES_API_KEY in the environment's API credentials (opens `places`;\n" +
          "    128 firms is inside the free monthly tier)",
  );
  process.exit(0);
}
if (!direct.ok && !places.ok) {
  console.log("\nRefusing to run: neither `direct` nor `places` is open, and `search` alone");
  console.log("is exactly what left these cells empty. Open a door (see --probe) and re-run.");
  process.exit(1);
}

const targets = ONLY ? firms.filter((f) => norm(f.legal_name).includes(norm(ONLY))) : firms;
if (!targets.length) {
  console.log(`\n--only ${ONLY} matched no firm.`);
  process.exit(2);
}
console.log(`\nfilling ${targets.length} firm(s) using: ${live.join(", ")}\n`);

const results = [];
let n = 0;
for (const f of targets) {
  n += 1;
  const rec = { legal_name: f.legal_name, nif: f.nif, tier: f.tier };
  try {
    if (places.ok) Object.assign(rec, await viaPlaces(f));
    if (direct.ok && (!rec.phone || !rec.email)) {
      const d = await viaDirect(f);
      for (const [k, v] of Object.entries(d)) if (rec[k] === undefined) rec[k] = v;
    }
  } catch (e) {
    rec.notes = `error: ${String(e.message).slice(0, 120)}`;
  }
  const got = ["phone", "email", "website", "address", "rating", "hours"].filter(
    (k) => rec[k] !== undefined,
  );
  results.push(rec);
  if (ONLY || n % 10 === 0 || got.length)
    console.log(
      `  ${String(n).padStart(3)}/${targets.length} ${f.legal_name.slice(0, 38).padEnd(38)} ${got.join(",") || "—"}`,
    );
}

// Every value keeps the URL it came from; a value without one is dropped rather
// than shipped, exactly as the earlier passes were held to.
const SOURCED = [
  "phone",
  "email",
  "website",
  "address",
  "rating",
  "reviews",
  "hours",
  "business_status",
];
let stripped = 0;
for (const r of results)
  for (const k of SOURCED)
    if (r[k] !== undefined && !r[k + "_source"]) {
      delete r[k];
      stripped += 1;
    }

fs.writeFileSync(OUT, results.map((r) => JSON.stringify(r)).join("\n") + "\n");
const fill = (k) =>
  results.filter((r) => r[k] !== undefined && r[k] !== null && r[k] !== "").length;
console.log(`\n${results.length} rows → ${OUT}`);
for (const k of SOURCED)
  console.log(`  ${k.padEnd(16)} ${String(fill(k)).padStart(3)}/${results.length}`);
if (stripped) console.log(`  ${stripped} value(s) dropped for having no source`);
const closed = results.filter((r) => r.business_status);
if (closed.length) {
  console.log(`\n  ${closed.length} firm(s) are not OPERATIONAL on Maps — do not call:`);
  for (const c of closed) console.log(`   · ${c.legal_name} (${c.business_status})`);
}
