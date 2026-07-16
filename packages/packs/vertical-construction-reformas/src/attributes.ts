/**
 * Shared vocabulary with jurisdiction tax adapters (ADR-0011): these string
 * keys are a data contract. The jurisdiction pack interprets them; neither
 * package imports the other. Covered end-to-end by the factory tests.
 */
export const HINT_WORKS_ON_DWELLING = "construction.works-on-dwelling";

export type DwellingRecipient = "individual-private" | "community-of-owners" | "business";

export interface DwellingWorksProfile {
  recipient: DwellingRecipient;
  dwellingPrivateUse: boolean;
  dwellingCompletedYearsAgo: number;
  /** Contractor-supplied materials as share of taxable base, basis points. */
  materialsShareBp: number;
}

export function dwellingWorksAttributes(
  p: DwellingWorksProfile,
): Record<string, string | number | boolean> {
  return {
    "construction.recipient": p.recipient,
    "construction.dwellingPrivateUse": p.dwellingPrivateUse,
    "construction.dwellingCompletedYearsAgo": p.dwellingCompletedYearsAgo,
    "construction.materialsShareBp": p.materialsShareBp,
  };
}
