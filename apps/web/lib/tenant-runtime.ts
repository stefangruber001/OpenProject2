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

export function listTenants(): string[] {
  const dir = join(repoRoot(), "tenants");
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
  const specPath = join(repoRoot(), "tenants", tenantId, "tenant.yaml");
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
    });
  }

  // Dev/demo fallback: in-memory, persists for the lifetime of the process.
  const resolved = resolveTenant(spec, registries);
  return buildServices(resolved);
}
