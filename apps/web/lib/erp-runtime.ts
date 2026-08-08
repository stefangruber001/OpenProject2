/**
 * The ERP, running on the server against Postgres.
 *
 * This is the piece that moves the system of record off a laptop. The engine is
 * unchanged (`lib/erp-engine.ts`), the storage is the versioned `erp_state`
 * table, and the sequence per request is:
 *
 *     load {state, version} → migrate → ERP.from(state) → run one command
 *                           → save quoting `version`
 *
 * Read-modify-write across two transactions rather than one long one. Holding a
 * transaction open across the engine work would serialise every user behind
 * whoever is slowest; the version check gives the same safety, because a writer
 * whose document moved underneath them is rejected (STALE_WRITE → HTTP 409)
 * instead of overwriting. That rejection is the whole reason more than one
 * person can use this at all.
 */
import { FactoryError } from "@repo/kernel";
import { COMMANDS, commandNames, isCommandName, type CommandName } from "./erp-commands";
import { ERP, Migrations } from "./erp-engine";
import { listTenants } from "./tenant-runtime";
import type { ErpInstance, ErpMethodBag, ErpState } from "./erp-types";

/** Documents live under one key per tenant; the column is there for later. */
const STATE_KEY = "state";

export interface LoadedErp {
  erp: ErpInstance;
  /** The version that must be quoted to save. 0 when nothing is stored yet. */
  version: number;
  /** Schema versions the ladder applied on the way in, for the caller to report. */
  migrated: number[];
}

interface ErpStateStore {
  load<T>(): Promise<{ state: T | null; version: number }>;
  save(state: unknown, expectedVersion: number, user?: string): Promise<number>;
}

/**
 * A tenant must be one the factory knows about.
 *
 * Without this, `/api/canei-typo/erp/state` reads as an empty company and the
 * first command CREATES it — a phantom tenant born from a mistyped URL, holding
 * real records, invisible to everything that lists tenants from the specs.
 */
function assertKnownTenant(tenantId: string): void {
  if (!listTenants().includes(tenantId)) {
    throw new FactoryError(
      "NOT_FOUND",
      `No tenant "${tenantId}". Known tenants: ${listTenants().join(", ") || "(none)"}.`,
    );
  }
}

async function stateStore(tenantId: string, key: string = STATE_KEY): Promise<ErpStateStore> {
  assertKnownTenant(tenantId);
  if (!process.env.DATABASE_URL) {
    throw new FactoryError(
      "CONFIG_INVALID",
      "The ERP needs a database: DATABASE_URL is not set. Without it there is " +
        "nowhere durable to put the company's data.",
    );
  }
  const db = await import("@repo/db");
  return new db.PrismaErpStateStore(db.prisma, tenantId, key);
}

/**
 * Reads the stored document and returns a live engine over it.
 *
 * The migration ladder runs here rather than in the browser, which is the
 * change of ownership that matters: with many clients, a ladder that runs
 * client-side runs a different number of times per user and cannot be reasoned
 * about. `Migrations.migrate` is pure and idempotent, and throws outright when
 * the blob is NEWER than this build — which is left to propagate, because
 * reseeding over data written by a newer version to make a page render is the
 * one failure this code must never cause.
 */
export async function loadErp(tenantId: string): Promise<LoadedErp> {
  const store = await stateStore(tenantId);
  const { state, version } = await store.load<ErpState>();

  if (!state) return { erp: new ERP(), version: 0, migrated: [] };

  const result = Migrations.migrate(state);
  return { erp: ERP.from(result.state), version, migrated: result.applied };
}

/**
 * The auxiliary documents — the screens that keep their own dataset.
 *
 * Master Data, Financial Data and the project folder each hold a document that
 * is theirs alone and is not part of the ERP register. They were written
 * against IndexedDB, one database each, which is why a customer typed into
 * Master Data on a laptop was on that laptop and nowhere else.
 *
 * The `erp_state` table is keyed `(tenantId, key)` and always was, so these need
 * no new storage — only a key each. They are NOT run through the ERP engine:
 * they are not the register and have no schema ladder. What they get is the
 * part that matters, which is being the company's rather than the device's.
 *
 * Closed list. The key comes from the URL, and an open one would let any caller
 * create unbounded rows under a tenant simply by asking.
 */
export const AUX_DOCUMENTS: Readonly<Record<string, string>> = {
  caneiMasterData: "master-data",
  caneiFinance: "financial-data",
  caneiJourney: "journey",
};

export function isAuxDocument(name: string): boolean {
  return Object.hasOwn(AUX_DOCUMENTS, name);
}

/**
 * The store for binary attachments (site photographs).
 *
 * Same tenant assertion and same DATABASE_URL requirement as the documents: a
 * photograph filed under a mistyped tenant is a photograph nobody will find
 * again, and a missing database must fail loudly rather than pretend to store
 * something.
 */
export async function blobStore(tenantId: string) {
  assertKnownTenant(tenantId);
  if (!process.env.DATABASE_URL) {
    throw new FactoryError(
      "CONFIG_INVALID",
      "Attachments need a database: DATABASE_URL is not set. Without it there " +
        "is nowhere durable to put the company's photographs.",
    );
  }
  const db = await import("@repo/db");
  return new db.PrismaErpBlobStore(db.prisma, tenantId);
}

