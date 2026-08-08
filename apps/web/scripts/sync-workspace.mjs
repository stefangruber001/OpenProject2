/**
 * Publishes `site/` from the Next server, at /workspace/.
 *
 * The workspace UI and its API have to be same-origin. Not for tidiness:
 *
 *   - cross-origin POSTs would need CORS, and a permissive CORS policy on an
 *     API with no authentication is a worse idea than it already sounds;
 *   - when real accounts land, one origin means one session cookie covers the
 *     workspace and the API. Two origins means inventing token plumbing.
 *
 * So the same files that GitHub Pages publishes are copied into `public/` at
 * build time, with one difference: a `<meta name="erp-api" content="">` tag is
 * injected, which is how `erp-store.js` knows to keep the company's document on
 * this origin's server instead of in IndexedDB. The Pages copy is untouched and
 * stays the read-only demo.
 *
 * EVERY page gets the tag, not a chosen few. It used to be a two-name list, from
 * when only `erp.html` talked to the API — and the result was a workspace where
 * some screens read the server and others read the browser, which is worse than
 * either on its own: the same record appears on one screen and not the next, and
 * nothing reports an error. The marker now says "this copy is server-backed",
 * which is a property of the deployment, so it belongs on all of it.
 *
 * `public/` is generated and gitignored. Editing it is pointless — this script
 * overwrites it on every build.
 */
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = dirname(dirname(webRoot));
const src = join(repoRoot, "site");
const dest = join(webRoot, "public", "workspace");

/** Every page served from here is server-backed. See the note above. */
async function remotePages(dir) {
  return (await readdir(dir)).filter((f) => f.endsWith(".html"));
}

const MARKER = '<meta name="erp-api" content="" />';

async function main() {
  await rm(dest, { recursive: true, force: true });
  await mkdir(dest, { recursive: true });
  await cp(src, dest, { recursive: true });

  const pages = await remotePages(dest);
  let marked = 0;
  for (const page of pages) {
    const file = join(dest, page);
    let html = await readFile(file, "utf8");
    if (html.includes('name="erp-api"')) continue;
    // Two shapes in here: full documents, and fragments with no <head> at all
    // (backend.html, frontend.html). Throwing on the second was survivable
    // while the list was two hand-picked pages and would fail the build now.
    // A <meta> ahead of everything is hoisted into the head by the parser, so
    // the fragments are served the same way they render.
    html = html.includes("<head>")
      ? html.replace("<head>", `<head>\n  ${MARKER}`)
      : `${MARKER}\n${html}`;
    await writeFile(file, html);
    marked += 1;
  }

  // Asserted, not assumed. A page that silently misses the marker keeps its own
  // data in the browser while its neighbours use the server — the failure looks
  // like "the record did not save" and points nowhere near this script.
  if (marked !== pages.length) {
    throw new Error(`${pages.length} pages, only ${marked} marked server-backed.`);
  }

  const count = (await readdir(dest)).length;
  console.log(`workspace: ${count} entries → public/workspace (${marked} marked server-backed)`);
}

await main();
