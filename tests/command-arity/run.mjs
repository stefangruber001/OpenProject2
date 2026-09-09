#!/usr/bin/env node
/**
 * What the browser SENDS must be what the whitelist ACCEPTS.
 *
 * `POST /erp/command` counts the arguments it is given against the `arity` in
 * `apps/web/lib/erp-commands.ts` and refuses the call if they disagree. That
 * number deliberately EXCLUDES the acting user: every mutating engine method
 * takes the user last, and the server appends it from the session so that a
 * caller cannot claim to be somebody else by putting a name in the body.
 *
 * The client did not know that. It sent the user as a trailing argument, the
 * server counted two where one was allowed, and every crew member's save was
 * refused — «"recordHours" (record hours) takes 1 argument(s), got 2» — on the
 * phone, in production, on the first day the write path existed at all.
 *
 * NEITHER SUITE COULD SEE IT, and that is the reason this file exists:
 *
 *   · `tests/site-e2e` drives the real screen but serves `site/` from disk with
 *     NO SERVER, so `commandMutate` takes its local branch and calls the engine
 *     directly — where the user IS the last argument and two is correct.
 *   · `tests/server-e2e` calls the endpoint but writes its own argument list by
 *     hand, so it proves the SERVER's contract against itself and never once
 *     looks at what the client would have sent.
 *
 * Each half was tested against its own idea of the contract. This checks the
 * two ideas against each other, which is the only place the disagreement was
 * ever visible — and it does so by reading the source, so it needs no browser,
 * no database and no network, and it runs in milliseconds.
 *
 * Run: node tests/command-arity/run.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CLIENT = path.join(ROOT, "site/erp.html");
const SPEC = path.join(ROOT, "apps/web/lib/erp-commands.ts");

const results = [];
const ok = (name) => results.push({ name, pass: true });
const bad = (name, detail) => results.push({ name, pass: false, detail });

/**
 * Split the comma-separated items of a bracketed list, ignoring commas nested
 * inside strings, templates, comments or deeper brackets.
 *
 * `open` is the index of the opening bracket. Returns the trimmed source of
 * each top-level item, or throws if the bracket is never closed — a parse that
 * quietly gives up is how a gate ends up reporting on nothing.
 */
function splitTopLevel(src, open) {
  const pairs = { "(": ")", "[": "]", "{": "}" };
  const close = pairs[src[open]];
  if (!close) throw new Error(`expected a bracket at ${open}, found ${JSON.stringify(src[open])}`);

  const items = [];
  let depth = 0;
  let start = open + 1;
  /* Template literals nest: `${ `${x}` }` is legal, so one flag will not do. A
     stack of "what is the innermost thing we are inside" is the honest shape. */
  const stack = [];
  let i = open;

  const push = (end) => {
    const text = src.slice(start, end).trim();
    if (text) items.push(text);
    start = end + 1;
  };

  while (i < src.length) {
    i += 1;
    const c = src[i];
    const next = src[i + 1];
    const top = stack[stack.length - 1];

    if (top === "'" || top === '"') {
      if (c === "\\") i += 1;
      else if (c === top) stack.pop();
      continue;
    }
    if (top === "`") {
      if (c === "\\") i += 1;
      else if (c === "`") stack.pop();
      else if (c === "$" && next === "{") {
        stack.push("${");
        i += 1;
      }
      continue;
    }
    if (top === "//") {
      if (c === "\n") stack.pop();
      continue;
    }
    if (top === "/*") {
      if (c === "*" && next === "/") {
        stack.pop();
        i += 1;
      }
      continue;
    }

    if (c === "'" || c === '"' || c === "`") {
      stack.push(c);
      continue;
    }
    if (c === "/" && next === "/") {
      stack.push("//");
      i += 1;
      continue;
    }
    if (c === "/" && next === "*") {
      stack.push("/*");
      i += 1;
      continue;
    }
    if (c === "(" || c === "[" || c === "{") {
      depth += 1;
      continue;
    }
    if (c === ")" || c === "]" || c === "}") {
      /* A `}` that closes a `${` is not a bracket of ours. */
      if (c === "}" && top === "${") {
        stack.pop();
        continue;
      }
      if (depth === 0) {
        if (c !== close) throw new Error(`mismatched ${c} at ${i}, expected ${close}`);
        push(i);
        return items;
      }
      depth -= 1;
      continue;
    }
    if (c === "," && depth === 0) push(i);
  }
  throw new Error(`unterminated ${src[open]} opened at ${open}`);
}

