/* =============================================================================
   CaneiEml — one .eml builder, and ONE email design, for every message this
   system files or downloads.

   WHY THIS FILE EXISTS. journey.html has built RFC 822 drafts since S19 and
   erp.html since N2 (every generated email lands in the company mailbox's
   Drafts). Two copies of MIME assembly would disagree within a month —
   boundary quoting, base64 line length, the X-Unsent header that makes a mail
   client open the file as an editable draft — so the assembly lives here and
   every caller uses it.

   WHY THE DESIGN LIVES HERE TOO. It did not, and the result is worth writing
   down. This repository grew THREE email designs: a six-band table layout in
   apps/web/lib/invite-mail.ts for the two account emails, four approved
   mockups in site/documentos/01-cliente/17–20 that nothing rendered, and the
   twelve lines below that every customer actually received — a mark, a name,
   the paragraphs and one rule over two lines of contact detail. The weakest of
   the three was the one that shipped, for two years, because it was the only
   one wired to the send path. So the design is now part of the same module as
   the envelope, in the same file both runtimes already load, and a message
   that does not go through it does not get sent.

   WHAT IT BUILDS.

     multipart/mixed
       multipart/related          ← so the mark can be a cid: image
         multipart/alternative
           text/plain             ← written to be read, not transcribed
           text/html
         image/png (inline)
       application/pdf …          ← the documents

   `X-Unsent: 1` is what tells Outlook and Apple Mail this is a draft to
   finish, not a message to display.

   THE THREE RULES THE MARKUP OBEYS, none of them cosmetic:
     · tables and inline styles only — Outlook on Windows lays out with Word's
       engine, which has no flexbox and often no <style> block;
     · every band states its own background — a client that force-inverts for
       dark mode leaves an explicit background alone, while unstyled
       black-on-white becomes white-on-white;
     · the mark is a cid: attachment with alt text AND the wordmark is live
       text beside it — a remote image is blocked by default in Gmail and
       Outlook, an inline <svg> is stripped by Gmail, and the worst case here
       is the identity we already shipped.
   ========================================================================== */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.CaneiEml = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /** UTF-8 text → base64 (btoa alone corrupts anything past Latin-1). */
  const textToB64 = (t) => btoa(unescape(encodeURIComponent(t)));

  /** RFC 2045: base64 bodies wrap at 76 characters. */
  const chunk = (s) => s.replace(/.{1,76}/g, "$&\r\n").trimEnd();

  /** A display name is quoted so a comma in «Canei Subirats, S.L.» does not
   *  split the address in two. */
  const addr = (name, email) =>
    name ? '"' + String(name).replace(/"/g, "'") + '" <' + email + ">" : email;

  /**
   * RFC 2047 for the Subject line.
   *
   * WHY. `Subject:` used to be written raw, and three of the six standard
   * subjects carry «—» or «¿» — so every draft this browser built went out
   * with an 8-bit header, which one mail server in five rejects and the rest
   * render as mojibake. The server-side composer had always done this
   * correctly; the browser one had not, and nothing compared them.
   *
   * Encoded words are capped at 75 characters INCLUDING the delimiters, so the
   * source is split first — by code point, because a chunk that ends in the
   * middle of a multi-byte character decodes to a replacement glyph.
   */
  function encodeHeader(s) {
    const v = String(s || "");
    if (!/[^\x20-\x7E]/.test(v)) return v;
    const bytes = (t) => unescape(encodeURIComponent(t)).length;
    const words = [];
    let buf = "";
    for (const ch of v) {
      // 75 − "=?UTF-8?B?" (10) − "?=" (2) = 63 base64 chars = 45 source bytes.
      if (bytes(buf + ch) > 45) {
        words.push(buf);
        buf = "";
      }
      buf += ch;
    }
    if (buf) words.push(buf);
    return words.map((w) => "=?UTF-8?B?" + textToB64(w) + "?=").join("\r\n ");
  }

  /**
   * The draft.
   *
   * `m` = { fromName, fromEmail, toName, toEmail, subject, text, html, date?,
   *         attachments: [{ name, b64, mime? }],
   *         inline:      [{ cid, b64, mime? }] }
   *
   * `date` exists so a generator can produce a byte-stable message; live sends
   * leave it out and get now.
   */
  function build(m) {
    const CRLF = "\r\n";
    const bnd = "CANEI_" + Math.random().toString(36).slice(2, 10);
    const inline = (m.inline || []).filter((p) => p && p.cid && p.b64);
    let s = "";
    s += "From: " + addr(m.fromName, m.fromEmail) + CRLF;
    s += "To: " + addr(m.toName, m.toEmail) + CRLF;
    s += "Subject: " + encodeHeader(m.subject || "") + CRLF;
    s += "Date: " + (m.date || new Date().toUTCString()) + CRLF;
    s += "X-Unsent: 1" + CRLF;
    s += "MIME-Version: 1.0" + CRLF;
    s += 'Content-Type: multipart/mixed; boundary="' + bnd + '"' + CRLF + CRLF;

    s += "--" + bnd + CRLF;
    s += 'Content-Type: multipart/related; boundary="' + bnd + '_r"' + CRLF + CRLF;
    s += "--" + bnd + "_r" + CRLF;
    s += 'Content-Type: multipart/alternative; boundary="' + bnd + '_a"' + CRLF + CRLF;
    s += "--" + bnd + "_a" + CRLF;
    s += 'Content-Type: text/plain; charset="utf-8"' + CRLF;
    s += "Content-Transfer-Encoding: base64" + CRLF + CRLF;
    s += chunk(textToB64(m.text || "")) + CRLF + CRLF;
    s += "--" + bnd + "_a" + CRLF;
    s += 'Content-Type: text/html; charset="utf-8"' + CRLF;
    s += "Content-Transfer-Encoding: base64" + CRLF + CRLF;
    s += chunk(textToB64(m.html || "")) + CRLF + CRLF;
    s += "--" + bnd + "_a--" + CRLF + CRLF;

    for (const p of inline) {
      s += "--" + bnd + "_r" + CRLF;
      s += "Content-Type: " + (p.mime || "image/png") + CRLF;
      s += "Content-Transfer-Encoding: base64" + CRLF;
      s += "Content-ID: <" + p.cid + ">" + CRLF;
      s += 'Content-Disposition: inline; filename="' + p.cid + '"' + CRLF + CRLF;
      s += chunk(p.b64) + CRLF + CRLF;
    }
    s += "--" + bnd + "_r--" + CRLF + CRLF;

    for (const a of m.attachments || []) {
      const mime = a.mime || "application/pdf";
      s += "--" + bnd + CRLF;
      s += "Content-Type: " + mime + '; name="' + a.name + '"' + CRLF;
      s += "Content-Transfer-Encoding: base64" + CRLF;
      s += 'Content-Disposition: attachment; filename="' + a.name + '"' + CRLF + CRLF;
      s += chunk(a.b64) + CRLF + CRLF;
    }
    s += "--" + bnd + "--" + CRLF;
    return s;
  }

  /** HTML-escape. The module's own, because this file must work in Node as
   *  well as in a page — the sample-email generator runs it headless. The
   *  apostrophe is escaped too: attribute values here are double-quoted, but a
   *  name like «L'Hospitalet» reaching a single-quoted style is the kind of
   *  thing that only breaks on the one customer who has one. */
  const esc = (s) =>
    String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  /* ------------------------------------------------------------ the palette
     The house values, the same ones erp-ds.css, the PDF stack and the approved
     document mockups carry. Literals rather than custom properties: a mail
     client has no stylesheet of ours and `var()` resolves to nothing. */
  const C = {
    green: "#48733C",
    deep: "#31532A",
    soft: "#E7F0E1",
    panel: "#F4F8F1",
    gold: "#F2C230",
    warnBg: "#FBF5DA",
    ink: "#14160F",
    body: "#3F4339",
    muted: "#7C8072",
    line: "#D8E0D1",
    hair: "#E4E9E0",
    page: "#E9EEE6",
    paper: "#FFFFFF",
  };
  const SANS = "Inter,-apple-system,'Segoe UI',Helvetica,Arial,sans-serif";
  const SERIF = "Georgia,'Times New Roman',serif";
  const MONO = "'SF Mono',Menlo,Consolas,'Courier New',monospace";

  /* ------------------------------------------------------------ the chrome
     The words the FRAME says — not the message, which comes from the template
     library. Here because this file has no dependencies by design (the sample
     generator loads it into a bare VM), and because a label that lives in the
     same place as the markup it labels cannot drift out of step with it. */
  const L = {
    es: {
      ref: "Referencia",
      date: "Fecha",
      amount: "Importe",
      due: "Vencimiento",
      total: "Total",
      pay: "Datos para el pago",
      holder: "Titular",
      concept: "Concepto",
      attached: "Adjunto a este correo",
      next: "Qué ocurre ahora",
      orOpen: "o abra",
      orWrite: "o escríbanos a",
      regOffice: "Domicilio social",
      confidential:
        "Este mensaje y sus adjuntos son confidenciales y van dirigidos únicamente a su destinatario. Si lo ha recibido por error, comuníquenoslo y elimínelo.",
      gdpr: (n, e) =>
        "Sus datos son tratados por " +
        n +
        " con base en la relación contractual o el interés legítimo, conforme al RGPD (UE) 2016/679. Puede ejercer sus derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad escribiendo a " +
        e +
        ".",
      gdprShort: (n) =>
        "Sus datos son tratados por " +
        n +
        " con base en la relación contractual o el interés legítimo, conforme al RGPD (UE) 2016/679, con los derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad que esa norma reconoce.",
      privacy: "Política de privacidad",
    },
    ca: {
      ref: "Referència",
      date: "Data",
      amount: "Import",
      due: "Venciment",
      total: "Total",
      pay: "Dades per al pagament",
      holder: "Titular",
      concept: "Concepte",
      attached: "Adjunt a aquest correu",
      next: "Què passa ara",
      orOpen: "o obriu",
      orWrite: "o escriviu-nos a",
      regOffice: "Domicili social",
      confidential:
        "Aquest missatge i els seus adjunts són confidencials i s'adrecen únicament al seu destinatari. Si l'heu rebut per error, comuniqueu-nos-ho i elimineu-lo.",
      gdpr: (n, e) =>
        "Les vostres dades són tractades per " +
        n +
        " sobre la base de la relació contractual o l'interès legítim, d'acord amb el RGPD (UE) 2016/679. Podeu exercir els drets d'accés, rectificació, supressió, oposició, limitació i portabilitat escrivint a " +
        e +
        ".",
      gdprShort: (n) =>
        "Les vostres dades són tractades per " +
        n +
        " sobre la base de la relació contractual o l'interès legítim, d'acord amb el RGPD (UE) 2016/679, amb els drets d'accés, rectificació, supressió, oposició, limitació i portabilitat que aquesta norma reconeix.",
      privacy: "Política de privacitat",
    },
    en: {
      ref: "Reference",
      date: "Date",
      amount: "Amount",
      due: "Due",
      total: "Total",
      pay: "Payment details",
      holder: "Account holder",
      concept: "Payment reference",
      attached: "Attached to this email",
      next: "What happens next",
      orOpen: "or open",
      orWrite: "or write to us at",
      regOffice: "Registered office",
      confidential:
        "This message and its attachments are confidential and intended solely for the addressee. If you have received it in error, please tell us and delete it.",
      gdpr: (n, e) =>
        "Your data is processed by " +
        n +
        " on the basis of the contract between us or of legitimate interest, under GDPR (EU) 2016/679. You may exercise your rights of access, rectification, erasure, objection, restriction and portability by writing to " +
        e +
        ".",
      gdprShort: (n) =>
        "Your data is processed by " +
        n +
        " on the basis of the contract between us or of legitimate interest, under GDPR (EU) 2016/679, with the rights of access, rectification, erasure, objection, restriction and portability that it confers.",
      privacy: "Privacy policy",
    },
  };
  const tr = (lang) => L[lang] || L.es;

  /* Regenerated by scripts/email-logo.mjs — do not hand-edit. */
  const MARK_PNG_B64 = [
    "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",
  ].join("");
  const MARK_WHITE_PNG_B64 = [
    "iVBORw0KGgoAAAANSUhEUgAAAFAAAABdCAYAAAAyj+FzAAAExElEQVR4nOycSWgUURCGawbFi7gruOBB8WAU96MHvehJ9OYC",
    "4oYguMXt4BoUiSIqxKNLFpUk5qaCgl5iEsRDXIkrKijqwS1qEkUijn/ZPRpDprtfV/f0i6kPfnpmut+b9/6p7q6p7pk0WU4m",
    "kymGFpClpMhSYNpMLCqgMe5LVdC6VCr1kSwiTZYB4wZCZXhYT3/NYxZDj7BuHlmEVQbCnN8mQctzbDIUuoDtqqFBZAFW7MIw",
    "YyQWpdAcg2bvoFXYpS9SgiQagTAuDRXi4WMyM4/JRmMNNJQSIrEIxKQnYnEGmkJy3kNrEY01lGfyHoEwrg90AA9vUzTmMUOg",
    "c+j3PDSE8kheI7CL1CQOPpCT7lRTHshLBLqpCZ8kOqcmfjRC06AigzaDoSo3GmM/NsYegZjEIixKoGEGzdqgXdwOkZRx+ynA",
    "ohKabNAPJ93r0UclxURsBoZMTZgr0EpM+nUXffbCYqer3hScy9By9PmWIiZyAzFJ7nMDtB/qa9CUJ1eISVb5bSiIxo3o/yxF",
    "SKQGuqkJfw2bQWZwmy2YXHPQBrZEYyQGcmpCzoF+G9TLoOlzaBkm00AhcaOR878JBs34g+JoP01CxGdhNzV5AG2n4Ob9gA5C",
    "BRLzGLTn954K7YXaAzYbCFVg7Jeg4SQgdARyaoLFYWglmXEHWoqJN1HEYEyTyDk2mkTjJ2gTxlNOIQgVgRjoQnKqJibmcWqy",
    "CZoeh3kM+r1H5tE4ACrDnK6GiUajCIwjNYmLkNH4GdqMcZYGbRAoAjk1gTaSE3WmJaclGNDcfJrHdIjGfeQcc4PQHzplEo2+",
    "EShITcrJ+TQDpyZxETIav5CTWp302ijt8aZcNSkmp2piYh6nJrPxxitsMI8JGY39oBNuNI7K2XdXL4asmvDAjkBFGPB3spSQ",
    "0dgCbcW8jndekerUOR8DjpJFqUkcYJ78zWU3meWuTC0583yVfSHdoVNOTbi0bpqabKYYU5M4wFjboT14OB26b9B0FvQQXq35",
    "05cwNVmNgbykbow4GtEB798mVROu+BZGXdVIGvjAhVu+RlNg0KyVd2ET8/jEMu5/M4/BnG6Rc42Gy3BBz9R9OQIzATZ8QU4J",
    "qJZ6ACZnar9vIvxJHILG9xTzmA55o280+kUgV3CPUQ8G9nB1vSTXer+zTispbV4rTU7bSheogULUQCFqoBA1UIgaKEQNFKIG",
    "ClEDhaiBQtRAIWqgkEQNRKWDy+h9KHq4BHUTakA1qYVkeNZLk47AHWRWEc/FV+gGOfdgs67DuG8UDZ43H3TXXZgv2PNtcVnD",
    "GmFY0DJ8pHQXA/m+mvoOasrefJ40fgbGPcifHuuyP4vg3fEJJYfXGH0NjPtnELmuyTTDtFVkB57XjTSNEaIGClEDhaiBQtRA",
    "IWqgEDVQiBooRA0UogYKUQOFqIFC1EAhaqAQNVCIGihEDRSiBgpRA4WogULUQCFqoBA1UIgaKEQNFKIGClEDhaiBQtRAIWqg",
    "EDVQiBooRA0UYquB/M/nT7GsI+c237pUKvWMLMTmCBzragU/gaFv6F9DrfivLj8D52Pgoyk+TH4jMgJa5IoN5Z86sJl3yedG",
    "cCFTvVYG/eciJQd6EhGiBgpRA4WogULUQCFs4DVSQvMLAAD//6ZwNYIAAAAGSURBVAMANcGp248+k3YAAAAASUVORK5CYII=",
  ].join("");

  const CID_MARK = "canei-mark.png";
  const CID_MARK_WHITE = "canei-mark-white.png";

  /** The two inline parts every message carries. Small — about 2.8 kB of
   *  base64 between them — and attached rather than fetched, which is the only
   *  form Gmail and Outlook both display without asking the reader. */
  const inlineParts = () => [
    { cid: CID_MARK, b64: MARK_PNG_B64, mime: "image/png" },
    { cid: CID_MARK_WHITE, b64: MARK_WHITE_PNG_B64, mime: "image/png" },
  ];

  /**
   * The same HTML with the `cid:` references resolved to data: URIs.
   *
   * ONLY for looking at the message outside a mail client — the sample pack,
   * the document catalogue, a preview pane. A `cid:` reference resolves
   * against the parts of the message it travels in, so a browser opening the
   * HTML alone shows two broken images and somebody concludes the logo does
   * not work. Never used for the part that is actually sent: Gmail strips a
   * data: image, which is the whole reason the message carries real parts.
   */
  function withInlineImages(html) {
    return String(html || "")
      .split("cid:" + CID_MARK_WHITE)
      .join("data:image/png;base64," + MARK_WHITE_PNG_B64)
      .split("cid:" + CID_MARK)
      .join("data:image/png;base64," + MARK_PNG_B64);
  }

  /* ----------------------------------------------------------------- blocks
     Each returns a full-width <tr>. A block that has nothing to say returns
     "", so a message composes out of whichever of them it needs. */

  const band = (bg, pad, inner) =>
    '<tr><td style="background:' + bg + ";padding:" + pad + '">' + inner + "</td></tr>";

  /* Tracking, but not so much that the text stops being text. At .18em a PDF
     extractor reads «DATOS PARA EL PAGO» as «D AT O S PA R A E L PA G O» —
     the gap between glyphs becomes a space — and the label stops being
     findable. The eyebrow still reads as an eyebrow at a third of that. */
  const label = (text, color) =>
    '<div style="font:700 10px ' +
    SANS +
    ";letter-spacing:.06em;text-transform:uppercase;color:" +
    color +
    ';padding:0 0 10px">' +
    esc(text) +
    "</div>";

  /** Masthead: the mark, the wordmark, the tagline, and the document this
   *  message is about — the four things a reader checks before reading. */
  function masthead(iss, m) {
    const refChip = m.ref
      ? '<td align="right" valign="top" style="font:600 11px ' +
        MONO +
        ";color:" +
        C.muted +
        ';white-space:nowrap;padding:3px 0 0">' +
        esc(m.ref) +
        "</td>"
      : "";
    const tagline = iss.tagline
      ? '<div style="font:400 10.5px ' +
        SANS +
        ";letter-spacing:.14em;text-transform:uppercase;color:" +
        C.green +
        ';padding:5px 0 0">' +
        esc(iss.tagline) +
        "</div>"
      : "";
    const name = iss.tradeName || iss.legalName || "";
    return (
      band(
        C.paper,
        "26px 32px 20px",
        '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>' +
          '<td width="52" valign="top" style="padding:0 12px 0 0">' +
          '<img src="cid:' +
          CID_MARK +
          '" width="40" height="46" alt="' +
          esc(name) +
          '" style="display:block;width:40px;height:46px;border:0">' +
          "</td>" +
          '<td valign="middle">' +
          '<div style="font:400 20px/1.1 ' +
          SERIF +
          ";color:" +
          C.ink +
          '">' +
          esc(name) +
          "</div>" +
          tagline +
          "</td>" +
          refChip +
          "</tr></table>",
      ) +
      '<tr><td style="height:3px;background:' +
      C.gold +
      ';font-size:0;line-height:0">&nbsp;</td></tr>'
    );
  }

  /** Greeting, opening sentence, paragraphs. */
  function prose(m) {
    const p = (t, extra) =>
      '<p style="margin:0 0 14px;font:400 15px/1.6 ' +
      SANS +
      ";color:" +
      C.body +
      (extra || "") +
      '">' +
      t +
      "</p>";
    let out = "";
    if (m.greeting) out += p(esc(m.greeting), ";color:" + C.ink);
    if (m.lede) out += p(rich(m.lede), ";font-size:15.5px");
    for (const t of m.paras || []) out += p(rich(t));
    return out ? band(C.paper, "26px 32px 6px", out) : "";
  }

  /**
   * The one piece of markup allowed inside a template body.
   *
   * A message has to be able to say «la factura **FAC-2026-0021**» without the
   * template library knowing what HTML is — the same string also goes out as
   * the plain-text part and down the WhatsApp channel, where a tag would be
   * read aloud as a tag. So the library writes `*emphasis*` and this is the
   * only thing that turns into markup.
   */
  function rich(s) {
    return (
      esc(s)
        .replace(/\*([^*]+)\*/g, '<b style="color:' + C.ink + ';font-weight:700">$1</b>')
        /* A newline the author typed is a line the reader sees. Without this a
         link and the sentence after it run together into one paragraph, which
         is exactly what makes a message look machine-made. */
        .replace(/\n/g, "<br>")
    );
  }

  /** The figures: reference, date, amount, due — with the one that matters
   *  set large. Hairlines above and below rather than a box, because a box
   *  inside a card is two objects saying the same thing. */
  function facts(m, t) {
    const rows = (m.facts || []).filter(
      (f) => f && f.v !== undefined && f.v !== null && f.v !== "",
    );
    if (!rows.length) return "";
    /* Each cell states the ground it sits on, not only the band around it. A
       client that force-inverts for dark mode leaves an explicit background
       alone and repaints everything else — so a row that names only its text
       colour comes back as paper-on-paper. */
    const line = (f) =>
      '<tr><td style="background:' +
      C.paper +
      ";padding:7px 0;border-bottom:1px solid " +
      C.hair +
      ";font:400 " +
      (f.hero ? "13px" : "13px") +
      " " +
      SANS +
      ";color:" +
      C.muted +
      '">' +
      esc(f.k) +
      "</td>" +
      '<td align="right" style="background:' +
      C.paper +
      ";padding:7px 0;border-bottom:1px solid " +
      C.hair +
      ";font:" +
      (f.hero ? "700 19px " + SERIF : "600 14px " + SANS) +
      ";color:" +
      C.ink +
      ';white-space:nowrap">' +
      esc(f.v) +
      "</td></tr>";
    void t;
    return band(
      C.paper,
      "6px 32px 8px",
      '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-top:2px solid ' +
        C.green +
        '">' +
        rows.map(line).join("") +
        "</table>",
    );
  }

  /** Where money is owed, how to pay it. */
  function payment(m, t) {
    const p = m.payment;
    if (!p || !p.iban) return "";
    const row = (k, v, mono) =>
      '<div style="font:400 12.5px/1.6 ' +
      SANS +
      ";color:" +
      C.body +
      '">' +
      esc(k) +
      ": " +
      (mono
        ? '<span style="font:700 14px ' +
          MONO +
          ";color:" +
          C.ink +
          ';letter-spacing:.02em">' +
          esc(v) +
          "</span>"
        : '<b style="color:' + C.ink + '">' + esc(v) + "</b>") +
      "</div>";
    return band(
      C.paper,
      "10px 32px 6px",
      '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:' +
        C.panel +
        ";border-left:3px solid " +
        C.green +
        '"><tr><td style="background:' +
        C.panel +
        ';padding:14px 16px">' +
        label(t.pay, C.green) +
        (p.holder ? row(t.holder, p.holder, false) : "") +
        row("IBAN", p.iban, true) +
        (p.concept ? row(t.concept, p.concept, false) : "") +
        "</td></tr></table>",
    );
  }

  /** An aside: the sentence that stops a reminder reading as an accusation,
   *  or the warning that stops a deadline being missed. */
  function note(m) {
    const n = m.note;
    if (!n || !n.text) return "";
    const warn = n.kind === "warn";
    return band(
      C.paper,
      "10px 32px 6px",
      '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:' +
        (warn ? C.warnBg : C.panel) +
        ";border-left:3px solid " +
        (warn ? C.gold : C.green) +
        '"><tr><td style="background:' +
        (warn ? C.warnBg : C.panel) +
        ";padding:13px 16px;font:400 13.5px/1.6 " +
        SANS +
        ";color:" +
        C.body +
        '">' +
        (n.title ? '<b style="color:' + C.ink + '">' + esc(n.title) + "</b><br>" : "") +
        rich(n.text) +
        "</td></tr></table>",
    );
  }

  /** Numbered steps on the pale ground — what happens next, in order. */
  function steps(m, t) {
    const list = (m.steps || []).filter(Boolean);
    if (!list.length) return "";
    const one = (text, i) =>
      "<tr>" +
      '<td width="30" valign="top" style="background:' +
      C.soft +
      ';padding:0 12px 10px 0">' +
      '<div style="width:22px;height:22px;background:' +
      C.green +
      ";font:700 12px/22px " +
      SANS +
      ';color:#ffffff;text-align:center">' +
      (i + 1) +
      "</div></td>" +
      '<td valign="top" style="background:' +
      C.soft +
      ";font:400 14px/22px " +
      SANS +
      ";color:" +
      C.body +
      ';padding:0 0 10px">' +
      rich(text) +
      "</td></tr>";
    return band(
      C.soft,
      "20px 32px 12px",
      label(m.stepsTitle || t.next, C.deep) +
        '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">' +
        list.map(one).join("") +
        "</table>",
    );
  }

  /**
   * THE THING THE READER HAS TO COPY — a username, a temporary password, a
   * one-time code.
   *
   * On the accent green with the values in white inset cards, which is the
   * strongest contrast in the message and therefore where the eye goes. It is
   * also the block that survives a dark-mode client intact: an explicit
   * background is left alone, whereas unstyled black-on-white is inverted into
   * white-on-white and the password disappears.
   */
  function credentials(m) {
    const c = m.credentials;
    if (!c || !(c.rows || []).length) return "";
    const row = (r) =>
      '<tr><td style="background:' +
      C.green +
      ';padding:0 0 12px">' +
      '<div style="font:700 10px ' +
      SANS +
      ';letter-spacing:.06em;text-transform:uppercase;color:rgba(255,255,255,.75);padding:0 0 6px">' +
      esc(r.k) +
      "</div>" +
      '<div style="font:' +
      (r.big ? "700 20px " + MONO : "600 14px " + MONO) +
      ";letter-spacing:" +
      (r.big ? ".08em" : "0") +
      ";color:" +
      C.ink +
      ";background:#ffffff;padding:" +
      (r.big ? "13px 15px" : "10px 13px") +
      ';word-break:break-all">' +
      esc(r.v) +
      "</div></td></tr>";
    return band(
      C.green,
      "22px 32px 14px",
      label(c.title || "", "rgba(255,255,255,.85)") +
        '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">' +
        c.rows.map(row).join("") +
        "</table>" +
        (c.foot
          ? '<div style="font:400 12px/1.6 ' +
            SANS +
            ';color:rgba(255,255,255,.78)">' +
            esc(c.foot) +
            "</div>"
          : ""),
    );
  }

  /** The action. A <td bgcolor> with a padded <a> inside it — the one button
   *  shape Outlook renders as a button rather than as a line of text. */
  function cta(m, t) {
    const c = m.cta;
    if (!c || !c.href) return "";
    const isMail = /^mailto:/i.test(c.href);
    const shown = isMail ? c.href.replace(/^mailto:/i, "").split("?")[0] : c.href;
    return band(
      C.paper,
      "18px 32px 14px",
      '<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>' +
        '<td align="center" bgcolor="' +
        C.green +
        '" style="background:' +
        C.green +
        '"><a href="' +
        esc(c.href) +
        '" style="display:inline-block;padding:14px 30px;font:700 14px ' +
        SANS +
        ';letter-spacing:.03em;color:#ffffff;text-decoration:none">' +
        esc(c.label) +
        " &rsaquo;</a></td></tr></table>" +
        '<div style="font:400 12px/1.5 ' +
        SANS +
        ";color:" +
        C.muted +
        ';padding:9px 0 0">' +
        /* A reader who cannot press the button needs the address, not the
           URL. `mailto:hola@…?subject=Re%3A%20FAC-2025-0014` printed in full
           is the kind of detail that makes a message look automated, which is
           the one thing the whole design is spending its effort against. */
        esc(isMail ? t.orWrite : t.orOpen) +
        ' <a href="' +
        esc(c.href) +
        '" style="color:' +
        C.green +
        ';word-break:break-all">' +
        esc(shown) +
        "</a></div>",
    );
  }

  /** The attachment, named in the body. A paperclip the reader has to notice
   *  is a paperclip the reader can miss. */
  function attachment(m, t) {
    const a = m.attachment;
    if (!a || !a.name) return "";
    return band(
      C.paper,
      "10px 32px 6px",
      '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid ' +
        C.line +
        '"><tr>' +
        '<td width="34" align="center" style="background:' +
        C.soft +
        ";font:400 16px " +
        SANS +
        ";color:" +
        C.green +
        ';padding:11px 0">&#128206;</td>' +
        '<td style="background:' +
        C.paper +
        ";padding:10px 14px;font:400 13px/1.45 " +
        SANS +
        ";color:" +
        C.body +
        '"><b style="color:' +
        C.ink +
        '">' +
        esc(a.name) +
        "</b>" +
        (a.size ? '<span style="color:' + C.muted + '"> · ' + esc(a.size) + "</span>" : "") +
        '<div style="font-size:11.5px;color:' +
        C.muted +
        '">' +
        esc(t.attached) +
        "</div></td></tr></table>",
    );
  }

  /** Who sent it. A message from a company nobody signs is a notification. */
  function signoff(m) {
    const s = m.signoff;
    if (!s || !s.who) return "";
    return band(
      C.paper,
      "22px 32px 28px",
      (m.closing
        ? '<p style="margin:0 0 14px;font:400 15px/1.6 ' +
          SANS +
          ";color:" +
          C.body +
          '">' +
          esc(m.closing) +
          "</p>"
        : "") +
        '<div style="font:600 15px ' +
        SERIF +
        ";color:" +
        C.ink +
        '">' +
        esc(s.who) +
        "</div>" +
        (s.role
          ? '<div style="font:400 12.5px ' +
            SANS +
            ";color:" +
            C.muted +
            ';padding:2px 0 0">' +
            esc(s.role) +
            "</div>"
          : "") +
        '<div style="font:400 12.5px ' +
        SANS +
        ";color:" +
        C.muted +
        ';padding:2px 0 0">' +
        esc([s.company, s.phone].filter(Boolean).join(" · ")) +
        "</div>",
    );
  }

  /**
   * THE LEGAL FOOT.
   *
   * Not decoration and not a signature: for a Spanish S.L. this is what
   * LSSI-CE art. 10 asks to be identifiable in a commercial electronic
   * communication — the name, the registered address, the NIF, the entry in
   * the Registro Mercantil and a means of direct contact — plus the art. 13
   * GDPR line saying who processes the reader's data and how they object.
   *
   * The fields and their order are the ones Sheet.prototype.docfoot prints at
   * the bottom of every document, so the email and the invoice cannot end up
   * telling a customer two different things about who wrote to them.
   */
  function footerHtml(issuer, lang) {
    const iss = issuer || {};
    const t = tr(lang);
    const name = iss.legalName || iss.tradeName || "";
    const line = (html, size, color) =>
      '<div style="font:400 ' +
      size +
      "/1.7 " +
      SANS +
      ";color:" +
      color +
      ';padding:0 0 3px">' +
      html +
      "</div>";
    const contact = [iss.phone, iss.email, iss.web].filter(Boolean);
    const rows = [
      line(
        esc([name, iss.taxId && "NIF " + iss.taxId].filter(Boolean).join(" · ")),
        "11.5px",
        "#FFFFFF",
      ),
      iss.registeredAddress || iss.address
        ? line(esc(iss.registeredAddress || iss.address), "11px", "rgba(255,255,255,.78)")
        : "",
      contact.length
        ? line(
            contact
              .map((c) =>
                /@/.test(c)
                  ? '<a href="mailto:' +
                    esc(c) +
                    '" style="color:#ffffff;text-decoration:none">' +
                    esc(c) +
                    "</a>"
                  : /^https?:|^www\./i.test(c)
                    ? '<a href="' +
                      esc(/^https?:/i.test(c) ? c : "https://" + c) +
                      '" style="color:#ffffff;text-decoration:none">' +
                      esc(c) +
                      "</a>"
                    : esc(c),
              )
              .join(" &middot; "),
            "11px",
            "rgba(255,255,255,.78)",
          )
        : "",
      iss.registry ? line(esc(iss.registry), "10.5px", "rgba(255,255,255,.62)") : "",
      iss.legalFooter ? line(esc(iss.legalFooter), "10.5px", "rgba(255,255,255,.62)") : "",
    ]
      .filter(Boolean)
      .join("");

    const small =
      '<div style="font:400 10px/1.6 ' +
      SANS +
      ';color:rgba(255,255,255,.55);padding:12px 0 0;border-top:1px solid rgba(255,255,255,.18);margin-top:12px">' +
      esc(t.confidential) +
      "<br>" +
      /* A company with no email on file gets the sentence without its last
         clause rather than «… escribiendo a .» — a data-protection notice
         that trails off is worse than a shorter one. */
      esc(iss.email ? t.gdpr(name, iss.email) : t.gdprShort(name)) +
      (iss.privacyUrl
        ? ' <a href="' +
          esc(iss.privacyUrl) +
          '" style="color:rgba(255,255,255,.8)">' +
          esc(t.privacy) +
          "</a>."
        : "") +
      "</div>";

    return band(
      C.deep,
      "22px 32px 24px",
      '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>' +
        '<td width="40" valign="top" style="padding:2px 12px 0 0">' +
        '<img src="cid:' +
        CID_MARK_WHITE +
        '" width="28" height="32" alt="' +
        esc(iss.tradeName || name) +
        '" style="display:block;width:28px;height:32px;border:0">' +
        '</td><td valign="top">' +
        rows +
        "</td></tr></table>" +
        small,
    );
  }

  /**
   * THE MESSAGE BODY IN THE HOUSE EMAIL DESIGN.
   *
   * `msg` = { subject, lang, preheader, greeting, lede, paras, ref, facts,
   *           payment, note, steps, stepsTitle, cta, attachment, closing,
   *           signoff }
   * `issuer` = `erp._issuerBlock()`, optionally with `tagline` and
   *           `privacyUrl`.
   *
   * The old three-argument call — `bodyHtml(subject, bodyText, issuer)` — is
   * still honoured, because two pages and a generator use it and a message
   * that is only prose is a perfectly good message. It renders in the new
   * design, with the body text split into paragraphs as before.
   */
  function bodyHtml(a, b, c) {
    let msg;
    let issuer;
    if (a && typeof a === "object") {
      msg = a;
      issuer = b;
    } else {
      issuer = c;
      const lines = String(b == null ? "" : b)
        .split(/\n{2,}|\n/)
        .filter((l) => l.trim());
      msg = { subject: a, greeting: "", paras: lines };
    }
    const iss = issuer || {};
    const t = tr(msg.lang);
    /* The preheader is the one place the emphasis markers would be READ
       rather than rendered — it is plain text on a lock screen, and
       «Se ha creado su cuenta en el sistema de *Canei Subirats*» is what a
       machine-written message looks like. */
    const pre = String(msg.preheader || msg.lede || msg.subject || "").replace(
      /\*([^*]+)\*/g,
      "$1",
    );

    /* The preheader: what a phone shows on the lock screen under the subject.
       Hidden in the message itself, and padded with zero-width joiners so the
       client does not carry on into the masthead looking for more text. */
    const preheader =
      '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;height:0;width:0">' +
      esc(pre) +
      "&#8199;&#65279;&#847;".repeat(40) +
      "</div>";

    return (
      '<!doctype html><html lang="' +
      esc(msg.lang || "es") +
      '"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<meta name="color-scheme" content="light only">' +
      "<title>" +
      esc(msg.subject || "") +
      "</title></head>" +
      '<body style="margin:0;padding:0;background:' +
      C.page +
      ';-webkit-text-size-adjust:100%">' +
      preheader +
      '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:' +
      C.page +
      '"><tr><td align="center" style="padding:22px 10px 30px">' +
      '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="620" style="width:620px;max-width:100%;background:' +
      C.paper +
      '">' +
      masthead(iss, msg) +
      prose(msg) +
      /* ORDER IS AN ARGUMENT ABOUT WHAT THE READER DOES NEXT, so two messages
         are allowed to disagree about it. A reminder puts its «if you have
         already paid, ignore this» beside the figures it qualifies; an
         invitation puts its alternative link at the end, after the way in that
         most people will use. Same two blocks, opposite ends, one flag each. */
      (msg.ctaFirst ? cta(msg, t) : "") +
      facts(msg, t) +
      payment(msg, t) +
      (msg.notePlace === "end" ? "" : note(msg)) +
      attachment(msg, t) +
      credentials(msg) +
      steps(msg, t) +
      (msg.notePlace === "end" ? note(msg) : "") +
      (msg.ctaFirst ? "" : cta(msg, t)) +
      signoff(msg) +
      footerHtml(iss, msg.lang) +
      "</table></td></tr></table></body></html>"
    );
  }

  /**
   * THE PLAIN PART, WRITTEN TO BE READ.
   *
   * Not a transcription of the HTML: the same facts in the order somebody
   * scanning a phone needs them. A client that refuses HTML still gets a
   * message that reads, and a plain part is also what stops the whole thing
   * scoring as spam.
   */
  function textPart(msg, issuer, opts) {
    if (!msg || typeof msg !== "object") return String(msg == null ? "" : msg);
    /* The legal foot belongs on a MESSAGE. The same composed text also goes
       down the chat channel, where a confidentiality notice and an article of
       the GDPR are noise in a bubble — the reader already knows who is
       writing, because they are looking at the contact's name. */
    const legal = !opts || opts.legal !== false;
    const iss = issuer || {};
    const t = tr(msg.lang);
    const plain = (s) => String(s || "").replace(/\*([^*]+)\*/g, "$1");
    const out = [];
    if (msg.greeting) out.push(plain(msg.greeting), "");
    if (msg.lede) out.push(plain(msg.lede), "");
    if (msg.cta && msg.cta.href && msg.ctaFirst)
      out.push(plain(msg.cta.label) + ": " + msg.cta.href, "");
    for (const p of msg.paras || []) out.push(plain(p), "");
    const rows = (msg.facts || []).filter(
      (f) => f && f.v !== undefined && f.v !== null && f.v !== "",
    );
    if (rows.length) {
      const w = Math.max(...rows.map((f) => String(f.k).length));
      for (const f of rows) out.push(String(f.k).padEnd(w + 2) + f.v);
      out.push("");
    }
    if (msg.payment && msg.payment.iban) {
      out.push(t.pay.toUpperCase());
      if (msg.payment.holder) out.push(t.holder + ": " + msg.payment.holder);
      out.push("IBAN: " + msg.payment.iban);
      if (msg.payment.concept) out.push(t.concept + ": " + msg.payment.concept);
      out.push("");
    }
    if (msg.attachment && msg.attachment.name)
      out.push(t.attached + ": " + msg.attachment.name, "");
    if (msg.credentials && (msg.credentials.rows || []).length) {
      if (msg.credentials.title) out.push(String(msg.credentials.title).toUpperCase());
      const w = Math.max(...msg.credentials.rows.map((r) => String(r.k).length));
      for (const r of msg.credentials.rows) out.push(String(r.k).padEnd(w + 2) + r.v);
      if (msg.credentials.foot) out.push(msg.credentials.foot);
      out.push("");
    }
    if (msg.steps && msg.steps.length) {
      out.push((msg.stepsTitle || t.next).toUpperCase());
      msg.steps.forEach((s, i) => out.push("  " + (i + 1) + ". " + plain(s)));
      out.push("");
    }
    if (msg.note && msg.note.text) out.push(plain(msg.note.text), "");
    if (msg.cta && msg.cta.href && !msg.ctaFirst)
      out.push(plain(msg.cta.label) + ": " + msg.cta.href, "");
    if (msg.closing) out.push(plain(msg.closing), "");
    if (msg.signoff && msg.signoff.who) {
      out.push(msg.signoff.who);
      if (msg.signoff.role) out.push(msg.signoff.role);
      out.push([msg.signoff.company, msg.signoff.phone].filter(Boolean).join(" · "));
    }
    if (!legal)
      return (
        out
          .join("\n")
          .replace(/\n{3,}/g, "\n\n")
          .trimEnd() + "\n"
      );
    out.push("", "--");
    out.push(
      [iss.legalName || iss.tradeName, iss.taxId && "NIF " + iss.taxId].filter(Boolean).join(" · "),
    );
    if (iss.registeredAddress || iss.address) out.push(iss.registeredAddress || iss.address);
    const contact = [iss.phone, iss.email, iss.web].filter(Boolean);
    if (contact.length) out.push(contact.join(" · "));
    if (iss.registry) out.push(iss.registry);
    out.push(t.confidential);
    const who = iss.legalName || iss.tradeName || "";
    out.push(iss.email ? t.gdpr(who, iss.email) : t.gdprShort(who));
    return (
      out
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trimEnd() + "\n"
    );
  }

  return {
    build,
    bodyHtml,
    textPart,
    footerHtml,
    inlineParts,
    withInlineImages,
    encodeHeader,
    textToB64,
    chunk,
    esc,
    palette: C,
  };
});
