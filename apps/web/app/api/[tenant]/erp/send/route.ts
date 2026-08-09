/**
 * Actually send a composed email.
 *
 *     POST /api/~/erp/send?confirm=yes
 *       content-type: message/rfc822
 *       → 200 { sent: true, recipients, messageId }
 *       → 400  no confirmation, or not a message
 *       → 403  sending is switched off for this mailbox
 *       → 422  a recipient is not on the approved list
 *       → 429  the hourly limit is spent
 *       → 502  the mail server refused
 *
 * THE `confirm` PARAMETER IS NOT CEREMONY. Every other write in this system is
 * reversible; this one is not, and the way irreversible things get done by
 * accident is that some code path that meant to save also sent. Requiring a
 * parameter that has no purpose other than saying "yes, send this" means no
 * caller can reach this by drifting into it — it has to be written on purpose,
 * and it shows up in the diff of whoever writes it.
 *
 * The sibling endpoint /draft remains the default path and is unchanged. A
 * company that never turns sending on has exactly the system it had before.
 */
import { mailboxConfigured } from "@/lib/draft-mailbox";
import { sendMail, sendPolicyFor } from "@/lib/mail-send";
import { requireUser } from "@/lib/session";
import { tenantFor } from "@/lib/access";
import { guarded, json } from "@/lib/api";
import { FactoryError } from "@repo/kernel";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024;

/** What the caller may know without attempting anything. */
export async function GET(req: Request, ctx: { params: Promise<{ tenant: string }> }) {
  const { tenant: param } = await ctx.params;
  return guarded(async () => {
    const tenant = await tenantFor(req, param);
    await requireUser(req);
    const policy = await sendPolicyFor(tenant);
    return json({
      tenant,
      enabled: policy.enabled,
      allowlist: policy.allowlist,
      hourlyLimit: policy.hourlyLimit,
    });
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ tenant: string }> }) {
  const { tenant: param } = await ctx.params;
  return guarded(async () => {
    const tenant = await tenantFor(req, param);
    const user = await requireUser(req);

    const confirm = new URL(req.url).searchParams.get("confirm");
    if (!confirm || confirm === "0" || confirm === "false") {
      throw new FactoryError(
        "BAD_REQUEST",
        "Sending must be confirmed: add ?confirm=yes. Use /draft to file the " +
          "message without sending it.",
      );
    }

    const raw = await req.text();
    if (!raw.trim()) throw new FactoryError("BAD_REQUEST", "Empty message.");
    if (Buffer.byteLength(raw) > MAX_BYTES) {
      throw new FactoryError("BAD_REQUEST", "Message is too large (8 MB maximum).");
    }
    if (!/^[A-Za-z-]+:\s/m.test(raw.slice(0, 2000))) {
      throw new FactoryError("BAD_REQUEST", "Body must be an RFC 822 message.");
    }

    if (!(await mailboxConfigured(tenant))) {
      return json(
        { tenant, sent: false, reason: "No mailbox is configured. Open /settings/email." },
        503,
      );
    }

    const result = await sendMail(tenant, raw, user);
    if (result.sent) return json({ tenant, sentBy: user, ...result });

    // Each refusal gets the status that tells the caller what to do about it.
    // A single 400 for all of them would make "you are not allowed to write to
    // that person" and "you sent too many" look like the same programming
    // mistake, which is how safety rails end up being routed around.
    const status = { DISABLED: 403, NOT_ALLOWED: 422, RATE_LIMITED: 429, NO_RECIPIENTS: 400 }[
      result.code || "DISABLED"
    ];
    return json({ tenant, ...result }, status);
  });
}
