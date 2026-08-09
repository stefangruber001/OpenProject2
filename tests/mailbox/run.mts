/**
 * Proves the draft mailbox adapter against a real IMAP conversation.
 *
 * The live mailbox cannot be part of this: its password is the operator's and
 * must never be in a repository or a test. So a stub IMAP server stands in and
 * records exactly what the adapter said to it — which is the interesting half
 * anyway. What matters is not "does Hostinger work", it is "do we send a
 * well-formed APPEND, into the folder the server says is Drafts, carrying the
 * \Draft flag, with the sender rewritten to the company address".
 *
 * Every one of those has a failure mode that looks like success from the
 * outside: a draft filed as an ordinary message, a draft in the wrong folder,
 * a draft from an address the account cannot send as.
 *
 * Run:  pnpm exec tsx tests/mailbox/run.ts
 */
import { createServer, type Socket } from "node:net";
import { once } from "node:events";

interface Session {
  commands: string[];
  appended: { folder: string; flags: string; message: string } | null;
  loggedInAs: string | null;
}

/**
 * Just enough IMAP to hold a conversation: greeting, capabilities, login, a
 * folder list with a special-use Drafts, and APPEND with a literal.
 */
function startImapStub(session: Session) {
  const server = createServer((socket: Socket) => {
    let buffer = "";
    /** Set while we are waiting for the bytes of an APPEND literal. */
    let literal: { tag: string; folder: string; flags: string; bytes: number } | null = null;

    const send = (line: string) => socket.write(line + "\r\n");
    send("* OK [CAPABILITY IMAP4rev1 AUTH=PLAIN] stub ready");

    socket.on("data", (chunk) => {
      buffer += chunk.toString("binary");

      for (;;) {
        if (literal) {
          if (Buffer.byteLength(buffer, "binary") < literal.bytes) return;
          const message = Buffer.from(buffer.slice(0, literal.bytes), "binary").toString("utf8");
          buffer = buffer.slice(literal.bytes);
          session.appended = { folder: literal.folder, flags: literal.flags, message };
          send(`${literal.tag} OK [APPENDUID 1 1] APPEND completed`);
          literal = null;
          // The trailing CRLF after the literal.
          buffer = buffer.replace(/^\r?\n/, "");
          continue;
        }

        const nl = buffer.indexOf("\r\n");
        if (nl < 0) return;
        const line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 2);
        session.commands.push(line);

        const [tag, verb = "", ...rest] = line.split(" ");
        const command = verb.toUpperCase();

        if (command === "CAPABILITY") {
          send("* CAPABILITY IMAP4rev1 AUTH=PLAIN SPECIAL-USE");
          send(`${tag} OK CAPABILITY completed`);
        } else if (command === "LOGIN") {
          session.loggedInAs = rest[0]?.replace(/"/g, "") ?? null;
          send(`${tag} OK LOGIN completed`);
        } else if (command === "NAMESPACE") {
          send('* NAMESPACE (("" ".")) NIL NIL');
          send(`${tag} OK NAMESPACE completed`);
        } else if (command === "AUTHENTICATE") {
          send("+ ");
          session.loggedInAs = "(sasl)";
          send(`${tag} OK AUTHENTICATE completed`);
        } else if (command === "LIST" || command === "XLIST") {
          // Honour the reference argument. imapflow issues more than one LIST,
          // and a stub that replies with the whole tree every time makes the
          // client nest the results into paths no server would ever return —
          // which looked exactly like an adapter bug for a while.
          const reference = (rest[0] ?? '""').replace(/"/g, "");
          if (reference === "") {
            send('* LIST (\\HasNoChildren) "." "INBOX"');
            // Named unlike the obvious guess on purpose: an adapter that assumes
            // "Drafts" would file the message into a folder that does not exist,
            // or create one the operator never looks at.
            send('* LIST (\\HasNoChildren \\Drafts) "." "INBOX.Borradores"');
            send('* LIST (\\HasNoChildren \\Sent) "." "INBOX.Sent"');
          }
          send(`${tag} OK LIST completed`);
        } else if (command === "APPEND") {
          const match = /^APPEND\s+("[^"]+"|\S+)\s*(\([^)]*\))?\s*(?:"[^"]*"\s*)?\{(\d+)\+?\}$/i.exec(
            line.slice(tag.length + 1),
          );
          if (!match) {
            send(`${tag} BAD could not parse APPEND: ${line}`);
            continue;
          }
          literal = {
            tag,
            folder: match[1]!.replace(/"/g, ""),
            flags: (match[2] ?? "").trim(),
            bytes: Number(match[3]),
          };
          send("+ Ready for literal data");
        } else if (command === "LOGOUT") {
          send("* BYE stub signing off");
          send(`${tag} OK LOGOUT completed`);
          socket.end();
        } else {
          // ID, ENABLE, NAMESPACE and anything else imapflow decides to try.
          send(`${tag} OK ${command} completed`);
        }
      }
    });
    socket.on("error", () => {});
  });
  return server;
}

const results: Array<{ label: string; ok: boolean }> = [];
const check = (label: string, ok: boolean, detail = "") => {
  results.push({ label, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? "  — " + detail : ""}`);
};

const session: Session = { commands: [], appended: null, loggedInAs: null };
const server = startImapStub(session);
server.listen(0, "127.0.0.1");
await once(server, "listening");
const { port } = server.address() as { port: number };

process.env.ERP_MAIL_IMAP_HOST = "127.0.0.1";
process.env.ERP_MAIL_IMAP_PORT = String(port);
process.env.ERP_MAIL_USER = "if@2iberia.com";
process.env.ERP_MAIL_PASSWORD = "stub-password-not-a-real-one";
process.env.ERP_MAIL_FROM = "if@2iberia.com";
process.env.ERP_MAIL_DRAFTS = "";

const { appendDraftWith, mailboxFromEnv, mailFrom, withSender } = await import(
  "../../apps/web/lib/draft-mailbox.ts"
);

// ── The sender rewrite, on its own ──────────────────────────────────────────
{
  const eml = "From: Canei Subirats <hola@caneisubirats.com>\r\nTo: a@b.com\r\n\r\nBody From: x\r\n";
  const out = withSender(eml, "if@2iberia.com");
  check(
    "sender rewritten, display name kept",
    out.includes("From: Canei Subirats <if@2iberia.com>"),
    out.split("\r\n")[0],
  );
  check("the body is left alone", out.includes("Body From: x"));
  check("only one From header remains", (out.match(/^From:/gim) || []).length === 1);
}
{
  const out = withSender("Subject: no sender\r\n\r\nhi\r\n", "if@2iberia.com");
  check("a message with no From gets one", out.startsWith("From: if@2iberia.com\r\n"));
}

// ── The real conversation ───────────────────────────────────────────────────
check("mailbox reports itself configured", mailboxFromEnv() !== null);
check("the from address is the configured one", mailFrom() === "if@2iberia.com");

const message = [
  "From: Canei Subirats <hola@caneisubirats.com>",
  "To: Cliente <cliente@example.com>",
  "Subject: Presupuesto P-2026-0001",
  "X-Unsent: 1",
  "",
  "Adjunto el presupuesto.",
  "",
].join("\r\n");

const result = await appendDraftWith(mailboxFromEnv()!, message);

check("the adapter reports delivery", result.delivered === true);
check(
  "it asked the server which folder is Drafts, and believed the answer",
  result.folder === "INBOX.Borradores",
  String(result.folder),
);
check("it authenticated", session.loggedInAs !== null, String(session.loggedInAs));
check("something was appended", session.appended !== null);
check(
  "the message carries the \\Draft flag",
  !!session.appended && /\\Draft/i.test(session.appended.flags),
  session.appended?.flags,
);
check(
  "the appended message is from the company mailbox",
  !!session.appended && session.appended.message.includes("From: Canei Subirats <if@2iberia.com>"),
  session.appended?.message.split("\r\n")[0],
);
check(
  "the subject and body survived the round trip",
  !!session.appended &&
    session.appended.message.includes("Subject: Presupuesto P-2026-0001") &&
    session.appended.message.includes("Adjunto el presupuesto."),
);
check(
  "no password appears in anything the adapter returned",
  !JSON.stringify(result).includes("stub-password-not-a-real-one"),
);

// ── Finding the server, and knowing when we have found it ───────────────────
//
// The operator should not have to know their provider's IMAP hostname, and the
// consequence of getting this wrong is not a cosmetic error message: a "host
// not found" for a correct password reads as a wrong password, and the operator
// goes and resets a working mailbox. So two things are asserted — that a typed
// host is obeyed exactly, and that a server refusing the credential is told
// apart from a server that was never there.
{
  const { imapCandidates, isAuthFailure } = await import("../../apps/web/lib/draft-mailbox.ts");

  const typed = await imapCandidates("if@2iberia.com", "  imap.hostinger.com  ");
  check(
    "a typed host is used alone, trimmed, with no guessing around it",
    typed.length === 1 && typed[0] === "imap.hostinger.com",
    typed.join(", "),
  );
  check("a non-address yields nothing to try", (await imapCandidates("nonsense")).length === 0);

  /** A server that refuses the login. `hangUp` covers the hosts that drop the
   *  connection instead of replying — where the rejection says only "Unexpected
   *  close" and the auth failure is only visible on the emitted error. */
  const startRefuser = (hangUp: boolean) =>
    createServer((socket: Socket) => {
      let buf = "";
      let pending = "";
      socket.write("* OK [CAPABILITY IMAP4rev1 AUTH=PLAIN] stub ready\r\n");
      socket.on("data", (chunk) => {
        buf += chunk.toString("binary");
        for (;;) {
          const nl = buf.indexOf("\r\n");
          if (nl < 0) return;
          const line = buf.slice(0, nl);
          buf = buf.slice(nl + 2);

          // The base64 SASL payload answering our "+" continuation.
          if (pending) {
            const tag = pending;
            pending = "";
            if (hangUp) return void socket.destroy();
            socket.write(`${tag} NO [AUTHENTICATIONFAILED] Invalid credentials\r\n`);
            continue;
          }

          const [tag, verb = ""] = line.split(" ");
          const command = verb.toUpperCase();
          if (command === "CAPABILITY") {
            socket.write("* CAPABILITY IMAP4rev1 AUTH=PLAIN\r\n");
            socket.write(`${tag} OK CAPABILITY completed\r\n`);
          } else if (command === "AUTHENTICATE") {
            pending = tag!;
            socket.write("+ \r\n");
          } else if (command === "LOGIN") {
            if (hangUp) return void socket.destroy();
            socket.write(`${tag} NO [AUTHENTICATIONFAILED] Invalid credentials\r\n`);
          } else {
            socket.write(`${tag} OK ${command} completed\r\n`);
          }
        }
      });
      socket.on("error", () => {});
    });

  for (const hangUp of [false, true]) {
    const refuser = startRefuser(hangUp);
    refuser.listen(0, "127.0.0.1");
    await once(refuser, "listening");
    const how = hangUp ? "hangs up after refusing" : "replies NO";

    let refusedError: unknown = null;
    try {
      await appendDraftWith(
        {
          from: "if@2iberia.com",
          host: "127.0.0.1",
          port: (refuser.address() as { port: number }).port,
          user: "if@2iberia.com",
          password: "wrong-password",
          drafts: "",
        },
        message,
      );
    } catch (e) {
      refusedError = e;
    }
    check(`a refused credential is an error (${how})`, refusedError !== null);
    check(
      `a server that refuses is recognised as an auth failure (${how})`,
      isAuthFailure(refusedError),
      (refusedError as Error)?.message?.slice(0, 70),
    );
    refuser.close();
  }

  // The direction that matters most: nothing listening must NOT be reported as
  // a bad password, or the caller stops looking for the real server and the
  // operator is told to fix a password that was never wrong.
  let unreachableError: unknown = null;
  try {
    await appendDraftWith(
      {
        from: "if@2iberia.com",
        host: "127.0.0.1",
        port: 1,
        user: "if@2iberia.com",
        password: "wrong-password",
        drafts: "",
      },
      message,
    );
  } catch (e) {
    unreachableError = e;
  }
  check("an unreachable host is an error", unreachableError !== null);
  check(
    "an unreachable host is NOT mistaken for a bad password",
    !isAuthFailure(unreachableError),
    (unreachableError as Error)?.message?.slice(0, 70),
  );
}

// ── Sending: the rules, which matter more than the socket ───────────────────
//
// A draft in the wrong folder is an inconvenience. A sent email is in somebody
// else's inbox and cannot be recalled, so every one of these is a case where
// being wrong costs the company something it cannot get back.
{
  const {
    isAllowed,
    policyFrom,
    recipientsOf,
    refuseToSend,
    smtpHostFor,
    SEND_OFF,
  } = await import("../../apps/web/lib/mail-send.ts");

  const letter = (to: string, extra = "") =>
    [`From: Canei <if@2iberia.com>`, `To: ${to}`, extra, "Subject: Presupuesto", "", "Hola.", ""]
      .filter((l) => l !== "")
      .join("\r\n");

  // Where SMTP lives, derived from the mailbox we already have.
  check("smtp host derived from the imap host", smtpHostFor("imap.hostinger.com") === "smtp.hostinger.com");
  check("gmail derives correctly", smtpHostFor("imap.gmail.com") === "smtp.gmail.com");
  check(
    "office365 is not imap.-prefixed and is handled by name",
    smtpHostFor("outlook.office365.com") === "smtp.office365.com",
  );

  // Recipient extraction. An allowlist that misses a recipient is not an
  // allowlist.
  check(
    "recipients are read from To, Cc and Bcc",
    JSON.stringify(
      recipientsOf(
        "From: a@b.com\r\nTo: One <one@x.com>, two@x.com\r\nCc: three@y.com\r\nBcc: four@z.com\r\nSubject: s\r\n\r\nbody five@nope.com\r\n",
      ).sort(),
    ) === JSON.stringify(["four@z.com", "one@x.com", "three@y.com", "two@x.com"]),
  );
  check(
    "a recipient list folded across lines is still read",
    recipientsOf("To: one@x.com,\r\n three@y.com\r\nSubject: s\r\n\r\nbody\r\n").length === 2,
  );

  // The default, and the meaning of "I did not say".
  check("the default policy is off", SEND_OFF.enabled === false);
  check("an absent policy is off", policyFrom(undefined).enabled === false);
  check("a truthy-but-not-true stored value does not enable sending", policyFrom({ enabled: "yes" }).enabled === false);
  check(
    "an empty allowlist does not mean everyone",
    !isAllowed("stranger@example.com", policyFrom({ enabled: true }), "if@2iberia.com"),
  );
  check(
    "the mailbox may always write to itself",
    isAllowed("if@2iberia.com", policyFrom({ enabled: true }), "if@2iberia.com"),
  );
  check(
    "an @domain entry covers that domain",
    isAllowed("bob@cliente.es", policyFrom({ enabled: true, allowlist: ["@cliente.es"] }), "if@2iberia.com"),
  );
  check(
    "an @domain entry does NOT cover a lookalike domain",
    !isAllowed(
      "bob@notcliente.es.evil.com",
      policyFrom({ enabled: true, allowlist: ["@cliente.es"] }),
      "if@2iberia.com",
    ),
  );

  // The decision, end to end.
  const on = policyFrom({ enabled: true, allowlist: ["cliente@example.com"], hourlyLimit: 3 });
  check(
    "with sending off, an otherwise perfect message is refused",
    refuseToSend(letter("cliente@example.com"), policyFrom({}), "if@2iberia.com", [], 0)?.code ===
      "DISABLED",
  );
  check(
    "an allowed recipient passes",
    refuseToSend(letter("cliente@example.com"), on, "if@2iberia.com", [], 0) === null,
  );
  check(
    "an unapproved recipient is refused by name",
    refuseToSend(letter("stranger@example.com"), on, "if@2iberia.com", [], 0)?.code ===
      "NOT_ALLOWED",
  );
  check(
    "one bad recipient among good ones blocks the whole message",
    refuseToSend(
      letter("cliente@example.com", "Bcc: stranger@example.com"),
      on,
      "if@2iberia.com",
      [],
      0,
    )?.code === "NOT_ALLOWED",
  );
  check(
    "a message with no recipient is refused",
    refuseToSend("From: a@b.com\r\nSubject: s\r\n\r\nhi\r\n", on, "if@2iberia.com", [], 0)?.code ===
      "NO_RECIPIENTS",
  );

  // The rate limit is the rail that catches a loop, which is the failure that
  // actually costs a company its mail reputation.
  const now = 1_000_000_000_000;
  const threeJustNow = [now - 1000, now - 2000, now - 3000];
  check(
    "the hourly limit refuses the message after it",
    refuseToSend(letter("cliente@example.com"), on, "if@2iberia.com", threeJustNow, now)?.code ===
      "RATE_LIMITED",
  );
  check(
    "sends older than an hour do not count against it",
    refuseToSend(
      letter("cliente@example.com"),
      on,
      "if@2iberia.com",
      threeJustNow.map((t) => t - 60 * 60 * 1000),
      now,
    ) === null,
  );
}

// ── Sending: what actually goes on the wire ─────────────────────────────────
//
// The rules above are pure functions and easy to get right. This is the part
// that talks to a mail server, and the failure it hides is the worst kind: a
// message that is accepted but is not the message the operator reviewed.
{
  const { sendViaSmtp } = await import("../../apps/web/lib/mail-send.ts");

  const smtp = {
    mailFrom: "",
    rcptTo: [] as string[],
    /** After un-stuffing — what the recipient would read. */
    data: "",
    /** Before un-stuffing — the literal bytes on the wire. Kept separately
     *  because an assertion made against `data` cannot tell a stuffed line from
     *  an unstuffed one: both arrive as `.signature` once we have undone it.
     *  Checking only `data` would pass whether or not the client escaped
     *  anything, which is a test that agrees with us for no reason. */
    wire: "",
    authenticated: false,
  };

  const smtpStub = createServer((socket: Socket) => {
    let buf = "";
    let inData = false;
    let expectAuth = false;
    const send = (line: string) => socket.write(line + "\r\n");
    send("220 stub ESMTP ready");

    socket.on("data", (chunk) => {
      buf += chunk.toString("utf8");
      for (;;) {
        const nl = buf.indexOf("\r\n");
        if (nl < 0) return;
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 2);

        if (inData) {
          if (line === ".") {
            inData = false;
            send("250 2.0.0 Ok: queued as STUB1");
            continue;
          }
          smtp.wire += line + "\r\n";
          // Undo dot-stuffing, exactly as a real server must.
          smtp.data += (line.startsWith("..") ? line.slice(1) : line) + "\r\n";
          continue;
        }
        if (expectAuth) {
          expectAuth = false;
          smtp.authenticated = true;
          send("235 2.7.0 Authentication successful");
          continue;
        }

        const verb = line.split(" ")[0]!.toUpperCase();
        if (verb === "EHLO" || verb === "HELO") {
          send("250-stub");
          send("250-AUTH PLAIN LOGIN");
          send("250 8BITMIME");
        } else if (verb === "AUTH") {
          if (line.trim().split(/\s+/).length > 2) {
            smtp.authenticated = true;
            send("235 2.7.0 Authentication successful");
          } else {
            expectAuth = true;
            send("334 ");
          }
        } else if (verb === "MAIL") {
          smtp.mailFrom = /<([^>]*)>/.exec(line)?.[1] ?? "";
          send("250 2.1.0 Ok");
        } else if (verb === "RCPT") {
          smtp.rcptTo.push(/<([^>]*)>/.exec(line)?.[1] ?? "");
          send("250 2.1.5 Ok");
        } else if (verb === "DATA") {
          inData = true;
          send("354 End data with <CR><LF>.<CR><LF>");
        } else if (verb === "QUIT") {
          send("221 2.0.0 Bye");
          socket.end();
        } else {
          send("250 2.0.0 Ok");
        }
      }
    });
    socket.on("error", () => {});
  });
  smtpStub.listen(0, "127.0.0.1");
  await once(smtpStub, "listening");
  const smtpPort = (smtpStub.address() as { port: number }).port;

  const outgoing = [
    "From: Canei Subirats <if@2iberia.com>",
    "To: Cliente <cliente@example.com>",
    "Subject: Presupuesto P-2026-0001",
    'Content-Type: text/plain; charset="utf-8"',
    "",
    "Adjunto el presupuesto.",
    ".signature line that must survive dot-stuffing",
    "",
  ].join("\r\n");

  let sendError: unknown = null;
  try {
    await sendViaSmtp(
      {
        from: "if@2iberia.com",
        host: "imap.example.com",
        port: 993,
        user: "if@2iberia.com",
        password: "stub-password-not-a-real-one",
        drafts: "",
      },
      outgoing,
      ["cliente@example.com"],
      { host: "127.0.0.1", port: smtpPort },
    );
  } catch (e) {
    sendError = e;
  }

  check("the send completed", sendError === null, (sendError as Error)?.message?.slice(0, 90));
  check("it authenticated before sending", smtp.authenticated);
  check(
    "the envelope sender is the company mailbox",
    smtp.mailFrom === "if@2iberia.com",
    smtp.mailFrom,
  );
  check(
    "the envelope recipient is the one we approved, and only that one",
    JSON.stringify(smtp.rcptTo) === JSON.stringify(["cliente@example.com"]),
    smtp.rcptTo.join(", "),
  );
  check(
    "the message that arrived is the message we composed",
    smtp.data.includes("Subject: Presupuesto P-2026-0001") &&
      smtp.data.includes("Adjunto el presupuesto."),
  );
  // Two halves of one fact: the client escaped the line on the wire, AND the
  // server got the original back. Either alone is satisfied by doing nothing.
  check(
    "a leading dot is escaped on the wire, so it cannot end the message early",
    smtp.wire.includes("\r\n..signature line that must survive dot-stuffing\r\n"),
  );
  check(
    "and un-escaping yields exactly what was composed",
    smtp.data.includes("\r\n.signature line that must survive dot-stuffing\r\n"),
  );
  check(
    "no password reached the message body",
    !smtp.data.includes("stub-password-not-a-real-one"),
  );
  smtpStub.close();
}

// ── Not configured must be loud, not a quiet success ────────────────────────
{
  delete process.env.ERP_MAIL_PASSWORD;
  // The module reads env per call, so this takes effect without a reload.
  check("with no password, the environment yields no mailbox", mailboxFromEnv() === null);
}

// ── The password is never stored in the clear ───────────────────────────────
{
  process.env.SESSION_SECRET = "a-test-session-secret-long-enough";
  const { seal, open } = await import("../../apps/web/lib/secret-box.ts");
  const secret = "p@ss$word \"with\" 'quotes' & $HOME";
  const sealed = seal(secret);
  check("the sealed form does not contain the password", !sealed.includes("p@ss"));
  check("it round-trips exactly", open(sealed) === secret);
  check("two seals of the same secret differ", seal(secret) !== seal(secret));

  const tampered = Buffer.from(sealed, "base64");
  tampered[tampered.length - 1] ^= 0xff;
  let refused = false;
  try {
    open(tampered.toString("base64"));
  } catch {
    refused = true;
  }
  check("a tampered secret is refused, not silently decrypted", refused);

  process.env.SESSION_SECRET = "a-completely-different-secret-value";
  let rotated = false;
  try {
    open(sealed);
  } catch {
    rotated = true;
  }
  check("rotating SESSION_SECRET makes it unopenable, and says so", rotated);
}

server.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
