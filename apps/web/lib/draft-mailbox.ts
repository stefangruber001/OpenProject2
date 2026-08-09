/**
 * The company mailbox, as somewhere to PUT A DRAFT — never to send from.
 *
 * WHAT THIS IS FOR. The ERP already composes finished emails: branded HTML, a
 * plain-text alternative, and the quote or invoice PDF attached. Until now the
 * only way to get one was to download an `.eml` and open it by hand. This puts
 * the same message straight into the Drafts folder of the company mailbox, so
 * it appears in Gmail, Outlook or Apple Mail on whatever device the operator
 * happens to have, already addressed and already written.
 *
 * WHAT IT DELIBERATELY CANNOT DO IS SEND. There is no SMTP here and no code
 * path that transmits anything to a customer. IMAP APPEND writes a message into
 * a folder the operator owns; the send button is theirs, in their own mail
 * client, after they have read it. That is the same promise the product already
 * makes on screen — "nothing is sent without you" — and the mandate's "no real
 * emails" rule survives intact, because a draft in your own Drafts folder has
 * not been emailed to anybody.
 *
 * NOT CONFIGURED IS NOT AN ERROR, BUT IT IS NEVER A SILENT SUCCESS. With no
 * credential the null adapter is used, and it reports `delivered: false` with a
 * reason. This project has been bitten more than once by something that
 * reported success while doing nothing; a draft the operator believes is in
 * their mailbox and is not would be the same bite with their customer on the
 * other end of it.
 */
import { FactoryError } from "@repo/kernel";

export interface DraftResult {
  delivered: boolean;
  /** The mailbox the message was written to, when it was written. */
  folder?: string;
  /** Why nothing was written, when nothing was. */
  reason?: string;
}

export interface MailboxConfig {
  from: string;
  host: string;
  port: number;
  user: string;
  password: string;
  /** Explicit folder name. Empty means "ask the server which one is Drafts". */
  drafts: string;
}

const env = (name: string) => (process.env[name] || "").trim();

/**
 * The address the ERP's drafts are written from.
 *
 * Configuration, not a constant in the page: the company can change mailbox
 * without a release. The fallback is empty rather than a guess — an invented
 * sender address is the kind of plausible-looking wrong that survives review.
 */
export function mailFrom(): string {
  return env("ERP_MAIL_FROM") || env("ERP_MAIL_USER");
}

export function mailboxConfig(): MailboxConfig | null {
  const host = env("ERP_MAIL_IMAP_HOST");
  const user = env("ERP_MAIL_USER");
  const password = env("ERP_MAIL_PASSWORD");
  // All three or nothing. A host and a user with no password is not a
  // half-working mailbox, it is a login that will fail on the first draft.
  if (!host || !user || !password) return null;
  return {
    from: mailFrom() || user,
    host,
    port: Number(env("ERP_MAIL_IMAP_PORT") || 993),
    user,
    password,
    drafts: env("ERP_MAIL_DRAFTS"),
  };
}

export function mailboxConfigured(): boolean {
  return mailboxConfig() !== null;
}

/**
 * Force the message to come from the configured mailbox.
 *
 * A draft appended to a mailbox with somebody else's address in `From` is
 * confusing at best: the mail client shows a sender the account cannot send as,
 * and some servers reject the append outright. The display name is kept —
 * "Canei Subirats <if@2iberia.com>" is exactly what should reach the customer —
 * and only the address is replaced.
 *
 * Header-only, and only the first `From:` line, which by definition is in the
 * header block: rewriting further would corrupt a MIME body that legitimately
 * contains the word.
 */
export function withSender(rfc822: string, from: string): string {
  const split = rfc822.search(/\r?\n\r?\n/);
  if (split < 0) return rfc822;
  const head = rfc822.slice(0, split);
  const rest = rfc822.slice(split);

  const display = /^From:\s*"?([^"<]*?)"?\s*</im.exec(head)?.[1]?.trim();
  const value = display ? `${display} <${from}>` : from;

  if (/^From:.*$/im.test(head)) {
    return head.replace(/^From:.*$/im, `From: ${value}`) + rest;
  }
  return `From: ${value}\r\n${head}${rest}`;
}

/**
 * Put one composed message in the Drafts folder.
 *
 * `\Draft` is not decoration: without that flag a mail client files the message
 * as a received item, and the operator finds something that looks like mail
 * from themselves instead of something they can open and send.
 */
export async function appendDraft(rfc822: string): Promise<DraftResult> {
  const config = mailboxConfig();
  if (!config) {
    return { delivered: false, reason: "No mailbox configured (ERP_MAIL_* not set)." };
  }

  const { ImapFlow } = await import("imapflow");
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.port === 993,
    auth: { user: config.user, pass: config.password },
    // The library logs every command at info level, and one of those commands
    // is LOGIN. Silenced so a password cannot reach a container log.
    logger: false,
  });

  try {
    await client.connect();
    const folder = config.drafts || (await findDraftsFolder(client));
    await client.append(folder, withSender(rfc822, config.from), ["\\Draft", "\\Seen"]);
    return { delivered: true, folder };
  } catch (error) {
    // Named rather than swallowed: "the draft is in your mailbox" must never be
    // said on the strength of a request that failed.
    throw new FactoryError(
      "INTEGRATION_FAILED",
      `Could not write the draft to the mailbox: ${(error as Error).message}`,
    );
  } finally {
    // logout() can itself throw on an already-broken socket; that must not
    // replace the real error above.
    await client.logout().catch(() => client.close());
  }
}

/**
 * Ask the server which folder is Drafts rather than assuming.
 *
 * The name differs between hosts — "Drafts", "INBOX.Drafts", and localised
 * variants all exist — so the special-use flag is the only portable answer.
 * Falling back to "Drafts" when a server publishes no special use is a guess,
 * and it is labelled as one wherever it surfaces.
 */
async function findDraftsFolder(client: {
  list: () => Promise<Array<{ path: string; pathAsListed?: string; specialUse?: string }>>;
}): Promise<string> {
  const boxes = await client.list();
  // `pathAsListed` first, deliberately. `path` is a value the client DERIVES,
  // and it can come back as something the server never said — a stub that
  // answered a second LIST produced "INBOX.Sent.INBOX.Borradores" for a mailbox
  // actually called "INBOX.Borradores". `pathAsListed` is the literal string
  // the server put on the wire, which is by definition a name it understands.
  const name = (b: { path: string; pathAsListed?: string }) => b.pathAsListed || b.path;

  const special = boxes.find((b) => b.specialUse === "\\Drafts");
  if (special) return name(special);
  const named = boxes.find((b) => /(^|[./])drafts$/i.test(name(b)));
  if (named) return name(named);
  // A guess, and the last resort. If it is wrong the APPEND fails loudly rather
  // than filing the draft somewhere nobody looks — and ERP_MAIL_DRAFTS exists
  // precisely so the operator can name it outright.
  return "Drafts";
}
