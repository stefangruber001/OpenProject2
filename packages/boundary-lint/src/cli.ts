import { checkBoundaries } from "./check";

const root = process.argv[2] ?? process.cwd();
const violations = checkBoundaries(root);

if (violations.length === 0) {
  console.log("boundaries: OK — layer matrix respected, no forbidden literals.");
  process.exit(0);
}

console.error(`boundaries: ${violations.length} violation(s):\n`);
for (const v of violations) {
  console.error(`  [${v.kind}] ${v.file}\n      ${v.detail}\n`);
}
console.error("The architecture is enforced by the build (mandate §6.1). Fix the layering.");
process.exit(1);
