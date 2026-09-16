/**
 * The invitation, as a DRAFT in the company mailbox.
 *
 * WHAT WAS WRONG, THREE TIMES.
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
 *     a password, on a phone, on a scaffold.
 *
 * 3 · IT WAS THE BEST-BUILT EMAIL IN THE REPOSITORY AND NOBODY ELSE GOT IT.
 *     The six-band table layout written here to answer (2) was never reachable
 *     from the customer emails, which went on shipping twelve lines of markup —
 *     so the product had two email designs, and the worse one was the one
 *     customers saw. It also had no legal foot at all: no NIF, no registered
 *     address, no Registro Mercantil entry, no confidentiality or data-
 *     protection notice, which for a Spanish S.L. writing commercially is not
 *     only unpolished but short of LSSI-CE art. 10.
 *
 * SO: the design moved to `site/erp-eml.js`, where the envelope already lived
 * and where both runtimes can reach it, and this file composes a message
 * against it like every other. What is left here is what is genuinely
 * particular to an account email — the credentials, the way in, and the
 * sentence that says to ignore it if you were not expecting it.
 *
 * IMAGES. The note that used to sit here said NO IMAGES, ANYWHERE, because a
 * remote logo is blocked by default and an inline `<svg>` is stripped by
 * Gmail. Both are still true. The mark is now a `cid:` part of the message
 * itself, which is the form those clients do render, it carries `alt` text,
 * and the wordmark beside it is live text — so a client that strips the image
 * still shows exactly the identity this file used to build out of type alone.
 *
 * `mailConfigured()` survives because the settings screen asks it.
 */

/** True when a real transport is configured. */
export function mailConfigured(): boolean {
  return Boolean(process.env.SMTP_URL?.trim() && process.env.SMTP_FROM?.trim());
}

export type InvitePurpose = "activation" | "reset";

/**
 * The shared builder — the same module the browser loads, imported the way
 * `lib/erp-engine.ts` already imports the engine. One design, one envelope.
 */
import * as Eml from "../../../site/erp-eml.js";

const SUBJECT: Record<InvitePurpose, Record<string, string>> = {
  activation: {
    es: "Su acceso a {company}",
    ca: "El seu accés a {company}",
    en: "Your access to {company}",
  },
  reset: {
    es: "Su nueva contraseña — {company}",
    ca: "La seva contrasenya nova — {company}",
    en: "Your new password — {company}",
  },
};

