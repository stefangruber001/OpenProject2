#!/usr/bin/env python3
"""
Stamp the "this is not the live system" warning into published HTML.

    stamp-pages-warning.py <dir> <which-es> <which-en> <live-url>

Applied by .github/workflows/pages.yml to every page it publishes — both the
production copy at the site root and the development copy under /preview/.

WHY THIS IS A SCRIPT AND NOT A ONE-LINE `perl -pi -e`
The workflow used to stamp its "Dev preview" pill with

    perl -0pi -e 's{</body>}{$ENV{BANNER}</body>}i'

and that is subtly wrong in three ways, all of which were live:

  * `s///` without /g replaces the FIRST match. In site/journey.html the first
    `</body>` sits inside a JavaScript template literal that builds an email
    document, so the pill was being injected into every generated EMAIL rather
    than onto the page. The page itself was never marked, and it is the page
    the phone app opens as "Project".
  * site/backend.html and site/frontend.html have no `</body>` at all — they
    are fragments. No match, no pill, silently.
  * Nothing checked. A regex that matches nothing exits 0 and looks like
    success, which is how the above survived.

So: anchor on the LAST `</body>`, fall back to appending for files that have
none, and REPORT a count that the workflow asserts against. A marking step that
cannot fail loudly is not a marking step.
"""

import pathlib
import sys

WARNING = pathlib.Path(__file__).resolve().parent.parent / "pages-warning.html"


def stamp(html: str, block: str) -> str:
    """Insert `block` at the end of the document body.

    Anchors on the LAST `</body>`, not the first: earlier occurrences may be
    text inside a script. Files with no `</body>` get the block appended —
    browsers parse trailing content into the body, and a fragment page still
    needs the warning.
    """
    idx = html.rfind("</body>")
    if idx == -1:
        return html + "\n" + block + "\n"
    return html[:idx] + block + "\n" + html[idx:]


def main() -> int:
    if len(sys.argv) != 5:
        print(__doc__.strip().splitlines()[2].strip(), file=sys.stderr)
        return 2
    root, which_es, which_en, live_url = sys.argv[1:5]

    block = (
        WARNING.read_text(encoding="utf-8")
        .replace("__WHICH_ES__", which_es)
        .replace("__WHICH_EN__", which_en)
        .replace("__LIVE_URL__", live_url)
    )
    # A leftover token means the warning ships with "__LIVE_URL__" as its link.
    # Better to fail the deployment than to publish a broken escape hatch.
    for token in ("__WHICH_ES__", "__WHICH_EN__", "__LIVE_URL__"):
        if token in block:
            print(f"ERROR: {token} was not substituted", file=sys.stderr)
            return 1

    pages = sorted(pathlib.Path(root).rglob("*.html"))
    if not pages:
        print(f"ERROR: no HTML found under {root}", file=sys.stderr)
        return 1

    stamped = skipped = appended = 0
    for page in pages:
        html = page.read_text(encoding="utf-8")
        # Idempotent, and load-bearing: this recurses, so the root pass also
        # reaches _site/preview. Skipping already-stamped files is what lets the
        # preview keep its own wording.
        if "canei-not-live-bar" in html:
            skipped += 1
            continue
        if "</body>" not in html:
            appended += 1
        page.write_text(stamp(html, block), encoding="utf-8")
        stamped += 1

    # Report what was DONE, not what was seen. A count of files found reads like
    # success even when every one of them was skipped.
    print(
        f"{root}: stamped {stamped}, already marked {skipped}, "
        f"of {len(pages)} pages ({appended} had no </body> and were appended to)"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
