/**
 * The invitation, as a DRAFT in the company mailbox.
 *
 * WHAT WAS WRONG. This file used to hold `sendInvitation`, whose only outcome
 * was to log a line and return false — there is no SMTP in this codebase and
 * there is not meant to be. So creating a colleague's account always ended on
 * «No se ha enviado ningún correo», with an activation link for the
 * administrator to copy into WhatsApp by hand.
 *
 * Meanwhile the product already had the answer for every other generated email:
 * `draft-mailbox.ts` writes a finished message straight into the Drafts folder
 * of the company mailbox over IMAP APPEND, where it appears in Gmail or Outlook
 * already addressed and already written. Quotes go that way. Invoices go that
 * way. The accountant package goes that way. Invitations were the one thing
 * that did not, for no reason anybody had written down.
 *
 * SO THEY GO THAT WAY TOO, and the mandate is untouched: appending to a folder
 * the company owns is not sending, and the operator still presses send in their
 * own client after reading it.
 *
 * `mailConfigured()` survives because the settings screen asks it.
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
 * RFC 822, built here because this runs on the server and `site/erp-eml.js` is
 * the browser's copy. Base64 for the body and RFC 2047 for the subject: both
 * carry accents, and a raw 8-bit header is the kind of thing one mail server in
 * five rejects and the other four render as mojibake.
 */
function rfc822(from: string, to: string, subject: string, text: string): string {
  const b64 = Buffer.from(text, "utf8")
    .toString("base64")
    .replace(/(.{76})/g, "$1\r\n");
  const subj = "=?UTF-8?B?" + Buffer.from(subject, "utf8").toString("base64") + "?=";
  return [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subj}`,
    `Date: ${new Date().toUTCString()}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="utf-8"',
    "Content-Transfer-Encoding: base64",
    "",
    b64,
  ].join("\r\n");
}

export interface InviteResult {
  /** True only when the message is actually sitting in the Drafts folder. */
  drafted: boolean;
  /** Which folder it landed in, when it landed. */
  folder?: string;
  /** Why it did not, when it did not. */
  reason?: string;
}

/**
 * File the invitation as a DRAFT in the company mailbox.
 *
 * WHY A DRAFT AND NOT A SEND. This codebase has no SMTP and the mandate forbids
 * real mail leaving; IMAP APPEND writes into a folder the company owns, and the
 * operator presses send themselves in their own client. That is the same route
 * every other generated email in the product already takes — quotes, invoices,
 * the accountant package — and invitations were the one that did not, which is
 * why the screen could only ever say «no se ha enviado ningún correo» and hand
 * over a link to copy by hand.
 *
 * Never throws. A mailbox that is down must not lose the account that was just
 * created: the link still comes back and the screen still shows it.
 */
export async function draftInvitation(
  tenantId: string,
  to: string,
  link: string,
  purpose: InvitePurpose,
): Promise<InviteResult> {
  try {
    const { appendDraft, mailboxConfig, mailboxConfigured } = await import("./draft-mailbox");
    if (!(await mailboxConfigured(tenantId))) {
      return {
        drafted: false,
        reason: "No hay buzón configurado todavía. Conéctalo en Configuración → Email.",
      };
    }
    const from = (await mailboxConfig(tenantId))?.from || "";
    const result = await appendDraft(
      tenantId,
      rfc822(from, to, SUBJECT[purpose], body(link, purpose)),
    );
    return result.delivered
      ? { drafted: true, folder: result.folder }
      : { drafted: false, reason: result.reason };
  } catch (e) {
    return { drafted: false, reason: (e as Error)?.message || String(e) };
  }
}
