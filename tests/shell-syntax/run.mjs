/* =============================================================================
   Every shell script in this repository parses.

   WHY THIS IS WORTH A GATE. `ops/` is not a build directory — it is the set of
   commands somebody runs, from a browser, to repair the client's production
   server: restore its address, stop the development stack, rotate a registry
   token, take a backup, redeploy. A syntax error in one of them is discovered
   at the exact moment it is needed, by a person who is already dealing with an
   outage, and it turns a five-minute recovery into an incident with no tools.

   Nothing checked them. The site's JavaScript has had a parse gate for months;
   nineteen shell scripts with root on the production box had none, and the only
   reason that never bit is luck. (S143 named the gap; the operator asked for it
   closed the same day.)

   IT IS ONLY A PARSE CHECK, and that is a deliberate limit rather than an
   oversight. `bash -n` reads a script and builds it without running a line of
   it, which is exactly what is safe to do with scripts that ssh into a live
   server. It catches the class that actually happens — an unclosed quote, a
   `fi` that never arrives, a heredoc whose terminator drifted — and it makes no
   claim about whether the script does the right thing. Anything stronger
   (shellcheck) is a separate decision with a backlog attached.

   Honouring each script's own shebang rather than assuming bash: a file that
   declares `sh` must parse as `sh`, or the gate is testing something the
   machine will never run.
   ========================================================================== */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/* Tracked files, asked of git rather than globbed, so a script added tomorrow
   is covered tomorrow without anybody remembering to widen a list. */
const files = execFileSync("git", ["ls-files", "*.sh"], { cwd: ROOT, encoding: "utf8" })
  .split("\n")
  .map((f) => f.trim())
  .filter(Boolean);

console.log("\n\x1b[1mShell scripts parse\x1b[0m\n");

/* A GATE OVER NOTHING PASSES BY BEING EMPTY. This exact trap was walked into
   once already today — a check that read its subjects from a list that had been
   emptied, and went green over a loop with no iterations. If the repository
   stops having shell scripts, that is a fact worth failing over rather than
   quietly celebrating. */
if (files.length < 15) {
  console.log(
    `  \x1b[1;31m✗\x1b[0m only ${files.length} shell script(s) found — expected the ops set\n`,
  );
  process.exit(1);
}

const fails = [];
for (const f of files) {
  const first = readFileSync(resolve(ROOT, f), "utf8").split("\n", 1)[0];
  // `#!/usr/bin/env bash` → bash; `#!/bin/sh` → sh; anything else → bash, which
  // is the repository's convention and the stricter reader of the two.
  const declared = /^#!.*\b(bash|zsh|sh)\b/.exec(first);
  const shell = declared ? declared[1] : "bash";
  try {
    execFileSync(shell, ["-n", f], { cwd: ROOT, stdio: "pipe" });
  } catch (e) {
    fails.push(
      `${f} (${shell}): ${
        String(e.stderr || e.message)
          .trim()
          .split("\n")[0]
      }`,
    );
  }
}

if (fails.length) {
  console.log(`  \x1b[1;31m✗\x1b[0m ${fails.length} of ${files.length} did not parse:\n`);
  for (const f of fails) console.log(`      ${f}`);
  console.log("");
  process.exit(1);
}
console.log(`  \x1b[1;32m✓\x1b[0m all ${files.length} shell scripts parse\n`);
