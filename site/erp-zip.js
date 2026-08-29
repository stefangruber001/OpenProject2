/* =============================================================================
   CaneiZip — the store-only ZIP writer, in one place.

   WHY IT IS ITS OWN FILE. An .xlsx is a ZIP of XML parts, a .docx is a ZIP of
   XML parts, and the accountant package is a ZIP of whatever the quarter
   produced. That was one writer living inside erp.html, reachable only by the
   page — so a Word document generated from the same descriptor as the PDF had
   no way to reach it without a second copy of the same 60 lines. Two ZIP
   writers is one ZIP writer and one future bug: the central directory offsets
   are the kind of arithmetic that is wrong in exactly one of the copies.

   STORE, NEVER DEFLATE. The format allows it, every reader accepts it, and it
   means no compression library has to reach a page that must work from a bare
   static host. The cost is file size on documents that are mostly text; the
   benefit is that this file has no dependencies at all and can be read in one
   sitting.
   ========================================================================== */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.CaneiZip = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const CRC_T = (() => {
    let c,
      t = [];
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(b) {
    let c = 0xffffffff;
    for (let i = 0; i < b.length; i++) c = CRC_T[(c ^ b[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  /** UTF-8 bytes, without assuming TextEncoder is the only way to get them. */
  function utf8(s) {
    if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(s);
    return Uint8Array.from(Buffer.from(s, "utf8"));
  }

  const u16 = (a, o, v) => {
    a[o] = v & 255;
    a[o + 1] = (v >>> 8) & 255;
  };
  const u32 = (a, o, v) => {
    a[o] = v & 255;
    a[o + 1] = (v >>> 8) & 255;
    a[o + 2] = (v >>> 16) & 255;
    a[o + 3] = (v >>> 24) & 255;
  };

  /**
   * `files` = [{ path, bytes }] — bytes is a Uint8Array, or a string which is
   * taken as UTF-8. Returns the archive as ONE Uint8Array, because that is the
   * form both a Blob and a Node Buffer are one step away from, and returning a
   * Blob here would make the writer unusable from the tests.
   */
  function zip(files) {
    const parts = [],
      central = [];
    let off = 0;
    for (const f of files) {
      const name = utf8(f.path);
      const data = typeof f.bytes === "string" ? utf8(f.bytes) : f.bytes;
      const crc = crc32(data);
      const lh = new Uint8Array(30 + name.length);
      u32(lh, 0, 0x04034b50);
      u16(lh, 4, 20);
      // Bit 11: the file name is UTF-8. Without it an accented path is read
      // in the reader's own code page, which is how «Facturas recibidas» comes
      // out of a ZIP as mojibake on a Spanish Windows.
      u16(lh, 6, 0x0800);
      u16(lh, 8, 0);
      u16(lh, 10, 0);
      u16(lh, 12, 0);
      u32(lh, 14, crc);
      u32(lh, 18, data.length);
      u32(lh, 22, data.length);
      u16(lh, 26, name.length);
      u16(lh, 28, 0);
      lh.set(name, 30);
      parts.push(lh, data);
      const ch = new Uint8Array(46 + name.length);
      u32(ch, 0, 0x02014b50);
      u16(ch, 4, 20);
      u16(ch, 6, 20);
      u16(ch, 8, 0x0800);
      u16(ch, 10, 0);
      u16(ch, 12, 0);
      u16(ch, 14, 0);
      u32(ch, 16, crc);
      u32(ch, 20, data.length);
      u32(ch, 24, data.length);
      u16(ch, 28, name.length);
      u16(ch, 30, 0);
      u16(ch, 32, 0);
      u16(ch, 34, 0);
      u16(ch, 36, 0);
      u32(ch, 38, 0);
      u32(ch, 42, off);
      ch.set(name, 46);
      central.push(ch);
      off += lh.length + data.length;
    }
    let cs = 0;
    central.forEach((c) => (cs += c.length));
    const end = new Uint8Array(22);
    u32(end, 0, 0x06054b50);
    u16(end, 4, 0);
    u16(end, 6, 0);
    u16(end, 8, files.length);
    u16(end, 10, files.length);
    u32(end, 12, cs);
    u32(end, 16, off);
    u16(end, 20, 0);

    let total = end.length;
    for (const p of parts) total += p.length;
    for (const c of central) total += c.length;
    const out = new Uint8Array(total);
    let at = 0;
    for (const p of parts) {
      out.set(p, at);
      at += p.length;
    }
    for (const c of central) {
      out.set(c, at);
      at += c.length;
    }
    out.set(end, at);
    return out;
  }

  /** The same archive as a Blob, for the browser's download path. */
  function blob(files, mime) {
    return new Blob([zip(files)], { type: mime || "application/zip" });
  }

  return { zip, blob, crc32, utf8 };
});
