/**
 * Contract-test kits (test-only module — import from *.test.ts files).
 * Every persistence adapter, in-memory or Postgres, must pass these
 * unchanged (ADR-0007): same behaviour, any backend.
 */
import { describe, expect, it } from "vitest";
import type { AppendOnlyStore, CounterStore, KeyValueStore, Repository } from "../stores";

interface TestEntity {
  id: string;
  n: number;
}

type Make<T> = () => T | Promise<T>;

export function repositoryContract(label: string, make: Make<Repository<TestEntity>>): void {
  describe(`Repository contract — ${label}`, () => {
    it("round-trips save/get and lists entities", async () => {
      const repo = await make();
      await repo.save({ id: "a", n: 1 });
      await repo.save({ id: "b", n: 2 });
      expect(await repo.get("a")).toEqual({ id: "a", n: 1 });
      expect((await repo.list()).length).toBe(2);
    });

    it("returns undefined for unknown ids", async () => {
      const repo = await make();
      expect(await repo.get("missing")).toBeUndefined();
    });

    it("save is an upsert", async () => {
      const repo = await make();
      await repo.save({ id: "a", n: 1 });
      await repo.save({ id: "a", n: 9 });
      expect((await repo.get("a"))?.n).toBe(9);
      expect((await repo.list()).length).toBe(1);
    });
  });
}

export function appendOnlyContract(label: string, make: Make<AppendOnlyStore<TestEntity>>): void {
  describe(`AppendOnlyStore contract — ${label}`, () => {
    it("appends and reads back", async () => {
      const store = await make();
      await store.append({ id: "a", n: 1 });
      expect(await store.get("a")).toEqual({ id: "a", n: 1 });
      expect((await store.list()).length).toBe(1);
    });

    it("rejects duplicate ids — append-only means immutable", async () => {
      const store = await make();
      await store.append({ id: "a", n: 1 });
      await expect(store.append({ id: "a", n: 2 })).rejects.toThrowError(/IMMUTABLE/);
    });
  });
}

export function counterContract(label: string, make: Make<CounterStore>): void {
  describe(`CounterStore contract — ${label}`, () => {
    it("increments gapless per key, independent across keys", async () => {
      const counters = await make();
      expect(await counters.next("x")).toBe(1);
      expect(await counters.next("x")).toBe(2);
      expect(await counters.next("y")).toBe(1);
      expect(await counters.next("x")).toBe(3);
    });
  });
}

export function keyValueContract(label: string, make: Make<KeyValueStore>): void {
  describe(`KeyValueStore contract — ${label}`, () => {
    it("round-trips values and overwrites", async () => {
      const kv = await make();
      expect(await kv.get("k")).toBeUndefined();
      await kv.set("k", { a: 1 });
      expect(await kv.get("k")).toEqual({ a: 1 });
      await kv.set("k", 2);
      expect(await kv.get("k")).toBe(2);
    });
  });
}
