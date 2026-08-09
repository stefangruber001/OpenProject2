/**
 * Save the company mailbox from the settings screen.
 *
 * A plain form POST, like the sign-in page, so the one screen that asks for a
 * password needs no client JavaScript to work.
 *
 * THE PASSWORD IS TESTED BEFORE IT IS STORED. Saving a credential that turns out
 * to be wrong, and only discovering it the first time somebody expects a draft,
 * is the failure this whole feature exists to avoid. So the sequence is: build
 * the config, open a real IMAP connection with it, and only write it down if the
 * mail server accepted it. A rejected password is reported on the spot and
 * nothing is kept.
 */
import { redirect } from "next/navigation";
import { appendDraftWith, type MailboxConfig } from "@/lib/draft-mailbox";
import { saveMailSettings } from "@/lib/erp-runtime";
import { seal } from "@/lib/secret-box";
import { requireUser } from "@/lib/session";
import { tenantFor } from "@/lib/access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Providers whose mail host is not `imap.<domain>`. Guessing wrong here costs
 *  the operator a confusing "login failed" for a password that is perfectly
 *  correct, so the few that matter are named. */
const KNOWN_HOSTS: Record<string, string> = {
  "hostinger.com": "imap.hostinger.com",
  "gmail.com": "imap.gmail.com",
  "googlemail.com": "imap.gmail.com",
  "outlook.com": "outlook.office365.com",
  "hotmail.com": "outlook.office365.com",
  "office365.com": "outlook.office365.com",
};

/** Errors that mean "there is nothing at that address", as opposed to "that
 *  address rejected you". Only the first kind is evidence the guessed host was
 *  the wrong host; a refused password says nothing about the server name. */
const UNREACHABLE = /ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ETIMEDOUT|EHOSTUNREACH|ENETUNREACH/i;

/**
 * Turn the mail library's error into something the operator can act on.
 *
 * The failure this exists for: `imap.<domain>` is a guess, and when the guess
 * is wrong the operator sees a DNS error about a host they never typed, for a
 * password that was entirely correct. The natural conclusion is that the
 * password is wrong, and they go and reset a working mailbox. So when we
 * guessed the host AND nothing answered there, say which field fixes it.
 */
function explain(error: Error, guessed: boolean, host: string): string {
  const raw = error.message.slice(0, 200);
  if (!guessed || !UNREACHABLE.test(raw)) return raw;
  return `${raw} — nothing is listening at ${host}, which the ERP guessed from the address. Your password is probably fine: open Advanced settings and enter your provider's IMAP server (Hostinger uses imap.hostinger.com).`;
}

function back(status: string, detail = ""): never {
  const query = new URLSearchParams({ status, ...(detail ? { detail } : {}) });
  redirect(`/settings/email?${query.toString()}`);
}

export async function POST(req: Request) {
  const user = await requireUser(req).catch(() => null);
  if (!user) redirect("/login?next=%2Fsettings%2Femail");
  const tenant = await tenantFor(req, "~");

  const form = await req.formData();
  const address = String(form.get("address") || "")
    .trim()
    .toLowerCase();
  const password = String(form.get("password") || "");
  const hostRaw = String(form.get("host") || "").trim();
  const drafts = String(form.get("drafts") || "").trim();

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) back("bad", "That is not an email address.");
  if (!password) back("bad", "Enter the mailbox password.");

  const domain = address.split("@")[1] || "";
  // `imap.<domain>` is a convention, not a rule. It is right often enough to be
  // worth trying and wrong often enough that the operator has to be told when
  // it is — see the hint below.
  const guessed = !hostRaw;
  const host = hostRaw || KNOWN_HOSTS[domain] || `imap.${domain}`;

  const config: MailboxConfig = {
    from: address,
    host,
    port: 993,
    user: address,
    password,
    drafts,
  };

  // The proof. A message to ourselves, filed as a draft, so a successful save
  // means an actual round trip happened rather than a form having been filled
  // in tidily. It also leaves the operator something to look at.
  const probe = [
    `From: ${address}`,
    `To: ${address}`,
    "Subject: Canei ERP — mailbox connected",
    "X-Unsent: 1",
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="utf-8"',
    "",
    "This draft was written by the Canei Subirats ERP to prove the connection works.",
    "You can delete it.",
    "",
  ].join("\r\n");

  let folder = "";
  try {
    const result = await appendDraftWith(config, probe);
    folder = result.folder || "";
  } catch (e) {
    // Nothing is stored. A saved-but-broken mailbox is worse than an unsaved
    // one, because it looks configured on every screen that asks.
    back("failed", explain(e as Error, guessed, host));
  }

  await saveMailSettings(
    tenant,
    { from: address, host, port: 993, user: address, sealedPassword: seal(password), drafts },
    user,
  );

  back("ok", folder);
}
