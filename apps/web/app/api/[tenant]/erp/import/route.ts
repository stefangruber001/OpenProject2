/**
 * Move an existing ERP document onto the server.
 *
 *   POST { _meta?, data }        — the envelope `#btnExport` produces
 *   POST { …state }              — or a bare state object
 *
 * The workspace has always had an export and never an import, which meant data
 * could leave a browser and never arrive anywhere. This is the other half.
 *
 * Refuses to overwrite by default. A tenant that already holds records is a
 * company that is already operating, and "import" is the kind of word someone
 * clicks twice — so replacing existing data needs `?overwrite=true` AND the
 * exact version being replaced, the same rule every other write follows.
 */
import { loadErp } from "@/lib/erp-runtime";
import { requireUser } from "@/lib/session";
import { guarded, json } from "@/lib/api";
import { ERP, Migrations } from "@/lib/erp-engine";
import { listTenants } from "@/lib/tenant-runtime";
import { FactoryError } from "@repo/kernel";
import type { ErpState } from "@/lib/erp-types";

export const dynamic = "force-dynamic";

/** Cheap structural check — enough to reject a wrong file, not a schema validator. */
function asState(body: unknown): ErpState {
  if (typeof body !== "object" || body === null) {
    throw new FactoryError("BAD_REQUEST", "Body must be a JSON object.");
  }
  const envelope = body as Record<string, unknown>;
  const candidate = (envelope.data ?? envelope) as Record<string, unknown>;

  if (typeof candidate !== "object" || candidate === null) {
    throw new FactoryError("BAD_REQUEST", "No ERP state found in the body.");
  }
  // `parties` and `seq` are present in every state the engine has ever
  // produced. Without a check, a wrong file imports as an empty company and
  // looks like it worked.
  if (!Array.isArray(candidate.parties) || typeof candidate.seq !== "object") {
    throw new FactoryError(
      "BAD_REQUEST",
      "This does not look like an ERP export: no `parties` array and `seq` object. " +
        "Use the file produced by Exportar in the workspace.",
    );
  }
  return candidate as unknown as ErpState;
}

export async function POST(req: Request, ctx: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await ctx.params;
  return guarded(async () => {
    const user = await requireUser(req);
    if (!listTenants().includes(tenant)) {
      throw new FactoryError("NOT_FOUND", `No tenant "${tenant}".`);
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new FactoryError("BAD_REQUEST", "Body must be JSON.");
    }
    const incoming = asState(body);

    const params = new URL(req.url).searchParams;
    const overwrite = params.get("overwrite") === "true";
    const expected = params.get("expectedVersion");

    const { version: currentVersion } = await loadErp(tenant);

    if (currentVersion > 0 && !overwrite) {
      throw new FactoryError(
        "INVALID_STATE",
        `"${tenant}" already holds data (version ${currentVersion}). Importing would ` +
          `replace it. Re-send with ?overwrite=true&expectedVersion=${currentVersion} ` +
          `if that is genuinely what you want.`,
        { currentVersion },
      );
    }
    if (currentVersion > 0 && Number(expected) !== currentVersion) {
      throw new FactoryError(
        "STALE_WRITE",
        `Version mismatch: you asked to replace version ${expected}, but "${tenant}" is ` +
          `at version ${currentVersion}.`,
        { expectedVersion: Number(expected), currentVersion },
      );
    }

    // Same ladder every read runs, so an old export lands in the current shape
    // rather than sitting there missing keys until something throws far away.
    const migrated = Migrations.migrate(incoming);
    const erp = ERP.from(migrated.state);

    const db = await import("@repo/db");
    const store = new db.PrismaErpStateStore(db.prisma, tenant, "state");
    const version = await store.save(erp.toJSON(), currentVersion, user);

    const state = erp.toJSON();
    const counts = Object.fromEntries(
      Object.entries(state)
        .filter(([, v]) => Array.isArray(v))
        .map(([k, v]) => [k, (v as unknown[]).length])
        .filter(([, n]) => (n as number) > 0),
    );

    return json({
      tenant,
      version,
      replaced: currentVersion > 0 ? currentVersion : null,
      migrated: migrated.applied,
      importedBy: user,
      // Reported back so whoever ran it can see what actually arrived, rather
      // than trusting a 200.
      counts,
    });
  });
}
