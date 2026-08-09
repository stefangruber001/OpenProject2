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
import { loadMailSettings } from "./erp-runtime";
import { open as unseal } from "./secret-box";

export interface DraftResult {
  delivered: boolean;
  /** The mailbox the message was written to, when it was written. */
  folder?: string;
  /** Why nothing was written, when nothing was. */
  reason?: string;
}

/**
 * Providers whose IMAP server is not `imap.<domain>`. Keyed by the mail
 * domain AND by the provider root found in an MX record, because those are the
 * two ways we can learn who actually runs a mailbox.
 */
const PROVIDER_IMAP: Record<string, string> = {
  "hostinger.com": "imap.hostinger.com",
  "gmail.com": "imap.gmail.com",
  "googlemail.com": "imap.gmail.com",
  "google.com": "imap.gmail.com", // MX: aspmx.l.google.com
  "outlook.com": "outlook.office365.com",
  "hotmail.com": "outlook.office365.com",
  "office365.com": "outlook.office365.com",
  "zoho.com": "imap.zoho.com",
  "zoho.eu": "imap.zoho.eu",
  "yandex.net": "imap.yandex.com",
  "mailbox.org": "imap.mailbox.org",
  "ionos.com": "imap.ionos.com",
  "ovh.net": "ssl0.ovh.net",
  "one.com": "imap.one.com",
  "titan.email": "imap.titan.email",
};

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

