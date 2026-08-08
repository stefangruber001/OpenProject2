/**
 * "Has anything changed?" — the cheapest possible answer.
 *
 *     GET /api/~/erp/version → { tenant, versions: { state: 42, caneiMasterData: 7 } }
 *
 * WHY THIS EXISTS. A page loads the company document once and then shows it
 * until somebody presses reload. That was survivable when the data lived in the
 * browser, because the only person who could change it was the person looking
 * at it. It stopped being survivable the moment the document moved to the
 * server and the same company started reading it from a phone AND a laptop: the
 * laptop went on showing a register that was no longer true, with nothing on
 * screen to say so. Stale and confident is worse than stale and honest.
 *
 * The client polls this and re-reads only the documents whose number moved. It
 * has to be cheap or it will not be called often enough to matter — hence two
 * columns, no payload, and no engine constructed. Fetching the whole document
 * to discover it had not changed would move the register across the network
 * every few seconds to answer "no".
 *
 * Authenticated like every other API route, and the tenant is resolved from the
 * session rather than read from the URL. Version numbers are not secret in any
 * interesting sense, but "how often does this company save" is still theirs.
 */
import { documentVersions } from "@/lib/erp-runtime";
import { tenantFor } from "@/lib/access";
import { guarded, json } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ tenant: string }> }) {
  const { tenant: param } = await ctx.params;
  return guarded(async () => {
    const tenant = await tenantFor(req, param);
    return json({ tenant, versions: await documentVersions(tenant) });
  });
}
