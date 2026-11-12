import { FactoryError, type Cents, type PortRegistry } from "@repo/kernel";
import { fold, normaliseText } from "./normalise";
import {
  AMOUNT_FIELDS,
  FIELD_KEYS,
  type Candidate,
  type ConsistencyCheck,
  type ExtractedField,
  type ExtractionResult,
  type FieldKey,
  type SourceSpan,
  type TaxBreakdownRow,
} from "./model";
import type { ExtractionConfig } from "./config";
import { EXTRACTION_PROFILE_PORT, type ExtractionProfile } from "./ports";

export interface ExtractionDeps {
  ports: PortRegistry;
  config: ExtractionConfig;
}

export interface ExtractInput {
  /** Recognised text: one string, or one per page. */
  text: string | string[];
  /**
   * The date the caller believes the document was issued, used only to ask the
   * profile which tax rates were law then. The extracted date wins once found.
   */
  assumeIssueDate?: string;
  /**
   * WHO WE ARE, so the reader cannot mistake us for the issuer.
   *
   * Every invoice names two companies, and one of them is always the reader.
   * The operator's own supplier invoice carries two tax ids — the supplier's
   * at the head and ours under «FACTURAR A» — and nothing in the shape of
   * either says which is which. This is the one fact that settles it, and the
   * caller has it: the issuer is the party that is not us.
   *
   * A hint, never a rule: an empty list simply removes the help.
   */
  exclude?: { names?: string[]; taxIds?: string[] };
}

/** Which token kinds each field is built from. */
const FIELD_TOKEN: Record<FieldKey, "amount" | "date" | "taxId" | "account" | "text"> = {
  issuerName: "text",
  issuerTaxId: "taxId",
  /* Text, but never found by the label pass: an address is not announced by a
     word, it is a shape in a position. `issuerContact` fills these directly,
     the way `unlabelledIssuer` fills the name. */
  issuerAddress: "text",
  issuerPostcode: "text",
  issuerCity: "text",
  issuerRegion: "text",
  issuerPhone: "text",
  issuerEmail: "text",
  docNumber: "text",
  issueDate: "date",
  dueDate: "date",
  netAmount: "amount",
  taxAmount: "amount",
  withholdingAmount: "amount",
  totalAmount: "amount",
  iban: "account",
  orderRef: "text",
};

/**
 * Reads candidate fields off a recognised document.
 *
 * Two properties matter more than accuracy, and both are structural:
 *
 *   1. NOTHING IS EVER CONFIRMED HERE. The result is a proposal with a
 *      confidence and a provenance per field; a person confirms it elsewhere.
 *      That is a requirement (CAP-04), and it is also the only honest posture
 *      for a component whose input is a photograph.
 *   2. NO LOCALE KNOWLEDGE. Number and date notation, tax-id shapes and
 *      validity, the words that announce a field, and which tax rates are
 *      plausible all come from the bound profile.
 */
export class ExtractionService {
  constructor(private readonly deps: ExtractionDeps) {}

  private profile(): ExtractionProfile {
    return this.deps.ports.get<ExtractionProfile>(EXTRACTION_PROFILE_PORT);
  }

  extract(input: ExtractInput): ExtractionResult {
    const profile = this.profile();
    const { lines, pageOf } = normaliseText(input.text);
    if (!lines.length) {
      throw new FactoryError(
        "INVALID_STATE",
        "No readable text: nothing to extract. Offer manual entry with the image attached.",
      );
    }
    const folded = lines.map(fold);

    const exclude = {
      names: new Set((input.exclude?.names ?? []).map(fold).filter(Boolean)),
      taxIds: new Set(
        (input.exclude?.taxIds ?? [])
          .map((t) => t.toUpperCase().replace(/[^A-Z0-9]/g, ""))
          .filter(Boolean),
      ),
    };

    /* WHERE THE OTHER COMPANY STARTS. Below «FACTURAR A» the name and the tax
       id belong to whoever is being billed, and on the operator's own invoice
       that customer's CIF is the one that validates while the issuer's — a
       made-up number on a simulated document — does not, so the reader
       confidently returned the wrong company. Position settles it where the
       shape of the value cannot. */
    const recipientAt = this.recipientBoundary(folded, lines, profile, exclude);

    const perField = new Map<FieldKey, Candidate[]>();
    for (const key of FIELD_KEYS) {
      perField.set(key, this.candidatesFor(key, lines, folded, pageOf, profile, exclude));
    }
    /* EVERY line the issuer's tax id was found on — collected here, before
       the boundary filter below throws the ones under it away. A document
       that prints the letterhead at the foot (the recipient in the window,
       the issuer's own address below the totals) states the tax id twice,
       and it is the discarded occurrence that says where their address is.
       Ours is already gone from this list: `exclude` dropped it. */
    const anchors = (perField.get("issuerTaxId") ?? []).map((c) => c.source.line);

    for (const key of ["issuerName", "issuerTaxId"] as const) {
      const all = perField.get(key) ?? [];
      const above = all.filter((c) => c.source.line < recipientAt);
      // Only when something survives: a document with no such heading, or one
      // that names the issuer below it, keeps whatever was found.
      if (above.length && above.length < all.length) perField.set(key, above);
    }
    /* THE ANCHOR: the one line on the page that is certainly the issuer's.
       A tax id that passes its check digit and is not ours belongs to them,
       and on every letterhead their name sits at or just above it and their
       address within a line or two of it. Everything below reads outward from
       that line instead of downward from the top of the page, which is what
       made a reader of real documents pick up a dateline for a name and the
       recipient's street for the issuer's. */
    const anchor = best(perField.get("issuerTaxId"))?.source.line ?? null;
    // The issuer is not labelled on real documents; see `unlabelledIssuer`.
    if (!perField.get("issuerName")?.length) {
      const guessed = this.unlabelledIssuer(
        lines,
        folded,
        pageOf,
        profile,
        exclude,
        recipientAt,
        anchor,
      );
      if (guessed) perField.set("issuerName", [guessed]);
    }
    // …and neither is where they are. See `issuerContact`.
    for (const [key, cand] of this.issuerContact(lines, pageOf, profile, recipientAt, anchors))
      if (!perField.get(key)?.length) perField.set(key, [cand]);

    // The issue date, once found, decides which rates were law — so it is
    // resolved before the checks that depend on it.
    const issueDate =
      (best(perField.get("issueDate"))?.value as string | undefined) ?? input.assumeIssueDate;

    const taxBreakdown = this.taxBreakdown(lines, pageOf, profile);
    const fields = FIELD_KEYS.map((key) => this.toField(key, perField.get(key) ?? []));
    this.deriveMissingAmount(fields);
    const checks = this.check(fields, taxBreakdown, issueDate, profile);

    // A contradiction is not a reason to hide a number; it is a reason to make
    // a person look at it.
    for (const check of checks) {
      if (check.status !== "mismatch") continue;
      for (const f of fields) {
        if (!check.fields.includes(f.key)) continue;
        f.confidence = round(Math.max(0, f.confidence - 0.25));
        f.reasons = [...f.reasons, `contradicted by ${check.id}`];
      }
    }

    this.applyVerdicts(fields, checks);

    // Amber IS the review list. Before the verdicts existed this was a
    // confidence threshold, which let a well-read but unchecked value — the
    // spike's wrong NIF, read cleanly and scored high — stay off the list of
    // things a person has to look at. Threshold still applies: a low-confidence
    // read is worth a look even where a validator happened to pass.
    const threshold = this.deps.config.reviewThreshold;
    const needsReview = fields
      .filter((f) => f.verdict === "amber" || f.confidence < threshold)
      .map((f) => f.key);

    return {
      lines,
      fields,
      taxBreakdown,
      checks,
      needsReview,
      profile: { id: profile.id, version: profile.version },
      confirmed: false,
    };
  }

