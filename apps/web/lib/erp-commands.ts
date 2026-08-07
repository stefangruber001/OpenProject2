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
 * The set below is exactly the mutations `site/erp.html` performs today — the
 * ten `mutate()` call sites collapse to nine engine methods, because the party
 * activate/deactivate toggle uses two of them.
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

  // --- money in --------------------------------------------------------
  recordCollection: { method: "recordCollection", arity: 1, describes: "record a collection" },

  // --- money out -------------------------------------------------------
  payBills: { method: "payBills", arity: 1, describes: "pay supplier bills" },

  // --- bank ------------------------------------------------------------
  allocateMovementToProject: {
    method: "allocateMovementToProject",
    arity: 3,
    describes: "allocate a bank movement to a project",
  },

  // --- site work -------------------------------------------------------
  markProgress: { method: "markProgress", arity: 4, describes: "record progress on site" },
  approveChange: { method: "approveChange", arity: 2, describes: "approve a change order" },

  // --- periodic --------------------------------------------------------
  quarterlyPackage: {
    method: "quarterlyPackage",
    arity: 1,
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
