import { nextJsConfig } from "@repo/eslint-config/next-js";

/** @type {import("eslint").Linter.Config[]} */
export default [
  // Node build tooling (PDF renderer etc.) — not part of the app's lint surface.
  // `public/` is a GENERATED copy of site/ (scripts/sync-workspace.mjs): browser
  // globals, ES5 UMD, and already linted at its source. Linting the copy would
  // report every finding twice and fail on rules site/ was never held to.
  { ignores: ["scripts/**", "public/**"] },
  ...nextJsConfig,
];
