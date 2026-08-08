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
};

export default nextConfig;