  /**
   * Re-run the consistency checks over values a person has edited.
   *
   * The validation screen needs this: the moment someone fixes the total, the
   * arithmetic verdict must move with it, and it must be the same arithmetic
   * the extractor used rather than a second copy living in the UI.
   */
  recheck(
    result: ExtractionResult,
    corrections: Partial<Record<FieldKey, string | number | null>>,
  ): ExtractionResult {
    const profile = this.profile();
    const fields = result.fields.map((f) => {
      if (!Object.prototype.hasOwnProperty.call(corrections, f.key)) return { ...f };
      const value = corrections[f.key] ?? null;
      // A typed value is re-CHECKED, not merely trusted. Typing is exactly
      // where a NIF acquires a transposed digit, and the whole reason the
      // check digit is worth computing is that it does not care who produced
      // the number. So confidence goes to 1 — a person is certain of what
      // they typed — while the dot still has to be earned.
      const revalidated = this.validateValue(f.key, value, profile);
      return {
        ...f,
        value,
        raw: value === null ? null : String(value),
        confidence: 1,
        reasons: revalidated.reasons.length
          ? ["corrected by hand", ...revalidated.reasons]
          : ["corrected by hand"],
        validated: revalidated.validated,
        verdict: "amber" as const, // finalised below
      };
    });
    const issueDate = fields.find((f) => f.key === "issueDate")?.value as string | undefined;
    const checks = this.check(fields, result.taxBreakdown, issueDate, profile);
    this.applyVerdicts(fields, checks);
    const threshold = this.deps.config.reviewThreshold;
    return {
      ...result,
      fields,
      checks,
      needsReview: fields
        .filter((f) => f.verdict === "amber" || f.confidence < threshold)
        .map((f) => f.key),
      confirmed: false,
    };
  }

  /**
   * Run whatever validator this field's kind has against a value that did not
   * come off the page. Amounts return false here and are decided by the
   * arithmetic in `applyVerdicts`, exactly as read values are.
   */
  private validateValue(
    key: FieldKey,
    value: string | number | null,
    profile: ExtractionProfile,
  ): { validated: boolean; reasons: string[] } {
    if (value === null || value === "") return { validated: false, reasons: [] };
    const kind = FIELD_TOKEN[key];
    if (kind === "taxId") {
      const c = profile.checkTaxId(String(value));
      if (c?.valid) return { validated: true, reasons: ["passes its check digit"] };
      return { validated: false, reasons: ["fails its check digit — read it again"] };
    }
    if (kind === "account") {
      const c = profile.checkAccountNumber?.(String(value));
      if (c?.valid) return { validated: true, reasons: ["passes its check digit"] };
      return { validated: false, reasons: ["fails its check digit — read it again"] };
    }
    if (kind === "date") {
      const iso = isRealDate(String(value)) ? String(value) : profile.parseDate(String(value));
      if (iso && isRealDate(iso)) return { validated: true, reasons: ["is a real calendar date"] };
      return { validated: false, reasons: ["is not a real calendar date"] };
    }
    return { validated: false, reasons: [] };
  }

  /* ------------------------------------------------------------------ */

