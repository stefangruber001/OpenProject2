import { json } from "@/lib/api";
import { env } from "@/lib/env";
import { environmentName } from "@/lib/environment";

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

  // Through `json()` for its no-store: `dynamic = "force-dynamic"` governs the
  // SERVER's caching and emits no header, so a probe answered from a cache
  // would report the liveness of a moment that has passed — and the revision
  // of an image that is no longer running, which is the exact failure this
  // route was added to catch.
  return json({
    status: "ok",
    database,
    revision: process.env.BUILD_REVISION || "unknown",
    // WHICH of the two systems answered. The workspace is a static file baked
    // into the image, so it cannot read an environment variable — it asks here
    // at boot and draws its band from the answer. Reported alongside `revision`
    // for the same reason that one is: "which code is running, on which system"
    // has to be answerable in a single request from a phone, or it stops being
    // answered at all.
    //
    // Public, and nothing is given away: that a test system exists is not a
    // secret, and the reply says nothing about what is in it.
    environment: environmentName(),
    timestamp: new Date().toISOString(),
  });
}
