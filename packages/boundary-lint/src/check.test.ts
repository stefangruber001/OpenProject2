import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkBoundaries } from "./check";
import { FORBIDDEN_LITERALS } from "./rules";

const here = dirname(fileURLToPath(import.meta.url));
// src → boundary-lint → packages → repo root
const REPO_ROOT = join(here, "..", "..", "..");
const BAD_WORKSPACE = join(here, "__fixtures__/bad-workspace");

describe("boundary linter", () => {
  it("flags the committed deliberate violations (mandate P0 proof)", () => {
    const violations = checkBoundaries(BAD_WORKSPACE);
    const kinds = violations.map((v) => v.kind).sort();
    // kernel→jurisdiction dependency, kernel→jurisdiction import,
    // vertical→jurisdiction dependency (N×M trap), capability literal 0.21
    expect(kinds).toEqual(["dependency", "dependency", "import", "literal"]);
    expect(violations.some((v) => v.detail.includes("@repo/pack-jurisdiction-es-es"))).toBe(true);
    expect(violations.some((v) => v.detail.includes("0.21"))).toBe(true);
  });

  /* A linter's hole is invisible by construction: it reports nothing, which is
     also what passing looks like. These are the words the vertical owns, pinned
     one by one, so that the next person to loosen a pattern finds out here
     rather than in a capability six months later.

     `subpartida` is the reason this test exists. The rule was `\bpartida`, and
     a word boundary does not fall between `sub` and `partida`, so the sector's
     own word for a budget line could be written into a capability and pass. */
  it("catches every word the vertical owns, compounds included", () => {
    const caught = (s: string) => FORBIDDEN_LITERALS.some((r) => r.pattern.test(s));
    for (const word of [
      "partida",
      "subpartida",
      "Subpartidas",
      "medición",
      "medicion",
      "certificación",
      "título",
      "titulo",
      "Títulos",
      "IVA",
      "IRPF",
      "AEAT",
      "es-ES",
    ])
      expect([word, caught(word)]).toEqual([word, true]);
    // And words that merely look like them are not swept up with them.
    for (const word of ["partial", "part", "medicine", "certificate", "title", "titular"])
      expect([word, caught(word)]).toEqual([word, false]);
  });

  it("passes on the real repository (the architecture holds)", () => {
    // Guard against scanning the wrong directory: the real kernel must be found.
    expect(existsSync(join(REPO_ROOT, "packages/kernel/package.json"))).toBe(true);
    expect(checkBoundaries(REPO_ROOT)).toEqual([]);
  });
});
