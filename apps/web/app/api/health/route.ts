import { env } from "@/lib/env";

// Never cache — this reflects live process/database state.
export const dynamic = "force-dynamic";

/**
 * Liveness/readiness probe. Returns `ok` as long as the app is serving, and
 * reports whether the database is reachable when one is configured.
 */
export async function GET() {
  let database: "connected" | "not_configured" | "error" = "not_configured";

  if (env.DATABASE_URL) {
    try {
      const { prisma } = await import("@repo/db");
      await prisma.$queryRaw`SELECT 1`;
      database = "connected";
    } catch {
      database = "error";
    }
  }

  return Response.json({
    status: "ok",
    database,
    timestamp: new Date().toISOString(),
  });
}
