/**
 * Durable-adapter contract tests. They run ONLY when DATABASE_URL is set
 * (CI provides a Postgres service and applies migrations first); locally
 * without a database they skip — the suite stays green either way, and the
 * adapters are exercised by the SAME kits as the in-memory implementations.
 */
import { PrismaClient } from "@prisma/client";
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
  PrismaEventLog,
  PrismaKeyValueStore,
  PrismaRepository,
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

  describe("tenant scoping (defense in depth)", () => {
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
}
