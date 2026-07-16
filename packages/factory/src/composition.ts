import {
  InMemoryEventLog,
  RandomIdGen,
  SystemClock,
  type ClockPort,
  type EventLogPort,
  type IdGenPort,
  type ResolvedTenant,
} from "@repo/kernel";
import { QuotingService } from "@repo/capability-quoting";
import {
  BillingService,
  DEFAULT_LABELS,
  DOC_LABELS_PORT,
  type BillingConfig,
  type DocLabels,
} from "@repo/capability-billing";

export interface FactoryServices {
  resolved: ResolvedTenant;
  events: EventLogPort;
  labels: DocLabels;
  quoting?: QuotingService;
  billing?: BillingService;
}

/**
 * Assemble runtime services for a resolved tenant. This is the host layer:
 * the only place capabilities, packs and kernel meet concretely.
 */
export function buildServices(
  resolved: ResolvedTenant,
  opts?: { clock?: ClockPort; idGen?: IdGenPort },
): FactoryServices {
  const clock = opts?.clock ?? new SystemClock();
  const idGen = opts?.idGen ?? new RandomIdGen();
  const events = new InMemoryEventLog();
  const has = (id: string) => resolved.spec.capabilities.includes(id);
  const labels = resolved.ports.tryGet<DocLabels>(DOC_LABELS_PORT) ?? DEFAULT_LABELS;

  const services: FactoryServices = { resolved, events, labels };
  const common = {
    tenantId: resolved.spec.tenant,
    currency: resolved.kernelConfig.currency,
    clock,
    idGen,
    events,
  };
  if (has("quoting")) {
    services.quoting = new QuotingService(common);
  }
  if (has("billing")) {
    services.billing = new BillingService({
      ...common,
      config: resolved.config.billing as BillingConfig,
      ports: resolved.ports,
    });
  }
  return services;
}
