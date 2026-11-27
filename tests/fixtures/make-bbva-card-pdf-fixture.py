#!/usr/bin/env python3
"""
Build the BBVA CARD-listing PDF fixture from the SHAPE of a real export.

Sibling of make-bbva-pdf-fixture.py, which builds the account statement
(«Extracto integral»). A business credit card exports something else: the
«Listado de movimientos de tarjeta». The client's real listings are never
committed — they carry a card number, a holder's name and a person's spending.
Structure reproduced, values invented, per decision 7 in
docs/worklog/PK7-SPEC.md.

What the real export does, and this fixture reproduces, because each one is a
way for a reader to go wrong:

  - ISO dates (2026-11-23), not dd/mm/yyyy — the account-statement reader found
    no movement at all in a real listing and refused it outright.
  - Four columns at fixed x: FECHA DE OPERACIÓN, CONCEPTO, TIPO DE MOVIMIENTO,
    IMPORTE. No balance. The header carries an «Importe total» that the rows
    must add up to — the only completeness check this format allows.
  - A merchant whose NAME contains a movement type («COMPRA FACIL SL», type
    «Compra»): joined text cannot tell where the concept ends, so the reader
    must place each cell by the column it sits under.
  - Pending movements («Sin categoría») printed first, in ascending order, then
    the rest newest-first — the reader must sort, not reverse.
  - «RECIBO MES ANTERIOR»: the card being paid off, not a purchase.
  - Two identical purchases on one day: two transactions.
  - A concept that wraps onto a second line under CONCEPTO only.
  - An amount with one decimal and one with a thousands separator.
  - A second page that repeats the column header, which is not a row.
  - The accented header, in WinAnsi, as the real file prints it.

No PDF library, the same hand-rolled writer as the statement fixture.

Run: python3 tests/fixtures/make-bbva-card-pdf-fixture.py
"""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "bbva-tarjeta.pdf")
PAGE_W, PAGE_H = 595, 842
X_LAB, X_VAL, X_LAB2, X_VAL2 = 29, 115, 371, 463
X_DATE, X_CONCEPT, X_KIND, X_AMOUNT = 29, 165, 301, 437
FONT_SIZE, LINE_H, TOP_Y, BOTTOM_Y = 8, 13, 800, 60

# (date, [concept lines], kind, cents) — printed in THIS order, as BBVA does.
MOVES = [
    ("2026-11-25", ["CAFETERIA DE PRUEBA"], "Sin categoría", -340),
    ("2026-11-26", ["PANADERIA EJEMPLO"], "Sin categoría", -165),
    ("2026-11-24", ["COMPRA FACIL SL"], "Compra", -1230),
    ("2026-11-20", ["REPUESTOS INVENTADOS SA"], "Reembolso", 7900),
    ("2026-11-18", ["FERRETERIA DEL BARRIO"], "Compra", -55),
    ("2026-11-15", ["MATERIALES DE OBRA", "SUMINISTROS DEL VALLES"], "Compra", -123456),
    ("2026-11-12", ["ALMACEN CONSTR.-PRUEBA"], "Compra", -4642),
    ("2026-11-05", ["RECIBO MES ANTERIOR"], "Sin categoría", 85046),
    ("2026-10-27", ["TOT DEGUSTACIO"], "Compra", -160),
    ("2026-10-27", ["TOT DEGUSTACIO"], "Compra", -160),
    ("2026-10-20", ["ESTACION DE SERVICIO"], "Compra", -5000),
    ("2026-10-15", ["ALMACEN CONSTR.-PRUEBA"], "Compra", -17808),
    ("2026-10-15", ["BRICO SANT BOI"], "Compra", -1297),
    ("2026-10-05", ["RECIBO MES ANTERIOR"], "Sin categoría", 94901),
] + [("2026-10-0%d" % (1 + i % 3), ["BAR DE LA ESQUINA"], "Compra", -(110 + 10 * i)) for i in range(40)]

def money(c):
    v = abs(c) / 100
    s = f"{v:,.2f}".replace(",", "_").replace(".", ",").replace("_", ".")
    # BBVA trims a trailing zero now and then; one row keeps that habit.
    if c == -5000:
        s = "50,0"
    return ("-" if c < 0 else "") + s + " EUR"

