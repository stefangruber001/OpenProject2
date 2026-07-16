// DELIBERATE VIOLATION FIXTURE — the boundary linter's tests must flag this.
// A kernel file importing a jurisdiction pack is the cardinal sin (§6.1).
import { esPack } from "@repo/pack-jurisdiction-es-es";

export const leak = esPack;
