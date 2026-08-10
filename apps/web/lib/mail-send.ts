/**
 * Sending, as opposed to drafting.
 *
 * WHY THIS FILE READS AS DEFENSIVELY AS IT DOES. Everything else the ERP writes
 * is recoverable: a wrong number in a quote is an edit, a wrong customer on a
 * project is a correction. A sent email is the one artifact this system
 * produces that cannot be taken back — it is in somebody else's inbox a second
 * later, and no amount of fixing the database changes that. So the interesting
 * part here is not the SMTP conversation, which is twenty lines; it is the four
 * things that must be true before those twenty lines are allowed to run.
 *
 * The project's standing rule was that no real email may leave the system, and
 * for months the guarantee behind that rule was structural: there was no
 * sending code, so there was nothing to misconfigure. That guarantee is spent
 * the moment this file exists. What replaces it:
 *
 *   1. OFF BY DEFAULT, and off is the state of every mailbox that does not
 *      explicitly say otherwise. Upgrading the server does not turn it on.
 *   2. AN ALLOWLIST. While the ERP is being trusted with real customer records
 *      for the first time, the set of people it may write to is named. A bug
 *      that picks the wrong customer then fails to send rather than succeeding
 *      at the wrong thing.
 *   3. A RATE LIMIT. The failure that costs a company its mail reputation is
 *      not one wrong email, it is four hundred, and that is always a loop.
 *   4. AN EXPLICIT ACT PER MESSAGE. Sending is never a side effect of
 *      generating, saving or drafting — the caller has to say send, and say it
 *      about one specific message.
 *
 * The credential is the SAME ONE the draft mailbox already holds: same address,
 * same password, sealed by lib/secret-box in the same row. Turning sending on
 * introduces no new secret and no new place to keep one.
 */
import { FactoryError } from "@repo/kernel";
import { mailboxConfig, type MailboxConfig } from "./draft-mailbox";
import { loadMailSettings, saveMailSettings } from "./erp-runtime";

/** Hosts whose submission server is not `smtp.<the imap host's tail>`. */
const SMTP_OVERRIDE: Record<string, string> = {
  "outlook.office365.com": "smtp.office365.com",
  "ssl0.ovh.net": "ssl0.ovh.net",
};

/**
 * The submission host, derived from the mailbox we already know.
 *
 * Providers name these in pairs — imap.hostinger.com and smtp.hostinger.com,
 * imap.gmail.com and smtp.gmail.com — so one is enough to know the other, and
 * asking the operator for a second hostname would repeat the mistake that made
 * the mailbox setup fail in the first place.
 */
export function smtpHostFor(imapHost: string): string {
  const host = imapHost.trim().toLowerCase();
  return SMTP_OVERRIDE[host] || host.replace(/^imap\./, "smtp.");
}

export interface SendPolicy {
  /** Nothing is sent unless this is explicitly true. */
  enabled: boolean;
  /**
   * Who the ERP may write to. An entry is either a whole address or a domain
   * beginning with `@`. EMPTY MEANS NOBODY BUT THE MAILBOX ITSELF — not
   * "everybody". An empty list is what an operator who has enabled sending and
   * not thought about recipients has, and the safe reading of "I did not say"
   * is "you may not", never "you may write to anyone".
   */
  allowlist: string[];
  /** Messages per rolling hour. */
  hourlyLimit: number;
}

export const SEND_OFF: SendPolicy = { enabled: false, allowlist: [], hourlyLimit: 20 };

export function policyFrom(stored: unknown): SendPolicy {
  const s = (stored || {}) as Partial<SendPolicy>;
  return {
    // `=== true`, not truthy: a stored "false", 0 or "" must not enable sending
    // because it happens to be a string.
    enabled: s.enabled === true,
    allowlist: Array.isArray(s.allowlist)
      ? s.allowlist.map((a) => String(a).trim().toLowerCase())
      : [],
    hourlyLimit: Number.isFinite(s.hourlyLimit) ? Math.max(1, Number(s.hourlyLimit)) : 20,
  };
}

/**
 * Every address this message would reach.
 *
 * Bcc is read for the same reason To is: a recipient the operator cannot see on
 * screen is still a recipient, and an allowlist that ignores Bcc is an
 * allowlist with a hole in it shaped exactly like the thing people use to send
 * quietly.
 */
export function recipientsOf(rfc822: string): string[] {
  const split = rfc822.search(/\r?\n\r?\n/);
  const head = split < 0 ? rfc822 : rfc822.slice(0, split);
  // Unfold: a header value may continue on following lines that begin with
  // whitespace, and a long recipient list is exactly where that happens.
  const unfolded = head.replace(/\r?\n[ \t]+/g, " ");

  const found: string[] = [];
  for (const line of unfolded.split(/\r?\n/)) {
    if (!/^(to|cc|bcc):/i.test(line)) continue;
    for (const match of line.slice(line.indexOf(":") + 1).matchAll(/[^\s<>,;"]+@[^\s<>,;"]+/g)) {
      found.push(match[0].toLowerCase().replace(/[.,;]+$/, ""));
    }
  }
  return [...new Set(found)];
}

export function isAllowed(address: string, policy: SendPolicy, mailbox: string): boolean {
  const to = address.trim().toLowerCase();
  if (to === mailbox.trim().toLowerCase()) return true; // writing to ourselves is always fine
  return policy.allowlist.some((entry) =>
    entry.startsWith("@") ? to.endsWith(entry) : to === entry,
  );
}

export interface SendRefusal {
  code: "DISABLED" | "NOT_ALLOWED" | "NO_RECIPIENTS" | "RATE_LIMITED";
  message: string;
}

