/**
 * The people who may sign in.
 *
 *   GET  /api/~/users           → the list, for DMC-08
 *   POST /api/~/users           → create somebody, and issue their invitation
 *
 * Both are admin-only, checked against the acting user's ROLE rather than
 * against "is signed in". A back-office colleague signing in is authenticated
 * and must still not be able to give themselves the admin role.
 */
import { guarded, json } from "@/lib/api";
import { tenantFor } from "@/lib/access";
import { requireUser } from "@/lib/session";
import { createUser, issueInvitation, listUsers, require_ } from "@/lib/user-admin";
import { sendInvitation } from "@/lib/invite-mail";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ tenant: string }> }) {
  const { tenant: param } = await ctx.params;
  return guarded(async () => {
    const tenant = await tenantFor(req, param);
    const who = await requireUser(req);
    await require_(tenant, who, "user.manage");
    return json({ users: await listUsers(tenant) });
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ tenant: string }> }) {
  const { tenant: param } = await ctx.params;
  return guarded(async () => {
    const tenant = await tenantFor(req, param);
    const who = await requireUser(req);
    await require_(tenant, who, "user.manage");

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const user = await createUser(
      tenant,
      {
        email: String(body.email ?? ""),
        name: String(body.name ?? ""),
        role: String(body.role ?? "backoffice"),
      },
      who,
    );

    const invitation = await issueInvitation(
      tenant,
      user.email,
      "activation",
      who,
      new URL(req.url).origin,
    );
    const sent = await sendInvitation(user.email, invitation.link, "activation");

    // The link comes back EITHER WAY. When no mail can leave, the admin needs
    // something to hand over; when it can, having it costs nothing and saves
    // the "it never arrived" conversation.
    return json({ user: user.email, invitation: { ...invitation, delivered: sent } }, 201);
  });
}
