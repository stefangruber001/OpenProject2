import { describe, expect, it } from "vitest";
import { composeAnnex, resolveAnnexOptions, type AnnexImageInput } from "./annex";

const opts = (o: Partial<{ enabled: boolean; imagesPerPage: number }> = {}) => o;

const img = (
  over: Partial<AnnexImageInput> & { ref: string; itemNum: string },
): AnnexImageInput => ({
  groupNum: over.itemNum.split(".")[0] ?? "1",
  groupName: "Group",
  itemLabel: "Item",
  ...over,
});

describe("image annex", () => {
  it("reads in document order: group, then line, numerically", () => {
    const a = composeAnnex(
      [
        img({ ref: "c", itemNum: "2.1" }),
        img({ ref: "d", itemNum: "1.10" }),
        img({ ref: "a", itemNum: "1.2" }),
        img({ ref: "b", itemNum: "1.9" }),
      ],
      opts({ imagesPerPage: 12 }),
    );
    // 1.10 after 1.9, not between 1.1 and 1.2 — a lexical sort gets this wrong
    // and the annex then contradicts the table it follows.
    expect(a.pages[0]!.plates.map((p) => p.ref)).toEqual(["a", "b", "d", "c"]);
  });

  it("breaks ties by the caller's position, then by input order", () => {
    const a = composeAnnex(
      [
        img({ ref: "second", itemNum: "1.1", order: 1 }),
        img({ ref: "first", itemNum: "1.1", order: 0 }),
        img({ ref: "third", itemNum: "1.1", order: 1 }),
      ],
      opts({ imagesPerPage: 12 }),
    );
    expect(a.pages[0]!.plates.map((p) => p.ref)).toEqual(["first", "second", "third"]);
  });

  it("numbers pictures correlatively only when a line has more than one", () => {
    const a = composeAnnex(
      [
        img({ ref: "solo", itemNum: "1.1" }),
        img({ ref: "p1", itemNum: "1.2" }),
        img({ ref: "p2", itemNum: "1.2" }),
      ],
      opts({ imagesPerPage: 12 }),
    );
    const [solo, p1, p2] = a.pages[0]!.plates;
    expect(solo!.sequence).toBeNull();
    expect(solo!.siblings).toBe(1);
    expect([p1!.sequence, p2!.sequence]).toEqual([1, 2]);
    expect(p1!.siblings).toBe(2);
  });

  it("fills pages to the requested count and starts numbering at one", () => {
    const a = composeAnnex(
      ["a", "b", "c", "d", "e"].map((r, i) => img({ ref: r, itemNum: `1.${i + 1}` })),
      opts({ imagesPerPage: 2 }),
    );
    expect(a.pages.map((p) => p.plates.length)).toEqual([2, 2, 1]);
    expect(a.pages.map((p) => p.number)).toEqual([1, 2, 3]);
    expect(a.plateCount).toBe(5);
  });

  it("carries the reference a reader needs to find the line", () => {
    const a = composeAnnex(
      [
        img({
          ref: "x",
          groupNum: "3",
          groupName: "Bathroom",
          itemNum: "3.4",
          itemLabel: "Wall tiling",
          caption: "Reference finish",
        }),
      ],
      opts(),
    );
    expect(a.pages[0]!.plates[0]).toMatchObject({
      groupNum: "3",
      groupName: "Bathroom",
      itemNum: "3.4",
      itemLabel: "Wall tiling",
      caption: "Reference finish",
    });
  });

  it("tells the table which rows carry a mark, in order", () => {
    const a = composeAnnex(
      [
        img({ ref: "a", itemNum: "2.1" }),
        img({ ref: "b", itemNum: "1.3" }),
        img({ ref: "c", itemNum: "1.3" }),
      ],
      opts(),
    );
    expect(a.markedItems).toEqual(["1.3", "2.1"]);
  });

  it("prints nothing and marks nothing when it is switched off", () => {
    const a = composeAnnex([img({ ref: "a", itemNum: "1.1" })], opts({ enabled: false }));
    expect(a.enabled).toBe(false);
    expect(a.pages).toEqual([]);
    expect(a.plateCount).toBe(0);
    // A mark pointing at a page that was never printed is worse than no mark.
    expect(a.markedItems).toEqual([]);
  });

  it("is empty, not broken, with no images at all", () => {
    const a = composeAnnex([], opts());
    expect(a.pages).toEqual([]);
    expect(a.plateCount).toBe(0);
    expect(a.markedItems).toEqual([]);
  });

  it("defaults to on and two per page, and repairs an unreadable sheet", () => {
    expect(resolveAnnexOptions(undefined)).toEqual({ enabled: true, imagesPerPage: 2 });
    // Repaired, not rejected: a stored preference must never make a customer's
    // document unprintable.
    expect(resolveAnnexOptions({ imagesPerPage: 0 }).imagesPerPage).toBe(1);
    expect(resolveAnnexOptions({ imagesPerPage: 40 }).imagesPerPage).toBe(12);
    expect(resolveAnnexOptions({ imagesPerPage: 2.6 }).imagesPerPage).toBe(3);
    expect(resolveAnnexOptions({ imagesPerPage: Number.NaN }).imagesPerPage).toBe(2);
  });

  it("sorts unnumbered lines predictably instead of throwing", () => {
    const a = composeAnnex(
      [
        img({ ref: "b", groupNum: "1", itemNum: "extra" }),
        img({ ref: "a", groupNum: "1", itemNum: "1.1" }),
      ],
      opts({ imagesPerPage: 12 }),
    );
    expect(a.pages[0]!.plates.map((p) => p.ref)).toEqual(["a", "b"]);
  });
});
