// =============================================================================
// Bundles @repo/erp-browser (and, through it, the capabilities it composes)
// into two committed artifacts under site/:
//
//   site/erp-factory.js   IIFE, window.ErpFactory  — loaded by erp.html
//   site/erp-factory.cjs  CommonJS                 — loaded by Node tests/sims
//
// Both are COMMITTED to the repository on purpose. .github/workflows/pages.yml
// publishes site/** verbatim with a bare checkout — no Node, no pnpm — so a
// build step there is not an option. CI guards the committed copies against
// drift by rebuilding and diffing (see the "Capability bundle" step in ci.yml).
//
// Deliberately NOT minified: the artifact is reviewed in diffs, the site E2E
// asserts zero console errors and needs readable stack traces, and size is not
// the binding constraint here (site/ already ships a 154 KB i18n dictionary).
//
// Run: pnpm --filter @repo/erp-browser build
// =============================================================================
import * as esbuild from "esbuild";
import { statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const entry = resolve(__dirname, "src/index.ts");

/** Shared across both output formats so the two artifacts can never diverge. */
const shared = {
  entryPoints: [entry],
  bundle: true,
  minify: false,
  sourcemap: false,
  legalComments: "none",
  define: { "process.env.NODE_ENV": '"production"' },
  banner: {
    // No commit sha, no timestamp: either would churn the committed artifact on
    // every build and make the CI drift check meaningless.
    js: "/* GENERATED — do not edit by hand. Rebuild: pnpm --filter @repo/erp-browser build */",
  },
};

await esbuild.build({
  ...shared,
  format: "iife",
  globalName: "ErpFactory",
  platform: "browser",
  target: ["es2019", "safari14", "chrome90"],
  outfile: resolve(repoRoot, "site/erp-factory.js"),
});

await esbuild.build({
  ...shared,
  format: "cjs",
  platform: "neutral",
  target: ["node20"],
  outfile: resolve(repoRoot, "site/erp-factory.cjs"),
});

const kb = (p) => (statSync(p).size / 1024).toFixed(1) + " KB";
console.log(`site/erp-factory.js   ${kb(resolve(repoRoot, "site/erp-factory.js"))}`);
console.log(`site/erp-factory.cjs  ${kb(resolve(repoRoot, "site/erp-factory.cjs"))}`);
