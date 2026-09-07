/**
 * What a request may see and touch of the hours register.
 *
 * A site-worker account is not an administrator with fewer buttons: it is a
 * person, and the only hours it may read or write are that person's own. Two
 * questions have to be answered on the server for that to mean anything —
 * WHICH person an account is, and WHAT is left of the ERP once everything that
 * is not theirs is taken out.
 *
 * Both live here rather than in a route, because the same answers are needed by
 * the read (`GET /erp/state`) and by every write (`runCommand`), and a rule
 * that only one of the two doors carries is not a rule.
 *
 * Nothing here loads anything. It takes a document and answers questions about
 * it, so `erp-runtime` can import it without the two calling each other in a
 * circle — and so both questions can be tested without a database.
 */
/** Loosely-typed views of the parts of the ERP document this file reads. */
interface WorkerLike {
  id?: string;
  email?: string;
  name?: string;
}
interface LabourLike {
  id?: string;
  workerId?: string;
  projectId?: string;
  date?: string;
  locked?: boolean;
}
interface AssignmentLike {
  workerId?: string;
  projectId?: string;
  from?: string;
  to?: string;
}
interface BudgetLineLike {
  id?: string;
  num?: string;
  code?: string;
  desc?: string;
}
interface BudgetChapterLike {
  num?: string;
  name?: string;
  lines?: BudgetLineLike[];
}
interface BudgetVersionLike {
  id?: string;
  chapters?: BudgetChapterLike[];
}
interface BudgetLike {
  id?: string;
  versions?: BudgetVersionLike[];
}
interface ProjectLike {
  id?: string;
  code?: string;
  name?: string;
  closed?: boolean;
  budgetId?: string;
  acceptedVersionId?: string;
  baseline?: { chapters?: BudgetChapterLike[] };
  [k: string]: unknown;
}
interface StateLike {
  workers?: WorkerLike[];
  labour?: LabourLike[];
  assignments?: AssignmentLike[];
  projects?: ProjectLike[];
  budgets?: BudgetLike[];
  [k: string]: unknown;
}

/**
 * One job, as the person working on it may see it.
 *
 * BUILT, NOT FILTERED — the same rule the top level already states, and this is
 * where it was missing. Projects used to be passed through WHOLE, and a project
 * carries `baseline`: `revenueCents`, `costCents`, `marginCents`, and for every
 * chapter its `saleCents` and `costCents`. So a site account assigned to a job
 * was receiving what that job sells for, what it costs and what it earns, on
 * every read. The docstring above said "everything with money in it is removed
 * rather than blanked"; the code said otherwise.
 *
 * The screen never printed those numbers, which is why it went unnoticed — and
 * why "not one euro sign on it" is a test of the SCREEN and not of the wire.
 *
 * What is left is what the two worker screens actually use: the code to
 * recognise the job by, whether it is still open, and the chapters and lines
 * their hours have to name. No amounts, no customer, no address.
 */
function scopeProject(p: ProjectLike, budgets: BudgetLike[]): ProjectLike {
  /* The lines a chapter offers live in the accepted budget version, and the
     budget itself is NOT sent — it is priced from end to end. So the few fields
     the picker needs are lifted onto the chapter here, money-free. Without this
     the Subpartida list was empty for every site account, always: the client
     looked the budget up, did not find it, and silently offered nothing. */
  const version = (budgets.find((b) => b.id === p.budgetId)?.versions ?? []).find(
    (v) => v.id === p.acceptedVersionId,
  );
  const linesFor = (num?: string): BudgetLineLike[] =>
    ((version?.chapters ?? []).find((c) => String(c.num) === String(num))?.lines ?? []).map(
      (l) => ({ id: l.id, num: l.num, code: l.code, desc: l.desc }),
    );
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    closed: p.closed,
    budgetId: p.budgetId,
    acceptedVersionId: p.acceptedVersionId,
    baseline: {
      chapters: (p.baseline?.chapters ?? []).map((c) => ({
        num: c.num,
        name: c.name,
        lines: linesFor(c.num),
      })),
    },
  };
}

const norm = (v: unknown) =>
  String(v ?? "")
    .trim()
    .toLowerCase();

/** The worker record this e-mail belongs to, or null when it belongs to none. */
export function workerIdIn(state: StateLike, email: string): string | null {
  const want = norm(email);
  if (!want) return null;
  const w = (state.workers ?? []).find((x) => norm(x.email) === want);
  return (w && w.id) || null;
}

/**
 * The ERP as one worker may see it.
 *
 * Everything with money in it is removed rather than blanked: a zero where a
 * figure used to be is still a shape somebody can reason about, and the point
 * is that this account never receives the number at all. What remains is the
 * minimum the two screens need — the person themself, their own hours, and the
 * jobs they are assigned to with the line items those hours can name.
 */
export function redactForWorker(state: StateLike, workerId: string | null): StateLike {
  const mine = (x: { workerId?: string }) => !!workerId && x.workerId === workerId;
  const labour = (state.labour ?? []).filter(mine);
  const assignments = (state.assignments ?? []).filter(mine);
  const allowed = new Set(assignments.map((a) => a.projectId).filter(Boolean) as string[]);
  /* Their own past hours name jobs they may no longer be assigned to. Dropping
     those projects would leave the worker's own history pointing at nothing. */
  for (const l of labour) if (l.projectId) allowed.add(l.projectId);
  const projects = (state.projects ?? [])
    .filter((p) => allowed.has(String(p.id)))
    .map((p) => scopeProject(p, state.budgets ?? []));
  return {
    today: state.today,
    company: undefined,
    workers: (state.workers ?? [])
      .filter((w) => !!workerId && w.id === workerId)
      /* Not even their own rate: the screens show hours, and a cost per hour is
         the one number a payslip conversation should not start from. */
      .map((w) => ({ id: w.id, name: w.name, kind: (w as { kind?: string }).kind })),
    labour: labour.map((l) => ({ ...l, costCents: undefined, rateCents: undefined })),
    assignments,
    projects,
    /* Everything else — parties, invoices, bank, cash, budgets, margins — is
       absent by construction: this object is BUILT, not filtered, so a field
       added to the ERP tomorrow does not leak by default. */
  } as StateLike;
}
