import { z } from "zod";

/**
 * Site visits are generic: a captured visit with notes, room measurements (in
 * whole millimetres, integer-safe) and photo references, linked to a customer
 * or lead. Area is derived; nothing sector-specific lives here.
 */
export interface RoomMeasurement {
  room: string;
  lengthMm: number;
  widthMm: number;
  heightMm?: number;
}

export interface Visit {
  id: string;
  customerRef?: string;
  leadRef?: string;
  date: string;
  notes: string;
  measurements: RoomMeasurement[];
  photoRefs: string[];
  capturedAt: string;
}

export interface Log {
  visits: Visit[];
}

export const visitsConfigSchema = z.object({}).default({});
export type VisitsConfig = z.infer<typeof visitsConfigSchema>;
