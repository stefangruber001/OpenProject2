import { describe, expect, it } from "vitest";
import { InMemoryEventLog } from "./events";

describe("event log", () => {
  it("appends sequentially and freezes entries", () => {
    const log = new InMemoryEventLog();
    const a = log.append({ type: "x", at: "2026-07-16T00:00:00Z", tenantId: "t", payload: {} });
    const b = log.append({ type: "y", at: "2026-07-16T00:00:01Z", tenantId: "t", payload: {} });
    expect(a.seq).toBe(1);
    expect(b.seq).toBe(2);
    expect(Object.isFrozen(a)).toBe(true);
    expect(log.list()).toHaveLength(2);
  });
});
