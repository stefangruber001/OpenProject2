import { resolveAt } from "@repo/kernel";
import type {
  TaxDeterminationInput,
  TaxJustification,
  TaxLineDecision,
  TaxPort,
} from "@repo/capability-billing";
import {
  IVA_GENERAL_BP,
  IVA_REDUCIDO_BP,
  RENOVATION_MATERIALS_MAX_SHARE_BP,
  RENOVATION_MIN_DWELLING_AGE_YEARS,
} from "./rates";

export const PACK_ID = "jurisdiction/es-ES";
export const PACK_VERSION = "1.0.0";

/**
 * Shared vocabulary with construction verticals (ADR-0011): the hint and the
 * `construction.*` attribute keys are a data contract — neither package
 * imports the other.
 */
export const HINT_WORKS_ON_DWELLING = "construction.works-on-dwelling";

const ATTR = {
  recipient: "construction.recipient",
  privateUse: "construction.dwellingPrivateUse",
  ageYears: "construction.dwellingCompletedYearsAgo",
  materialsShareBp: "construction.materialsShareBp",
} as const;

/**
 * es-ES tax adapter. Decides the VAT treatment per line at the invoice's
 * issue date and returns a persistable justification (mandate §6.3).
 * All renovation decisions carry legallyVerified:false until a human asesor
 * clears the implementation (LEGAL_REVIEW.md #2).
 */
export class EsTaxAdapter implements TaxPort {
  determine(input: TaxDeterminationInput): { perLine: TaxLineDecision[] } {
    return {
      perLine: input.lines.map((line) => {
        if (line.categoryHint === HINT_WORKS_ON_DWELLING) {
          return this.decideDwellingWorks(line.lineId, input);
        }
        return this.generalRate(line.lineId, input.issueDate, "línea sin categoría especial");
      }),
    };
  }

  private generalRate(lineId: string, issueDate: string, why: string): TaxLineDecision {
    const { value: rateBp, period } = resolveAt(IVA_GENERAL_BP, issueDate, "IVA general");
    return {
      lineId,
      taxCode: "ES-IVA-GENERAL",
      rateBp,
      justification: justify({
        ruleId: "es.iva.general",
        legalBasis: "Ley 37/1992 (LIVA), art. 90.Uno",
        effectiveDate: period.validFrom,
        issueDate,
        explanation: `Tipo general aplicado: ${why}.`,
        inputs: {},
      }),
    };
  }

  /**
   * Art. 91.Uno.2.10º LIVA — reduced rate for renovation/repair works on
   * dwellings. ALL conditions must hold; any failure or missing datum falls
   * back to the general rate (conservative by construction).
   */
  private decideDwellingWorks(lineId: string, input: TaxDeterminationInput): TaxLineDecision {
    const { issueDate, attributes } = input;
    const recipient = attributes[ATTR.recipient];
    const privateUse = attributes[ATTR.privateUse];
    const ageYears = attributes[ATTR.ageYears];
    const materialsShareBp = attributes[ATTR.materialsShareBp];

    const failures: string[] = [];
    if (
      recipient === undefined ||
      privateUse === undefined ||
      ageYears === undefined ||
      materialsShareBp === undefined
    ) {
      failures.push("faltan datos de elegibilidad (destinatario, uso, antigüedad o % materiales)");
    } else {
      const recipientOk =
        recipient === "community-of-owners" ||
        (recipient === "individual-private" && privateUse === true);
      if (!recipientOk) {
        failures.push(
          "el destinatario no es persona física para uso particular ni comunidad de propietarios",
        );
      }
      if (Number(ageYears) < RENOVATION_MIN_DWELLING_AGE_YEARS) {
        failures.push(
          `la vivienda no supera los ${RENOVATION_MIN_DWELLING_AGE_YEARS} años desde construcción/última rehabilitación`,
        );
      }
      const maxShare = resolveAt(
        RENOVATION_MATERIALS_MAX_SHARE_BP,
        issueDate,
        "límite de materiales art. 91.Uno.2.10º",
      );
      if (Number(materialsShareBp) > maxShare.value) {
        failures.push(
          `los materiales aportados (${Number(materialsShareBp) / 100} %) superan el ${maxShare.value / 100} % de la base`,
        );
      }
    }

    const inputs = {
      [ATTR.recipient]: recipient ?? null,
      [ATTR.privateUse]: privateUse ?? null,
      [ATTR.ageYears]: ageYears ?? null,
      [ATTR.materialsShareBp]: materialsShareBp ?? null,
    };

    if (failures.length > 0) {
      const general = resolveAt(IVA_GENERAL_BP, issueDate, "IVA general");
      return {
        lineId,
        taxCode: "ES-IVA-GENERAL",
        rateBp: general.value,
        justification: justify({
          ruleId: "es.iva.general.renovation-ineligible",
          legalBasis: "Ley 37/1992 (LIVA), art. 90.Uno; art. 91.Uno.2.10º no aplicable",
          effectiveDate: general.period.validFrom,
          issueDate,
          explanation: `Tipo general: obra en vivienda NO elegible para tipo reducido — ${failures.join("; ")}.`,
          inputs,
        }),
      };
    }

    const reduced = resolveAt(IVA_REDUCIDO_BP, issueDate, "IVA reducido");
    return {
      lineId,
      taxCode: "ES-IVA-REDUCIDO",
      rateBp: reduced.value,
      justification: justify({
        ruleId: "es.iva.reducido.renovation",
        legalBasis: "Ley 37/1992 (LIVA), art. 91.Uno.2.10º",
        effectiveDate: reduced.period.validFrom,
        issueDate,
        explanation:
          "Tipo reducido: obra de renovación/reparación en vivienda de uso particular, " +
          "antigüedad ≥ 2 años y materiales aportados dentro del límite legal.",
        inputs,
      }),
    };
  }
}

function justify(args: {
  ruleId: string;
  legalBasis: string;
  effectiveDate: string;
  issueDate: string;
  explanation: string;
  inputs: Record<string, unknown>;
}): TaxJustification {
  return {
    ruleId: args.ruleId,
    legalBasis: args.legalBasis,
    effectiveDate: args.effectiveDate,
    providerId: PACK_ID,
    providerVersion: PACK_VERSION,
    legallyVerified: false, // human gate pending — LEGAL_REVIEW.md
    explanation: `${args.explanation} (fecha de devengo: ${args.issueDate})`,
    inputs: args.inputs,
  };
}
