/**
 * These gates read PDFs with poppler (`pdftotext`). If it is absent they can
 * extract nothing — and a probe that extracts nothing must say so, not report a
 * clean sheet.
 *
 * This exists because that exact thing happened: on a runner without poppler the
 * margin gate printed "all pages clear of the printable border — 999.0mm" and
 * exited 0, for a PDF it had never read. The dependency is now stated once, in
 * one place, and checked before any measurement is attempted.
 */
import { spawnSync } from "node:child_process";

export function requirePoppler() {
  const probe = spawnSync("pdftotext", ["-v"], { encoding: "utf8" });
  if (probe.error || probe.status === null) {
    console.error(
      "FAIL: `pdftotext` is not available, so these documents cannot be measured.\n" +
        "      Install it:  apt-get install -y poppler-utils   (Debian/Ubuntu)\n" +
        "                   brew install poppler                (macOS)\n" +
        "      This gate refuses to pass without it — a document nobody could\n" +
        "      read is not a document anybody verified.",
    );
    process.exit(1);
  }
}
