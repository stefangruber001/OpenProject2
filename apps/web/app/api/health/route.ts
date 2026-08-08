import { env } from "@/lib/env";

// Never cache — this reflects live process/database state.
export const dynamic = "force-dynamic";

/**
 * Liveness/readiness probe. Returns `ok` as long as the app is serving, and
 * reports whether the database is reachable when one is configured.
 *
 * It also reports the commit the running image was built from. That is the one
 * fact this project has repeatedly got wrong: the pipeline goes green, the
 * registry has the new image, the container is healthy — and the code
 * answering is days old. Every other way of checking needs SSH and Docker,
 * which means it does not get checked. This is public because it has to be
 * answerable from a laptop in one request, and it exposes nothing: a commit
 * hash of a private repository identifies a build, not its contents.
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
    revision: process.env.BUILD_REVISION || "unknown",
    timestamp: new Date().toISOString(),
  });
}
