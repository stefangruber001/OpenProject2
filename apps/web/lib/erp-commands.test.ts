/**
 * The command whitelist is a security boundary, not a convenience.
 *
 * `erp[body.command](...)` with an open name is a remote-code-execution shape:
 * every method on the prototype chain becomes callable from a request body.
 * These tests pin the closed set and the checks that run before anything
 * touches the database.
 */
import { describe, expect, it } from "vitest";
import { COMMANDS, commandNames, isCommandName } from "./erp-commands";
import { runCommand } from "./erp-runtime";
import { ERP } from "./erp-engine";

const anyUser = "ana";

describe("the command whitelist", () => {
  it("names only methods the engine actually has", () => {
    const erp = new ERP("2026-03-01") as unknown as Record<string, unknown>;
    for (const [name, spec] of Object.entries(COMMANDS)) {
      expect(typeof erp[spec.method], `${name} → ${spec.method}`).toBe("function");
    }
  });

  it("declares the arity the engine method really takes, excluding the user arg", () => {
    const erp = new ERP("2026-03-01") as unknown as Record<string, (...a: unknown[]) => unknown>;
    for (const [name, spec] of Object.entries(COMMANDS)) {
      // +1 for `user`, which the server appends and the client may not send.
      expect(erp[spec.method]?.length, `${name} → ${spec.method}`).toBe(spec.arity + 1);
    }
  });

  it("rejects anything not on the list, including prototype members", () => {
    for (const attack of [
      "constructor",
      "__proto__",
      "toString",
      "valueOf",
      "hasOwnProperty",
      "toJSON",
      "state",
      "issueInvoice",
      "",
    ]) {
      expect(isCommandName(attack), attack).toBe(false);
    }
  });

  it("accepts exactly the nine mutations the workspace performs", () => {
    expect(commandNames().sort()).toEqual(
      [
        "addParty",
        "allocateMovementToProject",
        "approveChange",
        "deactivateParty",
        "markProgress",
        "payBills",
        "quarterlyPackage",
        "recordCollection",
        "updateParty",
      ].sort(),
    );
  });
});

describe("request validation (before anything is stored)", () => {
  // Every case below must be rejected before the store is reached, so a
  // resolved promise is itself a failure — the tenant "t" does not exist and
  // there is no DATABASE_URL here.
  const call = async (body: Record<string, unknown>, user = anyUser): Promise<Error> => {
    try {
      await runCommand("t", body as never, user);
    } catch (e) {
      return e as Error;
    }
    throw new Error("expected the request to be rejected, but it succeeded");
  };

  it("refuses an unknown command and says what is allowed", async () => {
    const err = await call({ command: "dropEverything", args: [], expectedVersion: 0 });
    expect(err.message).toMatch(/Unknown command/);
    expect(err.message).toMatch(/addParty/);
  });

  it("refuses the wrong number of arguments", async () => {
    const err = await call({ command: "addParty", args: [], expectedVersion: 0 });
    expect(err.message).toMatch(/takes 1 argument/);
  });

  it("refuses a missing expectedVersion rather than defaulting it", async () => {
    // Defaulting would make every call a blind overwrite — the exact data loss
    // the version column exists to stop, and it would fail silently.
    const err = await call({ command: "addParty", args: [{}] });
    expect(err.message).toMatch(/expectedVersion is required/);
  });

  it("refuses a non-integer expectedVersion", async () => {
    const err = await call({ command: "addParty", args: [{}], expectedVersion: "1" });
    expect(err.message).toMatch(/expectedVersion is required/);
  });

  it("refuses an anonymous mutation", async () => {
    const err = await call({ command: "addParty", args: [{}], expectedVersion: 0 }, "");
    expect(err.message).toMatch(/must be attributable/);
  });
});
