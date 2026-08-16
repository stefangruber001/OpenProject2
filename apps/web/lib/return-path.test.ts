import { describe, expect, it } from "vitest";
import { safeReturnPath } from "./return-path";

/**
 * The "?next=" validator. It guards every redirect the sign-in flow and the
 * language switch emit, and those redirects are RELATIVE — so whatever passes
 * here is handed to the browser to resolve, and the browser's parser is the
 * one whose quirks matter. The backslash cases below are not hypothetical:
 * `new URL("/\\evil.com", base)` resolves to `https://evil.com/`.
 */
describe("where a redirect may send the browser", () => {
  it("keeps ordinary site paths, query strings included", () => {
    for (const p of ["/", "/login", "/login?next=%2F", "/workspace/erp.html#tower", "/a/b?c=d"]) {
      expect(safeReturnPath(p)).toBe(p);
    }
  });

  it("sends everything that could leave the site back to the root", () => {
    for (const p of [
      "",
      "https://evil.example",
      "http://evil.example/login",
      "//evil.example",
      "//evil.example/login",
      "/\\evil.example", // backslash IS a slash to a browser
      "\\/evil.example",
      "\\\\evil.example",
      "javascript:alert(1)",
      "login", // no leading slash — resolves relative to the current directory
    ]) {
      expect(safeReturnPath(p)).toBe("/");
    }
  });

  it("refuses non-strings rather than coercing them", () => {
    for (const v of [null, undefined, 42, ["/x"], { toString: () => "/x" }]) {
      expect(safeReturnPath(v)).toBe("/");
    }
  });
});
