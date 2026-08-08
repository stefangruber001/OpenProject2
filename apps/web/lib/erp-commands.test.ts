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

  // Pinned deliberately. Widening what a request body may invoke should be a
  // visible line in a diff, not something that arrives with an unrelated change
  // — so adding a command is expected to fail this test until it is listed.
  it("accepts exactly these mutations and no others", () => {
    expect(commandNames().sort()).toEqual(
      [
        "addParty",
        "addTask",
        "allocateMovementToProject",
        "approveChange",
        "completeTask",
        "deactivateParty",
        "markProgress",
        "payBills",
        "quarterlyPackage",
        "recordCollection",
        "updateParty",
        "updateTask",
      ].sort(),
    );
  });
});

/**
 * The reported symptom: one person adds a task, the other never sees it.
 *
 * The engine half of that is what these cover — a task added through the
 * whitelist has to survive being written out and read back by somebody else,
 * because that round trip through the stored document is the only thing that
 * makes shared work planning possible.
 */
describe("a task survives the trip between two people", () => {
  it("is in the serialised document, so a colleague loading it sees the task", () => {
    const mine = new ERP("2026-03-01") as unknown as Record<string, (...a: unknown[]) => unknown>;
    mine.addTask?.({ title: "Site visit — Barcelona", due: "2026-03-09" }, "stefan@example.com");

    // What the server would store, and hand to the next person to ask.
    const stored = JSON.parse(JSON.stringify((mine as unknown as { state: unknown }).state));
    const theirs = ERP.from(stored) as unknown as { state: { tasks: Record<string, unknown>[] } };

    const task = theirs.state.tasks.find((t) => t.title === "Site visit — Barcelona");
    expect(task, "the task a colleague loads").toBeDefined();
    expect(task?.due).toBe("2026-03-09");
    expect(task?.status).toBe("open");
  });

  it("records who added it, so the schedule is attributable", () => {
    // addTask took the acting user and ignored it: no audit entry, no author on
    // the record. Caught by driving two signed-in sessions against a real server.
    const erp = new ERP("2026-03-01") as unknown as Record<string, (...a: unknown[]) => unknown> & {
      state: { audit: { user?: string; action?: string }[]; tasks: { id: string }[] };
    };
    erp.addTask?.({ title: "Order tiles" }, "ignacio@example.com");
    erp.completeTask?.(erp.state.tasks[0]!.id, "stefan@example.com");

    const actions = erp.state.audit.map((a) => `${a.user}:${a.action}`);
    expect(actions).toContain("ignacio@example.com:addTask");
    expect(actions).toContain("stefan@example.com:completeTask");
  });

  it("puts the author on the task itself, not only in the audit trail", () => {
    // "Who put this in the calendar?" has to be answerable from the task, which
    // is what a schedule screen actually renders.
    const erp = new ERP("2026-03-01") as unknown as Record<string, (...a: unknown[]) => unknown> & {
      state: { tasks: { createdBy?: string }[] };
    };
    erp.addTask?.({ title: "Order tiles" }, "ignacio@example.com");
    expect(erp.state.tasks[0]?.createdBy).toBe("ignacio@example.com");
  });

  it("refuses to complete a task that does not exist rather than inventing one", () => {
    const erp = new ERP("2026-03-01") as unknown as Record<string, (...a: unknown[]) => unknown>;
    expect(() => erp.completeTask?.("tsk-nope", anyUser)).toThrow(/not found/i);
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
