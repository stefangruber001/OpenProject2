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
 *
 * THE OPERATOR IS NOT ASKED WHERE THEIR MAILBOX IS. `imap.<domain>` is a
 * convention that fails on shared hosting, and the failure it produces — a DNS
 * error naming a host the operator never typed — reads as a wrong password.
 * The domain's MX records already say who runs its mail, so we look, and try
 * the candidates in order. See imapCandidates().
 */
import { redirect } from "next/navigation";
import {
  appendDraftWith,
  imapCandidates,
  isAuthFailure,
  type MailboxConfig,
} from "@/lib/draft-mailbox";
import { loadMailSettings, saveMailSettings } from "@/lib/erp-runtime";
import { seal } from "@/lib/secret-box";
import { requireUser } from "@/lib/session";
import { tenantFor } from "@/lib/access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

  // An unchecked checkbox is ABSENT from the form, not "off" — so the default
  // when the field is missing has to be the safe one, and here that is not
  // sending. Getting this backwards is the classic way a safety switch ends up
  // on by default.
  const sendEnabled = form.get("sendEnabled") === "yes";
  const allowlist = String(form.get("allowlist") || "")
    .split(/[\s,;]+/)
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.startsWith("@") || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(entry));

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) back("bad", "That is not an email address.");
  if (!password) back("bad", "Enter the mailbox password.");

  // Where the mailbox lives is a fact the domain's own DNS publishes, so it is
  // looked up rather than demanded from the operator. See imapCandidates().
  const candidates = await imapCandidates(address, hostRaw);
  if (!candidates.length) back("bad", "That is not an email address.");

  const config: Omit<MailboxConfig, "host"> = {
    from: address,
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

  let host = "";
  let folder = "";
  let failure: Error | null = null;

  for (const candidate of candidates) {
    try {
      const result = await appendDraftWith({ ...config, host: candidate }, probe);
      host = candidate;
      folder = result.folder || "";
      break;
    } catch (e) {
      failure = e as Error;
      // The server answered and refused the credential. That is the end of the
      // search, not a reason to try the next one: we have found the mailbox,
      // and offering the same password to further servers would be spreading a
      // secret around to learn something we already know.
      if (isAuthFailure(e)) break;
    }
  }

  if (!host) {
    // Nothing is stored. A saved-but-broken mailbox is worse than an unsaved
    // one, because it looks configured on every screen that asks.
    const raw = (failure?.message || "Could not reach the mail server.").slice(0, 200);
    back(
      "failed",
      isAuthFailure(failure)
        ? raw
        : `${raw} Tried ${candidates.join(", ")}. If your provider's IMAP server is not one of those, enter it under Advanced settings.`,
    );
  }

  // Merged, not replaced. The send log is an audit trail that happens to live
  // in this document, and rewriting the document wholesale would erase it every
  // time somebody re-saved their password.
  const existing = (await loadMailSettings(tenant).catch(() => null)) || {};

  await saveMailSettings(
    tenant,
    {
      ...existing,
      from: address,
      host,
      port: 993,
      user: address,
      sealedPassword: seal(password),
      drafts,
      send: { enabled: sendEnabled, allowlist, hourlyLimit: 20 },
    },
    user,
  );

  back("ok", folder);
}
