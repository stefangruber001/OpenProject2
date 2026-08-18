#!/usr/bin/env python3
"""
Build the two BBVA fixtures from the SHAPE of real exports.

The layouts here were taken from genuine files the tenant downloaded on
13/08/2026 — one account statement, one card statement. Those files are not in
this repository and must never be: they carry a live IBAN, full card numbers
and the names of real people and suppliers. What is reproduced is only the
structure and the awkward parts, with invented values:

  ACCOUNT  header on the SIXTEENTH row and starting in column C, eight rows of
           account metadata above it, dates as dd/mm/yyyy TEXT, amounts and
           balances as NUMERIC cells — including the binary-float noise a real
           export contains (-69.099999999999994 is sixty-nine euros ten) —
           newest row first, and two genuinely identical payroll payments on
           one day, which is what makes de-duplication by value wrong.

  CARD     a different shape from the same bank: header on the sixteenth row
           in columns C..G, dates as ISO TEXT, amounts as Spanish text with a
           comma, no balance column at all, and the monthly settlement row
           («RECIBO MES ANTERIOR») that the bank charge is matched against.

Run: python3 tests/fixtures/make-bbva-fixtures.py
"""
import zipfile, os
from xml.sax.saxutils import escape

HERE = os.path.dirname(os.path.abspath(__file__))

def col_name(i):
    s = ""
    i += 1
    while i:
        i, r = divmod(i - 1, 26)
        s = chr(65 + r) + s
    return s

class Sheet:
    def __init__(self):
        self.strings = []
        self.index = {}
        self.rows = []

    def s(self, text):
        if text not in self.index:
            self.index[text] = len(self.strings)
            self.strings.append(text)
        return self.index[text]

    def row(self, start_col, values):
        """values: str -> shared string, (num,) -> numeric cell, None -> gap."""
        self.rows.append((start_col, values))

    def xml(self):
        out = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
               '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>']
        for n, (start, values) in enumerate(self.rows, start=1):
            cells = []
            for j, v in enumerate(values):
                if v is None:
                    continue
                ref = f"{col_name(start + j)}{n}"
                if isinstance(v, tuple):
                    cells.append(f'<c r="{ref}"><v>{repr(v[0])}</v></c>')
                else:
                    cells.append(f'<c r="{ref}" t="s"><v>{self.s(v)}</v></c>')
            out.append(f'<row r="{n}">' + "".join(cells) + "</row>")
        out.append("</sheetData></worksheet>")
        return "".join(out)

    def shared_xml(self):
        items = "".join(f"<si><t xml:space=\"preserve\">{escape(x)}</t></si>" for x in self.strings)
        return ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                f'<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
                f'count="{len(self.strings)}" uniqueCount="{len(self.strings)}">{items}</sst>')

def write(path, sheet):
    ct = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
          '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
          '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
          '<Default Extension="xml" ContentType="application/xml"/>'
          '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
          '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
          '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>'
          '</Types>')
    rels = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            '</Relationships>')
    wb = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
          '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
          'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
          '<sheets><sheet name="Movimientos" sheetId="1" r:id="rId1"/></sheets></workbook>')
    wbrels = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
              '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
              '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
              '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>'
              '</Relationships>')
    with zipfile.ZipFile(path, "w") as z:
        # Real exports mix STORED and DEFLATED entries; the reader must take both.
        z.writestr("[Content_Types].xml", ct, zipfile.ZIP_STORED)
        z.writestr("_rels/.rels", rels, zipfile.ZIP_DEFLATED)
        z.writestr("xl/workbook.xml", wb, zipfile.ZIP_DEFLATED)
        z.writestr("xl/_rels/workbook.xml.rels", wbrels, zipfile.ZIP_DEFLATED)
        z.writestr("xl/worksheets/sheet1.xml", sheet.xml(), zipfile.ZIP_DEFLATED)
        z.writestr("xl/sharedStrings.xml", sheet.shared_xml(), zipfile.ZIP_STORED)
    print("wrote", path)

# ---------------------------------------------------------------- account ----
a = Sheet()
for _ in range(4):
    a.row(0, [])
a.row(2, ["Movimientos"])
a.row(0, [])
a.row(2, ["Titular", None, None, "EMPRESA DE PRUEBA S.L."])
a.row(2, ["Cuenta", None, None, "ES0000000000000000000000"])
a.row(2, ["Divisa", None, None, "EUR"])
a.row(2, ["Banco", None, None, "BANCO DE PRUEBA S.A. "])
a.row(2, ["Fecha", None, None, "26/06/2026 Hora  22:22 "])
a.row(2, ["Importe", None, None, "Todos "])
a.row(2, ["Periodo", None, None, "28/03/2026-01/07/2026"])
a.row(2, ["Filtros", None, None, "Todos "])
a.row(0, [])
a.row(2, ["F. CONTABLE", "F. VALOR", "CÓDIGO", "CONCEPTO", "BENEFICIARIO/ORDENANTE",
          "OBSERVACIONES", "IMPORTE", "SALDO", "DIVISA", "OFICINA", "REMESA"])

