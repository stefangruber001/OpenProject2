import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkBoundaries } from "./check";

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

  it("passes on the real repository (the architecture holds)", () => {
    // Guard against scanning the wrong directory: the real kernel must be found.
    expect(existsSync(join(REPO_ROOT, "packages/kernel/package.json"))).toBe(true);
    expect(checkBoundaries(REPO_ROOT)).toEqual([]);
  });
});
