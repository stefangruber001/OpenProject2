/**
 * THE SUBMISSION, CHECKED BEFORE APPLE CHECKS IT.
 *
 * A rejection is not a bug report. It is three to seven days, one at a time,
 * for things a script can see in a second: a subtitle two characters over the
 * limit, a screenshot at the wrong size, a locale that has a description and no
 * keywords, a `FILL-ME` nobody filled. Roughly two in five first submissions are
 * rejected, and the published lists of reasons are mostly this kind of thing
 * rather than anything about the software.
 *
 * So everything Apple rejects for that can be read out of this repository is
 * read out of it here, and the release workflow runs this before it uploads
 * anything. What CANNOT be checked here is named at the bottom of
 * docs/RELEASE-IOS.md instead — the App Privacy questionnaire and the custom-app
 * distribution setting are screens in App Store Connect, and a gate that
 * pretended to cover them would be worse than one that says it does not.
 *
 * Run:  node tests/app-store/run.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const META = path.join(ROOT, "ios/fastlane/metadata");
const SHOTS = path.join(ROOT, "ios/fastlane/screenshots");
const MANIFEST = path.join(ROOT, "ios/CaneiSubirats/Resources/PrivacyInfo.xcprivacy");

/* TWO AUDIENCES, TWO VERDICTS.
   Ordinary CI asserts what the REPOSITORY owns — limits, parity, sizes, the
   manifest — and must stay green while the operator-only values are still
   blank, because those cannot be filled from here and blocking every commit on
   them would only teach everybody to ignore a red gate. The release workflow
   runs the same script with `--ready`, where a blank the reviewer needs is a
   failure, because that is the moment it stops being pending and starts being
   a rejection. */
const READY = process.argv.includes("--ready");

let pass = 0;
const fail = [];
const pending = [];
const check = (ok, why) => {
  if (ok) pass += 1;
  else fail.push(why);
};
/** A value only the operator can supply: pending in CI, fatal at submission. */
const needsOperator = (ok, why) => {
  if (ok) pass += 1;
  else if (READY) fail.push(why);
  else pending.push(why);
};
const read = (p) => (fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null);

/* ------------------------------------------------------------------ 1 · text
   Apple's limits, as App Store Connect enforces them. A field over its limit is
   not truncated politely — the upload is refused, which on a good day costs the
   run and on a bad day costs the submission slot. */
const LIMITS = {
  name: 30,
  subtitle: 30,
  promotional_text: 170,
  keywords: 100,
  description: 4000,
  release_notes: 4000,
};
/* Every locale must carry the same set of files. A locale with a description
   and no keywords is not half-translated, it is a listing Apple shows with a
   hole in it. */
const REQUIRED_PER_LOCALE = [
  "name",
  "subtitle",
  "description",
  "keywords",
  "promotional_text",
  "release_notes",
  "support_url",
  "marketing_url",
  "privacy_url",
];

const locales = fs.existsSync(META)
  ? fs
      .readdirSync(META, { withFileTypes: true })
      .filter((d) => d.isDirectory() && /^[a-z]{2}(-[A-Z]{2})?$/.test(d.name))
      .map((d) => d.name)
  : [];

check(locales.length >= 1, `no locales under ios/fastlane/metadata — nothing to submit`);

for (const loc of locales) {
  for (const field of REQUIRED_PER_LOCALE) {
    const file = path.join(META, loc, field + ".txt");
    const body = read(file);
    if (body === null) {
      fail.push(`${loc}/${field}.txt is missing — every locale carries the same fields`);
      continue;
    }
    const value = body.trim();
    check(value.length > 0, `${loc}/${field}.txt is empty`);
    if (LIMITS[field])
      check(
        value.length <= LIMITS[field],
        `${loc}/${field}.txt is ${value.length} characters, Apple's limit is ${LIMITS[field]}`,
      );
    if (field.endsWith("_url"))
      check(
        /^https:\/\/[^\s]+\.[^\s]+/.test(value) && !/\s/.test(value),
        `${loc}/${field}.txt is not a single https URL: «${value.slice(0, 60)}»`,
      );
  }
  /* Keywords are one comma-separated string and Apple counts the separators.
     A trailing space after each comma is 11 wasted characters out of 100. */
  const kw = (read(path.join(META, loc, "keywords.txt")) || "").trim();
  if (kw) check(!/,\s/.test(kw), `${loc}/keywords.txt has spaces after commas — they count`);
}

/* ------------------------------------------------------- 2 · the app record */
const CATEGORIES = new Set([
  "BUSINESS",
  "PRODUCTIVITY",
  "UTILITIES",
  "FINANCE",
  "EDUCATION",
  "REFERENCE",
  "LIFESTYLE",
  "DEVELOPER_TOOLS",
  "GRAPHICS_DESIGN",
  "HEALTH_FITNESS",
  "SOCIAL_NETWORKING",
  "TRAVEL",
]);
for (const f of ["primary_category", "secondary_category"]) {
  const v = (read(path.join(META, f + ".txt")) || "").trim();
  check(v.length > 0, `${f}.txt is missing`);
  if (v) check(CATEGORIES.has(v), `${f}.txt is «${v}», which is not an App Store category key`);
}
check(
  ((read(path.join(META, "copyright.txt")) || "").trim() || "").length > 0,
  `copyright.txt is empty`,
);

/* ------------------------------------------------- 3 · what App Review needs
   An app a reviewer cannot sign into is rejected under guideline 2.1, and this
   product has no public sign-up, so the credentials are not optional. The
   PASSWORD is the one value allowed to be a placeholder in git: the release lane
   writes it in from ASC_DEMO_PASSWORD for the length of the run. */
