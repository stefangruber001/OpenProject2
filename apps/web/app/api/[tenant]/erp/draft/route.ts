/**
 * Put a composed email into the company mailbox's Drafts folder.
 *
 *     POST /api/~/erp/draft
 *       content-type: message/rfc822   → the .eml the ERP already builds
 *       → 200 { delivered: true, folder: "INBOX.Drafts", from: "…" }
 *       → 503 { delivered: false, reason }   mailbox not configured yet
 *
 * GET returns whether a mailbox is configured and which address drafts carry,
 * so a caller can tell the difference between "not set up" and "broken" without
 * attempting a write.
 *
 * THIS ENDPOINT CANNOT SEND EMAIL. It appends to a folder; there is no SMTP in
 * this codebase. The operator still opens the draft in their own mail client
 * and presses send, which is the promise the product already makes on screen.
 */
import { appendDraft, mailFrom, mailboxConfig, mailboxConfigured } from "@/lib/draft-mailbox";
import { requireUser } from "@/lib/session";
import { tenantFor } from "@/lib/access";
import { guarded, json } from "@/lib/api";
import { FactoryError } from "@repo/kernel";

export const dynamic = "force-dynamic";
// imapflow is a Node library and opens a TCP socket; the edge runtime has
// neither. Stated rather than inherited, so a future default cannot silently
// move this somewhere it cannot run.
export const runtime = "nodejs";

/** Comfortably larger than a branded email with a PDF quote attached. */
const MAX_BYTES = 8 * 1024 * 1024;

export async function GET(req: Request, ctx: { params: Promise<{ tenant: string }> }) {
  const { tenant: param } = await ctx.params;
  return guarded(async () => {
    const tenant = await tenantFor(req, param);
    await requireUser(req);
    const config = await mailboxConfig(tenant).catch(() => null);
    return json({
      tenant,
      configured: await mailboxConfigured(tenant),
      from: config?.from || mailFrom() || null,
      host: config?.host ?? null,
      // Never the user or the password. "Which server" is operational
      // information; the credentials are not.
      drafts: config?.drafts || "(detected from the server)",
    });
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ tenant: string }> }) {
  const { tenant: param } = await ctx.params;
  return guarded(async () => {
    const tenant = await tenantFor(req, param);
    // Attributable: a draft appearing in the shared company mailbox should be
    // traceable to whoever asked for it.
    const user = await requireUser(req);

    const raw = await req.text();
    if (!raw.trim()) throw new FactoryError("BAD_REQUEST", "Empty message.");
    if (Buffer.byteLength(raw) > MAX_BYTES) {
      throw new FactoryError("BAD_REQUEST", "Message is too large (8 MB maximum).");
    }
    // A message with no header block is not a message. Catching it here beats
    // discovering it as an IMAP syntax error three layers down.
    if (!/^[A-Za-z-]+:\s/m.test(raw.slice(0, 2000))) {
      throw new FactoryError("BAD_REQUEST", "Body must be an RFC 822 message.");
    }

    if (!(await mailboxConfigured(tenant))) {
      // 503, not 200. The caller asked for the draft to be in a mailbox; saying
      // "fine" while it is nowhere is the failure this project keeps meeting.
      return json(
        {
          tenant,
          delivered: false,
          reason: "No mailbox is configured yet. Open /settings/email and connect one.",
        },
        503,
      );
    }

    const result = await appendDraft(tenant, raw);
    return json({
      tenant,
      requestedBy: user,
      from: (await mailboxConfig(tenant))?.from,
      ...result,
    });
  });
}
