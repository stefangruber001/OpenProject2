#!/usr/bin/env python3
"""
Build the PDF bank-statement fixture from the SHAPE of a real BBVA export.

Companion to make-bbva-fixtures.py, which built the two .xlsx fixtures from
the same source tenant's real files (never committed — see that script's own
header). The PDF "Extracto integral" is the SAME account and an OVERLAPPING
period as bbva-cuenta.xlsx, in the bank's OTHER export shape: printed text,
not a spreadsheet. Structure reproduced, values invented, per decision 7 in
docs/worklog/PK7-SPEC.md.

  - Six logical columns collapse to five visible ones: F. Operación, F. Valor,
    Concepto (BENEFICIARIO and OBSERVACIONES are merged into it — the PDF has
    no separate counterparty column, unlike the .xlsx), Importe, Saldo. Every
    amount and balance is printed with its own " EUR" suffix, unlike the
    .xlsx's bare numeric cells.
  - Each table "cell" is its own PDF text-showing operator at its own x on the
    row's baseline, exactly as a real statement's layout engine emits it — so
    the reader is exercised on reassembling a row from several text runs, not
    handed one pre-joined string.
  - Concepts wrap across two or three lines; the continuation lines carry
    text ONLY at the concept column's x — no date, no amount — which is the
    one signal the reader has for "this line belongs to the row above".
  - Two identical payroll lines on the same day (same trap as the .xlsx
    fixture): two transactions, not a duplicate to be collapsed.
  - Runs to a second page, so a row is never assumed to fit on one.

No PDF library: a hand-rolled minimal single-content-stream-per-page writer,
Helvetica (a standard 14 font, no embedding needed), in the same
no-dependency spirit as make-bbva-fixtures.py's hand-rolled ZIP writer.

Run: python3 tests/fixtures/make-bbva-pdf-fixture.py
"""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "bbva-extracto.pdf")

PAGE_W, PAGE_H = 595, 842
X_DATE, X_VALUE, X_CONCEPT, X_IMPORTE, X_SALDO = 36, 90, 150, 430, 505
LINE_H = 13
TOP_Y = 800
# Deliberately shallow, so this small fixture still spans two pages — a real
# statement runs to many pages at 535 rows; this one proves the reader does
# not assume a row, or the whole file, fits on a single page.
BOTTOM_Y = 560
FONT_SIZE = 8

# ---------------------------------------------------------------- movements --
# Newest first, as the bank prints it. (date, value_date, concept_lines, amount)
MOVES = [
    ("26/06/2026", "26/06/2026",
     ["TRANSFERENCIA A FAVOR DE", "INMOBILIARIA DE PRUEBA SL", "FACTURA 20/26 CLIENTE DE PRUEBA"],
     553.27),
    ("26/06/2026", "26/06/2026",
     ["PAGO CON TARJETA EN HOGAR, MUEBLES, DECORACION Y ELECTR", "MATERIALES DE PRUEBA POBLACION ES"],
     -394.64),
    ("26/06/2026", "27/06/2026",
     ["PAGO CON TARJETA EN HOGAR, MUEBLES, DECORACION Y ELECTR", "DECORACION DE PRUEBA POBLACION ES"],
     -69.10),
    ("25/06/2026", "25/06/2026",
     ["TRANSFERENCIA A FAVOR DE", "PEDIDO 26PV010429"],
     -108.13),
    # Two people, the same 500 EUR, the same day: two transactions, not one.
    ("29/04/2026", "29/04/2026", ["PAGO DE NOMINAS POR SU CUENTA", "NOMINA ABRIL"], -500.00),
    ("29/04/2026", "29/04/2026", ["PAGO DE NOMINAS POR SU CUENTA", "NOMINA ABRIL"], -500.00),
    ("07/04/2026", "07/04/2026",
     ["ADEUDO A SU CARGO", "SERVICIOS DE PRUEBA, S.L."],
     -246.84),
    ("31/03/2026", "31/03/2026",
     ["TRANSFERENCIA A FAVOR DE", "VEHICULOS DE PRUEBA S L", "PEDIDO FURGONETA NUMERO 000000"],
     -18766.44),
    ("15/03/2026", "15/03/2026", ["PAGO CON TARJETA EN COMERCIO DE PRUEBA"], -11.30),
    ("10/03/2026", "10/03/2026",
     ["TRANSFERENCIA A FAVOR DE", "CLIENTE DE PRUEBA DOS"],
     1200.00),
    # Pads past a single page, so the reader is exercised on a row that is
    # never assumed to fit on one — the same reason bbva-cuenta.xlsx keeps a
    # header well below the first row.
    ("08/03/2026", "08/03/2026", ["PAGO CON TARJETA EN COMERCIO DE PRUEBA DOS"], -6.50),
    ("05/03/2026", "05/03/2026",
     ["ADEUDO A SU CARGO", "AGUA Y SANEAMIENTO DE PRUEBA"],
     -58.90),
    ("02/03/2026", "02/03/2026",
     ["TRANSFERENCIA A FAVOR DE", "CLIENTE DE PRUEBA TRES", "FACTURA 15/26"],
     2100.00),
    ("28/02/2026", "28/02/2026",
     ["PAGO CON TARJETA EN COMBUSTIBLES Y CARBURANTES", "GASOLINERA DE PRUEBA POBLACION ES"],
     -82.15),
    ("20/02/2026", "20/02/2026", ["COMISION MANTENIMIENTO CUENTA"], -12.00),
    ("11/02/2026", "11/02/2026",
     ["TRANSFERENCIA A FAVOR DE", "CLIENTE DE PRUEBA CUATRO"],
     980.00),
]
OPENING = 25000.00