const REVIEW = path.join(META, "review_information");
const REVIEW_FIELDS = [
  "first_name",
  "last_name",
  "phone_number",
  "email_address",
  "demo_user",
  "demo_password",
  "notes",
];
for (const f of REVIEW_FIELDS) {
  const v = read(path.join(REVIEW, f + ".txt"));
  if (v === null) {
    fail.push(`review_information/${f}.txt is missing`);
    continue;
  }
  check(v.trim().length > 0, `review_information/${f}.txt is empty`);
  if (f === "demo_password") continue; // supplied by the secret at run time
  needsOperator(
    !v.includes("FILL-ME"),
    `review_information/${f}.txt still says FILL-ME — App Review needs a real value`,
  );
}
const notes = read(path.join(REVIEW, "notes.txt")) || "";
const privacyUrl = (read(path.join(META, "en-US/privacy_url.txt")) || "").trim();
check(
  privacyUrl.length > 0 && notes.includes(privacyUrl),
  `review_information/notes.txt does not give the reviewer the privacy policy URL`,
);
/* The interface opens in Spanish. A reviewer who cannot change that writes the
   rejection about the language rather than about the app. */
check(
  /idioma|language/i.test(notes) && /\bEN\b|English/.test(notes),
  `review_information/notes.txt does not say how to switch the interface to English`,
);
check(
  /custom app/i.test(notes),
  `review_information/notes.txt does not say this is a custom app — the reviewer will judge it as a public one`,
);

/* ------------------------------------------------------- 4 · the screenshots
   Sizes read from the PNG header, never from the filename: a file called
   6.9-inch.png is a claim, and Apple checks the pixels. */
const APPLE_SIZES = [
  [1320, 2868], // 6.9-inch iPhone, portrait — the one size Apple requires
  [2868, 1320],
  [1290, 2796], // 6.7-inch iPhone, still accepted
  [2796, 1290],
];
function pngSize(file) {
  const b = fs.readFileSync(file);
  if (b.length < 24 || b.toString("hex", 0, 8) !== "89504e470d0a1a0a") return null;
  if (b.toString("ascii", 12, 16) !== "IHDR") return null;
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}
if (!fs.existsSync(SHOTS)) {
  fail.push("ios/fastlane/screenshots is missing — Apple will not take a listing with no images");
} else {
  for (const loc of locales) {
    const dir = path.join(SHOTS, loc);
    if (!fs.existsSync(dir)) {
      fail.push(`no screenshots for ${loc} — every listing locale needs its own`);
      continue;
    }
    const shots = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".png"));
    check(
      shots.length >= 3 && shots.length <= 10,
      `${loc}: ${shots.length} screenshots — Apple takes between 3 and 10`,
    );
    for (const s of shots) {
      const size = pngSize(path.join(dir, s));
      if (!size) {
        fail.push(`${loc}/${s} is not a readable PNG`);
        continue;
      }
      check(
        APPLE_SIZES.some(([w, h]) => w === size[0] && h === size[1]),
        `${loc}/${s} is ${size[0]}×${size[1]}, which is not an App Store screenshot size`,
      );
    }
  }
}

/* --------------------------------------------------- 5 · the privacy manifest
   Required since May 2024. Its absence is ITMS-91056, and for an app that
   touches UserDefaults it is the single most-cited privacy rejection there is.
   The app's own manifest is checked, not a dependency's. */
const manifest = read(MANIFEST);
if (manifest === null) {
  fail.push(
    "ios/CaneiSubirats/Resources/PrivacyInfo.xcprivacy is missing — Apple has required one since May 2024",
  );
} else {
  for (const key of [
    "NSPrivacyTracking",
    "NSPrivacyTrackingDomains",
    "NSPrivacyCollectedDataTypes",
    "NSPrivacyAccessedAPITypes",
  ])
    check(manifest.includes(key), `the privacy manifest declares no ${key}`);
  /* The app reads and writes UserDefaults (the Face ID arm flag, the role and
     the interface language). That is a required-reason API: declaring it is
     what stops the upload warning becoming a rejection. */
  const usesDefaults = fs
    .readdirSync(path.join(ROOT, "ios/CaneiSubirats"), { recursive: true })
    .filter((f) => String(f).endsWith(".swift"))
    .some((f) =>
      fs
        .readFileSync(path.join(ROOT, "ios/CaneiSubirats", String(f)), "utf8")
        .includes("UserDefaults"),
    );
  if (usesDefaults)
    check(
      manifest.includes("NSPrivacyAccessedAPICategoryUserDefaults") && manifest.includes("CA92.1"),
      "the app uses UserDefaults and the privacy manifest does not declare it with a reason",
    );
}

/* A gate that checked nothing would pass. */
const FLOOR = 60;
if (pass + fail.length < FLOOR)
  fail.push(`only ${pass + fail.length} checks ran, expected at least ${FLOOR}`);

console.log("──── the App Store submission, before Apple sees it ────");
for (const f of fail) console.log("  ✗ " + f);
for (const p of pending) console.log("  … " + p);
console.log(
  `${pass}/${pass + fail.length} passed · ${locales.length} locale(s): ${locales.join(", ")}` +
    (pending.length ? ` · ${pending.length} waiting on the operator` : ""),
);
if (fail.length) {
  console.log("\nEach of these costs a review cycle if Apple finds it instead of this script.");
  process.exit(1);
}
if (pending.length && !READY)
  console.log(
    "Not submittable yet, but nothing here is broken. Run with --ready to make the\n" +
      "waiting values fatal — the release workflow does exactly that before it uploads.",
  );
