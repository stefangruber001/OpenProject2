/**
 * The ERP engine, running on the server.
 *
 * `site/erp-engine.js` is imported as-is, with no changes and no shim. It was
 * written to run in both places — the UMD wrapper exports to `module.exports`
 * under Node and to `window.ErpEngine` in a browser — and it touches no browser
 * global at all: no window, document, indexedDB, btoa, FileReader, crypto,
 * Intl or fetch. It is also free of hidden non-determinism: no Math.random, no
 * Date.now, no bare `new Date()`. Time is injected (`new ERP(today)`) and dates
 * are UTC string arithmetic. The business simulations already `require()` it
 * and pass 145/145 invariants over a simulated year and 253/253 over two.
 *
 * That is why this file is short. The engine did not need porting; it needed a
 * caller on this side of the network.
 *
 * BUILD NOTE: these are static imports so Next's file tracing follows them into
 * the standalone bundle. `outputFileTracingRoot` is the monorepo root, so
 * `site/` is inside the traced tree. Do not turn these into a runtime
 * `createRequire(...)` of a computed path — tracing cannot see through that,
 * and the failure mode is a container that builds, starts, passes its health
 * check and then throws on the first ERP request. That exact shape of bug has
 * already happened once here with the tenant specs; the deploy smoke test grew
 * a real ERP route check because of it.
 */
// Plain JavaScript with no declaration file, and deliberately so: `allowJs`
// lets TypeScript read the source and infer every shape, so the types here
// cannot drift from the engine and a rename over there is a compile error over
// here. See lib/erp-types.ts.
import * as EngineModule from "../../../site/erp-engine.js";
import * as MigrationsModule from "../../../site/erp-migrations.js";

export const ERP = EngineModule.ERP;
export const Migrations = MigrationsModule;