export function mailboxFromEnv(): MailboxConfig | null {
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

/**
 * Where the mailbox comes from, in order.
 *
 *   1. the environment — set by ops/set-email.sh, and it WINS
 *   2. the settings screen — stored per company, password encrypted at rest
 *
 * Environment first on purpose. It is the channel an operator reaches for when
 * something is wrong and they need to be certain what the server is using; a
 * stored value quietly overriding it would make that recovery route untrue.
 */
export async function mailboxConfig(tenantId: string): Promise<MailboxConfig | null> {
  const fromEnv = mailboxFromEnv();
  if (fromEnv) return fromEnv;

  const stored = (await loadMailSettings(tenantId).catch(() => null)) as {
    from?: string;
    host?: string;
    port?: number;
    user?: string;
    sealedPassword?: string;
    drafts?: string;
  } | null;
  if (!stored?.host || !stored.user || !stored.sealedPassword) return null;

  return {
    from: stored.from || stored.user,
    host: stored.host,
    port: Number(stored.port || 993),
    user: stored.user,
    // Throws rather than returning a blank if SESSION_SECRET has moved under
    // it — a login attempted with an empty password fails in a way that points
    // at the mailbox provider instead of at this server.
    password: unseal(stored.sealedPassword),
    drafts: stored.drafts || "",
  };
}

export async function mailboxConfigured(tenantId: string): Promise<boolean> {
  return (await mailboxConfig(tenantId).catch(() => null)) !== null;
}

/** The registrable-ish tail of a hostname: `mx1.hostinger.com` → `hostinger.com`. */
function providerRoot(hostname: string): string {
  const labels = hostname.replace(/\.$/, "").toLowerCase().split(".");
  return labels.slice(-2).join(".");
}

/** Does anything answer to this name? Uses the same resolver the mail client
 *  will use, so a `true` here means the connection attempt is worth making. */
async function resolves(host: string): Promise<boolean> {
  try {
    const { promises: dns } = await import("node:dns");
    await dns.lookup(host);
    return true;
  } catch {
    return false;
  }
}

/**
 * Work out which server holds this mailbox, instead of asking the operator.
 *
 * `imap.<domain>` is a convention, not a rule, and when it is wrong the operator
 * gets a DNS error naming a host they never typed — for a password that was
 * perfectly correct. The natural conclusion is that the password is wrong, and
 * they go off and reset a working mailbox. That is a bad outcome caused entirely
 * by us making them supply a fact their own DNS already publishes.
 *
 * So: ask the domain who runs its mail. The MX records name the provider —
 * `mx1.hostinger.com`, `aspmx.l.google.com`, `x.mail.protection.outlook.com` —
 * and the provider determines the IMAP host.
 *
 * EVERY CANDIDATE IS DERIVED FROM THE DOMAIN ITSELF, never from a list of
 * servers to try. A password is about to be offered to whatever comes back, so
 * the only acceptable sources are the domain the operator typed and the mail
 * infrastructure that domain publishes for itself. A "try these ten popular
 * providers" fallback would be spraying a credential across the internet.
 *
 * A host the operator typed is returned alone and unexamined. They said where
 * it is; guessing past that would take the control away at the exact moment
 * they used it.
 */
export async function imapCandidates(address: string, typed = ""): Promise<string[]> {
  if (typed.trim()) return [typed.trim()];

  const domain = (address.split("@")[1] || "").trim().toLowerCase();
  if (!domain) return [];

  const guesses: string[] = [];
  if (PROVIDER_IMAP[domain]) guesses.push(PROVIDER_IMAP[domain]);
  guesses.push(`imap.${domain}`);

  try {
    const { promises: dns } = await import("node:dns");
    const mx = await dns.resolveMx(domain);
    // Lowest priority number is the preferred exchange, so try it first.
    for (const record of mx.sort((a, b) => a.priority - b.priority)) {
      const root = providerRoot(record.exchange);
      if (root && root !== domain) guesses.push(PROVIDER_IMAP[root] || `imap.${root}`);
    }
  } catch {
    // No MX, or no DNS from here. The conventional guess still stands.
  }

  const seen = new Set<string>();
  const unique = guesses.filter((h) => h && !seen.has(h) && (seen.add(h), true));

  const live: string[] = [];
  for (const host of unique) if (await resolves(host)) live.push(host);
  // Nothing resolved: hand back the conventional guess anyway, so the failure
  // the operator reads is about a name they can recognise rather than silence.
  return live.length ? live : unique.slice(0, 1);
}

/** True when the server answered — it just did not like the credential. That is
 *  a fact about the password, and it means we found the right host. */
export function isAuthFailure(error: unknown): boolean {
  return Boolean(error instanceof FactoryError && error.details?.authFailed);
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
export async function appendDraft(tenantId: string, rfc822: string): Promise<DraftResult> {
  const config = await mailboxConfig(tenantId);
  if (!config) {
    return { delivered: false, reason: "No mailbox configured." };
  }
  return appendDraftWith(config, rfc822);
}

/**
 * The part that talks to a mail server, separated from the part that decides
 * which mail server. Exported so the tests can drive a stub without a database
 * or a tenant — the conversation is what has failure modes worth asserting.
 */
export async function appendDraftWith(config: MailboxConfig, rfc822: string): Promise<DraftResult> {
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

  // MANDATORY, not defensive. ImapFlow is an EventEmitter, and a mail server
  // that hangs up rather than replying — which is exactly what several do after
  // refusing a login — makes it emit `error`. An `error` event with no listener
  // is not a rejected promise, it is an uncaught exception, and in a server
  // process that is the whole process rather than the one request.
  //
  // The first one is also KEPT, because it is often the only informative one.
  // When the server drops the connection after refusing a password, the promise
  // rejects with "Unexpected close" — which reads as "nothing there" — while the
  // emitted error is the one carrying `authenticationFailed`. Losing it would
  // mean telling the operator their server is unreachable when in fact it
  // answered and said no.
  let emitted: unknown = null;
  client.on("error", (e: unknown) => {
    emitted ??= e;
  });

  try {
    await client.connect();
    const folder = config.drafts || (await findDraftsFolder(client));
    await client.append(folder, withSender(rfc822, config.from), ["\\Draft", "\\Seen"]);
    return { delivered: true, folder };
  } catch (error) {
    // One turn of the loop before judging why it failed. When the server hangs
    // up mid-login the promise rejects with "Unexpected close" and the socket
    // teardown emits the error that actually says `authenticationFailed` — in
    // that order. Reading `emitted` immediately would therefore see nothing and
    // report a wrong password as an unreachable server, which is the exact
    // misdiagnosis this code exists to prevent, only inverted.
    await new Promise((resolve) => setImmediate(resolve));

    // Named rather than swallowed: "the draft is in your mailbox" must never be
    // said on the strength of a request that failed.
    throw new FactoryError(
      "INTEGRATION_FAILED",
      `Could not write the draft to the mailbox: ${(error as Error).message}`,
      // Carried, not just described, so a caller working through several
      // candidate hosts can tell "nothing is there" from "that is the right
      // server and the password is wrong" — and stop offering the password
      // around once it knows the difference.
      {
        host: config.host,
        authFailed: looksLikeAuthFailure(error) || looksLikeAuthFailure(emitted),
      },
    );
  } finally {
    // logout() can itself throw on an already-broken socket; that must not
    // replace the real error above.
    await client.logout().catch(() => client.close());
  }
}

/**
 * Did the server reject the credential, as opposed to never answering?
 *
 * imapflow sets `authenticationFailed` when it can tell; the text check is for
 * servers that refuse with a bare NO. Anything unrecognised counts as NOT an
 * auth failure, which is the safe direction: the caller then keeps looking for
 * a server rather than announcing a wrong password on thin evidence.
 */
function looksLikeAuthFailure(error: unknown): boolean {
  const e = error as { authenticationFailed?: boolean; responseText?: string; message?: string };
  if (e?.authenticationFailed) return true;
  return /AUTHENTICATIONFAILED|invalid credentials|authentication failed|login failed|LOGIN denied/i.test(
    `${e?.responseText || ""} ${e?.message || ""}`,
  );
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