/** The words this message says, in the three languages the product speaks. */
const T = {
  es: {
    title: { activation: "Su acceso al ERP", reset: "Su nueva contraseña" },
    lede: {
      activation:
        "Se ha creado su cuenta en el sistema de *{company}*. Desde él se llevan los presupuestos, las obras, las horas y las facturas.",
      reset: "Se ha restablecido la contraseña de su cuenta en *{company}*.",
    },
    creds: "Sus datos de acceso",
    user: "Usuario",
    pass: "Contraseña temporal",
    credsFoot: "Es temporal y la conoce quien le ha dado de alta. Cámbiela cuando entre.",
    credsFootNone: "Elija su contraseña con el enlace del final de este mensaje.",
    enter: "Entrar",
    how: "Cómo entrar",
    stepsPass: [
      "Pulse *Entrar* aquí arriba.",
      "Escriba su correo y *pegue* la contraseña temporal.",
      "Ya dentro, cámbiela por una suya.",
    ],
    stepsLink: [
      "Abra el enlace del final de este mensaje.",
      "Elija una contraseña de al menos 10 caracteres.",
      "Entre con su correo y esa contraseña.",
    ],
    other:
      "¿Prefiere elegir su propia contraseña ahora? Use este enlace, que caduca en 7 días y sólo sirve una vez: {link}",
    ignore:
      "Si no esperaba este mensaje, puede ignorarlo: sin la contraseña nadie entra con su correo.",
    closing: "Un cordial saludo,",
    who: "Administración",
  },
  ca: {
    title: { activation: "El seu accés a l'ERP", reset: "La seva contrasenya nova" },
    lede: {
      activation:
        "S'ha creat el vostre compte al sistema de *{company}*. Des d'aquí es porten els pressupostos, les obres, les hores i les factures.",
      reset: "S'ha restablert la contrasenya del vostre compte a *{company}*.",
    },
    creds: "Les vostres dades d'accés",
    user: "Usuari",
    pass: "Contrasenya temporal",
    credsFoot: "És temporal i la coneix qui us ha donat d'alta. Canvieu-la quan entreu.",
    credsFootNone: "Trieu la contrasenya amb l'enllaç del final d'aquest missatge.",
    enter: "Entrar",
    how: "Com entrar",
    stepsPass: [
      "Premeu *Entrar* aquí dalt.",
      "Escriviu el vostre correu i *enganxeu* la contrasenya temporal.",
      "Un cop dins, canvieu-la per una de vostra.",
    ],
    stepsLink: [
      "Obriu l'enllaç del final d'aquest missatge.",
      "Trieu una contrasenya de com a mínim 10 caràcters.",
      "Entreu amb el vostre correu i aquesta contrasenya.",
    ],
    other:
      "Preferiu triar la vostra contrasenya ara? Feu servir aquest enllaç, que caduca en 7 dies i només serveix una vegada: {link}",
    ignore:
      "Si no esperàveu aquest missatge, podeu ignorar-lo: sense la contrasenya ningú no entra amb el vostre correu.",
    closing: "Ben cordialment,",
    who: "Administració",
  },
  en: {
    title: { activation: "Your access to the ERP", reset: "Your new password" },
    lede: {
      activation:
        "An account has been created for you on *{company}*'s system. Quotes, jobs, hours and invoices are all run from it.",
      reset: "The password on your *{company}* account has been reset.",
    },
    creds: "Your sign-in details",
    user: "Username",
    pass: "Temporary password",
    credsFoot:
      "It is temporary, and whoever set up your account knows it. Change it once you are in.",
    credsFootNone: "Choose your password with the link at the end of this message.",
    enter: "Sign in",
    how: "How to sign in",
    stepsPass: [
      "Press *Sign in* above.",
      "Type your email address and *paste* the temporary password.",
      "Once inside, change it to one of your own.",
    ],
    stepsLink: [
      "Open the link at the end of this message.",
      "Choose a password of at least 10 characters.",
      "Sign in with your email address and that password.",
    ],
    other:
      "Would you rather choose your own password now? Use this link — it expires in 7 days and works once: {link}",
    ignore:
      "If you were not expecting this message you can ignore it: without the password nobody can sign in as you.",
    closing: "Kind regards,",
    who: "Accounts",
  },
} as const;

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
  /** Which language the person reads. Defaults to Spanish, as the documents do. */
  lang?: string;
  /** The company's own record — name, NIF, addresses, registry entry, contact
   *  details — for the legal foot. Absent when the caller has only a name, and
   *  the foot then says what it can. */
  issuer?: unknown;
}

type Lang = keyof typeof T;
const langOf = (c: InviteContent): Lang =>
  c.lang && Object.prototype.hasOwnProperty.call(T, c.lang) ? (c.lang as Lang) : "es";

/** What the message says about the company, when the caller knows no more
 *  than its name. A footer with a name and nothing else is still a footer. */
function issuerOf(c: InviteContent): Record<string, unknown> {
  return c.issuer && typeof c.issuer === "object"
    ? (c.issuer as Record<string, unknown>)
    : { legalName: c.company, tradeName: c.company };
}

export function inviteSubject(c: InviteContent): string {
  const byLang = SUBJECT[c.purpose];
  return (byLang[langOf(c)] || byLang.es || "").replace("{company}", c.company);
}

/** The message, in the blocks the house design lays out. Built once and
 *  rendered twice, so the HTML part and the plain part cannot disagree. */
