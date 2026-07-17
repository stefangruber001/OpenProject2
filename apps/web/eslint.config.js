import { nextJsConfig } from "@repo/eslint-config/next-js";

/** @type {import("eslint").Linter.Config[]} */
export default [
  // Node build tooling (PDF renderer etc.) — not part of the app's lint surface.
  { ignores: ["scripts/**"] },
  ...nextJsConfig,
];
