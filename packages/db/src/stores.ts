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

/** A document plus the version a writer must present to replace it. */
export interface VersionedState<T = unknown> {
  readonly state: T | null;
  readonly version: number;
}

/**
 * The version of every document this tenant has, and nothing else.
 *
 * This exists so a browser can ask "has anything changed?" cheaply and often.
 * The obvious alternative — re-fetching the document and comparing — transfers
 * the whole company register every time to answer a question whose answer is
 * almost always "no", which is the sort of thing that works beautifully with
 * one operator and one project and stops working exactly when the business
 * grows. `select` is narrowed to two columns so the payload is never read off
 * disk at all.
 *
 * Same tenant scoping as everything else here: RLS GUC inside the transaction,
 * plus an explicit WHERE. Neither is trusted to be the only one.
 */
export async function erpStateVersions(
  prisma: PrismaClient,
  tenantId: string,
): Promise<Record<string, number>> {
  const rows = await withTenant(prisma, tenantId, (tx) =>
    tx.erpState.findMany({
      where: { tenantId },
      select: { key: true, version: true },
    }),
  );
  const out: Record<string, number> = {};
  for (const row of rows) out[row.key] = row.version;
  return out;
}

/**
 * Durable home for a whole-document state, with optimistic concurrency.
 *
 * The usage is deliberately read-modify-write across two transactions rather
 * than one long one: load, do the work, then save quoting the version that was
 * loaded. Holding a transaction open for the duration of the work would serialise
 * every user behind whoever is slowest; the version check gives the same safety,
 * because a writer whose document moved underneath them is rejected instead of
 * overwriting. A caller that ignores the rejection is back to losing data, so
 * `save` throws rather than returning a flag.
 *
 * `version` 0 means "nothing stored yet" — the value to present on a first save.
 */
export class PrismaErpStateStore {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly tenantId: string,
    private readonly key = "state",
  ) {}

  async load<T = unknown>(): Promise<VersionedState<T>> {
    const row = await withTenant(this.prisma, this.tenantId, (tx) =>
      tx.erpState.findUnique({
        where: { tenantId_key: { tenantId: this.tenantId, key: this.key } },
      }),
    );
    if (!row) return { state: null, version: 0 };
    return { state: row.payload as T, version: row.version };
  }

  /** Replaces the document, or throws STALE_WRITE. Returns the new version. */
  async save(state: unknown, expectedVersion: number, user = ""): Promise<number> {
    const payload = state as Prisma.InputJsonValue;

    if (expectedVersion === 0) {
      try {
        const created = await withTenant(this.prisma, this.tenantId, (tx) =>
          tx.erpState.create({
            data: {
              tenantId: this.tenantId,
              key: this.key,
              version: 1,
              payload,
              updatedBy: user,
            },
          }),
        );
        return created.version;
      } catch (e) {
        // Someone else created it between our load and our save.
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          throw await this.stale(expectedVersion);
        }
        throw e;
      }
    }

    const { count } = await withTenant(this.prisma, this.tenantId, (tx) =>
      tx.erpState.updateMany({
        where: { tenantId: this.tenantId, key: this.key, version: expectedVersion },
        data: { payload, version: { increment: 1 }, updatedBy: user },
      }),
    );
    if (count === 0) throw await this.stale(expectedVersion);
    return expectedVersion + 1;
  }

  /** Names the version the caller should have had, so the UI can say something useful. */
  private async stale(expectedVersion: number): Promise<FactoryError> {
    const { version } = await this.load();
    return new FactoryError(
      "STALE_WRITE",
      `This record changed while you were editing it (you had version ${expectedVersion}, it is now ${version}). Reload before saving again.`,
      { expectedVersion, currentVersion: version },
    );
  }
}
