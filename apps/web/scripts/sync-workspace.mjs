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
 * injected, which is how `erp-backend.js` knows to talk to the server on this
 * origin instead of using IndexedDB. The Pages copy is untouched and stays the
 * offline demo.
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

/** Pages that talk to the ERP API and therefore need the marker. */
const REMOTE_PAGES = ["erp.html", "index.html"];

const MARKER = '<meta name="erp-api" content="" />';

async function main() {
  await rm(dest, { recursive: true, force: true });
  await mkdir(dest, { recursive: true });
  await cp(src, dest, { recursive: true });

  for (const page of REMOTE_PAGES) {
    const file = join(dest, page);
    let html = await readFile(file, "utf8");
    if (html.includes('name="erp-api"')) continue;
    if (!html.includes("<head>")) {
      throw new Error(`${page} has no <head> to inject the API marker into.`);
    }
    html = html.replace("<head>", `<head>\n  ${MARKER}`);
    await writeFile(file, html);
  }

  const count = (await readdir(dest)).length;
  console.log(
    `workspace: ${count} entries → public/workspace (${REMOTE_PAGES.length} marked remote)`,
  );
}

await main();
