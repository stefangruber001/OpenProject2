import { Prisma, PrismaClient } from "@prisma/client";
import {
  FactoryError,
  type AppendOnlyStore,
  type CounterStore,
  type DomainEvent,
  type EventLogPort,
  type KeyValueStore,
  type Repository,
} from "@repo/kernel";

/**
 * Durable adapters for the kernel store ports, backed by PostgreSQL.
 * Every operation is tenant-scoped twice: app-level WHERE tenant_id AND
 * database RLS policies keyed on the `app.tenant_id` GUC (defense in depth,
 * ADR-0007). Each adapter passes the SAME contract kits as the in-memory ones.
 */

type Tx = Prisma.TransactionClient;

/** Run `fn` in a transaction with the RLS GUC set for this tenant. */
async function withTenant<T>(
  prisma: PrismaClient,
  tenantId: string,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
    return fn(tx);
  });
}

export class PrismaRepository<T extends { id: string }> implements Repository<T> {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly tenantId: string,
    private readonly kind: string,
  ) {}

  async save(entity: T): Promise<void> {
    await withTenant(this.prisma, this.tenantId, (tx) =>
      tx.aggregate.upsert({
        where: {
          tenantId_kind_id: { tenantId: this.tenantId, kind: this.kind, id: entity.id },
        },
        create: {
          tenantId: this.tenantId,
          kind: this.kind,
          id: entity.id,
          payload: entity as unknown as Prisma.InputJsonValue,
        },
        update: { payload: entity as unknown as Prisma.InputJsonValue },
      }),
    );
  }

  async get(id: string): Promise<T | undefined> {
    const row = await withTenant(this.prisma, this.tenantId, (tx) =>
      tx.aggregate.findUnique({
        where: { tenantId_kind_id: { tenantId: this.tenantId, kind: this.kind, id } },
      }),
    );
    return (row?.payload as T | undefined) ?? undefined;
  }

  async list(): Promise<T[]> {
    const rows = await withTenant(this.prisma, this.tenantId, (tx) =>
      tx.aggregate.findMany({
        where: { tenantId: this.tenantId, kind: this.kind },
        orderBy: { id: "asc" },
      }),
    );
    return rows.map((r) => r.payload as T);
  }
}

export class PrismaAppendOnlyStore<T extends { id: string }> implements AppendOnlyStore<T> {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly tenantId: string,
    private readonly kind: string,
  ) {}

  async append(entity: T): Promise<void> {
    try {
      await withTenant(this.prisma, this.tenantId, (tx) =>
        tx.artifact.create({
          data: {
            tenantId: this.tenantId,
            kind: this.kind,
            id: entity.id,
            payload: entity as unknown as Prisma.InputJsonValue,
          },
        }),
      );
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new FactoryError("IMMUTABLE", `Append-only store already holds id "${entity.id}".`);
      }
      throw e;
    }
  }

  async get(id: string): Promise<T | undefined> {
    const row = await withTenant(this.prisma, this.tenantId, (tx) =>
      tx.artifact.findUnique({
        where: { tenantId_kind_id: { tenantId: this.tenantId, kind: this.kind, id } },
      }),
    );
    return (row?.payload as T | undefined) ?? undefined;
  }

  async list(): Promise<readonly T[]> {
    const rows = await withTenant(this.prisma, this.tenantId, (tx) =>
      tx.artifact.findMany({
        where: { tenantId: this.tenantId, kind: this.kind },
        orderBy: { id: "asc" },
      }),
    );
    return rows.map((r) => r.payload as T);
  }
}

export class PrismaCounterStore implements CounterStore {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly tenantId: string,
  ) {}

  async next(key: string): Promise<number> {
    const attempt = () =>
      withTenant(this.prisma, this.tenantId, (tx) =>
        tx.counter.upsert({
          where: { tenantId_key: { tenantId: this.tenantId, key } },
          create: { tenantId: this.tenantId, key, value: 1 },
          update: { value: { increment: 1 } },
        }),
      );
    try {
      return (await attempt()).value;
    } catch (e) {
      // Concurrent first-create can race; one retry resolves to the increment path.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        return (await attempt()).value;
      }
      throw e;
    }
  }
}

export class PrismaKeyValueStore implements KeyValueStore {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly tenantId: string,
    private readonly namespace = "",
  ) {}

  private k(key: string): string {
    return this.namespace ? `${this.namespace}:${key}` : key;
  }

  async get(key: string): Promise<unknown | undefined> {
    const row = await withTenant(this.prisma, this.tenantId, (tx) =>
      tx.kvState.findUnique({
        where: { tenantId_key: { tenantId: this.tenantId, key: this.k(key) } },
      }),
    );
    return row?.value ?? undefined;
  }

  async set(key: string, value: unknown): Promise<void> {
    await withTenant(this.prisma, this.tenantId, (tx) =>
      tx.kvState.upsert({
        where: { tenantId_key: { tenantId: this.tenantId, key: this.k(key) } },
        create: {
          tenantId: this.tenantId,
          key: this.k(key),
          value: value as Prisma.InputJsonValue,
        },
        update: { value: value as Prisma.InputJsonValue },
      }),
    );
  }
}

export class PrismaEventLog implements EventLogPort {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly tenantId: string,
  ) {}

  async append(evt: Omit<DomainEvent, "seq">): Promise<DomainEvent> {
    return withTenant(this.prisma, this.tenantId, async (tx) => {
      const counter = await tx.counter.upsert({
        where: { tenantId_key: { tenantId: this.tenantId, key: "__events__" } },
        create: { tenantId: this.tenantId, key: "__events__", value: 1 },
        update: { value: { increment: 1 } },
      });
      const stored: DomainEvent = Object.freeze({ ...evt, seq: counter.value });
      await tx.event.create({
        data: {
          tenantId: this.tenantId,
          seq: stored.seq,
          type: stored.type,
          at: stored.at,
          payload: stored.payload as Prisma.InputJsonValue,
        },
      });
      return stored;
    });
  }

  async list(): Promise<readonly DomainEvent[]> {
    const rows = await withTenant(this.prisma, this.tenantId, (tx) =>
      tx.event.findMany({ where: { tenantId: this.tenantId }, orderBy: { seq: "asc" } }),
    );
    return rows.map((r) =>
      Object.freeze({
        seq: r.seq,
        type: r.type,
        at: r.at,
        tenantId: r.tenantId,
        payload: r.payload as Record<string, unknown>,
      }),
    );
  }
}