  private candidatesFor(
    key: FieldKey,
    lines: string[],
    folded: string[],
    pageOf: number[],
    profile: ExtractionProfile,
    exclude: { names: Set<string>; taxIds: Set<string> },
  ): Candidate[] {
    const kind = FIELD_TOKEN[key];
    const keywords = (profile.keywords[key] ?? []).map(fold);
    const out: Candidate[] = [];

    lines.forEach((line, i) => {
      const spans = this.tokens(kind, line, i, pageOf[i], profile, key, lines);
      for (const { span, value } of spans) {
        /* NOT US. Every invoice names two companies and one of them is the
           reader; nothing in the shape of a tax id says which. Dropped before
           scoring rather than after, so a runner-up is never our own record
           offered as an alternative. */
        if (typeof value === "string") {
          if (kind === "taxId" && exclude.taxIds.has(value.toUpperCase().replace(/[^A-Z0-9]/g, "")))
            continue;
          if (kind === "text" && exclude.names.has(fold(value))) continue;
        }
        /* LABEL RESIDUE IS NOT A VALUE. «OBRA / REFERENCIA» is a heading, and
           taking everything after «obra» yielded «/ REFERENCIA» — a field
           filled with the rest of its own label. A value that is nothing but
           punctuation and other keywords is discarded, and the line below is
           tried instead (see `tokens`). */
        if (kind === "text" && typeof value === "string" && this.isLabelResidue(value, profile))
          continue;
        const reasons: string[] = [];
        let score = 0;
        let failedCheckDigit = false;
        let labelled = true;

        // A label on the same line, to the left of the value, is the strongest
        // signal a document gives; a label on the line above is the second.
        const hit = keywords.find((k) => folded[i]!.includes(k));
        if (hit && folded[i]!.indexOf(hit) < span.start) {
          score += 0.5;
          reasons.push(`labelled "${hit}"`);
        } else if (hit) {
          score += 0.35;
          reasons.push(`labelled "${hit}" on the same line`);
        } else if (i > 0 && keywords.some((k) => folded[i - 1]!.includes(k))) {
          score += 0.3;
          reasons.push("labelled on the line above");
        } else {
          labelled = false;
        }

        score += kind === "text" ? 0.15 : 0.3;
        reasons.push(`matched a ${kind} token`);

        // Whether anything CHECKED this value, as opposed to liking the look
        // of it. Only a real check may turn a dot green — see FieldVerdict.
        let validated = false;

        if (kind === "taxId" || kind === "account") {
          const check =
            kind === "taxId"
              ? profile.checkTaxId(span.text)
              : profile.checkAccountNumber?.(span.text);
          if (check?.valid) {
            score += 0.2;
            validated = true;
            reasons.push("passes its check digit");
          } else if (check) {
            failedCheckDigit = true;
            reasons.push("fails its check digit — read it again");
          }
        }

        // A date is validated by being a real day: the profile knows how this
        // locale writes one, but "is 31 February a date" is arithmetic, not
        // locale knowledge, so it is checked here.
        if (kind === "date" && typeof value === "string" && isRealDate(value)) {
          validated = true;
          reasons.push("is a real calendar date");
        }

        // Totals sit at the foot of a document; identifiers at the head.
        const position = i / Math.max(1, lines.length - 1);
        if (key === "totalAmount" && position > 0.6) {
          score += 0.1;
          reasons.push("near the foot of the document");
        }
        if ((key === "issuerTaxId" || key === "issuerName") && position < 0.4) {
          score += 0.1;
          reasons.push("near the head of the document");
        }

        // A field with no label anywhere and no other signal is a guess, and
        // is scored like one.
        if (!hit && score < 0.5) reasons.push("no label found nearby");

        // An id that fails its own check digit cannot be right as read,
        // however well-labelled and well-placed it was. The ceiling is applied
        // LAST, after every bonus, so a beautifully positioned wrong number
        // still reaches a human.
        if (failedCheckDigit) score = Math.min(score, 0.5);

        out.push({
          value,
          raw: span.text,
          confidence: round(Math.min(1, score)),
          source: span,
          reasons,
          labelled,
          validated,
        });
      }
    });

    return out.sort((a, b) => b.confidence - a.confidence || a.source.line - b.source.line);
  }

