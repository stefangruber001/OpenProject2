/**
 * Durable-adapter contract tests. They run ONLY when DATABASE_URL is set
 * (CI provides a Postgres service and applies migrations first); locally
 * without a database they skip — the suite stays green either way, and the
 * adapters are exercised by the SAME kits as the in-memory implementations.
 */
import { PrismaClient } from "@prisma/client";
import { isFactoryError, type FactoryError } from "@repo/kernel";
import {
  appendOnlyContract,
  counterContract,
  keyValueContract,
  repositoryContract,
} from "@repo/kernel/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  PrismaAppendOnlyStore,
  PrismaCounterStore,
  PrismaErpBlobStore,
  PrismaErpStateStore,
  PrismaEventLog,
  PrismaKeyValueStore,
  PrismaRepository,
  erpStateVersions,
} from "./stores";

const DB = process.env.DATABASE_URL;

if (!DB) {
  describe.skip("Prisma store adapters (skipped: no DATABASE_URL)", () => {
    it("skipped", () => {});
  });
} else {
  const prisma = new PrismaClient();
  let n = 0;
  /** Fresh tenant per contract run — isolation without truncation. */
  const freshTenant = async () => {
    const id = `contract-${Date.now()}-${n++}`;
    await prisma.tenant.create({ data: { id, name: id } });
    return id;
  };

  beforeAll(async () => {
    await prisma.$queryRaw`SELECT 1`;
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  repositoryContract("prisma", async () => new PrismaRepository(prisma, await freshTenant(), "t"));
  appendOnlyContract(
    "prisma",
    async () => new PrismaAppendOnlyStore(prisma, await freshTenant(), "t"),
  );
  counterContract("prisma", async () => new PrismaCounterStore(prisma, await freshTenant()));
  keyValueContract("prisma", async () => new PrismaKeyValueStore(prisma, await freshTenant()));

  // NOTE: these prove the APPLICATION-level `WHERE tenant_id` only. They pass
  // even with RLS disabled, because the adapters filter before the database
  // gets a chance to. The database half of "defense in depth" is a separate
  // question — and is only real when the connection cannot bypass RLS. See the
  // block below.
  describe("tenant scoping (application-level filter)", () => {
    it("one tenant's rows are invisible to another tenant's store", async () => {
      const t1 = await freshTenant();
      const t2 = await freshTenant();
      const s1 = new PrismaRepository<{ id: string; secret: string }>(prisma, t1, "doc");
      const s2 = new PrismaRepository<{ id: string; secret: string }>(prisma, t2, "doc");
      await s1.save({ id: "x", secret: "t1-only" });
      expect(await s2.get("x")).toBeUndefined();
      expect(await s2.list()).toEqual([]);
    });

    it("event sequences are per tenant", async () => {
      const t1 = await freshTenant();
      const t2 = await freshTenant();
      const l1 = new PrismaEventLog(prisma, t1);
      const l2 = new PrismaEventLog(prisma, t2);
      const a = await l1.append({
        type: "a",
        at: "2026-07-16T00:00:00Z",
        tenantId: t1,
        payload: {},
      });
      const b = await l2.append({
        type: "b",
        at: "2026-07-16T00:00:00Z",
        tenantId: t2,
        payload: {},
      });
      expect(a.seq).toBe(1);
      expect(b.seq).toBe(1);
      expect((await l1.list()).length).toBe(1);
    });
  });

  describe("erpStateVersions (the cheap 'has anything changed?' probe)", () => {
    it("reports each document's version, and omits ones never written", async () => {
      const t = await freshTenant();
      await new PrismaErpStateStore(prisma, t, "state").save({ a: 1 }, 0, "ana");
      await new PrismaErpStateStore(prisma, t, "master-data").save({ b: 2 }, 0, "ana");
      await new PrismaErpStateStore(prisma, t, "state").save({ a: 2 }, 1, "ana");

      expect(await erpStateVersions(prisma, t)).toEqual({ state: 2, "master-data": 1 });
    });

    it("is scoped to one tenant", async () => {
      const mine = await freshTenant();
      const theirs = await freshTenant();
      await new PrismaErpStateStore(prisma, theirs, "state").save({ secret: true }, 0, "them");
      expect(await erpStateVersions(prisma, mine)).toEqual({});
    });
  });

  describe("PrismaErpBlobStore (site photographs)", () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);

    it("stores bytes and gives them back unchanged", async () => {
      const s = new PrismaErpBlobStore(prisma, await freshTenant());
      expect(await s.get("img_missing")).toBeNull();

      await s.put("img_a", jpeg, "image/jpeg", "ana");
      const got = await s.get("img_a");
      expect(got?.mime).toBe("image/jpeg");
      expect(got?.size).toBe(jpeg.byteLength);
      // Byte-for-byte. A photograph that survives a round trip "mostly" is a
      // corrupt photograph.
      expect(Array.from(got!.bytes)).toEqual(Array.from(jpeg));
    });

    it("writing the same key twice replaces rather than duplicates", async () => {
      const s = new PrismaErpBlobStore(prisma, await freshTenant());
      await s.put("img_a", jpeg, "image/jpeg", "ana");
      const second = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
      await s.put("img_a", second, "image/png", "ana");

      const got = await s.get("img_a");
      expect(got?.mime).toBe("image/png");
      expect(Array.from(got!.bytes)).toEqual(Array.from(second));
    });

    it("deleting is idempotent", async () => {
      const s = new PrismaErpBlobStore(prisma, await freshTenant());
      await s.put("img_a", jpeg, "image/jpeg");
      await s.delete("img_a");
      expect(await s.get("img_a")).toBeNull();
      await expect(s.delete("img_a")).resolves.toBeUndefined();
    });

    it("one company cannot read another's photographs", async () => {
      const mine = await freshTenant();
      const theirs = await freshTenant();
      await new PrismaErpBlobStore(prisma, theirs).put("img_a", jpeg, "image/jpeg");
      // Same key, different tenant: must be invisible, not merely filtered by
      // a WHERE the caller could forget.
      expect(await new PrismaErpBlobStore(prisma, mine).get("img_a")).toBeNull();
    });
  });

  describe("PrismaErpStateStore (optimistic concurrency)", () => {
    it("an absent document loads as version 0 and first save takes version 1", async () => {
      const s = new PrismaErpStateStore(prisma, await freshTenant());
      expect(await s.load()).toEqual({ state: null, version: 0 });
      expect(await s.save({ parties: [] }, 0, "ana")).toBe(1);
      expect(await s.load()).toEqual({ state: { parties: [] }, version: 1 });
    });

    it("a second writer holding a stale version is rejected and changes nothing", async () => {
      const s = new PrismaErpStateStore(prisma, await freshTenant());
      await s.save({ note: "start" }, 0, "ana");

      // Both read version 1; Ana saves first and takes version 2.
      const { version: anaSaw } = await s.load();
      const { version: brunoSaw } = await s.load();
      expect(await s.save({ note: "ana's afternoon" }, anaSaw, "ana")).toBe(2);

      await expect(s.save({ note: "bruno's overwrite" }, brunoSaw, "bruno")).rejects.toThrow(
        /STALE_WRITE/,
      );

      // The whole point: Ana's work is still there.
      expect(await s.load()).toEqual({ state: { note: "ana's afternoon" }, version: 2 });
    });

    it("the rejection names the version the writer should have had", async () => {
      const s = new PrismaErpStateStore(prisma, await freshTenant());
      await s.save({ n: 1 }, 0);
      await s.save({ n: 2 }, 1);
      const err = await s.save({ n: 3 }, 1).catch((e: unknown) => e);
      expect(isFactoryError(err, "STALE_WRITE")).toBe(true);
      expect((err as FactoryError).details).toMatchObject({
        expectedVersion: 1,
        currentVersion: 2,
      });
    });

    it("racing first-creates do not both succeed", async () => {
      const t = await freshTenant();
      const a = new PrismaErpStateStore(prisma, t);
      const b = new PrismaErpStateStore(prisma, t);
      const results = await Promise.allSettled([a.save({ w: "a" }, 0), b.save({ w: "b" }, 0)]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect((await a.load()).version).toBe(1);
    });

    it("documents are per tenant and per key", async () => {
      const t1 = await freshTenant();
      const t2 = await freshTenant();
      await new PrismaErpStateStore(prisma, t1).save({ secret: "t1-only" }, 0);
      expect(await new PrismaErpStateStore(prisma, t2).load()).toEqual({
        state: null,
        version: 0,
      });
      expect(await new PrismaErpStateStore(prisma, t1, "other").load()).toEqual({
        state: null,
        version: 0,
      });
    });
  });
}

/**
 * The database half of the isolation, which the tests above cannot see.
 *
 * RLS_TEST_DATABASE_URL must point at the same database as the RESTRICTED
 * application role (ops/harden-db-role.sh). Connected as the owner these
 * assertions would all fail: the owner is a superuser, and Postgres lets
 * superusers bypass row-level security regardless of FORCE ROW LEVEL SECURITY.
 * That is precisely the bug this guards against coming back — an app that
 * connects as the owner has app-level filtering and nothing else.
 */
const RLS_DB = process.env.RLS_TEST_DATABASE_URL;

if (!RLS_DB || !DB) {
  describe.skip("row-level security (skipped: no RLS_TEST_DATABASE_URL)", () => {
    it("skipped", () => {});
  });
} else {
  describe("row-level security (database-level isolation)", () => {
    // Two connections: the owner seeds the fixtures (it can see everything),
    // the restricted role is the one under test.
    const owner = new PrismaClient({ datasources: { db: { url: DB } } });
    const restricted = new PrismaClient({ datasources: { db: { url: RLS_DB } } });
    afterAll(async () => {
      await Promise.all([owner.$disconnect(), restricted.$disconnect()]);
    });

    it("the application role cannot bypass RLS", async () => {
      const roles = await restricted.$queryRaw<{ bypasses: boolean }[]>`
        SELECT (rolsuper OR rolbypassrls) AS bypasses
        FROM pg_roles WHERE rolname = current_user`;
      expect(roles).toHaveLength(1);
      expect(roles[0]?.bypasses).toBe(false);
    });

    it("sees nothing at all when no tenant is set", async () => {
      const rows = await restricted.$queryRaw<unknown[]>`SELECT 1 FROM aggregates LIMIT 1`;
      expect(rows).toEqual([]);
    });

    it("sees only the tenant named by app.tenant_id", async () => {
      const t1 = `rls-${Date.now()}-a`;
      const t2 = `rls-${Date.now()}-b`;
      await owner.tenant.createMany({
        data: [
          { id: t1, name: t1 },
          { id: t2, name: t2 },
        ],
      });
      await new PrismaRepository(owner, t1, "doc").save({ id: "x" });
      await new PrismaRepository(owner, t2, "doc").save({ id: "y" });

      // Raw, WITHOUT the adapter's WHERE clause — so only RLS can be doing the
      // filtering here. An unfiltered query returning one row is the proof.
      const seen = await restricted.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.tenant_id', ${t1}, true)`;
        return tx.$queryRaw<{ id: string }[]>`SELECT id FROM aggregates`;
      });
      expect(seen).toEqual([{ id: "x" }]);
    });

    it("cannot write rows belonging to another tenant", async () => {
      const t = `rls-${Date.now()}-c`;
      await owner.tenant.create({ data: { id: t, name: t } });
      await expect(
        restricted.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT set_config('app.tenant_id', ${t}, true)`;
          // WITH CHECK on the policy must refuse a row stamped for someone else.
          await tx.$executeRaw`INSERT INTO kv_state (tenant_id, key, value)
                               VALUES ('someone-else', 'k', '{}'::jsonb)`;
        }),
      ).rejects.toThrow();
    });
  });
}
