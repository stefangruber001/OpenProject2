/**
 * Adopt a language for this device, then carry on where you were.
 *
 *     GET /api/lang?to=ca&next=/login
 *
 * A GET THAT CHANGES SOMETHING, on purpose. The sign-in page runs no client
 * JavaScript — that is the one guarantee it makes — so the language switch has
 * to be an ordinary link. What it changes is a display preference on the
 * visitor's own device: there is nothing here worth forging, and nothing that
 * cannot be undone by clicking the other option.
 *
 * The cookie is the shared source of truth between the two halves of the app:
 * the server reads it to render the sign-in page in the right language, and
 * site/i18n.js reads the same cookie to translate the workspace. One choice,
 * one place, rather than a preference that has to be made twice.
 */
import { NextResponse } from "next/server";
import { LANG_COOKIE, asLanguage } from "@/lib/ui-language";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const to = asLanguage(url.searchParams.get("to"));

  const nextRaw = url.searchParams.get("next") || "/";
  // Only ever a path on this site — the same rule the sign-in redirect uses.
  // An open redirect reached through a language switch is still an open
  // redirect.
  const next = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/";

  const res = NextResponse.redirect(new URL(next, url.origin), 303);
  if (to) {
    res.cookies.set(LANG_COOKIE, to, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      // Readable by script on purpose: site/i18n.js needs it to translate the
      // workspace, and it holds nothing but two letters.
      httpOnly: false,
    });
  }
  return res;
}