  private tokens(
    kind: "amount" | "date" | "taxId" | "account" | "text",
    line: string,
    lineIndex: number,
    page: number | undefined,
    profile: ExtractionProfile,
    key: FieldKey,
    allLines?: string[],
  ): { span: SourceSpan; value: string | number | null }[] {
    const mk = (m: RegExpExecArray, value: string | number | null) => ({
      span: {
        line: lineIndex,
        text: m[0],
        start: m.index,
        end: m.index + m[0].length,
        page,
      } as SourceSpan,
      value,
    });

    if (kind === "text") {
      // Free text has no shape of its own: it is whatever follows the label on
      // its line, which is why an unlabelled document yields none of it.
      const keywords = (profile.keywords[key] ?? []).map(fold);
      const f = fold(line);
      for (const k of keywords) {
        const at = f.indexOf(k);
        if (at === -1) continue;
        const after = line.slice(at + k.length).replace(/^[\s:.#/–—-]+/, "");
        if (after && !this.isLabelResidue(after, profile)) {
          const start = line.length - after.length;
          return [
            {
              span: { line: lineIndex, text: after, start, end: line.length, page },
              value: after,
            },
          ];
        }
        /* THE VALUE IS ON THE NEXT LINE, which is how documents are actually
           laid out: a heading, then the thing it heads. «OBRA / REFERENCIA»
           over «Reforma de aseos — local comercial», «FACTURA» over «N.o
           F-2026/4471». Taking the rest of the heading's own line gave a field
           filled with the remainder of its label, and taking nothing gave an
           empty field on a document that states the answer plainly. */
        /* …and only when this line is a HEADING — nothing on it but label
           words and punctuation. Without that gate the rule reached past a
           line that did carry its value and took whatever came next, which on
           a real invoice is the line-items table header. */
        const below = allLines?.[lineIndex + 1]?.trim();
        if (below && this.isLabelResidue(line, profile) && !this.isLabelResidue(below, profile)) {
          return [
            {
              span: { line: lineIndex + 1, text: below, start: 0, end: below.length, page },
              value: below,
            },
          ];
        }
      }
      return [];
    }

    const pattern =
      kind === "amount"
        ? profile.patterns.amount
        : kind === "date"
          ? profile.patterns.date
          : kind === "taxId"
            ? profile.patterns.taxId
            : profile.patterns.accountNumber;
    if (!pattern) return [];

    const re = new RegExp(
      pattern.source,
      pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g",
    );
    const found: { span: SourceSpan; value: string | number | null }[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
      if (m[0] === "") {
        re.lastIndex += 1;
        continue;
      }
      const value =
        kind === "amount"
          ? profile.parseAmountCents(m[0])
          : kind === "date"
            ? profile.parseDate(m[0])
            : kind === "taxId"
              ? (profile.checkTaxId(m[0])?.value ?? null)
              : (profile.checkAccountNumber?.(m[0])?.value ?? m[0]);
      if (value === null) continue;
      found.push(mk(m, value));
    }
    return found;
  }

  /**
   * Is this "value" just the rest of its own label?
   *
   * «OBRA / REFERENCIA» is a heading. Cutting at «obra» left «/ REFERENCIA»,
   * and the reader offered it as the job reference — a field filled with the
   * remainder of the words that announced it. So: strip every keyword this
   * profile knows, and if what survives has no word left in it, there was
   * never a value there.
   *
   * Every keyword, not just the field's own: a heading pairs words from
   * different fields («OBRA / REFERENCIA», «Fecha / Vencimiento»), and a rule
   * that only knew its own would keep the other half.
   *
   * What survives has to be alphanumeric, not a WORD. The first version asked
   * for three consecutive letters and threw away «OB-2026-014» and
   * «F-2026/0417» — real references, mostly digits, exactly the shape these
   * fields carry. A reference is not prose and must not be tested as though it
   * were.
   */
  private isLabelResidue(text: string, profile: ExtractionProfile): boolean {
    let rest = fold(text);
    for (const list of Object.values(profile.keywords)) {
      for (const k of list ?? []) {
        const folded = fold(k);
        if (folded.length >= 3) rest = rest.split(folded).join(" ");
      }
    }
    return !/[\p{L}\p{N}]/u.test(rest);
  }

  /**
   * THE ISSUER, WHICH NO DOCUMENT LABELS.
   *
   * `keywords.issuerName` lists «razón social», «emisor», «proveedor» — words
   * that appear on almost no real invoice. A supplier's name is simply the
   * largest text at the top, announced by nothing, so a label-driven reader
   * could never find it and returned "not found" on documents that shout it in
   * 24-point bold.
   *
   * What IS true of it: it sits in the head of the document, it is not us, and
   * it is not a date, an amount, a tax id or an address. That is enough to
   * offer one — never to be sure of one, so the confidence stays low and the
   * dot stays amber, which is the honest posture for a guess about a name
   * nothing can check.
   *
   * A name that wrapped onto a second line is one name: «SUMINISTROS CERDA» /
   * «MATERIALS, S.L.» — joined when the line below ends in one of the legal
   * suffixes the profile names, because knowing what the end of a company name
   * looks like here is jurisdiction knowledge and does not belong in this file.
   */
  private unlabelledIssuer(
    lines: string[],
    folded: string[],
    pageOf: number[],
    profile: ExtractionProfile,
    exclude: { names: Set<string>; taxIds: Set<string> },
    recipientAt: number,
    anchor: number | null,
  ): Candidate | null {
    const suffixes = (profile.issuerSuffixes ?? []).map(fold);

    const nameAt = (i: number, why: string, confidence: number): Candidate | null => {
      const line = lines[i]?.trim();
      if (!line) return null;
      if (line.length < 3 || line.length > 80) return null;
      if (!/\p{Lu}/u.test(line)) return null; // a name carries a capital
      if (this.isLabelResidue(line, profile)) return null;
      if (exclude.names.has(fold(line))) return null;
      // Not a date, an amount, a tax id, or a line that is mostly digits.
      if (profile.parseDate(line) || profile.parseAmountCents(line)) return null;
      const letters = (line.match(/\p{L}/gu) ?? []).length;
      const digits = (line.match(/\d/gu) ?? []).length;
      if (digits >= letters) return null;
      if (this.isDateline(line, profile, suffixes)) return null;
      /* NOT A CONTACT LINE. A postal code, a telephone or an email address
         marks a line that says where the issuer is, not who they are — and
         the anchor sits inside exactly such a block, so without this the line
         carrying the tax id and the street came back as the name. */
      for (const p of [profile.patterns.postcode, profile.patterns.phone, profile.patterns.email])
        if (p && new RegExp(p.source, p.flags).test(line)) return null;
      /* NOR A LABEL AND ITS VALUE. "<tax-id label> <tax id>" survives every
         test above — it has letters, no whole-line date parses out of it, and
         the label is longer than the number — and the anchor line is very
         often precisely that. Take out what the profile can name and what is
         left of a label is nothing. */
      if (this.nameResidue(line, profile).length < 3) return null;

      let text = line;
      let end = i;
      const next = lines[i + 1]?.trim();
      if (next && next.length <= 40 && suffixes.some((sfx) => fold(next).includes(sfx))) {
        text = `${line} ${next}`;
        end = i + 1;
      }
      if (exclude.names.has(fold(text))) return null;
      return {
        value: text,
        raw: text,
        confidence,
        source: { line: i, text, start: 0, end: lines[end]!.length, page: pageOf[i] },
        reasons: [why],
        labelled: false,
        validated: false,
      };
    };

    /* NEAREST THE ANCHOR FIRST. Their name is the line their tax id sits on,
       or the one above it, or the one above that — a letterhead is three or
       four lines tall. Searched upward, because what follows a tax id is a
       street and what precedes it is a name. Found there it is more than a
       guess about position, so it carries a little more confidence; still
       nothing checked it, so it stays well short of green. */
    if (anchor !== null) {
      for (let i = anchor; i >= 0 && i >= anchor - 3; i--) {
        const hit = nameAt(i, "beside the issuer's own tax id", 0.45);
        if (hit) return hit;
      }
    }

    const head = Math.min(lines.length, 8, recipientAt);
    for (let i = 0; i < head; i++) {
      const hit = nameAt(i, "at the head of the document, and not this company", 0.35);
      if (hit) return hit;
    }
    return null;
  }

  /**
   * A LINE THAT SAYS WHEN AND WHERE IS NOT A COMPANY.
   *
   * A real document opened with a date and a town on one line, and the reader
   * offered that as the supplier's name. Every test above let it through: only
   * a whole line parses as a date and this one has a word after it, and it is
   * not mostly digits because the town is longer than the date. The operator,
   * relaying the client: it never reads the issuer right.
   *
   * What gives it away is that taking the date out leaves almost nothing.
   * Dates belong to the profile, so each word is offered to it rather than
   * matched against a shape written here; a line with a date in it and at most
   * two words besides, none of which ends a company name, states a fact about
   * the document and names nobody.
   */
  /**
   * What is left of a line once the profile has taken out everything it can
   * name: the labels it knows and every shape it can match. A name is what
   * nothing in the profile accounts for, so a line that accounts for itself
   * entirely — a label and its value — leaves nothing behind and is not one.
   *
   * Letters only, so punctuation and separators cannot make an empty residue
   * look like a word.
   */
  private nameResidue(line: string, profile: ExtractionProfile): string {
    let rest = line;
    for (const p of Object.values(profile.patterns)) {
      if (!p) continue;
      const flags = p.flags.includes("g") ? p.flags : `${p.flags}g`;
      rest = rest.replace(new RegExp(p.source, flags), " ");
    }
    let folded = fold(rest);
    for (const list of Object.values(profile.keywords)) {
      for (const k of list ?? []) {
        const f = fold(k);
        if (f.length >= 3) folded = folded.split(f).join(" ");
      }
    }
    return (folded.match(/\p{L}/gu) ?? []).join("");
  }

  private isDateline(line: string, profile: ExtractionProfile, suffixes: string[]): boolean {
    const words = line.split(/[\s,;]+/u).filter(Boolean);
    if (words.length < 2) return false;
    const dated = words.filter((w) => profile.parseDate(w) !== null).length;
    if (!dated) return false;
    if (words.length - dated > 2) return false;
    return !suffixes.some((sfx) => fold(line).includes(sfx));
  }

  /**
   * WHERE THE ISSUER IS, READ OFF THE HEAD OF THE PAGE.
   *
   * The operator, having created a supplier from an invoice and found the
   * address, the town and the telephone all empty on a document that states
   * every one of them: "it does not read all the information from the doc."
   * It was not losing them in transit — there were no fields for them at all,
   * so a party record built from a document arrived incomplete by
   * construction and had to be finished by hand from the same page.
   *
   * A postal address is not announced by a label the way an amount is; it is a
   * SHAPE in a POSITION. So this does not go through the keyword pass. It
   * looks above the recipient boundary — everything there belongs to the
   * issuer, which is the same fact that already keeps their tax id from being
   * confused with ours — and anchors on the one token an address always
   * contains and nothing else looks like: the postal code.
   *
   * Around that anchor the rest falls out. What follows it on the same segment
   * is the town, with a region in brackets after it where this locale writes
   * one; what precedes it is the street. Segments, because a header line is
   * very often one line with separators in it — a tax id, a registry number,
   * an address and a telephone divided by bullets — and splitting on those
   * turns one crowded line into the four facts it is carrying.
   *
   * The telephone is the exception and needs its label. Nine digits in three
   * groups is also what a document number, a registry code and an account
   * fragment look like, and a wrong telephone on a supplier record is worse
   * than none: it gets dialled. So it is read only where the page says it is
   * one. An address that this profile has no postal-code pattern for simply
   * comes back empty — nothing is guessed.
   */
  private issuerContact(
    lines: string[],
    pageOf: number[],
    profile: ExtractionProfile,
    recipientAt: number,
    anchors: number[],
  ): Map<FieldKey, Candidate> {
    const out = new Map<FieldKey, Candidate>();
    const region = this.issuerLines(lines.length, recipientAt, anchors);
    const make = (
      value: string,
      line: number,
      start: number,
      end: number,
      why: string,
    ): Candidate => ({
      value,
      raw: value,
      // Never green on its own: nothing here is check-summed, and a person
      // reads it once on the way past.
      confidence: 0.5,
      source: { line, text: lines[line] ?? "", start, end, page: pageOf[line] },
      reasons: [why],
      labelled: false,
      validated: false,
    });

    const pc = profile.patterns.postcode;
    if (pc) {
      outer: for (const i of region) {
        const raw = lines[i] ?? "";
        // A header line often carries four facts divided by bullets.
        const segments = raw.split(/\s[·|—–]\s|\t{2,}/g);
        let consumed = 0;
        for (const seg of segments) {
          const at = raw.indexOf(seg, consumed);
          consumed = at + seg.length;
          const rx = new RegExp(pc.source, pc.flags);
          const m = rx.exec(seg);
          if (!m) continue;
          const code = m[0].trim();
          const before = seg
            .slice(0, m.index)
            .replace(/[\s,;.]+$/u, "")
            .trim();
          const after = seg.slice(m.index + m[0].length).trim();
          const bracket = /\(([^)]+)\)/u.exec(after);
          const town = after
            .replace(/\([^)]*\)/gu, "")
            .replace(/^[\s,;.-]+/u, "")
            .trim();
          const base = at + m.index;
          out.set("issuerPostcode", make(code, i, base, base + m[0].length, "postal code"));
          if (town)
            out.set(
              "issuerCity",
              make(town, i, base, base + seg.length - m.index, "beside the postal code"),
            );
          if (bracket && bracket[1])
            out.set(
              "issuerRegion",
              make(bracket[1].trim(), i, base, base + seg.length, "in brackets after the town"),
            );
          /* The street is what came before the code on the same segment, and
             when the code opens its own line — the ordinary two-line address
             — it is the line above. */
          let street = before;
          if (!street) {
            for (let k = i - 1; k >= 0 && k >= i - 2; k--) {
              const prev = (lines[k] ?? "").trim();
              if (prev.length > 3 && /\p{L}/u.test(prev)) {
                street = prev;
                break;
              }
            }
          }
          if (street)
            out.set(
              "issuerAddress",
              make(street, i, at, at + seg.length, "before the postal code"),
            );
          break outer;
        }
      }
    }

    const ph = profile.patterns.phone;
    const phoneWords = (profile.keywords.issuerPhone ?? []).map(fold).filter(Boolean);
    if (ph && phoneWords.length) {
      for (const i of region) {
        if (out.has("issuerPhone")) break;
        const raw = lines[i] ?? "";
        const segments = raw.split(/\s[·|—–]\s|\t{2,}/g);
        let consumed = 0;
        for (const seg of segments) {
          const at = raw.indexOf(seg, consumed);
          consumed = at + seg.length;
          if (!phoneWords.some((w) => fold(seg).includes(w))) continue;
          const rx = new RegExp(ph.source, ph.flags);
          const m = rx.exec(seg);
          if (!m) continue;
          const v = m[0].trim();
          out.set(
            "issuerPhone",
            make(v, i, at + m.index, at + m.index + m[0].length, "beside a telephone label"),
          );
          break;
        }
      }
    }

    const em = profile.patterns.email;
    if (em) {
      for (const i of region) {
        if (out.has("issuerEmail")) break;
        const raw = lines[i] ?? "";
        const rx = new RegExp(em.source, em.flags);
        const m = rx.exec(raw);
        if (m)
          out.set(
            "issuerEmail",
            make(m[0].trim(), i, m.index, m.index + m[0].length, "an address in the issuer block"),
          );
      }
    }
    return out;
  }

