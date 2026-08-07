/**
 * Who is acting.
 *
 * Every mutating engine method takes the acting user as its final argument and
 * writes it to `state.audit`. On a system that will hold tax records, that name
 * has to be a person, and it has to come from the server — a name in a request
 * body is a claim, not an identity.
 *
 * INTERIM. There is no login yet: `apps/web` has no middleware, no auth library
 * and no login route, and the server is reachable only over an SSH tunnel
 * (`docs/INTERIM-HETZNER-ONLY.md`). While that is true there is exactly one
 * operator, and naming them in configuration is honest. What is NOT acceptable
 * is defaulting to "system" or "" and producing an audit trail that reads as if
 * nobody did anything — so this fails closed instead.
 *
 * When real accounts land, the body of `requireUser` becomes a session lookup
 * and nothing else in the ERP API changes. That is the point of it being one
 * function.
 */
import { FactoryError } from "@repo/kernel";

export function requireUser(): string {
  const operator = process.env.ERP_OPERATOR?.trim();
  if (!operator) {
    throw new FactoryError(
      "CONFIG_INVALID",
      "No operator identity. Set ERP_OPERATOR to the name of the person using " +
        "this server, so every change is attributable. Anonymous writes to an " +
        "invoice register are not something this API will do.",
    );
  }
  return operator;
}
