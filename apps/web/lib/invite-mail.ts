/**
 * The invitation, as a DRAFT in the company mailbox.
 *
 * WHAT WAS WRONG, TWICE.
 *
 * 1 · IT WENT NOWHERE. This file used to hold `sendInvitation`, whose only
 *     outcome was to log a line and return false — there is no SMTP in this
 *     codebase and there is not meant to be. So creating a colleague's account
 *     always ended on «No se ha enviado ningún correo». Meanwhile the product
 *     already had the answer for every other generated email: `draft-mailbox.ts`
 *     writes a finished message into the Drafts folder of the company mailbox
 *     over IMAP APPEND. Quotes go that way. Invoices go that way. Invitations
 *     were the one thing that did not, for no reason anybody had written down.
 *
 * 2 · IT LOOKED LIKE NOTHING, AND ASKED TOO MUCH. The draft was six lines of
 *     unstyled plain text with a 90-character activation URL wrapped across four
 *     of them — from a product whose every other document carries the company's
 *     identity. And the only way in was that link: open it, read a form, invent
 *     a password, on a phone, on a scaffold. The operator's verdict on seeing it
 *     in their own Drafts folder was exactly right.
 *
 * SO: a proper message, in the company's own colours, carrying the two things a
 * person needs and nothing else — a button to the sign-in page, and a temporary
 * password they can copy. `multipart/alternative`, because a mail client that
 * refuses HTML must still get a message that reads well, and because a plain
 * part is what stops the whole thing scoring as spam.
 *
 * NO IMAGES, ANYWHERE. A remote logo is blocked by default in Outlook and Gmail
 * and renders as a broken box, and an inlined one is a `cid:` attachment that
 * some clients show a paperclip for and others strip. The identity here is
 * built from type, colour and rule — which cannot be blocked.
 *
 * `mailConfigured()` survives because the settings screen asks it.
 */
import { randomBytes } from "node:crypto";

/** True when a real transport is configured. */
export function mailConfigured(): boolean {
  return Boolean(process.env.SMTP_URL?.trim() && process.env.SMTP_FROM?.trim());
}

export type InvitePurpose = "activation" | "reset";

const SUBJECT: Record<InvitePurpose, string> = {
  activation: "Su acceso a Canei Subirats",
  reset: "Su nueva contraseña — Canei Subirats",
};

/** The house palette, the same values `site/erp-ds.css` and the PDFs carry. */
const C = {
  green: "#48733c",
  deep: "#31532a",
  soft: "#e7f0e1",
  gold: "#f2c230",
  ink: "#14160f",
  body: "#3f4339",
  muted: "#7c8072",
  line: "#d8e0d1",
  panel: "#f4f8f1",
  page: "#e9eee6",
};

const SANS = "Inter,-apple-system,'Segoe UI',Helvetica,Arial,sans-serif";
const SERIF = "Georgia,'Times New Roman',serif";
const MONO = "'SF Mono',Menlo,Consolas,'Courier New',monospace";

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export interface InviteContent {
  /** Who the message is for — shown as the username to sign in with. */
  to: string;
  /** The sign-in page, where the temporary password is typed. */
  loginUrl: string;
  /** The temporary password, or "" when the account could not be given one. */
  tempPassword: string;
  /** The one-time link that lets them choose their own password instead. */
  link: string;
  purpose: InvitePurpose;
  /** What to call the company in the header and the sign-off. */
  company: string;
}

/**
 * The plain-text part.
 *
 * Written to be read, not as a transcription of the HTML: the same facts in the
 * order somebody scanning a phone notification needs them.
 */
export function inviteText(c: InviteContent): string {
  const opening =
    c.purpose === "activation"
      ? `Se ha creado su cuenta en el sistema de ${c.company}.`
      : `Se ha restablecido la contraseña de su cuenta en ${c.company}.`;
  const lines = [opening, "", "ENTRAR", c.loginUrl, "", `Usuario:  ${c.to}`];
  if (c.tempPassword) {
    lines.push(
      `Contraseña temporal:  ${c.tempPassword}`,
      "",
      "Copie la contraseña, ábrala en el enlace de arriba y péguela.",
      "Cámbiela cuando entre: es temporal y la conoce quien le ha dado de alta.",
    );
  } else {
    lines.push("", "Elija su contraseña en este enlace:", c.link);
  }
  lines.push(
    "",
    "¿Prefiere elegir su propia contraseña ahora? Use este enlace, que caduca",
    "en 7 días y sólo sirve una vez:",
    c.link,
    "",
    "Si no esperaba este mensaje, puede ignorarlo.",
    c.company,
  );
  return lines.join("\n");
}

