import { describe, expect, it } from "vitest";
import {
  ALLOWED_MIME,
  MAX_ATTACHMENT_BYTES,
  attachmentMime,
  isAllowedAttachment,
} from "./attachments";

/**
 * The attachment allow-list.
 *
 * This file exists because the list had no test and a real bug hid in it: the
 * workspace offers a PDF wherever it asks for the document behind a decision
 * — the accepted quote, the signed contract, the delivery note — and the
 * server refused every one of them with «Attachments must be an image», on a
 * screen that had just invited the file. Reported from the demo on 28/08.
 */
describe("what may be attached", () => {
  it("pins the whole list, so widening it is a decision and not a slip", () => {
    // Deliberately a whole-list assertion. A membership check would pass just
    // as happily on a list with one extra entry, and every entry here is
    // something this endpoint will then serve back from the company's origin.
    expect([...ALLOWED_MIME].sort()).toEqual([
      "application/pdf",
      "image/gif",
      "image/heic",
      "image/heif",
      "image/jpeg",
      "image/png",
      "image/webp",
    ]);
  });

  it("accepts a PDF — the document behind a decision, not a photograph", () => {
    expect(isAllowedAttachment("application/pdf")).toBe(true);
  });

  it("still refuses an SVG, which is markup that can carry script", () => {
    // The one type that must never be here. It is served back from the same
    // origin as the session cookie, and a browser executes it.
    expect(isAllowedAttachment("image/svg+xml")).toBe(false);
    expect(ALLOWED_MIME.has("image/svg+xml")).toBe(false);
  });

  it("refuses the shapes an open list would have let through", () => {
    for (const mime of [
      "text/html",
      "application/javascript",
      "text/javascript",
      "application/xhtml+xml",
      "application/octet-stream",
      "",
    ]) {
      expect(isAllowedAttachment(mime)).toBe(false);
    }
  });

  it("reads the type off a real header: parameters and casing are not the file", () => {
    expect(attachmentMime("application/pdf")).toBe("application/pdf");
    expect(attachmentMime("Application/PDF")).toBe("application/pdf");
    expect(attachmentMime("image/jpeg; charset=binary")).toBe("image/jpeg");
    expect(attachmentMime("  image/png  ")).toBe("image/png");
    expect(attachmentMime(null)).toBe("");
  });

  it("caps a single attachment at ten megabytes", () => {
    expect(MAX_ATTACHMENT_BYTES).toBe(10 * 1024 * 1024);
  });
});
