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

// Re-export the generated model *types* (your Prisma models) so consumers
// import everything database-related from `@repo/db`. Type-only avoids pulling
// Prisma's CommonJS runtime through the bundler. For enum runtime values, import
// from `@prisma/client` directly.
export type * from "@prisma/client";
