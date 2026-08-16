/**
 * What may be reached WITHOUT signing in.
 *
 * This list is the whole of the lock's exception surface, and it lives in its
 * own file for one reason: it was inside `middleware.ts`, which imports
 * `next/server` and therefore had no unit test, so nothing checked it and
 * nothing could. That is not a hypothetical cost. `/api/lang` — the language
 * switcher that sits ON the sign-in page, where the visitor is by definition
 * not signed in — was missing from it, so choosing Català or English answered
 * with a raw 401 JSON body where the sign-in screen should have been, while
 * Spanish appeared to work because it is the default and needs no click.
 *
 * DEFAULT DENY. Everything not named here is protected, including routes added
 * tomorrow by somebody who has never read this file. The opposite arrangement,
 * a list of protected paths, fails open every time somebody forgets to add to
 * it.
 *
 * Adding an entry means deciding that an anonymous stranger may have it. The
 * test beside this file pins the list exactly, so an addition fails the build
 * until it is written down there too — a second pair of eyes by construction.
 */
export const PUBLIC_EXACT: readonly string[] = [
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  // Accepting an invitation. The whole point is that the person following the
  // link has no account yet — putting this behind the login would mean you must
  // sign in to be able to sign in. The link itself is the credential: 32 random
  // bytes, single use, seven days.
  "/activate",
  "/api/auth/activate",
  // Choosing a display language. Writes two letters into a cookie on the
  // visitor's own device, reads nothing, reveals nothing, and its redirect
  // target is restricted to a path on this site.
  "/api/lang",
  // Health is how the machine checks itself, from inside, with no browser and
  // no cookie. It reports whether the process is up and the database is
  // reachable — it exposes no company data.
  "/api/health",
];

/**
 * Prefixes reachable without a session. Kept separate from the exact list so a
 * prefix is always a deliberate choice: a prefix opens everything beneath it.
 */
export const PUBLIC_PREFIXES: readonly string[] = [
  // The link preview. WhatsApp and Slack fetch the page and its image with no
  // session at all, so an image behind the login produces a card with no
  // thumbnail. Nothing under /brand/ is company data; it is a logo and a
  // picture of a logo.
  "/brand/",
];

export function isPublic(pathname: string): boolean {
  return PUBLIC_EXACT.includes(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}
