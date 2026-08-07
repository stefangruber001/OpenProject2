/**
 * The shapes the server borrows from the ERP engine.
 *
 * Derived from the JavaScript rather than hand-written. `allowJs` is on, so
 * TypeScript reads `site/erp-engine.js` and `site/erp-migrations.js` directly
 * and infers all of this — which means the types cannot drift from the engine,
 * and a rename over there becomes a compile error over here. A hand-maintained
 * `.d.ts` was tried first and was wrong within the hour (it claimed the
 * migration ladder reports migration *names*; it reports version *numbers*).
 */
import type { ERP, Migrations } from "./erp-engine";

/** A live engine instance. */
export type ErpInstance = InstanceType<typeof ERP>;

/** The whole company dataset: one plain JSON object, ~36 top-level keys. */
export type ErpState = ErpInstance["state"];

/** What the migration ladder reports after running. */
export type MigrationResult = ReturnType<typeof Migrations.migrate>;

/**
 * The engine viewed as a bag of methods, for dispatching a command by name.
 *
 * Used at exactly one place (`lib/erp-runtime.ts`) and immediately after the
 * name has been checked against the closed whitelist in `lib/erp-commands.ts`.
 * The cast is the narrow, deliberate hole; the whitelist is what makes it safe.
 */
export type ErpMethodBag = Record<string, unknown>;
