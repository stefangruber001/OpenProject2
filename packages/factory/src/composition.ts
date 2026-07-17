import {
  InMemoryAppendOnlyStore,
  InMemoryCounterStore,
  InMemoryEventLog,
  InMemoryKeyValueStore,
  InMemoryRepository,
  RandomIdGen,
  SystemClock,
  type AppendOnlyStore,
  type ClockPort,
  type CounterStore,
  type EventLogPort,
  type IdGenPort,
  type KeyValueStore,
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
import { ProjectsService, type ProjectsConfig } from "@repo/capability-projects";
import { ReceivablesService, type ReceivablesConfig } from "@repo/capability-receivables";
import { PayablesService, type PayablesConfig } from "@repo/capability-payables";
import { CrmService, type CrmConfig } from "@repo/capability-crm";
import { ProcurementService, type ProcurementConfig } from "@repo/capability-procurement";
import { SchedulingService, type SchedulingConfig } from "@repo/capability-scheduling";
import { TimeService, type TimeConfig } from "@repo/capability-time";
import { DocsService, type DocsConfig } from "@repo/capability-docs";
import { VisitsService, type VisitsConfig } from "@repo/capability-visits";
import { AccessService, type AccessConfig } from "@repo/capability-access";
import { CatalogueService, type CatalogueConfig } from "@repo/capability-catalogue";
import { SuppliersService, type SuppliersConfig } from "@repo/capability-suppliers";

export interface FactoryInfra {
  clock?: ClockPort;
  idGen?: IdGenPort;
  events?: EventLogPort;
  quoteStore?: Repository<Quote>;
  invoiceStore?: AppendOnlyStore<Invoice>;
  comparisonStore?: Repository<Comparison>;
  counters?: CounterStore;
  /** Durable store for the value-typed capability aggregates (crm book, etc). */
  aggregates?: KeyValueStore;
}

export interface FactoryServices {
  resolved: ResolvedTenant;
  events: EventLogPort;
  labels: DocLabels;
  /** Persists the value-typed capability aggregates by key (durable / in-mem). */
  aggregates: KeyValueStore;
  quoting?: QuotingService;
  billing?: BillingService;
  sourcing?: SourcingService;
  projects?: ProjectsService;
  receivables?: ReceivablesService;
  payables?: PayablesService;
  crm?: CrmService;
  procurement?: ProcurementService;
  scheduling?: SchedulingService;
  time?: TimeService;
  docs?: DocsService;
  visits?: VisitsService;
  access?: AccessService;
  catalogue?: CatalogueService;
  suppliers?: SuppliersService;
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

  const services: FactoryServices = {
    resolved,
    events,
    labels,
    aggregates: infra.aggregates ?? new InMemoryKeyValueStore(),
  };
  const common = {
    tenantId: resolved.spec.tenant,
    currency: resolved.kernelConfig.currency,
    clock,
    idGen,
    events,
  };
  const cfg = resolved.config as Record<string, unknown>;
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
  // Value-typed capability engines: constructed here, their state persisted via
  // `services.aggregates` (durable KV) by the host. No store needed to build.
  if (has("projects")) {
    services.projects = new ProjectsService({
      clock,
      idGen,
      config: cfg.projects as ProjectsConfig,
    });
  }
  if (has("receivables")) {
    services.receivables = new ReceivablesService({
      clock,
      idGen,
      config: cfg.receivables as ReceivablesConfig,
    });
  }
  if (has("payables")) {
    services.payables = new PayablesService({
      clock,
      idGen,
      config: cfg.payables as PayablesConfig,
    });
  }
  if (has("crm")) {
    services.crm = new CrmService({ clock, idGen, config: cfg.crm as CrmConfig });
  }
  if (has("procurement")) {
    services.procurement = new ProcurementService({
      clock,
      idGen,
      config: cfg.procurement as ProcurementConfig,
    });
  }
  if (has("scheduling")) {
    services.scheduling = new SchedulingService({
      clock,
      idGen,
      config: cfg.scheduling as SchedulingConfig,
    });
  }
  if (has("time")) {
    services.time = new TimeService({ clock, idGen, config: cfg.time as TimeConfig });
  }
  if (has("docs")) {
    services.docs = new DocsService({ clock, idGen, config: cfg.docs as DocsConfig });
  }
  if (has("visits")) {
    services.visits = new VisitsService({ clock, idGen, config: cfg.visits as VisitsConfig });
  }
  if (has("access")) {
    services.access = new AccessService({ idGen, config: cfg.access as AccessConfig });
  }
  if (has("catalogue")) {
    services.catalogue = new CatalogueService(cfg.catalogue as CatalogueConfig);
  }
  if (has("suppliers")) {
    services.suppliers = new SuppliersService({
      clock,
      idGen,
      config: cfg.suppliers as SuppliersConfig,
    });
  }
  return services;
}
