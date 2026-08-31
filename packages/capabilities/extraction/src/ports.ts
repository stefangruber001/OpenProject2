import type { Cents, PortId } from "@repo/kernel";
import type { FieldKey } from "./model";

/**
 * The one port this capability consumes. Everything locale-shaped lives behind
 * it: how numbers and dates are written, what a tax id looks like and whether
 * a given one is real, which words announce which field, and which tax rates
 * are plausible on a document of a given date.
 *
 * The capability is therefore testable — and shippable — against a profile for
 * a country nobody has written yet.
 */
export const EXTRACTION_PROFILE_PORT: PortId = "extraction-profile@1";

export interface TaxIdCheck {
  /** Canonical form (case, separators removed). */
  value: string;
  /**
   * Whether it passes the jurisdiction's own check — a checksum, a registry
   * shape, whatever that jurisdiction uses. A structurally plausible id that
   * fails its check is worth less confidence than one that passes, and worth
   * more than nothing: the reader may simply have misread a digit.
   */
  valid: boolean;
}

export interface ExtractionProfile {
  id: string;
  version: string;

  /** Words that announce a field, lower-cased and already de-accented. */
  keywords: Partial<Record<FieldKey, string[]>>;

  /**
   * How a company's legal name ends in this locale, lower-cased.
   *
   * The issuer of a document is almost never labelled — it is simply the
   * largest text at the top — and it frequently wraps onto a second line. The
   * capability needs to know that two consecutive head lines are one name
   * rather than two, and cannot know it without being told what the end of a
   * name looks like here. It reads these as markers and nothing else: no
   * meaning is attached to any of them.
   */
  issuerSuffixes?: string[];

  /**
   * Labels that introduce the party being BILLED, in this locale.
   *
   * Every invoice names two companies, and both a name and a tax id look
   * identical whichever one they belong to. What separates them is layout: the
   * issuer is at the head, and the recipient arrives under a heading that says
   * so — «FACTURAR A», «CLIENTE», «DESTINATARIO». Everything from that heading
   * onwards is the other company, and the capability uses these markers as a
   * boundary without knowing what any of them mean.
   */
  recipientMarkers?: string[];

  /** Money, in this locale's notation. Null when it is not an amount. */
  parseAmountCents(raw: string): Cents | null;

  /** A date in this locale's notation → ISO `yyyy-mm-dd`, or null. */
  parseDate(raw: string): string | null;

  /** A percentage token, however this locale writes one → basis points. */
  parsePercentBp(raw: string): number | null;

  /** Canonicalise and check a tax id. Null when it is not one at all. */
  checkTaxId(raw: string): TaxIdCheck | null;

  /** Canonicalise and check an account number. Null when it is not one. */
  checkAccountNumber?(raw: string): TaxIdCheck | null;

  /**
   * Regexes that find each kind of token inside a line. They must carry the
   * `g` flag; the capability clones them per scan so their `lastIndex` never
   * leaks between documents.
   */
  patterns: {
    amount: RegExp;
    date: RegExp;
    taxId: RegExp;
    percent: RegExp;
    accountNumber?: RegExp;
    docNumber?: RegExp;
  };

  /**
   * Tax rates that may legitimately appear on a document issued on that date,
   * in basis points. Effective-dated because rates change and a document from
   * two years ago must be checked against the law of two years ago.
   */
  expectedTaxRatesBp(issueDateIso: string): number[];
}
