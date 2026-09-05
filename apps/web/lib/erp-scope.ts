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
interface StateLike {
  workers?: WorkerLike[];
  labour?: LabourLike[];
  assignments?: AssignmentLike[];
  projects?: Record<string, unknown>[];
  [k: string]: unknown;
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
  const projects = (state.projects ?? []).filter((p) => allowed.has(String(p.id)));
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
