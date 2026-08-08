import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { parse } from "yaml";
import {
  FactoryError,
  RandomIdGen,
  SystemClock,
  resolveTenant,
  type ResolveOptions,
} from "@repo/kernel";
import { buildServices, registries, type FactoryServices } from "@repo/factory";

/**
 * Server-side tenant runtimes for the web shell. Specs are read from
 * `tenants/<id>/tenant.yaml` (control-plane storage arrives in P4). Stores
 * are durable (Prisma + RLS) when DATABASE_URL is set, in-memory otherwise —
 * same services either way, courtesy of the kernel store contracts.
 */
const globalRuntimes = globalThis as unknown as {
  __tenantRuntimes?: Map<string, Promise<FactoryServices>>;
};

const TENANT_ID = /^[a-z0-9][a-z0-9-]*$/;

function repoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    dir = dirname(dir);
  }
  throw new FactoryError("NOT_FOUND", "repo root not found from " + process.cwd());
}

/**
 * Where tenant specs live.
 *
 * In development that is `<repo>/tenants`, found by walking up for the
 * workspace file. A production container has neither the workspace file nor
 * the repo above it — `next build --output standalone` ships only the traced
 * server — so TENANTS_DIR is set explicitly in the image. Without this the
 * app builds, starts, passes its health check and then fails every tenant
 * request with "repo root not found", which is a miserable way to discover the
 * problem in production.
 */
function tenantsDir(): string {
  const explicit = process.env.TENANTS_DIR;
  if (explicit) {
    if (!existsSync(explicit)) {
      throw new FactoryError(
        "NOT_FOUND",
        `TENANTS_DIR is set to "${explicit}" but it does not exist`,
      );
    }
    return explicit;
  }
  return join(repoRoot(), "tenants");
}

export function listTenants(): string[] {
  const dir = tenantsDir();
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith("_"))
    .filter((e) => existsSync(join(dir, e.name, "tenant.yaml")))
    .map((e) => e.name)
    .sort();
}

export async function getTenantRuntime(tenantId: string): Promise<FactoryServices> {
  if (!TENANT_ID.test(tenantId)) {
    throw new FactoryError("SPEC_INVALID", `Invalid tenant id "${tenantId}".`);
  }
  const cache = (globalRuntimes.__tenantRuntimes ??= new Map());
  let runtime = cache.get(tenantId);
  if (!runtime) {
    runtime = buildRuntime(tenantId);
    cache.set(tenantId, runtime);
    runtime.catch(() => cache.delete(tenantId)); // don't cache failures
  }
  return runtime;
}

async function buildRuntime(tenantId: string): Promise<FactoryServices> {
  const specPath = join(tenantsDir(), tenantId, "tenant.yaml");
  if (!existsSync(specPath)) {
    throw new FactoryError("NOT_FOUND", `No tenant spec at tenants/${tenantId}/tenant.yaml`);
  }
  const spec = parse(readFileSync(specPath, "utf8")) as Record<string, unknown>;

  if (process.env.DATABASE_URL) {
    const db = await import("@repo/db");
    const resolveOptions: ResolveOptions = {
      packInfra: (packId) => ({ kv: new db.PrismaKeyValueStore(db.prisma, tenantId, packId) }),
    };
    const resolved = resolveTenant(spec, registries, resolveOptions);
    return buildServices(resolved, {
      clock: new SystemClock(),
      idGen: new RandomIdGen(),
      events: new db.PrismaEventLog(db.prisma, tenantId),
      quoteStore: new db.PrismaRepository(db.prisma, tenantId, "quote"),
      invoiceStore: new db.PrismaAppendOnlyStore(db.prisma, tenantId, "invoice"),
      counters: new db.PrismaCounterStore(db.prisma, tenantId),
      aggregates: new db.PrismaKeyValueStore(db.prisma, tenantId, "aggregates"),
    });
  }

  // Dev/demo fallback: in-memory, persists for the lifetime of the process.
  const resolved = resolveTenant(spec, registries);
  return buildServices(resolved);
}
