/**
 * What may be stored as an attachment, and served back from the company's
 * own origin.
 *
 * This list lives in its own file for the reason `public-paths.ts` does: it
 * was inside `app/api/[tenant]/erp/blob/[key]/route.ts`, which imports the
 * session, the tenant resolver and the blob store, so it had no unit test and
 * could not have one. Nothing checked it, and something real hid in it —
 * `application/pdf` was missing while the workspace's own attach control
 * (`EV_ACCEPT` = "image/*,application/pdf") offered PDFs everywhere it asks
 * for the document behind a decision: the email accepting a quote, the signed
 * contract from the notaría, the delivery note behind an extra. Every one of
 * those uploads was refused by the server with «Attachments must be an
 * image», on a screen that had just invited it. Reported from the demo on
 * 28/08.
 *
 * DEFAULT DENY. Anything not named here is refused, including a type added to
 * the page tomorrow by somebody who has never read this file. An open list
 * would make this endpoint a way to host arbitrary files — scripts included —
 * beside the company's session cookie.
 *
 * The test next to this file pins the list exactly, so widening it fails the
 * build until the addition is written down there too.
 */

/** Photographs. What a phone or a laptop actually produces. */
const IMAGES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  // What an iPhone hands over when the page cannot re-encode it. Both
  // spellings appear in the wild depending on iOS version.
  "image/heic",
  "image/heif",
] as const;

/**
 * Documents. Not photographs, and not optional.
 *
 * A PDF is stored byte for byte — `evidenceField` deliberately does not
 * re-encode one, because a document that has been re-encoded is no longer the
 * document that was signed.
 *
 * Safe where an SVG is not, and the difference is worth stating rather than
 * assuming: this endpoint serves a PDF back as `application/pdf`, which a
 * browser hands to a viewer instead of executing against this origin. It is
 * content. An SVG is markup that can carry script, and serving one from the
 * company's own origin would turn "attach a document" into "host a script
 * alongside the session cookie" — which is why `image/svg+xml` is absent from
 * IMAGES above and must stay absent.
 */
const DOCUMENTS = ["application/pdf"] as const;

export const ALLOWED_MIME: ReadonlySet<string> = new Set<string>([...IMAGES, ...DOCUMENTS]);

/**
 * Ten megabytes. A phone photograph compressed by the page is far under this;
 * a scanned PDF of a signed contract fits comfortably. Anything above it is a
 * mistake or an attempt to fill the disk.
 */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/**
 * Reads the declared type off a request and says whether it may be stored.
 *
 * The header is normalised here rather than at the call site, because the
 * parameters after the semicolon (`; charset=…`, `; boundary=…`) and the
 * casing are both things a real client sends and neither changes what the
 * file IS.
 */
export function attachmentMime(contentTypeHeader: string | null): string {
  return (contentTypeHeader || "").split(";")[0]!.trim().toLowerCase();
}

export function isAllowedAttachment(mime: string): boolean {
  return ALLOWED_MIME.has(mime);
}