  /**
   * WHICH LINES ARE THE ISSUER'S, AND IN WHICH ORDER TO READ THEM.
   *
   * Above the recipient boundary first: everything there is theirs. Within
   * that, nearest the anchor first, because a letterhead keeps the tax id and
   * the address together and one page carries several postal codes — theirs, a
   * delivery address, a registry line, ours.
   *
   * Then, and ONLY where there is an anchor, the handful of lines around it
   * that fall below the boundary. Some documents name the recipient first and
   * print the issuer's own address at the foot, so "above the boundary" holds
   * no address at all and the next postal code down the page is the
   * recipient's — which is the shape that put our own street on a supplier's
   * record. Their tax id is the one thing that says which block is theirs;
   * with no tax id there is nothing to tell them apart by, and a wrong address
   * is worse than an empty one, so nothing is guessed.
   */
  private issuerLines(count: number, recipientAt: number, anchors: number[]): number[] {
    const head = Math.max(0, Math.min(count, recipientAt));
    const distance = (i: number) =>
      anchors.length ? Math.min(...anchors.map((a) => Math.abs(i - a))) : 0;
    const order = (a: number, b: number) => distance(a) - distance(b) || a - b;
    // With no anchor every line is the same distance from nothing, so this is
    // the plain top-down scan it has always been.
    const above = Array.from({ length: head }, (_unused, i) => i).sort(order);
    /* Below the boundary, only the lines around a tax id that is ITSELF down
       there. An anchor above the boundary means the whole letterhead is above
       it, so there is nothing below worth reading and the first postal code
       under the boundary is the recipient's — reaching for it is the mistake
       this is here to stop. */
    const below = new Set<number>();
    for (const a of anchors) {
      if (a < head) continue;
      for (let i = Math.max(head, a - 4); i < Math.min(count, a + 5); i++) below.add(i);
    }
    return [...above, ...[...below].sort(order)];
  }