/**
 * One row of the credentials block: a pale label over a white inset card.
 *
 * The card sits ON the green block, which is what makes it read as the thing to
 * copy rather than as more paragraph. White on green also survives every dark
 * mode: a client that inverts the page leaves an explicit background alone,
 * whereas black-on-white text with no background stated becomes white-on-white.
 */
function credential(label: string, value: string, big: boolean): string {
  return `<tr><td style="padding:0 0 12px">
    <div style="font:700 10px ${SANS};letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.72);padding:0 0 6px">${esc(label)}</div>
    <div style="font:${big ? `700 22px ${MONO}` : `600 14px ${MONO}`};letter-spacing:${big ? ".1em" : "0"};color:${C.ink};background:#ffffff;padding:${big ? "14px 16px" : "11px 14px"};word-break:break-all">${esc(value)}</div>
  </td></tr>`;
}

/**
 * The mark: the company's initials in a tile, standing in for the logo.
 *
 * A drawn mark would have to be an image, and an image in an email is either
 * blocked (remote) or stripped (inline) — see the note at the top of this file.
 * Initials in a bordered tile occupy the same corner, carry the same weight, and
 * cannot fail to load. One word gives one letter, so a company called simply
 * Paramur reads P rather than PA.
 */
function monogram(company: string): string {
  const words = company
    .replace(/[,.]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !/^(s\.?l\.?u?|s\.?a|sccl|cb)$/i.test(w));
  // Indexed reads are `string | undefined` under noUncheckedIndexedAccess, and
  // the length check above does not narrow them — so the initials are taken with
  // slice, which answers "" rather than throwing on a word that is not there.
  const first = (words[0] || "").slice(0, 1);
  const second = (words[1] || "").slice(0, 1);
  return ((second ? first + second : first) || "·").toUpperCase();
}

/** One numbered step, on the pale green band. */
function step(n: number, text: string): string {
  return `<tr>
    <td width="30" valign="top" style="padding:0 12px 10px 0">
      <div style="width:24px;height:24px;background:${C.green};font:700 12px ${SANS};color:#ffffff;text-align:center;line-height:24px">${n}</div>
    </td>
    <td valign="top" style="font:400 14px/24px ${SANS};color:${C.body};padding:0 0 10px">${text}</td>
  </tr>`;
}

/**
 * The HTML part. Tables and inline styles throughout — Outlook renders a subset
 * of CSS from 2007, so a stylesheet, flexbox or a padded `<a>` are all things
 * that work everywhere except the client half the trade actually uses.
 */
