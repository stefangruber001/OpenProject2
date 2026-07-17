import { toMillis } from "@repo/kernel";

/** "1234.56" | "1234,56" → integer cents. Empty/invalid → 0. */
export function eurosToCents(raw: FormDataEntryValue | null): number {
  const s = String(raw ?? "")
    .trim()
    .replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/** Form number → float, with fallback. */
export function num(raw: FormDataEntryValue | null, fallback = 0): number {
  const n = Number(
    String(raw ?? "")
      .trim()
      .replace(",", "."),
  );
  return Number.isFinite(n) ? n : fallback;
}

export { toMillis };
