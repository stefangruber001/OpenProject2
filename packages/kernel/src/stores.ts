import { FactoryError } from "./errors";

/**
 * Persistence ports. Capabilities depend on these interfaces only; adapters
 * (in-memory today, Postgres+RLS next — ADR-0007) are injected by the host.
 * All async so a remote adapter is a drop-in. Every adapter must pass the
 * contract kits in `testing/contracts.ts` — same tests, any backend.
 */
export interface Repository<T extends { id: string }> {
  /** Upsert. */
  save(entity: T): Promise<void>;
  get(id: string): Promise<T | undefined>;
  list(): Promise<T[]>;
}

/** Append-only: no update, no delete — issued artifacts are immutable. */
export interface AppendOnlyStore<T extends { id: string }> {
  append(entity: T): Promise<void>;
  get(id: string): Promise<T | undefined>;
  list(): Promise<readonly T[]>;
}

/** Atomic, gapless counters (numbering series). */
export interface CounterStore {
  next(key: string): Promise<number>;
}

/** Small durable state (e.g. chain heads). */
export interface KeyValueStore {
  get(key: string): Promise<unknown | undefined>;
  set(key: string, value: unknown): Promise<void>;
}

// --- In-memory adapters (P1 runtime & unit tests) ---------------------------

export class InMemoryRepository<T extends { id: string }> implements Repository<T> {
  private map = new Map<string, T>();
  async save(entity: T): Promise<void> {
    this.map.set(entity.id, entity);
  }
  async get(id: string): Promise<T | undefined> {
    return this.map.get(id);
  }
  async list(): Promise<T[]> {
    return [...this.map.values()];
  }
}

export class InMemoryAppendOnlyStore<T extends { id: string }> implements AppendOnlyStore<T> {
  private map = new Map<string, T>();
  async append(entity: T): Promise<void> {
    if (this.map.has(entity.id)) {
      throw new FactoryError("IMMUTABLE", `Append-only store already holds id "${entity.id}".`);
    }
    this.map.set(entity.id, entity);
  }
  async get(id: string): Promise<T | undefined> {
    return this.map.get(id);
  }
  async list(): Promise<readonly T[]> {
    return [...this.map.values()];
  }
}

export class InMemoryCounterStore implements CounterStore {
  private counters = new Map<string, number>();
  async next(key: string): Promise<number> {
    const value = (this.counters.get(key) ?? 0) + 1;
    this.counters.set(key, value);
    return value;
  }
}

export class InMemoryKeyValueStore implements KeyValueStore {
  private map = new Map<string, unknown>();
  async get(key: string): Promise<unknown | undefined> {
    return this.map.get(key);
  }
  async set(key: string, value: unknown): Promise<void> {
    this.map.set(key, value);
  }
}
