import type { CapabilityManifest, PackManifest, Registries } from "@repo/kernel";
import { quotingManifest } from "@repo/capability-quoting";
import { billingManifest } from "@repo/capability-billing";
import { sourcingManifest } from "@repo/capability-sourcing";
import { messagingManifest } from "@repo/capability-messaging";
import { projectsManifest } from "@repo/capability-projects";
import { receivablesManifest } from "@repo/capability-receivables";
import { payablesManifest } from "@repo/capability-payables";
import { crmManifest } from "@repo/capability-crm";
import { procurementManifest } from "@repo/capability-procurement";
import { schedulingManifest } from "@repo/capability-scheduling";
import { timeManifest } from "@repo/capability-time";
import { docsManifest } from "@repo/capability-docs";
import { visitsManifest } from "@repo/capability-visits";
import { accessManifest } from "@repo/capability-access";
import { catalogueManifest } from "@repo/capability-catalogue";
import { suppliersManifest } from "@repo/capability-suppliers";
import { extractionManifest } from "@repo/capability-extraction";
import { esPack } from "@repo/pack-jurisdiction-es-es";
import { reformasPack } from "@repo/pack-vertical-construction-reformas";

export const capabilityRegistry: ReadonlyMap<string, CapabilityManifest> = new Map(
  [
    quotingManifest,
    billingManifest,
    sourcingManifest,
    messagingManifest,
    projectsManifest,
    receivablesManifest,
    payablesManifest,
    crmManifest,
    procurementManifest,
    schedulingManifest,
    timeManifest,
    docsManifest,
    visitsManifest,
    accessManifest,
    catalogueManifest,
    suppliersManifest,
    extractionManifest,
  ].map((c) => [c.id, c] as const),
);

export const packRegistry: readonly PackManifest[] = [esPack, reformasPack];

export const registries: Registries = {
  capabilities: capabilityRegistry,
  packs: packRegistry,
};
