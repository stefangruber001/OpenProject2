import {
  InMemoryAppendOnlyStore,
  InMemoryCounterStore,
  InMemoryEventLog,
  InMemoryRepository,
  RandomIdGen,
  SystemClock,
  type AppendOnlyStore,
  type ClockPort,
  type CounterStore,
  type EventLogPort,
  type IdGenPort,
  type Repository,
  type ResolvedTenant,
} from "@repo/kernel";
import { QuotingService, type Quote } from "@repo/capability-quoting";
import { SourcingService, type Comparison } from "@repo/capability-sourcing";
import {
  BillingService,
  DEFAULT_LABELS,
  DOC_LABELS_PORT,
  type BillingConfig,
  type DocLabels,
  type Invoice,
} from "@repo/capability-billing";

export interface FactoryInfra {
  clock?: ClockPort;
  idGen?: IdGenPort;
  events?: EventLogPort;
  quoteStore?: Repository<Quote>;
  invoiceStore?: AppendOnlyStore<Invoice>;
  comparisonStore?: Repository<Comparison>;
  counters?: CounterStore;
}

export interface FactoryServices {
  resolved: ResolvedTenant;
  events: EventLogPort;
  labels: DocLabels;
  quoting?: QuotingService;
  billing?: BillingService;
  sourcing?: SourcingService;
}

/**
 * Assemble runtime services for a resolved tenant. This is the host layer:
 * the only place capabilities, packs, kernel and INFRASTRUCTURE meet.
 * Defaults are in-memory; durable adapters (Prisma+RLS, ADR-0007) drop in
 * through the same store contracts without touching capabilities.
 */
export function buildServices(resolved: ResolvedTenant, infra: FactoryInfra = {}): FactoryServices {
  const clock = infra.clock ?? new SystemClock();
  const idGen = infra.idGen ?? new RandomIdGen();
  const events = infra.events ?? new InMemoryEventLog();
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
    services.quoting = new QuotingService({
      ...common,
      store: infra.quoteStore ?? new InMemoryRepository<Quote>(),
    });
  }
  if (has("billing")) {
    services.billing = new BillingService({
      ...common,
      config: resolved.config.billing as BillingConfig,
      ports: resolved.ports,
      store: infra.invoiceStore ?? new InMemoryAppendOnlyStore<Invoice>(),
      counters: infra.counters ?? new InMemoryCounterStore(),
    });
  }
  if (has("sourcing")) {
    services.sourcing = new SourcingService({
      tenantId: resolved.spec.tenant,
      store: infra.comparisonStore ?? new InMemoryRepository<Comparison>(),
      clock: common.clock,
      idGen: common.idGen,
      events,
    });
  }
  return services;
}
