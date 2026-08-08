#!/usr/bin/env node
/**
 * Turn a password into the hash that goes in ERP_USERS.
 *
 *   node apps/web/scripts/hash-password.mjs ana@example.com
 *
 * Prompts for the password without echoing it, and prints the ERP_USERS entry.
 * The password is never written to disk, never printed, and never put in a
 * command-line argument — arguments are visible to every process on the machine
 * and land in your shell history, which is why this asks instead of taking one.
 */
import { randomBytes, scrypt } from "node:crypto";
import { createInterface } from "node:readline";

const N = 16384;
const R = 8;
const P = 1;

function ask(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    // Silence the echo so the password does not sit on screen behind you.
    const out = rl.output;
    let silent = false;
    out.write(question);
    rl._writeToOutput = (s) => {
      if (!silent) out.write(s);
    };
    silent = true;
    rl.question("", (answer) => {
      silent = false;
      out.write("\n");
      rl.close();
      resolve(answer);
    });
  });
}

const email = (process.argv[2] ?? "").trim().toLowerCase();
if (!email || !email.includes("@")) {
  console.error("Usage: node apps/web/scripts/hash-password.mjs <email>");
  process.exit(2);
}

if (!process.stdin.isTTY) {
  console.error("This needs a terminal, so the password can be typed without being echoed.");
  process.exit(2);
}

const password = await ask(`Password for ${email}: `);
const again = await ask("Again: ");

if (password !== again) {
  console.error("Those did not match. Nothing was written.");
  process.exit(1);
}
if (password.length < 12) {
  // Not a policy for its own sake: this account can read and change a company's
  // invoice register, and it is reachable from the internet.
  console.error("Too short — use at least 12 characters. Nothing was written.");
  process.exit(1);
}

const salt = randomBytes(16);
const key = await new Promise((resolve, reject) =>
  scrypt(password, salt, 64, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 }, (e, k) =>
    e ? reject(e) : resolve(k),
  ),
);

const entry = `${email}:scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;

console.log(
  "\nAdd this to ERP_USERS in the server's .env, in SINGLE quotes " +
    "(comma-separated for several people):\n",
);
console.log(entry);
console.log(
  "\nThe hash is not a secret in the way the password is, but it is worth guessing\n" +
    "offline — keep .env off shared machines and out of git.\n",
);
