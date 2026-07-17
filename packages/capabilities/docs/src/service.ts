import { FactoryError, type ClockPort, type IdGenPort, type PortId } from "@repo/kernel";
import type { DocMeta, DocsConfig, Register } from "./model";

/** Blob-store port: bytes live here, keyed opaquely. Dev binds the fake below. */
export const BLOB_STORE_PORT: PortId = "blob-store@1";

export interface BlobStore {
  put(key: string, bytes: Uint8Array): Promise<void>;
  get(key: string): Promise<Uint8Array | undefined>;
}

/** Dev/safe adapter: keeps blobs in memory. No network, nothing persisted. */
export class InMemoryBlobStore implements BlobStore {
  private readonly map = new Map<string, Uint8Array>();
  async put(key: string, bytes: Uint8Array): Promise<void> {
    this.map.set(key, bytes);
  }
  async get(key: string): Promise<Uint8Array | undefined> {
    return this.map.get(key);
  }
}

export interface DocsDeps {
  clock: ClockPort;
  idGen: IdGenPort;
  config: DocsConfig;
}

/**
 * Document register. Attach metadata to any entity, tag it, and version it.
 * Bytes (if any) go to the injected blob store; the register stays metadata.
 */
export class DocsService {
  constructor(private readonly deps: DocsDeps) {}

  empty(): Register {
    return { docs: [] };
  }

  attach(
    register: Register,
    input: {
      entityKind: string;
      entityRef: string;
      name: string;
      mime: string;
      sizeBytes: number;
      storageKey: string;
      tags?: string[];
    },
  ): Register {
    const doc: DocMeta = {
      id: this.deps.idGen.next("doc"),
      entityKind: input.entityKind,
      entityRef: input.entityRef,
      name: input.name,
      mime: input.mime,
      sizeBytes: input.sizeBytes,
      storageKey: input.storageKey,
      tags: input.tags ?? [],
      version: 1,
      uploadedAt: this.deps.clock.nowIso(),
    };
    return { ...register, docs: [...register.docs, doc] };
  }

  /** Add a new version of an existing document (same name/entity lineage). */
  newVersion(
    register: Register,
    docId: string,
    input: { sizeBytes: number; storageKey: string },
  ): Register {
    const prev = register.docs.find((d) => d.id === docId);
    if (!prev) throw new FactoryError("NOT_FOUND", `Document ${docId} not found.`);
    const doc: DocMeta = {
      ...prev,
      id: this.deps.idGen.next("doc"),
      sizeBytes: input.sizeBytes,
      storageKey: input.storageKey,
      version: prev.version + 1,
      uploadedAt: this.deps.clock.nowIso(),
    };
    return { ...register, docs: [...register.docs, doc] };
  }

  tag(register: Register, docId: string, tag: string): Register {
    const idx = register.docs.findIndex((d) => d.id === docId);
    if (idx === -1) throw new FactoryError("NOT_FOUND", `Document ${docId} not found.`);
    return {
      ...register,
      docs: register.docs.map((d, i) =>
        i === idx && !d.tags.includes(tag) ? { ...d, tags: [...d.tags, tag] } : d,
      ),
    };
  }

  /** Latest version of each document attached to an entity. */
  listFor(register: Register, entityKind: string, entityRef: string): DocMeta[] {
    return register.docs.filter((d) => d.entityKind === entityKind && d.entityRef === entityRef);
  }

  findByTag(register: Register, tag: string): DocMeta[] {
    return register.docs.filter((d) => d.tags.includes(tag));
  }
}
