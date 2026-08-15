/**
 * The company's working language.
 *
 *     GET  /api/~/erp/language   → { language: "es" | "ca" | "en" }
 *     PUT  /api/~/erp/language   { language: "ca" }
 *
 * ONE SETTING FOR THE WHOLE COMPANY, kept where everything else the company
 * owns is kept. The alternative — a language per browser — is what the system
 * had, and it meant "we work in Catalan now" was a sentence somebody had to say
 * to each person individually, and say again on every new phone. A setting that
 * only applies to the device you set it on is not a company setting.
 *
 * A device may still override it locally; that is a decision the browser makes
 * (see site/i18n.js) and it deliberately does not travel. This endpoint is only
 * ever about the default everybody starts from.
 *
 * GET IS READABLE BY ANYONE WHO CAN REACH THE APP. It reveals which of three
 * languages a company works in, which is not a secret and is on the sign-in
 * screen anyway — and requiring a session would mean the sign-in page could not
 * render itself in the right language. Writing needs a session.
 */
import { loadUiSettings, saveUiSettings } from "@/lib/erp-runtime";
import { requireUser } from "@/lib/session";
import { tenantFor } from "@/lib/access";
import { guarded, json } from "@/lib/api";
import { FactoryError } from "@repo/kernel";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const LANGUAGES = ["es", "ca", "en"] as const;
export type Language = (typeof LANGUAGES)[number];

export function asLanguage(value: unknown): Language | null {
  const v = String(value ?? "")
    .trim()
    .toLowerCase()
    .slice(0, 2);
  return (LANGUAGES as readonly string[]).includes(v) ? (v as Language) : null;
}

export async function GET(req: Request, ctx: { params: Promise<{ tenant: string }> }) {
  const { tenant: param } = await ctx.params;
  return guarded(async () => {
    const tenant = await tenantFor(req, param);
    const stored = await loadUiSettings(tenant).catch(() => null);
    return json({
      tenant,
      // Spanish when nothing has been chosen. Not a guess — it is the language
      // the company's own documents are written in.
      language: asLanguage((stored as { language?: unknown } | null)?.language) || "es",
    });
  });
}

export async function PUT(req: Request, ctx: { params: Promise<{ tenant: string }> }) {
  const { tenant: param } = await ctx.params;
  return guarded(async () => {
    const tenant = await tenantFor(req, param);
    const user = await requireUser(req);

    const body = (await req.json().catch(() => null)) as { language?: unknown } | null;
    const language = asLanguage(body?.language);
    if (!language) {
      throw new FactoryError(
        "BAD_REQUEST",
        `Unknown language. Choose one of: ${LANGUAGES.join(", ")}.`,
      );
    }

    const existing = (await loadUiSettings(tenant).catch(() => null)) || {};
    await saveUiSettings(tenant, { ...existing, language }, user);
    return json({ tenant, language, changedBy: user });
  });
}
