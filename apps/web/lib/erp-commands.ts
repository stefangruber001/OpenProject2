/**
 * What the ERP API is allowed to do.
 *
 * The engine exposes ~164 methods. Most are read-only projections, but the
 * mutating ones include things like reissuing an invoice or rewriting a party's
 * bank details, and the object is reached by name from a request body. Without
 * a list, "call `erp[body.command]`" is a remote-code-execution shape: anything
 * on the prototype chain becomes callable, `constructor` included.
 *
 * So the mapping is explicit and closed. Adding a command is a deliberate edit
 * here, reviewed like any other change, rather than a side effect of adding a
 * method to the engine.
 *
 * The set below started as exactly the mutations `site/erp.html` performs — the
 * ten `mutate()` call sites collapse to nine engine methods, because the party
 * activate/deactivate toggle uses two of them. The scheduling three were added
 * afterwards, ahead of a UI: a task entered by one person was staying on that
 * person's device, and a command the server will not accept is the first of the
 * reasons why. See `docs/WHY-THE-CALENDAR-IS-NOT-SHARED.md` for the others.
 *
 * `user` is deliberately NOT part of `arity`. Every mutating engine method
 * takes the acting user as its last argument and writes it to `state.audit`;
 * the server appends it from the session, so a caller cannot claim to be
 * somebody else by putting a name in the request body.
 */

export interface CommandSpec {
  /** Method to invoke on the engine instance. */
  readonly method: string;
  /** How many positional arguments come from the request, before `user`. */
  readonly arity: number;
  /** Sentence fragment for the audit note and error messages. */
  readonly describes: string;
}

export const COMMANDS = {
  // --- parties ---------------------------------------------------------
  addParty: { method: "addParty", arity: 1, describes: "add a party" },
  updateParty: { method: "updateParty", arity: 2, describes: "update a party" },
  deactivateParty: { method: "deactivateParty", arity: 1, describes: "deactivate a party" },
  // A15 · deletion is allowed THROUGH the engine, which refuses any party
  // carrying economic documents — the same rule the screen enforces. Without
  // this the test suite's own cleanup had no door to use, and every run left
  // an «E2E …» row in the live register.
  deleteParty: { method: "deleteParty", arity: 1, describes: "delete a party" },

  // --- money in --------------------------------------------------------
  recordCollection: { method: "recordCollection", arity: 1, describes: "record a collection" },

  // --- money out -------------------------------------------------------
  payBills: { method: "payBills", arity: 1, describes: "pay supplier bills" },

  // --- bank ------------------------------------------------------------
  allocateMovementToProject: {
    method: "allocateMovementToProject",
    /* FOUR, NOT THREE. The engine method is
       `allocateMovementToProject(movId, ref, kind, where, user)` — `where`
       arrived with the work that made every euro name its partida AND its
       subpartida, and this number did not follow it. The whitelist is what
       the server is allowed to forward, so a stale arity does not just fail a
       test: it silently drops the subpartida on its way through the API. */
    arity: 4,
    describes: "allocate a bank movement to a project",
  },

  // --- site work -------------------------------------------------------
  markProgress: { method: "markProgress", arity: 4, describes: "record progress on site" },
  approveChange: { method: "approveChange", arity: 2, describes: "approve a change order" },

  // --- scheduling ------------------------------------------------------
  // Shared work planning: without these the engine can hold tasks but the
  // server cannot be told about one, so a schedule entered by one person stays
  // on that person's device and a colleague never sees it. That is the whole
  // point of the data being on a server.
  addTask: { method: "addTask", arity: 1, describes: "add a task" },
  updateTask: { method: "updateTask", arity: 2, describes: "update a task" },
  completeTask: { method: "completeTask", arity: 1, describes: "complete a task" },

  // --- periodic --------------------------------------------------------
  // (period, options). The engine grew an options argument and stayed callable
  // with the old two-argument form, so the declared arity has to move with it
  // or the whitelist test — which reads the real function's length — fails.
  quarterlyPackage: {
    method: "quarterlyPackage",
    arity: 2,
    describes: "generate the quarterly archive",
  },
} as const satisfies Record<string, CommandSpec>;

export type CommandName = keyof typeof COMMANDS;

export function isCommandName(value: unknown): value is CommandName {
  return typeof value === "string" && Object.hasOwn(COMMANDS, value);
}

/** Every command the API accepts, for error messages and documentation. */
export function commandNames(): CommandName[] {
  return Object.keys(COMMANDS) as CommandName[];
}
