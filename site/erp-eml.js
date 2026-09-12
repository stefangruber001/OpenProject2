/* =============================================================================
   CaneiEml — one .eml builder for every draft this system files or downloads.

   WHY THIS FILE EXISTS. journey.html has built RFC 822 drafts since S19 and
   erp.html is about to start (N2: every generated email lands in the company
   mailbox's Drafts). Two copies of MIME assembly would disagree within a
   month — boundary quoting, base64 line length, the X-Unsent header that
   makes a mail client open the file as an editable draft — so the assembly
   lives here and both pages call it.

   WHAT IT BUILDS. multipart/mixed carrying one multipart/alternative
   (text + html, both base64 so no encoding surprise survives to the reader)
   plus any attachments, each already base64. `X-Unsent: 1` is what tells
   Outlook and Apple Mail this is a draft to finish, not a message to display.
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
   * The draft.
   * `m` = { fromName, fromEmail, toName, toEmail, subject, text, html,
   *         attachments: [{ name, b64, mime? }] }
   */
  function build(m) {
    const CRLF = "\r\n";
    const bnd = "CANEI_" + Math.random().toString(36).slice(2, 10);
    let s = "";
    s += "From: " + addr(m.fromName, m.fromEmail) + CRLF;
    s += "To: " + addr(m.toName, m.toEmail) + CRLF;
    s += "Subject: " + (m.subject || "") + CRLF;
    s += "X-Unsent: 1" + CRLF;
    s += "MIME-Version: 1.0" + CRLF;
    s += 'Content-Type: multipart/mixed; boundary="' + bnd + '"' + CRLF + CRLF;

    s += "--" + bnd + CRLF;
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
   *  well as in a page — the sample-email generator runs it headless. */
  const esc = (s) =>
    String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  /**
   * THE MESSAGE BODY IN THE APPROVED EMAIL DESIGN — lockup, the template
   * wording, the company legal foot. Inline styles throughout: this lands in a
   * mail client, which has no stylesheet of ours and may strip a `<style>`
   * block outright.
   *
   * Here rather than in the page for the reason at the top of this file. The
   * body is as much a part of what gets sent as the MIME around it, and the
   * sample pack the client is shown has to be the same email the customer
   * receives — a second renderer for the samples would make the pack a drawing
   * of the product instead of the product.
   *
   * `issuer` is `erp._issuerBlock()`.
   */
  function bodyHtml(subject, bodyText, issuer) {
    const iss = issuer || {};
    const paras = String(bodyText || "")
      .split(/\n{2,}|\n/)
      .filter(Boolean)
      .map((l) => '<p style="margin:0 0 12px">' + esc(l) + "</p>")
      .join("");
    return `<!doctype html><html><body style="margin:0;padding:0;background:#EDEDEB">
        <div style="max-width:620px;margin:0 auto;padding:28px 26px;background:#fff;font:400 14px/1.55 Arial,Helvetica,sans-serif;color:#3D3D3D">
         <div style="display:flex;align-items:center;gap:10px;border-bottom:2px solid #48733C;padding-bottom:12px;margin-bottom:18px">
          <svg width="26" height="30" viewBox="0 0 118.391 137.002" xmlns="http://www.w3.org/2000/svg"><path fill="#48733C" fill-rule="nonzero" d="M60.449 0 0 38.374V137.002H118.391V38.445ZM107.462 126.073H71.480L56.137 122.671V71.986L82.416 65.524H45.953V126.073H10.929V44.382L60.318 13.028L107.462 44.311Z"/></svg>
          <span style="font:400 20px Georgia,serif;color:#000">${esc(iss.tradeName || iss.legalName || "")}</span>
         </div>
         ${paras}
         <div style="border-top:2px solid #48733C;margin-top:22px;padding-top:10px;font:400 11px/1.6 Georgia,serif;color:#48733C">
          ${esc([iss.legalName, iss.taxId, iss.registeredAddress || iss.address].filter(Boolean).join(" · "))}<br>
          ${esc([iss.phone, iss.email, iss.web].filter(Boolean).join(" · "))}
         </div>
        </div></body></html>`;
  }

  return { build, bodyHtml, textToB64, chunk };
});
