import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import {
  FORBIDDEN_LITERALS,
  allowedForLayer,
  classifyDependency,
  classifyPackageDir,
  type Layer,
} from "./rules";

export interface Violation {
  kind: "dependency" | "import" | "literal";
  file: string;
  detail: string;
}

interface PackageInfo {
  dir: string;
  relDir: string;
  name: string;
  layer: Layer;
  deps: string[];
}

function listPackages(root: string): PackageInfo[] {
  const candidates: string[] = ["packages/kernel"];
  for (const base of ["packages/capabilities", "packages/packs"]) {
    const abs = join(root, base);
    try {
      for (const entry of readdirSync(abs)) {
        if (statSync(join(abs, entry)).isDirectory()) candidates.push(`${base}/${entry}`);
      }
    } catch {
      // directory absent — nothing to scan
    }
  }
  const packages: PackageInfo[] = [];
  for (const relDir of candidates) {
    const layer = classifyPackageDir(relDir);
    if (!layer) continue;
    try {
      const pkg = JSON.parse(readFileSync(join(root, relDir, "package.json"), "utf8")) as {
        name: string;
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      packages.push({
        dir: join(root, relDir),
        relDir,
        name: pkg.name,
        layer,
        deps: [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})],
      });
    } catch {
      // no package.json — skip
    }
  }
  return packages;
}

function* walkTs(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) {
      if (entry === "node_modules" || entry === "__fixtures__") continue;
      yield* walkTs(abs);
    } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      yield abs;
    }
  }
}

const IMPORT_RE = /from\s+["'](@repo\/[^"']+)["']|import\s*\(\s*["'](@repo\/[^"']+)["']\s*\)/g;

function checkDep(layer: Layer, dep: string): string | null {
  const target = classifyDependency(dep);
  if (target === undefined || target === "tooling") return null;
  const allowed = allowedForLayer(layer);
  if (target === "kernel" && allowed.kernel) return null;
  if (target === "capability" && allowed.capability) return null;
  return target;
}

/** Scan a workspace root. Pure function of the filesystem — testable on fixtures. */
export function checkBoundaries(root: string): Violation[] {
  const violations: Violation[] = [];
  const packages = listPackages(root);

  for (const pkg of packages) {
    // 1) Declared dependencies must respect the layer matrix.
    for (const dep of pkg.deps) {
      const bad = checkDep(pkg.layer, dep);
      if (bad !== null) {
        violations.push({
          kind: "dependency",
          file: `${pkg.relDir}/package.json`,
          detail: `${pkg.name} (${pkg.layer}) depends on ${dep} (${bad}) — layers depend strictly downward; packs never import packs.`,
        });
      }
    }

    // 2) Source imports must match (catches undeclared/sneaky imports).
    const srcDir = join(pkg.dir, "src");
    let files: string[] = [];
    try {
      files = [...walkTs(srcDir)];
    } catch {
      files = [];
    }
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      for (const match of content.matchAll(IMPORT_RE)) {
        const dep = (match[1] ?? match[2])!;
        const depRoot = dep.split("/").slice(0, 2).join("/");
        const bad = checkDep(pkg.layer, depRoot);
        if (bad !== null) {
          violations.push({
            kind: "import",
            file: relative(root, file),
            detail: `${pkg.layer} package imports "${dep}" (${bad}) — forbidden by the layer matrix.`,
          });
        }
      }

      // 3) Forbidden literals in kernel + capabilities (non-test files).
      if (
        (pkg.layer === "kernel" || pkg.layer === "capability") &&
        !file.endsWith(".test.ts") &&
        !file.endsWith(".spec.ts")
      ) {
        for (const { pattern, why } of FORBIDDEN_LITERALS) {
          const m = pattern.exec(content);
          if (m) {
            violations.push({
              kind: "literal",
              file: relative(root, file),
              detail: `forbidden literal "${m[0]}" — ${why}.`,
            });
          }
        }
      }
    }
  }
  return violations;
}
