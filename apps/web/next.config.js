import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Load the single root `.env` so the web app and Prisma share one config file.
// Missing file is a no-op (e.g. in CI/production, where env comes from the host).
const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
config({ path: resolve(rootDir, ".env") });

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Emit a self-contained server bundle (server.js plus only the node_modules
  // Next traced) so the production container needs no pnpm, no workspace and no
  // second install. Required by the root Dockerfile.
  output: "standalone",
  // Trace from the monorepo root, not apps/web — otherwise the workspace
  // packages above are missed and the container starts with missing modules.
  outputFileTracingRoot: rootDir,
  // Workspace packages export TypeScript sources; Next transpiles them.
  transpilePackages: [
    "@repo/kernel",
    "@repo/capability-quoting",
    "@repo/capability-billing",
    "@repo/pack-jurisdiction-es-es",
    "@repo/pack-vertical-construction-reformas",
    "@repo/factory",
    "@repo/db",
    "@repo/ui",
  ],
  // THE WORKSPACE MUST NOT BE CACHED WITHOUT ASKING.
  //
  // `public/workspace/` is a build-time copy of `site/`, and Next serves files
  // from `public/` with no revalidation hint of its own. The phone shells keep
  // a web view alive per tab for the life of the process, so a stale copy is
  // not refetched by anything a person does — and the failure is silent and
  // MIXED, which is what makes it expensive: the app was seen rendering a new
  // `erp-ds.css` against an old `erp.html`, so half the redesign appeared and
  // half did not, and the page's own scripts were the old ones too. A native
  // shell calling into a function the cached page does not define gets nothing,
  // with no error to notice.
  //
  // `no-cache` does not mean "do not store" — it means store it, but ask first.
  // Every request becomes a conditional one, so an unchanged file still costs a
  // 304 and the bytes stay on the device. That is the right trade for files
  // that carry the whole application and change on every release.
  async headers() {
    return [
      {
        source: "/workspace/:path*",
        headers: [{ key: "Cache-Control", value: "no-cache, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
