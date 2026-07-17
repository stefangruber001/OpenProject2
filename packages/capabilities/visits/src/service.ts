import { FactoryError, roundDivHalfUp, type ClockPort, type IdGenPort } from "@repo/kernel";
import type { Log, RoomMeasurement, Visit, VisitsConfig } from "./model";

export interface VisitsDeps {
  clock: ClockPort;
  idGen: IdGenPort;
  config: VisitsConfig;
}

/**
 * Site-visit engine. Capture a visit (phone-first: notes, room measurements,
 * photo refs) and derive area. Measurements are whole millimetres, so area is
 * computed in integer mm² and reported in cm² (÷100) to stay integer-safe.
 */
export class VisitsService {
  constructor(private readonly deps: VisitsDeps) {}

  empty(): Log {
    return { visits: [] };
  }

  record(
    log: Log,
    input: {
      customerRef?: string;
      leadRef?: string;
      notes?: string;
      measurements?: RoomMeasurement[];
      photoRefs?: string[];
      date?: string;
    },
  ): Log {
    if (!input.customerRef && !input.leadRef) {
      throw new FactoryError("INVALID_STATE", "A visit must link to a customer or a lead.");
    }
    const visit: Visit = {
      id: this.deps.idGen.next("visit"),
      customerRef: input.customerRef,
      leadRef: input.leadRef,
      date: input.date ?? this.deps.clock.todayIso(),
      notes: input.notes ?? "",
      measurements: input.measurements ?? [],
      photoRefs: input.photoRefs ?? [],
      capturedAt: this.deps.clock.nowIso(),
    };
    return { ...log, visits: [...log.visits, visit] };
  }

  /** Floor area of a visit in cm² (integer): Σ length×width per room, ÷100. */
  areaCm2(visit: Visit): number {
    return visit.measurements.reduce(
      (sum, m) => sum + roundDivHalfUp(m.lengthMm * m.widthMm, 100),
      0,
    );
  }

  /** Convenience: area in whole m² (rounded), from the integer cm². */
  areaM2(visit: Visit): number {
    return roundDivHalfUp(this.areaCm2(visit), 10_000);
  }

  forCustomer(log: Log, customerRef: string): Visit[] {
    return log.visits.filter((v) => v.customerRef === customerRef);
  }

  forLead(log: Log, leadRef: string): Visit[] {
    return log.visits.filter((v) => v.leadRef === leadRef);
  }
}