/**
 * The whole decision, as a pure function.
 *
 * Pure on purpose: this is the part that must never be wrong, and a rule that
 * needs a database and a mail server to exercise is a rule that gets tested
 * once. Everything it needs is an argument.
 */
export function refuseToSend(
  rfc822: string,
  policy: SendPolicy,
  mailbox: string,
  recentSendTimes: number[],
  now: number,
): SendRefusal | null {
  if (!policy.enabled) {
    return {
      code: "DISABLED",
      message: "Sending is switched off for this mailbox. The ERP files drafts instead.",
    };
  }

  const recipients = recipientsOf(rfc822);
  if (!recipients.length) {
    return { code: "NO_RECIPIENTS", message: "The message has no recipient." };
  }

  const blocked = recipients.filter((r) => !isAllowed(r, policy, mailbox));
  if (blocked.length) {
    return {
      code: "NOT_ALLOWED",
      message:
        `Not on the approved recipient list: ${blocked.join(", ")}. ` +
        "Add the address (or @domain) under Sending in the mailbox settings.",
    };
  }

  const hour = 60 * 60 * 1000;
  const recent = recentSendTimes.filter((t) => now - t < hour).length;
  if (recent >= policy.hourlyLimit) {
    return {
      code: "RATE_LIMITED",
      message: `${policy.hourlyLimit} messages have already been sent in the last hour.`,
    };
  }

  return null;
}

export interface SendResult {
  sent: boolean;
  recipients: string[];
  messageId?: string;
  reason?: string;
  code?: SendRefusal["code"];
}

/**
 * The SMTP conversation, separated from the decision to have it — the same
 * split as the draft adapter, and for the same reason: the tests can drive a
 * stub server without a database, and the rules can be tested without a socket.
 */
export async function sendViaSmtp(
  config: MailboxConfig,
  rfc822: string,
  recipients: string[],
  options: { host?: string; port?: number } = {},
): Promise<{ messageId: string }> {
  const nodemailer = await import("nodemailer");
  const host = options.host || smtpHostFor(config.host);
  const port = options.port ?? 465;

  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user: config.user, pass: config.password },
    // The library will happily log the AUTH exchange otherwise.
    logger: false,
    debug: false,
  });

  try {
    // `raw` because the message is already a complete, signed-off RFC822
    // document — the same bytes the operator reviewed. Handing nodemailer the
    // parts and letting it rebuild would mean sending something nobody read.
    const info = await transport.sendMail({
      envelope: { from: config.from, to: recipients },
      raw: rfc822,
    });
    return { messageId: String(info.messageId || "") };
  } catch (error) {
    throw new FactoryError(
      "INTEGRATION_FAILED",
      `The mail server refused to send: ${(error as Error).message}`,
      { host },
    );
  } finally {
    transport.close();
  }
}

/** One audit line per attempt — refusals included. */
interface SendLogEntry {
  at: number;
  by: string;
  to: string[];
  subject: string;
  sent: boolean;
  reason?: string;
}

function subjectOf(rfc822: string): string {
  const split = rfc822.search(/\r?\n\r?\n/);
  const head = (split < 0 ? rfc822 : rfc822.slice(0, split)).replace(/\r?\n[ \t]+/g, " ");
  return /^subject:(.*)$/im.exec(head)?.[1]?.trim().slice(0, 200) || "(no subject)";
}

/**
 * Send one message, having been told to, by somebody.
 *
 * `by` is not decoration. The single most useful fact after "the ERP emailed a
 * customer something wrong" is which person pressed the button, and it is the
 * fact nobody can reconstruct afterwards.
 */
export async function sendMail(
  tenantId: string,
  rfc822: string,
  by: string,
  now = Date.now(),
): Promise<SendResult> {
  const config = await mailboxConfig(tenantId);
  if (!config) {
    return { sent: false, recipients: [], code: "DISABLED", reason: "No mailbox configured." };
  }

  const stored = (await loadMailSettings(tenantId).catch(() => null)) || {};
  const policy = policyFrom((stored as { send?: unknown }).send);
  const log = Array.isArray((stored as { sendLog?: unknown }).sendLog)
    ? ((stored as { sendLog: SendLogEntry[] }).sendLog satisfies SendLogEntry[])
    : [];

  const recipients = recipientsOf(rfc822);
  const refusal = refuseToSend(
    rfc822,
    policy,
    config.user,
    log.filter((e) => e.sent).map((e) => e.at),
    now,
  );

  const record = async (entry: SendLogEntry) => {
    // Bounded: this rides inside the settings document, and an unbounded audit
    // list would grow that row without limit. The recent past is what a rate
    // limit and an investigation both need.
    const next = [...log, entry].slice(-500);
    await saveMailSettings(tenantId, { ...stored, sendLog: next }, by).catch(() => {});
  };

  if (refusal) {
    await record({
      at: now,
      by,
      to: recipients,
      subject: subjectOf(rfc822),
      sent: false,
      reason: refusal.message,
    });
    return { sent: false, recipients, code: refusal.code, reason: refusal.message };
  }

  try {
    const { messageId } = await sendViaSmtp(config, rfc822, recipients);
    await record({ at: now, by, to: recipients, subject: subjectOf(rfc822), sent: true });
    return { sent: true, recipients, messageId };
  } catch (error) {
    await record({
      at: now,
      by,
      to: recipients,
      subject: subjectOf(rfc822),
      sent: false,
      reason: (error as Error).message,
    });
    throw error;
  }
}

export async function sendPolicyFor(tenantId: string): Promise<SendPolicy> {
  const stored = await loadMailSettings(tenantId).catch(() => null);
  if (!stored) return SEND_OFF;
  return policyFrom((stored as { send?: unknown }).send);
}
