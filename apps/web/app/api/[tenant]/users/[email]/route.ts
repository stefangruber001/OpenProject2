/**
 * One account.
 *
 *   PATCH /api/~/users/ana@example.com   → name, role, active/disabled
 *   POST  /api/~/users/ana@example.com   → issue a fresh invitation or reset
 *
 * There is no DELETE, and that is deliberate rather than unfinished: the audit
 * trail has to keep resolving who did what, and a deleted row turns every entry
 * that person authored into an unattributable one. Disable instead.
 */
import { guarded, json } from "@/lib/api";
import { tenantFor } from "@/lib/access";
import { requireUser } from "@/lib/session";
import { issueInvitation, require_, updateUser } from "@/lib/user-admin";
import { draftInvitation } from "@/lib/invite-mail";
import { originIsReachable, publicOrigin } from "@/lib/public-origin";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ tenant: string; email: string }> },
) {
  const { tenant: param, email } = await ctx.params;
  return guarded(async () => {
    const tenant = await tenantFor(req, param);
    const who = await requireUser(req);
    await require_(tenant, who, "user.manage");

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const patch: { name?: string; role?: string; state?: string } = {};
    if (typeof body.name === "string") patch.name = body.name;
    if (typeof body.role === "string") patch.role = body.role;
    if (typeof body.state === "string") patch.state = body.state;

    const user = await updateUser(tenant, decodeURIComponent(email), patch);
    return json({ user: user.email, role: user.role, state: user.state });
  });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ tenant: string; email: string }> },
) {
  const { tenant: param, email } = await ctx.params;
  return guarded(async () => {
    const tenant = await tenantFor(req, param);
    const who = await requireUser(req);
    await require_(tenant, who, "user.manage");

    const target = decodeURIComponent(email);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const purpose = body.purpose === "reset" ? "reset" : "activation";

    const origin = publicOrigin(req);
    const invitation = await issueInvitation(tenant, target, purpose, who, origin);
    const draft = await draftInvitation(tenant, target, invitation.link, purpose);
    return json({
      invitation: {
        ...invitation,
        delivered: draft.drafted,
        drafted: draft.drafted,
        folder: draft.folder,
        reason: draft.reason,
        linkReachable: originIsReachable(origin),
      },
    });
  });
}
