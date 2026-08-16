import { describe, expect, it } from "vitest";
import { PUBLIC_EXACT, PUBLIC_PREFIXES, isPublic } from "./public-paths";

/**
 * The lock's exception surface.
 *
 * This file exists because the list had no test and a real bug hid in it: the
 * sign-in page's own language buttons pointed at `/api/lang`, which was not
 * public, so choosing Català or English on a screen you reach BEFORE signing in
 * answered with a raw 401 JSON body. Spanish looked fine only because it is the
 * default and needs no click.
 */
describe("what may be reached without signing in", () => {
  it("pins the exact list, so adding to it is a decision and not a slip", () => {
    // Deliberately a whole-list assertion. A membership check would pass just
    // as happily on a list with one extra entry, which is precisely the change
    // worth stopping — every addition here hands something to a stranger.
    expect([...PUBLIC_EXACT].sort()).toEqual(
      [
        "/activate",
        "/api/auth/activate",
        "/api/auth/login",
        "/api/auth/logout",
        "/api/health",
        "/api/lang",
        "/login",
      ].sort(),
    );
    expect([...PUBLIC_PREFIXES]).toEqual(["/brand/"]);
  });

  it("lets the sign-in page change its own language", () => {
    // The regression itself. A visitor on /login has no session by definition,
    // so the switcher it renders must be reachable without one.
    expect(isPublic("/api/lang")).toBe(true);
  });

  it("keeps everything else shut", () => {
    for (const path of [
      "/",
      "/workspace/erp.html",
      "/api/~/erp/doc/caneiMasterData",
      "/api/~/erp/language",
      "/api/auth/users",
      "/admin",
    ]) {
      expect(isPublic(path)).toBe(false);
    }
  });

  it("does not treat a prefix as a suffix, or a near-miss as a match", () => {
    // "/api/langsomething" is not "/api/lang", and a path that merely CONTAINS
    // a public one is not public. Matching loosely here would open routes
    // nobody listed.
    expect(isPublic("/api/langs")).toBe(false);
    expect(isPublic("/api/lang/extra")).toBe(false);
    expect(isPublic("/x/api/lang")).toBe(false);
    expect(isPublic("/loginx")).toBe(false);
    expect(isPublic("/x/brand/logo.svg")).toBe(false);
  });

  it("opens everything beneath a declared prefix, and nothing above it", () => {
    expect(isPublic("/brand/logo.svg")).toBe(true);
    expect(isPublic("/brand/social/card.png")).toBe(true);
    expect(isPublic("/brand")).toBe(false);
  });
});
