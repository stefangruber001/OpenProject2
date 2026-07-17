import { describe, expect, it } from "vitest";
import { FixedClock, SeqIdGen, isFactoryError } from "@repo/kernel";
import { docsConfigSchema } from "./model";
import { DocsService, InMemoryBlobStore } from "./service";

function svc() {
  return new DocsService({
    clock: new FixedClock("2026-07-17"),
    idGen: new SeqIdGen(),
    config: docsConfigSchema.parse({}),
  });
}

describe("DocsService", () => {
  it("attaches a document to an entity and lists it", () => {
    const s = svc();
    const r = s.attach(s.empty(), {
      entityKind: "project",
      entityRef: "p1",
      name: "plan.pdf",
      mime: "application/pdf",
      sizeBytes: 1024,
      storageKey: "k1",
      tags: ["plan"],
    });
    const docs = s.listFor(r, "project", "p1");
    expect(docs).toHaveLength(1);
    expect(docs[0]!.version).toBe(1);
    expect(s.findByTag(r, "plan")).toHaveLength(1);
  });

  it("versions a document", () => {
    const s = svc();
    let r = s.attach(s.empty(), {
      entityKind: "quote",
      entityRef: "q1",
      name: "quote.pdf",
      mime: "application/pdf",
      sizeBytes: 100,
      storageKey: "k1",
    });
    r = s.newVersion(r, r.docs[0]!.id, { sizeBytes: 200, storageKey: "k2" });
    expect(r.docs.map((d) => d.version).sort()).toEqual([1, 2]);
    expect(r.docs[1]!.name).toBe("quote.pdf");
  });

  it("throws versioning an unknown document", () => {
    const s = svc();
    try {
      s.newVersion(s.empty(), "nope", { sizeBytes: 1, storageKey: "k" });
      throw new Error("should throw");
    } catch (e) {
      expect(isFactoryError(e, "NOT_FOUND")).toBe(true);
    }
  });

  it("stores and retrieves bytes via the in-memory blob store", async () => {
    const store = new InMemoryBlobStore();
    await store.put("k1", new Uint8Array([1, 2, 3]));
    expect(await store.get("k1")).toEqual(new Uint8Array([1, 2, 3]));
    expect(await store.get("missing")).toBeUndefined();
  });
});