TOTAL = sum(m[3] for m in MOVES)

def esc(s):
    return s.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")

def tj(x, y, text):
    return f"BT /F1 {FONT_SIZE} Tf 1 0 0 1 {x} {y} Tm ({esc(text)}) Tj ET\n"

pages, ops, y = [], [], TOP_Y

def head_block(n, of):
    global y
    ops.append(tj(555, y, f"{n}/ {of}"))
    y -= LINE_H
    ops.append(tj(26, y, "Listado de movimientos de tarjeta"))
    y -= LINE_H * 1.5
    if n == 1:
        for (l1, v1, l2, v2) in [
            ("Nº de tarjeta", "5478240000001234", "Fecha", "27/11/2026"),
            ("Tipo de tarjeta", "TARJETA NEGOCIOS CREDITO -NEGOCIOS CREDITO CU", "Periodo", "01/10/2026 - 27/11/2026"),
            ("Nº de contrato", "01820000000000000000000000", "Tipo de movimiento", "TODOS"),
            ("Titular de la tarjeta", "TITULAR DE PRUEBA", "Importes", "TODOS"),
        ]:
            ops.append(tj(X_LAB, y, l1)); ops.append(tj(X_VAL, y, v1))
            ops.append(tj(X_LAB2, y, l2)); ops.append(tj(X_VAL2, y, v2))
            y -= LINE_H
        ops.append(tj(X_LAB, y, "Importe total")); ops.append(tj(X_VAL, y, money(TOTAL)[:-4]))
        y -= LINE_H * 1.5
    ops.append(tj(X_DATE, y, "FECHA DE OPERACIÓN")); ops.append(tj(X_CONCEPT, y, "CONCEPTO"))
    ops.append(tj(X_KIND, y, "TIPO DE MOVIMIENTO")); ops.append(tj(X_AMOUNT, y, "IMPORTE"))
    y -= LINE_H * 1.3

PER_PAGE = 34
chunks = [MOVES[i:i + PER_PAGE] for i in range(0, len(MOVES), PER_PAGE)]
for pn, chunk in enumerate(chunks, start=1):
    ops, y = [], TOP_Y
    head_block(pn, len(chunks))
    for (d, lines, kind, c) in chunk:
        ops.append(tj(X_DATE, y, d)); ops.append(tj(X_CONCEPT, y, lines[0]))
        ops.append(tj(X_KIND, y, kind)); ops.append(tj(X_AMOUNT, y, money(c)))
        y -= LINE_H
        for cont in lines[1:]:
            ops.append(tj(X_CONCEPT, y, cont)); y -= LINE_H
    pages.append("".join(ops))

n_pages = len(pages)
objs = [None] * (3 + n_pages * 2)
objs[0] = "<< /Type /Catalog /Pages 2 0 R >>"
kids = " ".join(f"{4 + 2*i} 0 R" for i in range(n_pages))
objs[1] = f"<< /Type /Pages /Kids [{kids}] /Count {n_pages} /MediaBox [0 0 {PAGE_W} {PAGE_H}] >>"
# WinAnsi, so «Ó» and «º» print as the real export prints them.
objs[2] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"
for i, content in enumerate(pages):
    objs[3 + 2 * i] = f"<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 3 0 R >> >> /Contents {5 + 2*i} 0 R >>"
    objs[4 + 2 * i] = ("STREAM", content.encode("cp1252"))

out = bytearray(b"%PDF-1.4\n")
offsets = [0] * (len(objs) + 1)
for i, o in enumerate(objs, start=1):
    offsets[i] = len(out)
    if isinstance(o, tuple):
        out += f"{i} 0 obj\n<< /Length {len(o[1])} >>\nstream\n".encode("latin-1") + o[1] + b"\nendstream\nendobj\n"
    else:
        out += f"{i} 0 obj\n{o}\nendobj\n".encode("latin-1")
xref = len(out)
out += f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n".encode("latin-1")
for i in range(1, len(objs) + 1):
    out += f"{offsets[i]:010d} 00000 n \n".encode("latin-1")
out += f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF".encode("latin-1")
with open(OUT, "wb") as f:
    f.write(bytes(out))
print("wrote", OUT, f"({n_pages} pages, {len(MOVES)} movements, total {TOTAL / 100:.2f})")