bal, chain = OPENING, []
for m in reversed(MOVES):  # oldest first, to build the running balance
    bal = round(bal + m[3], 2)
    chain.append(bal)
chain.reverse()  # back to newest-first, as printed

def money(v):
    s = f"{abs(v):,.2f}".replace(",", "_").replace(".", ",").replace("_", ".")
    return ("-" if v < 0 else "") + s + " EUR"

# ------------------------------------------------------------------ PDF text --
def esc(s):
    return s.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")

def tj(x, y, text):
    return f"BT /F1 {FONT_SIZE} Tf 1 0 0 1 {x} {y} Tm ({esc(text)}) Tj ET\n"

pages = []
ops = []
y = TOP_Y

def new_page(header=True):
    global ops, y
    if ops:
        pages.append("".join(ops))
    ops = []
    y = TOP_Y
    if header:
        ops.append(tj(X_DATE, y, "F. OPERACION"))
        ops.append(tj(X_VALUE, y, "F. VALOR"))
        ops.append(tj(X_CONCEPT, y, "CONCEPTO"))
        ops.append(tj(X_IMPORTE, y, "IMPORTE"))
        ops.append(tj(X_SALDO, y, "SALDO"))
        y -= LINE_H * 1.6

new_page()
for (d, v, lines, amt), b in zip(MOVES, chain):
    needed = LINE_H * len(lines)
    if y - needed < BOTTOM_Y:
        new_page()
    ops.append(tj(X_DATE, y, d))
    ops.append(tj(X_VALUE, y, v))
    ops.append(tj(X_CONCEPT, y, lines[0]))
    ops.append(tj(X_IMPORTE, y, money(amt)))
    ops.append(tj(X_SALDO, y, money(b)))
    y -= LINE_H
    for cont in lines[1:]:
        ops.append(tj(X_CONCEPT, y, cont))
        y -= LINE_H
    y -= LINE_H * 0.4  # a little air between rows, as a real statement has
if ops:
    pages.append("".join(ops))

# ------------------------------------------------------------------ objects --
objs = []  # 1-indexed via append order; index i -> object number i+1

def add(body):
    objs.append(body)
    return len(objs)

font_num = None  # allocated after we know page numbers, filled below via placeholder

# Page/content object numbers are allocated in a first pass so /Kids and
# /Contents can reference forward — a PDF's objects need not be in reference
# order, but this keeps the numbering simple and readable.
n_pages = len(pages)
catalog_num = 1
pages_num = 2
font_num = 3
first_page_obj = 4  # each page: page_obj = first_page_obj + 2*i, content = +1

objs = [None] * (3 + n_pages * 2)
objs[catalog_num - 1] = f"<< /Type /Catalog /Pages {pages_num} 0 R >>"
kids = " ".join(f"{first_page_obj + 2*i} 0 R" for i in range(n_pages))
objs[pages_num - 1] = (
    f"<< /Type /Pages /Kids [{kids}] /Count {n_pages} "
    f"/MediaBox [0 0 {PAGE_W} {PAGE_H}] >>"
)
objs[font_num - 1] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
for i, content in enumerate(pages):
    page_obj = first_page_obj + 2 * i
    content_obj = page_obj + 1
    objs[page_obj - 1] = (
        f"<< /Type /Page /Parent {pages_num} 0 R "
        f"/Resources << /Font << /F1 {font_num} 0 R >> >> "
        f"/Contents {content_obj} 0 R >>"
    )
    body = content.encode("latin-1")
    objs[content_obj - 1] = ("STREAM", body)

# ------------------------------------------------------------------- write --
out = bytearray()
out += b"%PDF-1.4\n"
offsets = [0] * (len(objs) + 1)
for i, o in enumerate(objs, start=1):
    offsets[i] = len(out)
    if isinstance(o, tuple) and o[0] == "STREAM":
        body = o[1]
        out += f"{i} 0 obj\n<< /Length {len(body)} >>\nstream\n".encode("latin-1")
        out += body
        out += b"\nendstream\nendobj\n"
    else:
        out += f"{i} 0 obj\n{o}\nendobj\n".encode("latin-1")

xref_start = len(out)
out += f"xref\n0 {len(objs) + 1}\n".encode("latin-1")
out += b"0000000000 65535 f \n"
for i in range(1, len(objs) + 1):
    out += f"{offsets[i]:010d} 00000 n \n".encode("latin-1")
out += (
    f"trailer\n<< /Size {len(objs) + 1} /Root {catalog_num} 0 R >>\n"
    f"startxref\n{xref_start}\n%%EOF"
).encode("latin-1")

with open(OUT, "wb") as f:
    f.write(bytes(out))
print("wrote", OUT, f"({n_pages} page(s), {len(MOVES)} movements)")
print("opening", f"{OPENING:.2f}", "closing", f"{chain[0]:.2f}")
