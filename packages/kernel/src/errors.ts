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
  | "NOT_FOUND";

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