/** Line number of an index, for an error somebody can act on. */
const lineOf = (src, i) => src.slice(0, i).split("\n").length;

/** The declared arity of every whitelisted command. */
function declaredArities(src) {
  const from = src.indexOf("export const COMMANDS");
  if (from < 0) throw new Error("no `export const COMMANDS` in erp-commands.ts");
  const body = src.slice(from);
  /* Entries are the two-space-indented keys of that one object. Nested objects
     are indented further, so the anchor is the indentation. */
  const re = /^ {2}([A-Za-z_$][\w$]*):\s*\{/gm;
  const hits = [...body.matchAll(re)];
  const out = new Map();
  for (let n = 0; n < hits.length; n += 1) {
    const slice = body.slice(hits[n].index, n + 1 < hits.length ? hits[n + 1].index : undefined);
    const arity = /\barity:\s*(\d+)/.exec(slice);
    if (!arity) throw new Error(`command "${hits[n][1]}" declares no arity`);
    out.set(hits[n][1], Number(arity[1]));
  }
  return out;
}

/** Every `commandMutate("name", [ … ])` the client actually performs. */
function clientCalls(src) {
  const calls = [];
  const needle = "commandMutate(";
  let at = src.indexOf(needle);
  while (at >= 0) {
    /* The declaration itself, and any mention inside a comment or a string, are
       not calls. A call is followed by a string literal naming the command. */
    const open = at + needle.length - 1;
    const before = src.slice(Math.max(0, at - 40), at);
    if (!/function\s+$/.test(before)) {
      const args = splitTopLevel(src, open);
      const name = /^"([^"]+)"$|^'([^']+)'$/.exec(args[0] || "");
      if (name) {
        const listAt = src.indexOf("[", src.indexOf(args[0], open) + args[0].length);
        calls.push({
          name: name[1] || name[2],
          count: splitTopLevel(src, listAt).length,
          line: lineOf(src, at),
        });
      }
    }
    at = src.indexOf(needle, at + needle.length);
  }
  return calls;
}

const client = fs.readFileSync(CLIENT, "utf8");
const spec = fs.readFileSync(SPEC, "utf8");
const arities = declaredArities(spec);
const calls = clientCalls(client);

/* A GATE THAT CANNOT SEE ITS SUBJECT MUST FAIL, NOT PASS QUIETLY. If the call
   sites are ever renamed or restructured this finds nothing, and finding
   nothing would otherwise read exactly like finding nothing wrong. */
if (!calls.length) {
  bad(
    "the client's commands were found at all",
    "no commandMutate(...) call sites in site/erp.html",
  );
} else {
  ok(`the client's commands were found (${calls.length} call sites)`);
}

for (const call of calls) {
  const want = arities.get(call.name);
  if (want === undefined) {
    bad(
      `erp.html:${call.line} · "${call.name}" is a command the server knows`,
      `not in the COMMANDS whitelist — known: ${[...arities.keys()].join(", ")}`,
    );
  } else if (call.count !== want) {
    bad(
      `erp.html:${call.line} · "${call.name}" sends what the server accepts`,
      `whitelist arity ${want}, client sends ${call.count}` +
        (call.count === want + 1
          ? " — one too many: the acting user comes from the session, never from the body"
          : ""),
    );
  } else {
    ok(`erp.html:${call.line} · "${call.name}" sends ${want} argument(s), as declared`);
  }
}

console.log("──── client ↔ whitelist argument check ────");
for (const r of results) {
  console.log(r.pass ? `✓ ${r.name}` : `✗ ${r.name}\n    → ${r.detail}`);
}
const failed = results.filter((r) => !r.pass);
console.log(`${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
