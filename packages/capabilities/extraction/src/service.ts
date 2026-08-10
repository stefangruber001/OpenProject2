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
}

/** Which token kinds each field is built from. */
const FIELD_TOKEN: Record<FieldKey, "amount" | "date" | "taxId" | "account" | "text"> = {
  issuerName: "text",
  issuerTaxId: "taxId",
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

    const perField = new Map<FieldKey, Candidate[]>();
    for (const key of FIELD_KEYS) {
      perField.set(key, this.candidatesFor(key, lines, folded, pageOf, profile));
    }

    // The issue date, once found, decides which rates were law — so it is
    // resolved before the checks that depend on it.
    const issueDate =
      (best(perField.get("issueDate"))?.value as string | undefined) ?? input.assumeIssueDate;

    const taxBreakdown = this.taxBreakdown(lines, pageOf, profile);
    const fields = FIELD_KEYS.map((key) => this.toField(key, perField.get(key) ?? []));
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
  ): Candidate[] {
    const kind = FIELD_TOKEN[key];
    const keywords = (profile.keywords[key] ?? []).map(fold);
    const out: Candidate[] = [];

    lines.forEach((line, i) => {
      const spans = this.tokens(kind, line, i, pageOf[i], profile, key);
      for (const { span, value } of spans) {
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
        const after = line.slice(at + k.length).replace(/^[\s:.#-]+/, "");
        if (!after) continue;
        const start = line.length - after.length;
        return [
          {
            span: { line: lineIndex, text: after, start, end: line.length, page },
            value: after,
          },
        ];
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
        const ok = totals?.status === "ok";
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
