import { resolveAt, type EffectivePeriod } from "@repo/kernel";

/**
 * IRPF retention on supplier (autónomo) invoices — profile-dependent
 * (LEGAL_REVIEW.md #3). Most construction subcontractors are "business"
 * (actividad empresarial) ⇒ NO retention; professionals carry 15 % (7 % the
 * first years); certain módulos activities 1 %.
 */
export type SupplierProfile = "business" | "professional" | "professional_new" | "modulos_1";

const TABLES: Record<SupplierProfile, EffectivePeriod<number>[]> = {
  business: [{ validFrom: "2015-07-12", value: 0 }],
  professional: [{ validFrom: "2015-07-12", value: 1500 }],
  professional_new: [{ validFrom: "2015-07-12", value: 700 }],
  modulos_1: [{ validFrom: "2015-07-12", value: 100 }],
};

const BASIS: Record<SupplierProfile, string> = {
  business: "Sin retención: actividad empresarial (no profesional) — art. 75 RIRPF a contrario",
  professional: "Art. 101.5 LIRPF — actividades profesionales, tipo general",
  professional_new: "Art. 101.5 LIRPF y art. 95.1 RIRPF — inicio de actividad (período reducido)",
  modulos_1: "Art. 101.5.d) LIRPF — actividades en estimación objetiva sujetas al 1 %",
};

export interface RetentionDecision {
  profile: SupplierProfile;
  rateBp: number;
  legalBasis: string;
  effectiveDate: string;
  legallyVerified: false;
}

export function retentionFor(profile: SupplierProfile, date: string): RetentionDecision {
  const { value, period } = resolveAt(TABLES[profile], date, `retención IRPF (${profile})`);
  return {
    profile,
    rateBp: value,
    legalBasis: BASIS[profile],
    effectiveDate: period.validFrom,
    legallyVerified: false,
  };
}
