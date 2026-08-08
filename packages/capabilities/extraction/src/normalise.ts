/**
 * Turning whatever a reader produced into lines the scanner can work on.
 *
 * Recognised text arrives ragged: control characters, doubled spaces, empty
 * lines, and the odd character a reader is entitled to get wrong. Normalising
 * once, here, is what lets every later rule be written against clean input —
 * and keeps the `SourceSpan` offsets meaningful, because the line the user is
 * shown is the same line the offsets index into.
 */
export interface NormalisedInput {
  lines: string[];
  /** Page each line came from, when the caller supplied pages. */
  pageOf: number[];
}

export function normaliseText(input: string | string[]): NormalisedInput {
  const pages = Array.isArray(input) ? input : [input];
  const lines: string[] = [];
  const pageOf: number[] = [];
  pages.forEach((page, pageIndex) => {
    for (const raw of String(page ?? "").split(/\r\n|\r|\n/)) {
      const clean = raw
        // Control characters: a reader emits them for figures, rules and page
        // furniture. Stripping them is this function's entire job, which is
        // why the rule that normally forbids matching them is off here.
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        // Non-breaking, figure and thin spaces become ordinary ones: a number
        // split by one of these would otherwise read as two tokens.
        .replace(/[\u00a0\u2007\u2009\u202f]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (!clean) continue;
      lines.push(clean);
      pageOf.push(pageIndex + 1);
    }
  });
  return { lines, pageOf };
}

/** Lower-case and strip diacritics, so keyword matching is accent-blind. */
export function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