function composed(c: InviteContent): Record<string, unknown> {
  const lang = langOf(c);
  const t = T[lang];
  const fill = (s: string) => s.replace("{company}", c.company).replace("{link}", c.link);
  return {
    lang,
    subject: inviteSubject(c),
    greeting: "",
    lede: fill(t.lede[c.purpose]),
    paras: [],
    cta: { label: t.enter, href: c.loginUrl },
    /* The button is the message: everything under it is detail for somebody
       who cannot use it. */
    ctaFirst: true,
    credentials: {
      title: t.creds,
      rows: c.tempPassword
        ? [
            { k: t.user, v: c.to },
            { k: t.pass, v: c.tempPassword, big: true },
          ]
        : [{ k: t.user, v: c.to }],
      foot: c.tempPassword ? t.credsFoot : t.credsFootNone,
    },
    stepsTitle: t.how,
    steps: c.tempPassword ? [...t.stepsPass] : [...t.stepsLink],
    note: { text: fill(t.other) + "\n" + t.ignore },
    notePlace: "end",
    closing: t.closing,
    signoff: { who: t.who, company: c.company, phone: String(issuerOf(c).phone || "") },
  };
}

/**
 * The plain-text part.
 *
 * Written to be read, not as a transcription of the HTML: the same facts in the
 * order somebody scanning a phone notification needs them. The shared builder
 * does that from the same composed message the HTML part uses.
 */
export function inviteText(c: InviteContent): string {
  return (Eml as { textPart: (m: unknown, i: unknown) => string }).textPart(
    composed(c),
    issuerOf(c),
  );
}

/** The HTML part, in the house design — tables, inline styles, explicit
 *  backgrounds and a `cid:` mark. All of that lives in the shared builder. */
export function inviteHtml(c: InviteContent): string {
  return (Eml as { bodyHtml: (m: unknown, i: unknown) => string }).bodyHtml(
    composed(c),
    issuerOf(c),
  );
}

/**
 * The envelope, from the shared builder.
 *
 * It used to be written here, because `site/erp-eml.js` was «the browser's
 * copy» — and the two then drifted in exactly the way that phrasing predicts:
 * this one encoded its subject and dated its messages and the browser's did
 * neither. There is one now, it does both, and it nests a `multipart/related`
 * so the mark travels with the message.
 */
function rfc822(from: string, to: string, subject: string, text: string, html: string): string {
  const E = Eml as {
    build: (m: Record<string, unknown>) => string;
    inlineParts: () => unknown[];
  };
  return E.build({
    fromName: "",
    fromEmail: from,
    toName: "",
    toEmail: to,
    subject,
    text,
    html,
    inline: E.inlineParts(),
  });
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
 * The company's own record — what to call it, and the legal foot.
 *
 * Read from the company's own document, so a second tenant's invitation says
 * the second tenant's name.
 *
 * The same block every document in this product prints under itself — name,
 * NIF, registered address, Registro Mercantil entry, telephone, email, web. An
 * invitation used to carry none of it. Falls back to the bare name rather than
 * failing: a message that cannot be sent because the ERP document would not
 * load is a worse outcome than one with a short footer.
 */
async function companyIssuer(tenantId: string): Promise<Record<string, string>> {
  try {
    const { loadErp } = await import("./erp-runtime");
    const { erp } = await loadErp(tenantId);
    const e = erp as {
      _issuerBlock?: () => Record<string, string>;
      companyProfile?: () => Record<string, string>;
    };
    const iss = e._issuerBlock?.() || e.companyProfile?.() || {};
    return { ...iss, tradeName: iss.tradeName || iss.legalName || "Canei Subirats" };
  } catch {
    return { tradeName: "Canei Subirats", legalName: "Canei Subirats" };
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
    const iss = await companyIssuer(tenantId);
    const c = {
      ...content,
      company: content.company || iss.tradeName || "Canei Subirats",
      issuer: content.issuer || iss,
    };
    const result = await appendDraft(
      tenantId,
      rfc822(from, c.to, inviteSubject(c), inviteText(c), inviteHtml(c)),
    );
    return result.delivered
      ? { drafted: true, folder: result.folder }
      : { drafted: false, reason: result.reason };
  } catch (e) {
    return { drafted: false, reason: (e as Error)?.message || String(e) };
  }
}
