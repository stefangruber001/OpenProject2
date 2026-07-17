import { FactoryError, type KeyValueStore } from "@repo/kernel";
import type { FactoryServices } from "@repo/factory";

const REQUIRED = [
  "crm",
  "projects",
  "receivables",
  "payables",
  "procurement",
  "scheduling",
  "access",
] as const;

/** Load a persisted aggregate, seeding + saving it on first access. */
async function loadOrSeed<T>(kv: KeyValueStore, key: string, seed: () => T): Promise<T> {
  const existing = await kv.get(key);
  if (existing !== undefined) return existing as T;
  const value = seed();
  await kv.set(key, value);
  return value;
}

/**
 * The control-tower overview, computed by the REAL capability services over
 * durably-persisted aggregates (Prisma+RLS when DATABASE_URL, in-memory
 * otherwise). First call seeds a synthetic dataset through the services; later
 * calls read it back — proving the engines run on durable storage.
 */
export async function controlTower(rt: FactoryServices) {
  const missing = REQUIRED.filter((c) => rt[c] == null);
  if (missing.length > 0) {
    throw new FactoryError(
      "NOT_FOUND",
      `Tenant "${rt.resolved.spec.tenant}" does not select the capabilities needed for the control tower: ${missing.join(", ")}.`,
    );
  }
  const kv = rt.aggregates;

  const crmBook = await loadOrSeed(kv, "crm", () => {
    let b = rt.crm!.empty();
    b = rt.crm!.addCustomer(b, { name: "Laura Puig", email: "laura.puig@example.com" });
    const cust = b.customers[0]!.id;
    b = rt.crm!.addLead(b, {
      title: "Bathroom + aerothermal — Esplugues",
      customerRef: cust,
      valueCents: 352_000,
      owner: "operations",
      nextAction: "Book site visit",
      nextActionDate: "2026-07-10",
    });
    b = rt.crm!.addLead(b, {
      title: "Kitchen reform — Sant Just",
      valueCents: 1_025_000,
      owner: "administration",
    });
    b = rt.crm!.moveLead(b, b.leads[1]!.id, "quoted");
    return b;
  });

  const projects = await loadOrSeed(kv, "projects", () => {
    let p = rt.projects!.fromAcceptedQuote({
      name: "Full bathroom — C/ Balmes 24",
      sourceQuoteId: "quote-seed",
      baselineByChapter: [
        { chapter: "Demolition & preliminary works", budgetCents: 23_000 },
        { chapter: "Coverings & finishes", budgetCents: 79_200 },
        { chapter: "Plumbing", budgetCents: 185_000 },
      ],
    });
    p = rt.projects!.bookCost(p, {
      kind: "committed",
      chapter: "Plumbing",
      description: "PO plumbing",
      amountCents: 150_000,
    });
    p = rt.projects!.bookCost(p, {
      kind: "actual",
      chapter: "Plumbing",
      description: "bill plumbing",
      amountCents: 148_000,
    });
    p = rt.projects!.bookCost(p, {
      kind: "actual",
      chapter: "Coverings & finishes",
      description: "bill tiling",
      amountCents: 58_000,
    });
    p = rt.projects!.recordRevenue(p, 287_200);
    return [p];
  });

  const ar = await loadOrSeed(kv, "ar", () => {
    let l = rt.receivables!.empty();
    l = rt.receivables!.registerInvoice(l, {
      ref: "FAC-2026-0007",
      customerRef: "Laura Puig",
      totalCents: 368_720,
      issueDate: "2026-07-01",
      dueDate: "2026-07-16",
    });
    const inv = l.invoices[0]!.id;
    l = rt.receivables!.recordReceipt(l, {
      amountCents: 200_000,
      allocations: [{ invoiceId: inv, amountCents: 200_000 }],
    });
    return l;
  });

  const ap = await loadOrSeed(kv, "ap", () => {
    let l = rt.payables!.empty();
    l = rt.payables!.registerBill(l, {
      supplierRef: "S-Plumb",
      number: "P-337",
      totalCents: 148_000,
      issueDate: "2026-07-05",
      dueDate: "2026-07-26",
    });
    l = rt.payables!.registerBill(l, {
      supplierRef: "S-Tiles",
      number: "A-1042",
      totalCents: 58_000,
      issueDate: "2026-07-06",
      dueDate: "2026-07-21",
    });
    l = rt.payables!.recordPayment(l, { billId: l.bills[1]!.id, amountCents: 58_000 });
    return l;
  });

  const plan = await loadOrSeed(kv, "plan", () => {
    let pl = rt.scheduling!.empty();
    pl = rt.scheduling!.addTask(pl, {
      title: "Demolition",
      plannedStart: "2026-07-02",
      plannedEnd: "2026-07-05",
      assignee: "operations",
    });
    pl = rt.scheduling!.setStatus(pl, pl.tasks[0]!.id, "done");
    pl = rt.scheduling!.addTask(pl, {
      title: "Tiling",
      plannedStart: "2026-07-08",
      plannedEnd: "2026-07-12",
      assignee: "operations",
    });
    pl = rt.scheduling!.addTask(pl, {
      title: "Final inspection",
      plannedStart: "2026-07-14",
      plannedEnd: "2026-07-15",
      assignee: "administration",
      milestone: true,
    });
    return pl;
  });

  const poBook = await loadOrSeed(kv, "po", () => {
    let b = rt.procurement!.empty();
    b = rt.procurement!.raise(b, {
      supplierRef: "S-Plumb",
      projectRef: projects[0]!.id,
      lines: [{ chapter: "Plumbing", description: "bathroom plumbing kit", amountCents: 150_000 }],
    });
    b = rt.procurement!.transition(b, b.orders[0]!.id, "sent");
    return b;
  });

  const access = await loadOrSeed(kv, "access", () => {
    let dir = rt.access!.seed();
    dir = rt.access!.assign(dir, "wife", "administration");
    dir = rt.access!.assign(dir, "husband", "operations");
    return dir;
  });

  // Compute with the real services.
  const financials = projects.map((p) => {
    const f = rt.projects!.financials(p);
    return { id: p.id, name: p.name, ...f };
  });

  return {
    runtime: rt.resolved.spec.tenant,
    durable: Boolean(process.env.DATABASE_URL),
    capabilities: rt.resolved.spec.capabilities.length,
    pipeline: rt.crm!.pipeline(crmBook),
    projects: financials,
    receivablesOutstandingCents: rt.receivables!.totalOutstanding(ar),
    payablesOutstandingCents: rt.payables!.totalOutstanding(ap),
    committedCents: rt.procurement!.committed(poBook, projects[0]!.id),
    overdueTasks: rt
      .scheduling!.overdue(plan)
      .map((t) => ({ title: t.title, plannedEnd: t.plannedEnd })),
    taskSummary: rt.scheduling!.summary(plan),
    access: {
      wifeCanIssueInvoice: rt.access!.can(access, "wife", "invoice.issue"),
      husbandCanIssueInvoice: rt.access!.can(access, "husband", "invoice.issue"),
      husbandCanRecordVisit: rt.access!.can(access, "husband", "visit.record"),
    },
  };
}
