import { describe, expect, it } from "vitest";
import { SeqIdGen, isFactoryError } from "@repo/kernel";
import { accessConfigSchema } from "./model";
import { AccessService } from "./service";

function svc(roles: Record<string, string[]> = {}) {
  return new AccessService({ idGen: new SeqIdGen(), config: accessConfigSchema.parse({ roles }) });
}

describe("AccessService", () => {
  it("seeds roles from config and checks permissions", () => {
    const s = svc({ admin: ["*"], field: ["visit.record", "time.log"] });
    let dir = s.seed();
    dir = s.assign(dir, "wife", "admin");
    dir = s.assign(dir, "husband", "field");
    expect(s.can(dir, "wife", "invoice.issue")).toBe(true); // wildcard
    expect(s.can(dir, "husband", "visit.record")).toBe(true);
    expect(s.can(dir, "husband", "invoice.issue")).toBe(false);
    expect(s.can(dir, "stranger", "anything")).toBe(false);
  });

  it("unions permissions across multiple roles", () => {
    const s = svc({ a: ["x"], b: ["y"] });
    let dir = s.seed();
    dir = s.assign(dir, "u", "a");
    dir = s.assign(dir, "u", "b");
    expect(s.permissionsOf(dir, "u").sort()).toEqual(["x", "y"]);
  });

  it("rejects a duplicate role and an unknown role assignment", () => {
    const s = svc();
    const dir = s.addRole(s.seed(), "owner", ["*"]);
    try {
      s.addRole(dir, "owner", []);
      throw new Error("should throw");
    } catch (e) {
      expect(isFactoryError(e, "INVALID_STATE")).toBe(true);
    }
    try {
      s.assign(dir, "u", "ghost");
      throw new Error("should throw");
    } catch (e) {
      expect(isFactoryError(e, "NOT_FOUND")).toBe(true);
    }
  });
});