  /**
   * The line at which the document stops talking about the issuer.
   *
   * A heading, so the marker has to START the line — «FACTURAR A» does;
   * «Indíquese el número de factura al cliente» does not, and treating the
   * word wherever it fell would cut the document at a sentence in the payment
   * terms. Returns the line count when there is no such heading, which means
   * "no boundary" and leaves every candidate in play.
   */
  private recipientBoundary(
    folded: string[],
    lines: string[],
    profile: ExtractionProfile,
    exclude: { names: Set<string>; taxIds: Set<string> },
  ): number {
    let at = folded.length;
    const markers = (profile.recipientMarkers ?? []).map(fold).filter(Boolean);
    if (markers.length) {
      for (let i = 0; i < folded.length; i++) {
        const line = folded[i]!.trim();
        if (markers.some((m) => line.startsWith(m))) {
          at = i;
          break;
        }
      }
    }
    /* OUR OWN NAME IS THE HEADING EVERY DOCUMENT CARRIES.
     *
     * The heading is optional and most small suppliers omit it: they print
     * their letterhead, then our name and address, and nothing announces the
     * change of subject. With no marker this returned the line count — "no
     * boundary" — and the whole page counted as the issuer's, so the address
     * reader took the first postal code on it, which is OURS, and wrote our
     * street into their supplier record. The operator, from the client: it
     * never reads the issuer right.
     *
     * But we know who we are: the host passes it, for the reason `read` gives.
     * The first line that carries our name or our tax id is where the document
     * stopped talking about them, whether or not a heading says so — a fact,
     * where the marker was a hope. Earliest of the two wins; a heading that
     * names us on the same line gives the same answer twice.
     */
    const ours = this.ownIdentityLine(lines, folded, exclude);
    if (ours !== null && ours < at) at = ours;
    return at;
  }

