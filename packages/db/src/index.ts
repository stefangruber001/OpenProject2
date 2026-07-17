import { PrismaClient } from "@prisma/client";

/**
 * A single shared PrismaClient instance.
 *
 * In development Next.js hot-reloads modules, which would otherwise spawn a new
 * client (and a new connection pool) on every reload. Caching it on `globalThis`
 * keeps a single instance across reloads.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Durable adapters for the kernel store ports (tenant-scoped, RLS-backed).
export * from "./stores";

// Re-export the generated model *types* so consumers import everything
// database-related from `@repo/db`. Type-only avoids pulling Prisma's
// CommonJS runtime through the bundler.
export type * from "@prisma/client";
