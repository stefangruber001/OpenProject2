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

  return { build, textToB64, chunk };
});
