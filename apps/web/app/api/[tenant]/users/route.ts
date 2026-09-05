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
import { draftInvitation } from "@/lib/invite-mail";
import { originIsReachable, publicOrigin } from "@/lib/public-origin";

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

    /* The address the OUTSIDE reaches this server on — not the one the process
       bound to. `new URL(req.url).origin` is `0.0.0.0:3000` inside the
       container, and that is what the activation link used to say. */
    const origin = publicOrigin(req);
    const invitation = await issueInvitation(tenant, user.email, "activation", who, origin);
    const draft = await draftInvitation(tenant, user.email, invitation.link, "activation");

    // The link comes back EITHER WAY. With a draft filed the admin rarely needs
    // it; without one it is the only way in, and saying so beats a green tick
    // over a message nobody will receive.
    return json(
      {
        user: user.email,
        invitation: {
          ...invitation,
          delivered: draft.drafted,
          drafted: draft.drafted,
          folder: draft.folder,
          reason: draft.reason,
          linkReachable: originIsReachable(origin),
        },
      },
      201,
    );
  });
}
