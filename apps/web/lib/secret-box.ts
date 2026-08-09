/**
 * Encrypting a secret we have to keep, rather than a password we can hash.
 *
 * A login password is only ever compared, so it is hashed and never recovered.
 * A MAILBOX password is different in kind: the server has to present it to
 * another server, so it must be recoverable, and the only honest question is
 * what protects it while it sits still.
 *
 * AES-256-GCM, with the key derived per-secret from SESSION_SECRET and a random
 * salt. GCM rather than CBC because it authenticates as well as encrypts: a
 * tampered ciphertext fails to open instead of decrypting to plausible rubbish
 * that then gets sent somewhere as a password.
 *
 * WHAT THIS DOES AND DOES NOT BUY. It means a stolen database dump is not a
 * stolen mailbox — the key is not in the database, it is in the server's
 * environment. It does NOT protect against someone who already has the running
 * server, because that machine must be able to decrypt in order to work at all.
 * That is the ceiling for any credential a program has to use unattended, and
 * pretending otherwise would be the dishonest part.
 *
 * Rotating SESSION_SECRET makes every stored secret unopenable. That is a real
 * consequence and it is why `open` says so plainly rather than returning empty.
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { FactoryError } from "@repo/kernel";

const SALT_BYTES = 16;
const IV_BYTES = 12; // 96 bits, the size GCM is defined for
const KEY_BYTES = 32;

function masterSecret(): string {
  const secret = (process.env.SESSION_SECRET || "").trim();
  if (!secret) {
    throw new FactoryError(
      "CONFIG_INVALID",
      "SESSION_SECRET is not set, so there is nothing to encrypt a stored " +
        "password with. Refusing to keep it in plain text.",
    );
  }
  return secret;
}

function derive(salt: Buffer): Buffer {
  // scrypt, not a bare hash: it costs enough that a leaked ciphertext plus a
  // guessable SESSION_SECRET is still expensive to attack.
  return scryptSync(masterSecret(), salt, KEY_BYTES);
}

/** salt | iv | tag | ciphertext, base64. Self-describing, so nothing else has to remember the layout. */
export function seal(plaintext: string): string {
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", derive(salt), iv);
  const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([salt, iv, cipher.getAuthTag(), body]).toString("base64");
}

export function open(sealed: string): string {
  const raw = Buffer.from(sealed, "base64");
  // 16 salt + 12 iv + 16 tag = 44 bytes before a single byte of content.
  if (raw.length < SALT_BYTES + IV_BYTES + 16 + 1) {
    throw new FactoryError("CONFIG_INVALID", "Stored secret is malformed.");
  }
  const salt = raw.subarray(0, SALT_BYTES);
  const iv = raw.subarray(SALT_BYTES, SALT_BYTES + IV_BYTES);
  const tag = raw.subarray(SALT_BYTES + IV_BYTES, SALT_BYTES + IV_BYTES + 16);
  const body = raw.subarray(SALT_BYTES + IV_BYTES + 16);

  const decipher = createDecipheriv("aes-256-gcm", derive(salt), iv);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
  } catch {
    // Either the data was tampered with or SESSION_SECRET changed. Both are
    // worth naming: the second is a thing an operator does deliberately and
    // then spends an afternoon wondering why the mailbox stopped working.
    throw new FactoryError(
      "CONFIG_INVALID",
      "Could not decrypt the stored mailbox password. If SESSION_SECRET was " +
        "changed, enter the password again to store it under the new key.",
    );
  }
}
