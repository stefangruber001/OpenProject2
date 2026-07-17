import { z } from "zod";
import type { Cents } from "@repo/kernel";

/**
 * CRM is generic: a customer register plus leads moving through a configurable
 * pipeline, each carrying a next action. No sector or jurisdiction knowledge.
 */
export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  /** External reference (e.g. tax id) — opaque to this capability. */
  ref?: string;
  createdAt: string;
}

export type LeadStatus = "open" | "won" | "lost";

export interface Lead {
  id: string;
  customerRef?: string;
  title: string;
  stage: string;
  valueCents?: Cents;
  status: LeadStatus;
  nextAction?: string;
  nextActionDate?: string;
  /** Owner group, e.g. an operations vs administration split (opaque). */
  owner?: string;
  createdAt: string;
}

export interface Book {
  customers: Customer[];
  leads: Lead[];
}

export const crmConfigSchema = z
  .object({
    /** Ordered pipeline stages; the first is the default entry stage. */
    pipeline: z.array(z.string()).nonempty().default(["new", "qualified", "quoted", "won"]),
  })
  .default({});
export type CrmConfig = z.infer<typeof crmConfigSchema>;

export interface StageSummary {
  stage: string;
  count: number;
  valueCents: Cents;
}
