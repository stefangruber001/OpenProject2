/**
 * Sending an invitation, or being honest that nothing was sent.
 *
 * `email-out@1` is the port; its only bound adapter today writes to the log and
 * delivers nothing. That is the whole reason this file exists as its own thing
 * rather than three lines inside a route handler: the difference between "sent"
 * and "logged" has to reach the screen, and a boolean that is always true would
 * be indistinguishable from working.
 *
 * WHAT HAPPENS WITH NO SMTP. Nothing leaves, this returns false, and the screen
 * shows the activation link for the admin to pass on — over WhatsApp, or in
 * person. That is a real cost and it is the honest one: the alternative is a
 * green tick for a message nobody will ever receive, and the person waiting for
 * it has no way to tell the difference.
 *
 * WHAT HAPPENS WITH SMTP. Configure `SMTP_URL` and `SMTP_FROM`, and this sends
 * for real. The transport is deliberately not implemented here yet — see
 * INTEGRATIONS_PENDING.md — because a half-written mailer that swallows its own
 * errors is worse than no mailer at all, and the fallback above is not a
 * degraded mode, it is a working one.
 */

/** True when a real transport is configured. */
export function mailConfigured(): boolean {
  return Boolean(process.env.SMTP_URL?.trim() && process.env.SMTP_FROM?.trim());
}

export type InvitePurpose = "activation" | "reset";

const SUBJECT: Record<InvitePurpose, string> = {
  activation: "Su acceso a Canei Subirats",
  reset: "Restablecer su contraseña — Canei Subirats",
};

function body(link: string, purpose: InvitePurpose): string {
  const opening =
    purpose === "activation"
      ? "Se ha creado una cuenta para usted en el sistema de Canei Subirats."
      : "Se ha solicitado restablecer la contraseña de su cuenta.";
  return [
    opening,
    "",
    "Abra este enlace para elegir su contraseña:",
    link,
    "",
    "El enlace caduca en 7 días y sólo puede usarse una vez.",
    "Si no esperaba este mensaje, puede ignorarlo.",
  ].join("\n");
}

/**
 * Send the invitation. Returns whether it actually left.
 *
 * Never throws: a mail that could not be sent must not lose the account that
 * was just created. The caller shows the link instead.
 */
export async function sendInvitation(
  to: string,
  link: string,
  purpose: InvitePurpose,
): Promise<boolean> {
  if (!mailConfigured()) {
    // Logged, not sent — and said plainly, so a server log reads the same way
    // the screen does.
    console.info(
      `[email-out@1] NOT SENT (no SMTP configured): "${SUBJECT[purpose]}" to ${to}. ` +
        `The activation link was returned to the administrator instead.`,
    );
    return false;
  }
  // SMTP is configured but no transport is wired yet. Saying so out loud beats
  // both alternatives: pretending it sent, and half-writing a mailer that
  // swallows its own errors. The link still comes back, so the account is
  // usable — see INTEGRATIONS_PENDING.md.
  console.warn(
    `[email-out@1] SMTP_URL is set but no transport is wired yet, so nothing was ` +
      `sent to ${to}. The activation link was returned to the administrator instead. ` +
      `See INTEGRATIONS_PENDING.md.`,
  );
  void body;
  return false;
}