/**
 * Every document's version, named the way the BROWSER names them.
 *
 * The client asks this on a timer and whenever its page comes back to the
 * front, and refreshes only when a number it is watching has moved. That is the
 * whole mechanism behind "a customer entered on the phone appears on the laptop
 * without anyone pressing reload".
 *
 * The translation matters. Storage keys are `master-data`; the browser knows
 * the document as `caneiMasterData`, because that is what the page's old
 * IndexedDB database was called and the pages still say so. Publishing storage
 * keys here would make the client depend on a name that exists only because of
 * where the bytes happen to live.
 *
 * A document with no row yet is simply absent, not zero: absent means "never
 * written", and the client already treats a missing number as "no news".
 */
export async function documentVersions(tenantId: string): Promise<Record<string, number>> {
  assertKnownTenant(tenantId);
  if (!process.env.DATABASE_URL) {
    throw new FactoryError("CONFIG_INVALID", "The ERP needs a database: DATABASE_URL is not set.");
  }
  const db = await import("@repo/db");
  const byStorageKey = await db.erpStateVersions(db.prisma, tenantId);

  const clientName = new Map<string, string>([[STATE_KEY, "state"]]);
  for (const [name, key] of Object.entries(AUX_DOCUMENTS)) clientName.set(key, name);

  const out: Record<string, number> = {};
  for (const [key, version] of Object.entries(byStorageKey)) {
    const name = clientName.get(key);
    if (name) out[name] = version;
  }
  return out;
}

export async function loadAuxDocument(
  tenantId: string,
  name: string,
): Promise<{ doc: unknown; version: number }> {
  if (!isAuxDocument(name)) throw new FactoryError("NOT_FOUND", `No document "${name}".`);
  const store = await stateStore(tenantId, AUX_DOCUMENTS[name]);
  const { state, version } = await store.load<unknown>();
  return { doc: state ?? null, version };
}

export async function saveAuxDocument(
  tenantId: string,
  name: string,
  doc: unknown,
  expectedVersion: unknown,
  user: string,
): Promise<{ version: number }> {
  if (!isAuxDocument(name)) throw new FactoryError("NOT_FOUND", `No document "${name}".`);
  if (typeof expectedVersion !== "number" || !Number.isInteger(expectedVersion)) {
    throw new FactoryError("BAD_REQUEST", "expectedVersion is required.");
  }
  if (typeof doc !== "object" || doc === null) {
    throw new FactoryError("BAD_REQUEST", "doc must be an object.");
  }
  if (!user) {
    throw new FactoryError("BAD_REQUEST", "No acting user — every write must be attributable.");
  }
  const store = await stateStore(tenantId, AUX_DOCUMENTS[name]);
  const { version } = await store.load<unknown>();
  if (version !== expectedVersion) {
    throw new FactoryError(
      "STALE_WRITE",
      `Somebody else saved while you were working (you had version ${expectedVersion}, ` +
        `it is now ${version}). Reload before saving again.`,
      { expectedVersion, currentVersion: version },
    );
  }
  return { version: await store.save(doc, expectedVersion, user) };
}

export interface SavedDocument {
  version: number;
  migrated: number[];
}

/**
 * Stores a whole ERP document sent by a client.
 *
 * The workspace applies a change with its own copy of the engine and then saves
 * the resulting document, rather than asking the server to re-run the change.
 * That is a weaker contract than `runCommand` and the difference is worth being
 * honest about: this trusts the client's arithmetic, so the server cannot tell
 * a legitimate edit from a wrong one — only that the document is well-formed
 * and that nobody else has written since the client last read.
 *
 * It is nevertheless what makes the shared system real today. The workspace
 * mutates the engine at several hundred call sites; routing every one through a
 * whitelisted command is the right destination and a large piece of work, and
 * until it is done the alternative is not a stricter server, it is data sitting
 * on one person's laptop. A conflict here is REFUSED, not merged, which is the
 * property that actually lets two people share a register.
 *
 * What the server still guarantees, and does not delegate:
 *   • the version check, so a save built on a stale read is rejected
 *   • the migration ladder, so a document from a newer build is refused rather
 *     than quietly downgraded
 *   • normalisation through `ERP.from(...).toJSON()`, so what lands in the
 *     column has this build's shape
 *   • attribution: `user` comes from the session and is written to the row by
 *     the store, so who saved is recorded server-side and not claimable by the
 *     body of the request
 */