# Newest first, as the bank writes it. Balance runs backwards up the file.
# (date, code, concept, counterparty, observations, amount)
MOVES = [
    ("26/06/2026", "00007", "TRANSFERENCIAS", "", "PEDIDO 26PV010429", -108.13),
    ("26/06/2026", "00919", "PAGO CON TARJETA EN HOGAR, MUEBLES, DECORACION Y ELECTR", "",
     "0000000000000000 MATERIALES DE PRUEBA   POBLACION     ES", -394.64),
    # The float-noise row: this IS sixty-nine euros ten in the bank's own PDF.
    ("26/06/2026", "00919", "PAGO CON TARJETA EN HOGAR, MUEBLES, DECORACION Y ELECTR", "",
     "0000000000000000 DECORACION DE PRUEBA   POBLACION     ES", -69.099999999999994),
    ("25/06/2026", "00007", "TRANSFERENCIAS", "INMOBILIARIA DE PRUEBA SL",
     "FACTURA 20/26 CLIENTE DE PRUEBA", 553.27),
    # Two people, the same 500 €, the same day: two transactions, not one.
    ("29/04/2026", "00301", "PAGO DE NOMINAS POR SU CUENTA", "", "NOMINA ABRIL", -500.0),
    ("29/04/2026", "00301", "PAGO DE NOMINAS POR SU CUENTA", "", "NOMINA ABRIL", -500.0),
    ("07/04/2026", "00136", "ADEUDO A SU CARGO", "SERVICIOS DE PRUEBA, S.L.",
     "N 0000000000000000 SERVICIOS DE PRUEBA, S.L.", -246.84),
    # The other float-noise shape: a five-figure amount.
    ("31/03/2026", "00007", "TRANSFERENCIAS", "VEHICULOS DE PRUEBA S L",
     "PEDIDO FURGONETA  NUMERO 000000", -18766.439999999999),
]
OPENING = 20300.00
bal, chain = OPENING, []
for m in reversed(MOVES):           # oldest first, to build the running balance
    bal = round(bal + m[5], 2)
    chain.append(bal)
chain.reverse()                      # back to newest-first, as written
for m, b in zip(MOVES, chain):
    a.row(2, [m[0], m[0], m[1], m[2], m[3], m[4], (m[5],), (b,), "EUR", "3090", "-"])
write(os.path.join(HERE, "bbva-cuenta.xlsx"), a)

# ------------------------------------------------------------------- card ----
c = Sheet()
for _ in range(2):
    c.row(0, [])
c.row(2, ["Listado de movimientos de tarjeta"])
c.row(0, [])
c.row(2, ["Nº de tarjeta", None, "0000000000000000"])
c.row(2, ["Tipo de tarjeta", None, "TARJETA NEGOCIOS CREDITO -NEGOCIOS CREDITO CU"])
c.row(2, ["Nº de contrato", None, "00000000000000000000000000"])
c.row(2, ["Titular de la tarjeta", None, "TITULAR DE PRUEBA"])
c.row(2, ["Fecha", None, "14/08/2026"])
c.row(2, ["Periodo", None, "14/08/2024 - 14/08/2026"])
c.row(2, ["Tipo de movimiento", None, "TODOS"])
c.row(2, ["Importes", None, "TODOS"])
for _ in range(3):
    c.row(0, [])
c.row(2, ["FECHA DE OPERACIÓN", "CONCEPTO", "TIPO DE MOVIMIENTO", "IMPORTE", "DIVISA"])
CARD = [
    ("2026-08-12", "COMERCIO DE PRUEBA", "Compra", "-11,30"),
    ("2026-08-07", "COMERCIO DE PRUEBA", "Compra", "-2,60"),
    ("2026-08-06", "ELECTRODOMESTICOS DE PRUEBA", "Compra", "-54,33"),
    # What the bank charge on the current account is matched against.
    ("2026-08-05", "RECIBO MES ANTERIOR", "Sin categoría", "262,27"),
    ("2026-08-03", "SERVICIOS AUTOMOVILISTICO", "Compra", "-8,00"),
]
for r in CARD:
    c.row(2, [r[0], r[1], r[2], r[3], "EUR"])
write(os.path.join(HERE, "bbva-tarjeta.xlsx"), c)
