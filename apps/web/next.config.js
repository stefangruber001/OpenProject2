import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Load the single root `.env` so the web app and Prisma share one config file.
// Missing file is a no-op (e.g. in CI/production, where env comes from the host).
const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
config({ path: resolve(rootDir, ".env") });

/** @type {import('next').NextConfig} */
const nextConfig = {};

export default nextConfig;
