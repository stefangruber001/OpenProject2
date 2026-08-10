export type FactoryErrorCode =
  | "MONEY_NOT_INTEGER"
  | "NO_EFFECTIVE_RULE"
  | "PORT_CONFLICT"
  | "PORT_NOT_BOUND"
  | "SPEC_INVALID"
  | "CONFIG_INVALID"
  | "UNKNOWN_PACK"
  | "UNKNOWN_CAPABILITY"
  | "KERNEL_INCOMPATIBLE"
  | "PACK_WINDOW"
  | "MISSING_PORT_IMPLEMENTATION"
  | "IMMUTABLE"
  | "INVALID_STATE"
  | "STALE_WRITE"
  | "NO_TEMPLATE"
  | "NO_OUTBOX"
  | "NOT_FOUND"
  // The CALLER got it wrong — a malformed body, an unknown command, the wrong
  // number of arguments. Distinct from SPEC_INVALID, which means the tenant's
  // own spec is broken and is the operator's problem, not the caller's. They
  // deserve different HTTP statuses and different people looking at them.
  | "BAD_REQUEST"
  // Nobody proved who they are. Distinct from BAD_REQUEST because the caller's
  // recovery is completely different — not "fix your payload" but "log in".
  | "UNAUTHENTICATED"
  // A system we depend on but do not control refused or failed — a mail server,
  // a payment gateway, a tax authority. Deliberately distinct from BAD_REQUEST:
  // the caller's payload was fine and there is nothing for them to fix, so
  // telling them "bad request" sends them to look in the wrong place entirely.
  | "INTEGRATION_FAILED";

/**
 * Single error type for the whole factory. `code` is stable API; message is
 * for humans. Resolve-time failures are loud and early by design.
 */
export class FactoryError extends Error {
  readonly code: FactoryErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: FactoryErrorCode, message: string, details?: Record<string, unknown>) {
    super(`[${code}] ${message}`);
    this.name = "FactoryError";
    this.code = code;
    this.details = details;
  }
}

export function isFactoryError(e: unknown, code?: FactoryErrorCode): e is FactoryError {
  return e instanceof FactoryError && (code === undefined || e.code === code);
}