  /**
   * The first line that is about us rather than about the issuer.
   *
   * A substring match, because the name sits in a line with other things in
   * it ("Cliente: <name>", a name followed by a tax id). Short names are
   * ignored: a trade name of three characters is a syllable that lands
   * anywhere, and a wrong boundary costs more than no boundary. The tax id is
   * compared with punctuation and case removed, the way it is anywhere else
   * here, so a hyphen or a space inside it changes nothing.
   */
  private ownIdentityLine(
    lines: string[],
    folded: string[],
    exclude: { names: Set<string>; taxIds: Set<string> },
  ): number | null {
    const names = [...exclude.names].filter((n) => n.length >= 4);
    const taxIds = [...exclude.taxIds].filter((t) => t.length >= 6);
    if (!names.length && !taxIds.length) return null;
    for (let i = 0; i < lines.length; i++) {
      const f = folded[i] ?? "";
      if (names.some((n) => f.includes(n))) return i;
      if (taxIds.length) {
        const squashed = (lines[i] ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
        if (taxIds.some((t) => squashed.includes(t))) return i;
      }
    }
    return null;
  }

  /**
   * THE THIRD AMOUNT IS ARITHMETIC, NOT A GUESS.
   *
   * A photograph loses a table row: a real document came back with the net and
   * the total read cleanly and the tax missing, because the recogniser kept the
   * figure and lost the words that named it. But net + tax = total — with two
   * of the three present the third is not a guess, it is subtraction.
   *
   * Filled only when exactly one is missing and the others were actually read,
   * marked as derived rather than read, and left amber: nothing checked it,
   * and the totals check that runs immediately afterwards will contradict it
   * if the two it came from disagree with the rest of the document. A value
   * that arrives by arithmetic must never wear a green dot for it.
   */
  private deriveMissingAmount(fields: ExtractedField[]): void {
    const get = (key: FieldKey) => fields.find((f) => f.key === key);
    const net = get("netAmount");
    const tax = get("taxAmount");
    const total = get("totalAmount");
    if (!net || !tax || !total) return;
    const wh = get("withholdingAmount");
    const whValue = typeof wh?.value === "number" ? wh.value : 0;
    const num = (f: ExtractedField) => (typeof f.value === "number" ? f.value : null);
    const n = num(net);
    const t = num(tax);
    const g = num(total);

    const fill = (f: ExtractedField, value: number, from: string) => {
      f.value = round(value);
      f.confidence = 0.4;
      f.validated = false;
      f.verdict = "amber";
      f.derived = true;
      f.reasons = [`derived from ${from}, not read`];
    };
    if (n !== null && t !== null && g === null)
      fill(total, n + t - whValue, "the base and the tax");
    else if (n !== null && g !== null && t === null)
      fill(tax, g - n + whValue, "the base and the total");
    else if (t !== null && g !== null && n === null)
      fill(net, g - t + whValue, "the tax and the total");
  }

  /** Rows of a document that states several rates (spec §5.2). */
  private taxBreakdown(
    lines: string[],
    pageOf: number[],
    profile: ExtractionProfile,
  ): TaxBreakdownRow[] {
    const rows: TaxBreakdownRow[] = [];
    lines.forEach((line, i) => {
      const pct = new RegExp(profile.patterns.percent.source, "g");
      const hit = pct.exec(line);
      if (!hit) return;
      const rateBp = profile.parsePercentBp(hit[0]);
      if (rateBp === null) return;
      const amounts: Cents[] = [];
      const amt = new RegExp(profile.patterns.amount.source, "g");
      let m: RegExpExecArray | null;
      while ((m = amt.exec(line)) !== null) {
        // The percentage itself is not one of the line's amounts.
        if (m.index === hit.index) continue;
        const cents = profile.parseAmountCents(m[0]);
        if (cents !== null) amounts.push(cents);
      }
      if (!amounts.length) return;
      rows.push({
        rateBp,
        baseCents: amounts.length > 1 ? amounts[0]! : null,
        taxCents: amounts.length > 1 ? amounts[1]! : amounts[0]!,
        source: { line: i, text: line, start: 0, end: line.length, page: pageOf[i] },
      });
    });
    return rows;
  }

  private check(
    fields: ExtractedField[],
    breakdown: TaxBreakdownRow[],
    issueDate: string | undefined,
    profile: ExtractionProfile,
  ): ConsistencyCheck[] {
    const val = (key: FieldKey): number | null => {
      const f = fields.find((x) => x.key === key);
      return typeof f?.value === "number" ? f.value : null;
    };
    const net = val("netAmount");
    const tax = val("taxAmount");
    const withheld = val("withholdingAmount") ?? 0;
    const total = val("totalAmount");
    const checks: ConsistencyCheck[] = [];

    // Pure arithmetic — no rate, no law, nothing jurisdictional.
    if (net === null || tax === null || total === null) {
      checks.push({
        id: "totals",
        status: "unknown",
        detail: "Not enough amounts were read to check the arithmetic.",
        fields: ["netAmount", "taxAmount", "totalAmount"],
      });
    } else {
      const expected = net + tax - withheld;
      const off = Math.abs(expected - total);
      checks.push({
        id: "totals",
        status: off <= this.deps.config.totalsToleranceCents ? "ok" : "mismatch",
        detail:
          off <= this.deps.config.totalsToleranceCents
            ? "Net + tax − withholding equals the total."
            : `Net + tax − withholding is ${expected}, but the total reads ${total}.`,
        fields: ["netAmount", "taxAmount", "withholdingAmount", "totalAmount"],
      });
    }

    // Plausible rate: the RATES come from the profile, the comparison does not.
    if (net !== null && tax !== null && net > 0 && issueDate) {
      const rateBp = Math.round((tax / net) * 10000);
      const allowed = profile.expectedTaxRatesBp(issueDate);
      const near = allowed.find((r) => Math.abs(r - rateBp) <= 25);
      checks.push({
        id: "taxRate",
        status: near !== undefined ? "ok" : "mismatch",
        detail:
          near !== undefined
            ? `The tax is ${fmtBp(near)} of the net amount.`
            : `The tax works out at ${fmtBp(rateBp)} of the net amount, which is not a rate in force on ${issueDate}.`,
        fields: ["netAmount", "taxAmount"],
      });
    }

    if (breakdown.length > 1 && tax !== null) {
      const summed = breakdown.reduce((s, r) => s + (r.taxCents ?? 0), 0);
      const off = Math.abs(summed - tax);
      checks.push({
        id: "breakdown",
        status: off <= this.deps.config.totalsToleranceCents ? "ok" : "mismatch",
        detail:
          off <= this.deps.config.totalsToleranceCents
            ? `The ${breakdown.length} rate rows add up to the tax total.`
            : `The ${breakdown.length} rate rows add up to ${summed}, but the tax total reads ${tax}.`,
        fields: ["taxAmount"],
      });
    }

    return checks;
  }

  private toField(key: FieldKey, candidates: Candidate[]): ExtractedField {
    /**
     * An amount has no shape of its own: every number on the page looks like
     * every other one, and only a word beside it says which is the net, which
     * the tax and which the total. So an unlabelled amount may be OFFERED as
     * an alternative — one tap for the user — but it may never be the answer.
     *
     * This is not fastidiousness. Nominating the first number on the page as
     * the withholding on a document that has none produces an amount that
     * contradicts the arithmetic, and a contradiction poisons every other
     * field's confidence with it.
     */
    const answerable = isAmountField(key) ? candidates.filter((c) => c.labelled) : candidates;
    const top = answerable[0];
    if (!top) {
      const unlabelled = candidates.slice(0, this.deps.config.maxAlternatives);
      if (unlabelled.length) {
        return {
          key,
          value: null,
          raw: null,
          confidence: 0,
          source: null,
          alternatives: unlabelled,
          reasons: ["found amounts, but none of them was labelled as this field"],
          validated: false,
          verdict: "amber",
        };
      }
    }
    if (!top) {
      return {
        key,
        value: null,
        raw: null,
        confidence: 0,
        source: null,
        alternatives: [],
        reasons: ["not found"],
        validated: false,
        verdict: "amber",
      };
    }
    // Two candidates that agree are worth more than either alone.
    const agreeing = answerable.filter((c) => c.value === top.value).length;
    const confidence = round(Math.min(1, top.confidence + (agreeing > 1 ? 0.05 : 0)));
    const alternatives = candidates
      .filter((c) => c !== top)
      .filter((c) => c.value !== top.value)
      .slice(0, this.deps.config.maxAlternatives);
    return {
      key,
      value: top.value,
      raw: top.raw,
      confidence,
      source: top.source,
      alternatives,
      reasons: agreeing > 1 ? [...top.reasons, `read ${agreeing} times`] : top.reasons,
      validated: top.validated,
      verdict: "amber", // finalised by applyVerdicts, once the checks are known
    };
  }

  /**
   * Colour the dots, after the consistency checks — which is the only moment
   * the answer is knowable, because an amount is validated by its arithmetic
   * rather than by anything about the amount itself.
   *
   * Mutates in place, deliberately: it runs on freshly built field objects
   * inside `extract` and `recheck`, and copying them again to set two
   * properties would only make the ordering harder to follow.
   */
  private applyVerdicts(fields: ExtractedField[], checks: ConsistencyCheck[]): void {
    const totals = checks.find((c) => c.id === "totals");
    const contradicted = new Set<FieldKey>();
    for (const c of checks)
      if (c.status === "mismatch") for (const k of c.fields) contradicted.add(k);

    for (const f of fields) {
      // Nothing read is nothing to be confident about; a contradiction is a
      // reason to look, whatever vouched for the value in isolation.
      if (f.value === null || contradicted.has(f.key)) {
        f.verdict = "amber";
        continue;
      }
      // An amount has no check digit. What vouches for it is the arithmetic it
      // takes part in — and if that arithmetic could not be done at all, the
      // amount has not been checked by anything.
      if (isAmountField(f.key)) {
        /* A DERIVED AMOUNT CANNOT BE VOUCHED FOR BY THE SUM IT WAS DERIVED
           FROM. Tax computed as total − base satisfies the totals check
           every time; going green on that says subtraction works, not that
           the figure is what the document says. It stays amber, and stays on
           the list of things a person looks at. */
        const ok = totals?.status === "ok" && !f.derived;
        f.validated = ok;
        f.verdict = ok ? "green" : "amber";
        continue;
      }
      f.verdict = f.validated ? "green" : "amber";
    }
  }
}

/** A real day in a real month, not merely something shaped like a date. */
function isRealDate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = new Date(iso + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}

/** Amount fields carry cents; everything else carries text. */
export function isAmountField(key: FieldKey): boolean {
  return AMOUNT_FIELDS.includes(key);
}

function best(candidates: Candidate[] | undefined): Candidate | undefined {
  return candidates?.[0];
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function fmtBp(bp: number): string {
  return `${(bp / 100).toFixed(2).replace(/\.00$/, "")} per cent`;
}