export function inviteHtml(c: InviteContent): string {
  const opening =
    c.purpose === "activation"
      ? `Se ha creado su cuenta en el sistema de <b style="color:${C.ink}">${esc(c.company)}</b>. Desde él se llevan los presupuestos, las obras, las horas y las facturas.`
      : `Se ha restablecido la contraseña de su cuenta en <b style="color:${C.ink}">${esc(c.company)}</b>.`;
  const title = c.purpose === "activation" ? "Su acceso al ERP" : "Su nueva contraseña";

  const creds = c.tempPassword
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
         ${credential("Usuario", c.to, false)}
         ${credential("Contraseña temporal", c.tempPassword, true)}
       </table>
       <div style="font:400 12.5px/19px ${SANS};color:rgba(255,255,255,.72);padding:2px 0 0">
         Es temporal y la conoce quien le ha dado de alta. Cámbiela cuando entre.
       </div>`
    : `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
         ${credential("Usuario", c.to, false)}
       </table>
       <div style="font:400 12.5px/19px ${SANS};color:rgba(255,255,255,.72)">
         Elija su contraseña con el enlace del final de este mensaje.
       </div>`;

  const steps = c.tempPassword
    ? [
        `Pulse <b style="color:${C.ink}">Entrar</b> aquí arriba.`,
        `Escriba su correo y <b style="color:${C.ink}">pegue</b> la contraseña temporal.`,
        `Ya dentro, cámbiela por una suya.`,
      ]
    : [
        `Abra el enlace del final de este mensaje.`,
        `Elija una contraseña de al menos 10 caracteres.`,
        `Entre con su correo y esa contraseña.`,
      ];

  /* BLOCKS, NOT A PAGE WITH A GREEN STRIP ON TOP.
     Six bands, alternating: deep green masthead · gold rule · white hero ·
     green credentials · pale green steps · white footnote · deep green
     sign-off. The colour is what carries the identity down the whole message
     rather than only in the first 80px, and it is what a person scrolling a
     phone actually perceives as "this is from them".

     The credentials sit on the ACCENT green with the values in white inset
     cards. That is the one thing the reader has to act on, so it gets the
     strongest contrast in the message — and a coloured block is also the only
     thing that survives a dark-mode client intact, because an explicit
     background is left alone while unstyled black-on-white is inverted into
     white-on-white.

     No border radius on the bands. A rounded card inside a rounded card is what
     Outlook renders as neither, and square blocks are the house drawing anyway
     — `erp-ds.css` sets `border-radius: 0` on every button and menu. */
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:${C.page};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">Su usuario y su contraseña para entrar en ${esc(c.company)}.</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${C.page}">
 <tr><td align="center" style="padding:24px 12px 34px">

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="620" style="width:620px;max-width:100%;background:#ffffff">

   <!-- ░░ block 1 · masthead, deep green ░░ -->
   <tr><td style="background:${C.deep};padding:30px 34px 26px">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
     <td width="46" valign="top" style="padding:0 14px 0 0">
      <div style="width:44px;height:44px;background:${C.green};border:1px solid rgba(255,255,255,.34);font:600 17px/44px ${SERIF};color:#ffffff;text-align:center">${esc(monogram(c.company))}</div>
     </td>
     <td valign="middle">
      <div style="font:600 21px/1.1 ${SERIF};color:#ffffff;letter-spacing:.06em">${esc(c.company)}</div>
      <div style="font:400 10.5px ${SANS};letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.6);padding:5px 0 0">Reformas · Sant Just Desvern</div>
     </td>
     <td align="right" valign="top"><div style="width:11px;height:11px;background:${C.gold}">&nbsp;</div></td>
    </tr></table>
   </td></tr>
   <tr><td style="height:3px;background:${C.gold};font-size:0;line-height:0">&nbsp;</td></tr>

   <!-- ░░ block 2 · the hero, white ░░ -->
   <tr><td style="padding:34px 34px 28px" align="center">
    <div style="font:700 10px ${SANS};letter-spacing:.22em;text-transform:uppercase;color:${C.green}">${c.purpose === "activation" ? "Su invitación" : "Su acceso"}</div>
    <h1 style="margin:12px 0 12px;font:600 29px/1.15 ${SERIF};color:${C.ink}">${esc(title)}</h1>
    <p style="margin:0 auto 24px;max-width:44ch;font:400 15px/24px ${SANS};color:${C.body}">${opening}</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>
     <td align="center" bgcolor="${C.green}">
      <a href="${esc(c.loginUrl)}" style="display:inline-block;padding:15px 40px;font:700 15px ${SANS};letter-spacing:.04em;color:#ffffff;text-decoration:none">Entrar &nbsp;&rsaquo;</a>
     </td>
    </tr></table>
    <div style="font:400 12px/18px ${SANS};color:${C.muted};padding:11px 0 0">o abra <a href="${esc(c.loginUrl)}" style="color:${C.green}">${esc(c.loginUrl)}</a></div>
   </td></tr>

   <!-- ░░ block 3 · the credentials, accent green ░░ -->
   <tr><td style="background:${C.green};padding:26px 34px 22px">
    <div style="font:700 10px ${SANS};letter-spacing:.22em;text-transform:uppercase;color:${C.gold};padding:0 0 14px">Sus datos de acceso</div>
    ${creds}
   </td></tr>

   <!-- ░░ block 4 · how, pale green ░░ -->
   <tr><td style="background:${C.soft};padding:24px 34px 18px">
    <div style="font:700 10px ${SANS};letter-spacing:.22em;text-transform:uppercase;color:${C.deep};padding:0 0 14px">Cómo entrar</div>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
     ${steps.map((t, i) => step(i + 1, t)).join("")}
    </table>
   </td></tr>

   <!-- ░░ block 5 · the other way in, white ░░ -->
   <tr><td style="padding:24px 34px 26px">
    <div style="font:400 12.5px/20px ${SANS};color:${C.muted}">
     ¿Prefiere elegir su propia contraseña ahora? Use este enlace — caduca en 7 días y sólo sirve una vez:<br>
     <a href="${esc(c.link)}" style="color:${C.green};word-break:break-all">${esc(c.link)}</a>
    </div>
   </td></tr>

   <!-- ░░ block 6 · sign-off, deep green ░░ -->
   <tr><td style="background:${C.deep};padding:22px 34px 24px">
    <div style="font:600 13px ${SERIF};color:#ffffff;letter-spacing:.06em">${esc(c.company)}</div>
    <div style="font:400 11.5px/18px ${SANS};color:rgba(255,255,255,.6);padding:5px 0 0">
     Si no esperaba este mensaje, puede ignorarlo — sin la contraseña nadie entra con su correo.
    </div>
   </td></tr>

  </table>
 </td></tr>
</table>
</body></html>`;
}

