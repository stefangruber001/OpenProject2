/**
 * Spanish tax identifiers: NIF (natural persons), NIE (foreign residents) and
 * CIF (entities). Shape AND check character, because a document read off a
 * photograph will happily produce something that looks right and is not.
 *
 * This lives in the jurisdiction pack, which is the only layer allowed to know
 * that a tax id has this shape at all.
 */

/** Letter table for the 8-digit modulus-23 check (NIF and NIE). */
const NIF_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE";

/** Leading letters of a CIF and whether their check character is a digit. */
const CIF_DIGIT_ONLY = new Set(["A", "B", "E", "H"]);
const CIF_LETTER_ONLY = new Set(["K", "P", "Q", "S"]);
const CIF_LETTERS = "JABCDEFGHI";

export interface TaxIdResult {
  value: string;
  valid: boolean;
  kind: "nif" | "nie" | "cif";
}

export function normaliseTaxId(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[\s.\-/]/g, "")
    .trim();
}

export function checkSpanishTaxId(raw: string): TaxIdResult | null {
  const value = normaliseTaxId(raw);

  // NIF: 8 digits + check letter.
  if (/^\d{8}[A-Z]$/.test(value)) {
    const digits = Number(value.slice(0, 8));
    return { value, valid: NIF_LETTERS[digits % 23] === value[8], kind: "nif" };
  }

  // NIE: X/Y/Z + 7 digits + check letter, the leading letter standing for 0/1/2.
  if (/^[XYZ]\d{7}[A-Z]$/.test(value)) {
    const lead = "XYZ".indexOf(value[0]!);
    const digits = Number(`${lead}${value.slice(1, 8)}`);
    return { value, valid: NIF_LETTERS[digits % 23] === value[8], kind: "nie" };
  }

  // CIF: entity letter + 7 digits + check digit or letter.
  if (/^[ABCDEFGHJKLMNPQRSUVW]\d{7}[0-9A-J]$/.test(value)) {
    const body = value.slice(1, 8);
    let sum = 0;
    for (let i = 0; i < body.length; i++) {
      const digit = Number(body[i]);
      if (i % 2 === 0) {
        // Odd positions (1-based) are doubled and their digits added.
        const doubled = digit * 2;
        sum += Math.floor(doubled / 10) + (doubled % 10);
      } else {
        sum += digit;
      }
    }
    const control = (10 - (sum % 10)) % 10;
    const given = value[8]!;
    const lead = value[0]!;
    const validDigit = given === String(control);
    const validLetter = given === CIF_LETTERS[control];
    const valid = CIF_DIGIT_ONLY.has(lead)
      ? validDigit
      : CIF_LETTER_ONLY.has(lead)
        ? validLetter
        : validDigit || validLetter;
    return { value, valid, kind: "cif" };
  }

  return null;
}

/**
 * IBAN: shape plus the ISO 13616 modulus-97 check. Kept beside the tax id
 * because both answer the same question for the extractor — "is this string
 * really one of these, or did the reader hallucinate a plausible one?"
 */
export function checkIban(raw: string): { value: string; valid: boolean } | null {
  const value = raw.toUpperCase().replace(/[\s-]/g, "");
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(value)) return null;
  const rearranged = value.slice(4) + value.slice(0, 4);
  const expanded = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  // Modulus 97 in chunks, because the number is far wider than a JS integer.
  let remainder = 0;
  for (const digit of expanded) remainder = (remainder * 10 + Number(digit)) % 97;
  return { value, valid: remainder === 1 };
}
