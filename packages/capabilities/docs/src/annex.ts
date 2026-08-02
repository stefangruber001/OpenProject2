/**
 * Image annex: the pages of pictures that ride at the back of a document.
 *
 * The rule that shapes everything here is that an image belongs to a line item
 * but is NOT printed in its row. Rows stay a table of numbers; the pictures
 * collect at the end, grouped and ordered the way the document itself is
 * ordered, each one saying which line it illustrates. A reader can therefore
 * scan the numbers without interruption and still find the picture for any
 * line — and, just as importantly, a row's height never changes because
 * somebody attached a photograph to it.
 *
 * This module is pure composition: what goes on which page, in what order,
 * under what reference. It never touches bytes, never resizes anything and
 * never decides which images are eligible — the caller hands it the images
 * that are to be printed, and it lays them out.
 */

/** One image, already selected for printing, with the line it illustrates. */
export interface AnnexImageInput {
  /** Opaque reference to the bytes (a blob-store key). Never dereferenced here. */
  ref: string;
  /** Group the line sits in, e.g. "2". Ordering is numeric-aware, not lexical. */
  groupNum: string;
  groupName: string;
  /** The line's own number, e.g. "2.10". */
  itemNum: string;
  /** Short description of the line, so the reader can locate it unambiguously. */
  itemLabel: string;
  /** Optional wording under the picture. Empty means "no caption", not "none given". */
  caption?: string;
  /** Position within its own line; ties fall back to the input order. */
  order?: number;
}

/** One printed picture. */
export interface AnnexPlate {
  ref: string;
  groupNum: string;
  groupName: string;
  itemNum: string;
  itemLabel: string;
  caption: string;
  /**
   * Correlative number within its line when that line has more than one
   * picture, and `null` when it has exactly one. A lone picture reading
   * "2.3 (1 of 1)" is noise; the number only earns its place once there is a
   * second one to tell apart.
   */
  sequence: number | null;
  /** Total pictures for that line, so a renderer can print "2 of 3" if it wants. */
  siblings: number;
}

export interface AnnexPage {
  /** 1-based, counted within the annex — not within the document. */
  number: number;
  plates: AnnexPlate[];
}

export interface Annex {
  enabled: boolean;
  pages: AnnexPage[];
  plateCount: number;
  /**
   * The item numbers that ended up with at least one plate. This is what lets
   * the table print a discreet mark on exactly the rows that have pictures,
   * without the table having to know anything about the annex's contents.
   * Empty when the annex is off, so a disabled annex can never leave marks
   * pointing at pages that were not printed.
   */
  markedItems: string[];
}

/**
 * Per-document, not per-tenant: these are arguments, so they are plain values
 * with plain defaults rather than a config schema. (The capability's zod config
 * schema stays in model.ts, where tenant configuration belongs. Reaching for it
 * here would drag a validation library into every browser that renders a
 * document preview, to check two numbers.)
 */
export interface AnnexOptions {
  /** Per-document switch. Off means: no pages, and no marks in the table. */
  enabled?: boolean;
  /** How many pictures share a page. */
  imagesPerPage?: number;
}

export const ANNEX_DEFAULT_ENABLED = true;
/** Two is what stays readable on a portrait page. */
export const ANNEX_DEFAULT_IMAGES_PER_PAGE = 2;
export const ANNEX_MAX_IMAGES_PER_PAGE = 12;

/**
 * Repairs rather than rejects. These options come off a stored document that
 * may have been written by any past or future build, and refusing to lay out a
 * document because someone once saved `imagesPerPage: 40` would make a
 * customer's quotation unprintable over a formatting preference. Out-of-range
 * values are pulled back into range; a missing one takes the default.
 */
export function resolveAnnexOptions(o: AnnexOptions | undefined | null): Required<AnnexOptions> {
  const raw = Number(o?.imagesPerPage);
  const perPage = Number.isFinite(raw)
    ? Math.min(ANNEX_MAX_IMAGES_PER_PAGE, Math.max(1, Math.round(raw)))
    : ANNEX_DEFAULT_IMAGES_PER_PAGE;
  return {
    enabled: typeof o?.enabled === "boolean" ? o.enabled : ANNEX_DEFAULT_ENABLED,
    imagesPerPage: perPage,
  };
}

/**
 * Compares two dotted numbers the way a reader expects: 2.10 comes after 2.9,
 * not between 2.1 and 2.2. Non-numeric segments fall back to a string compare
 * so an unnumbered or hand-labelled line still sorts predictably instead of
 * throwing.
 */
function compareNumbering(a: string, b: string): number {
  const pa = String(a).split(".");
  const pb = String(b).split(".");
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const sa = pa[i];
    const sb = pb[i];
    if (sa === undefined) return -1;
    if (sb === undefined) return 1;
    const na = Number(sa);
    const nb = Number(sb);
    if (Number.isFinite(na) && Number.isFinite(nb)) {
      if (na !== nb) return na - nb;
    } else if (sa !== sb) {
      return sa < sb ? -1 : 1;
    }
  }
  return 0;
}

/**
 * Lays the given images out as annex pages.
 *
 * Ordering is group, then line, then the position the caller gave, then the
 * order they arrived in — so the annex reads in the same sequence as the
 * document it follows, and two images with the same position never swap places
 * between two runs over the same data.
 */
export function composeAnnex(images: AnnexImageInput[], options?: AnnexOptions): Annex {
  const opts = resolveAnnexOptions(options);
  if (!opts.enabled || images.length === 0) {
    return { enabled: opts.enabled, pages: [], plateCount: 0, markedItems: [] };
  }

  const ordered = images
    .map((img, i) => ({ img, i }))
    .sort((a, b) => {
      const g = compareNumbering(a.img.groupNum, b.img.groupNum);
      if (g !== 0) return g;
      const it = compareNumbering(a.img.itemNum, b.img.itemNum);
      if (it !== 0) return it;
      const o = (a.img.order ?? 0) - (b.img.order ?? 0);
      if (o !== 0) return o;
      return a.i - b.i;
    })
    .map((x) => x.img);

  const perItem = new Map<string, number>();
  for (const img of ordered) perItem.set(img.itemNum, (perItem.get(img.itemNum) ?? 0) + 1);

  const seen = new Map<string, number>();
  const plates: AnnexPlate[] = ordered.map((img) => {
    const siblings = perItem.get(img.itemNum) ?? 1;
    const n = (seen.get(img.itemNum) ?? 0) + 1;
    seen.set(img.itemNum, n);
    return {
      ref: img.ref,
      groupNum: img.groupNum,
      groupName: img.groupName,
      itemNum: img.itemNum,
      itemLabel: img.itemLabel,
      caption: img.caption ?? "",
      sequence: siblings > 1 ? n : null,
      siblings,
    };
  });

  const pages: AnnexPage[] = [];
  for (let i = 0; i < plates.length; i += opts.imagesPerPage) {
    pages.push({
      number: pages.length + 1,
      plates: plates.slice(i, i + opts.imagesPerPage),
    });
  }

  return {
    enabled: true,
    pages,
    plateCount: plates.length,
    markedItems: [...perItem.keys()].sort(compareNumbering),
  };
}