export async function saveErpDocument(
  tenantId: string,
  state: unknown,
  expectedVersion: unknown,
  user: string,
): Promise<SavedDocument> {
  if (typeof expectedVersion !== "number" || !Number.isInteger(expectedVersion)) {
    throw new FactoryError(
      "BAD_REQUEST",
      "expectedVersion is required: send the version you received from GET " +
        "/erp/state, so a save cannot silently overwrite someone else's work.",
    );
  }
  if (typeof state !== "object" || state === null || Array.isArray(state)) {
    throw new FactoryError("BAD_REQUEST", "state must be the ERP document object.");
  }
  if (!user) {
    throw new FactoryError("BAD_REQUEST", "No acting user — every write must be attributable.");
  }

  const store = await stateStore(tenantId);
  const { version } = await store.load<ErpState>();
  if (version !== expectedVersion) {
    throw new FactoryError(
      "STALE_WRITE",
      `Somebody else saved while you were working (you had version ${expectedVersion}, ` +
        `it is now ${version}). Reload before saving again.`,
      { expectedVersion, currentVersion: version },
    );
  }

  // Migrate the INCOMING document, not the stored one: an older client may
  // still be open in a tab somewhere, and this is where its document is
  // brought up to this build — or refused, if it comes from a newer one.
  const result = Migrations.migrate(state as ErpState);
  const erp = ERP.from(result.state);

  const newVersion = await store.save(erp.toJSON(), expectedVersion, user);
  return { version: newVersion, migrated: result.applied };
}

export interface CommandRequest {
  command: string;
  /** Positional arguments, matching the command's declared arity. */
  args?: unknown[];
  /** The version the client last read. Required — see the note below. */
  expectedVersion?: number;
}

export interface CommandOutcome {
  command: CommandName;
  /** The engine's return value, if any — a created id, a generated document. */
  result: unknown;
  /** The document's version after the write; quote this on the next call. */
  version: number;
  migrated: number[];
}

/**
 * Runs one whitelisted command and persists the result.
 *
 * `user` comes from the caller's session and is appended as the engine's final
 * argument, never taken from the request. The engine writes it to `state.audit`
 * on every mutation, so this is what makes the audit trail name a person
 * instead of a hardcoded string like the browser build does.
 */
export async function runCommand(
  tenantId: string,
  req: CommandRequest,
  user: string,
): Promise<CommandOutcome> {
  if (!isCommandName(req.command)) {
    throw new FactoryError(
      "BAD_REQUEST",
      `Unknown command "${String(req.command)}". Known commands: ${commandNames().join(", ")}.`,
    );
  }
  const spec = COMMANDS[req.command];
  const args = req.args ?? [];
  if (!Array.isArray(args) || args.length !== spec.arity) {
    throw new FactoryError(
      "BAD_REQUEST",
      `"${req.command}" (${spec.describes}) takes ${spec.arity} argument(s), got ${
        Array.isArray(args) ? args.length : typeof args
      }.`,
    );
  }
  // A missing expectedVersion is rejected rather than defaulted. Defaulting it
  // to "whatever is current" would turn every call into a blind overwrite,
  // which is exactly the data loss the version column exists to prevent — and
  // it would fail silently, only for the person whose work disappeared.
  if (typeof req.expectedVersion !== "number" || !Number.isInteger(req.expectedVersion)) {
    throw new FactoryError(
      "BAD_REQUEST",
      "expectedVersion is required: send the version you received from GET " +
        "/erp/state (or 0 for a tenant with no data yet), so a save cannot " +
        "silently overwrite someone else's work.",
    );
  }
  if (!user) {
    throw new FactoryError("BAD_REQUEST", "No acting user — every mutation must be attributable.");
  }

  const store = await stateStore(tenantId);
  const { state, version } = await store.load<ErpState>();

  if (version !== req.expectedVersion) {
    throw new FactoryError(
      "STALE_WRITE",
      `This record changed while you were editing it (you had version ${req.expectedVersion}, ` +
        `it is now ${version}). Reload before saving again.`,
      { expectedVersion: req.expectedVersion, currentVersion: version },
    );
  }

  let erp: ErpInstance;
  let migrated: number[] = [];
  if (state) {
    const result = Migrations.migrate(state);
    migrated = result.applied;
    erp = ERP.from(result.state);
  } else {
    erp = new ERP();
  }

  // The one deliberate hole in the typing, taken only after the name has passed
  // the closed whitelist above. Everything that makes this safe is in
  // lib/erp-commands.ts.
  const method = (erp as unknown as ErpMethodBag)[spec.method];
  if (typeof method !== "function") {
    // Reachable only if the whitelist drifts from the engine — a rename lands
    // here as a clear error rather than as "is not a function" from inside a
    // route handler.
    throw new FactoryError(
      "MISSING_PORT_IMPLEMENTATION",
      `The engine has no method "${spec.method}" for command "${req.command}".`,
    );
  }

  // The engine throws plain Errors for business-rule violations ("this bill is
  // already paid"). Those are the caller's problem, not a server fault, so they
  // become a 400 with the engine's own wording rather than a stack trace.
  let result: unknown;
  try {
    result = (method as (...a: unknown[]) => unknown).apply(erp, [...args, user]);
  } catch (e) {
    if (e instanceof FactoryError) throw e;
    throw new FactoryError("INVALID_STATE", e instanceof Error ? e.message : String(e));
  }

  const newVersion = await store.save(erp.toJSON(), req.expectedVersion, user);
  return { command: req.command, result: result ?? null, version: newVersion, migrated };
}