/**
 * RFC 822, built here because this runs on the server and `site/erp-eml.js` is
 * the browser's copy. Base64 for every part and RFC 2047 for the subject: both
 * carry accents, and a raw 8-bit header is the kind of thing one mail server in
 * five rejects and the other four render as mojibake.
 */
function rfc822(from: string, to: string, subject: string, text: string, html: string): string {
  const b64 = (s: string) =>
    Buffer.from(s, "utf8")
      .toString("base64")
      .replace(/(.{76})/g, "$1\r\n");
  const subj = "=?UTF-8?B?" + Buffer.from(subject, "utf8").toString("base64") + "?=";
  // Random, because a fixed boundary that happens to occur in the body ends the
  // part early — and the body here is HTML somebody may one day paste into.
  const bnd = "--canei-" + randomBytes(12).toString("hex");
  return [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subj}`,
    `Date: ${new Date().toUTCString()}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${bnd}"`,
    "",
    // Least-preferred part first: that is what `alternative` means, and a client
    // shows the LAST part it understands.
    `--${bnd}`,
    'Content-Type: text/plain; charset="utf-8"',
    "Content-Transfer-Encoding: base64",
    "",
    b64(text),
    "",
    `--${bnd}`,
    'Content-Type: text/html; charset="utf-8"',
    "Content-Transfer-Encoding: base64",
    "",
    b64(html),
    "",
    `--${bnd}--`,
    "",
  ].join("\r\n");
}

export interface InviteResult {
  /** True only when the message is actually sitting in the Drafts folder. */
  drafted: boolean;
  /** Which folder it landed in, when it landed. */
  folder?: string;
  /** Why it did not, when it did not. */
  reason?: string;
}

/**
 * What to call the company in the message.
 *
 * Read from the company's own record, so a second tenant's invitation says the
 * second tenant's name. Falls back rather than failing: an invitation that
 * cannot be sent because the ERP document would not load is a worse outcome
 * than one signed with the product's own name.
 */
async function companyName(tenantId: string): Promise<string> {
  try {
    const { loadErp } = await import("./erp-runtime");
    const { erp } = await loadErp(tenantId);
    const c = (erp as { companyProfile?: () => Record<string, string> }).companyProfile?.() || {};
    return (c.tradeName || c.legalName || "").trim() || "Canei Subirats";
  } catch {
    return "Canei Subirats";
  }
}

/**
 * File the invitation as a DRAFT in the company mailbox.
 *
 * WHY A DRAFT AND NOT A SEND. This codebase has no SMTP and the mandate forbids
 * real mail leaving; IMAP APPEND writes into a folder the company owns, and the
 * operator presses send themselves in their own client. That is the same route
 * every other generated email in the product already takes.
 *
 * Never throws. A mailbox that is down must not lose the account that was just
 * created: the credentials still come back and the screen still shows them.
 */
export async function draftInvitation(
  tenantId: string,
  content: InviteContent,
): Promise<InviteResult> {
  try {
    const { appendDraft, mailboxConfig, mailboxConfigured } = await import("./draft-mailbox");
    if (!(await mailboxConfigured(tenantId))) {
      return {
        drafted: false,
        reason: "No hay buzón configurado todavía. Conéctalo en Configuración → Empresa.",
      };
    }
    const from = (await mailboxConfig(tenantId))?.from || "";
    const c = { ...content, company: content.company || (await companyName(tenantId)) };
    const result = await appendDraft(
      tenantId,
      rfc822(from, c.to, SUBJECT[c.purpose], inviteText(c), inviteHtml(c)),
    );
    return result.delivered
      ? { drafted: true, folder: result.folder }
      : { drafted: false, reason: result.reason };
  } catch (e) {
    return { drafted: false, reason: (e as Error)?.message || String(e) };
  }
}
