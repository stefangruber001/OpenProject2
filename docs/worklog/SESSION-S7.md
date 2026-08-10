# S7 · The document finds out who pays for it

> Context pack. What "still needs a person" turned out to mean, why receiving
> stopped being a stage without being deleted, the two things that did not
> exist at all, and what S8 inherits.

## What was wrong

S6 built the reading and left the filing. Three things followed from that:

1. **`erp.allocateCapture` had zero callers.** A document could be
   photographed, read, checked and confirmed — and then nothing in the
   application could say which obra paid for it. The one method that answers
   the question had never been called by anything but its own definition.
2. **The inbox was one flat table.** The doc specifies two zones: a **372**
   column of **96 px** cards on the left, a **756** register on the right. One
   table is not a worklist; it is a pile with a scrollbar.
3. **ADM-02 was session 10b's screen.** Seven status pills, no counters, and
   the order opened in a 480 drawer with no sight of the quote it came from —
   which is the one document you need when checking what was ordered.

Gaps 10 and 11 (`sourcePath`, `reference`, `notes`) had no home either: three
workbook columns the model could not hold.

## What exists now

|                          | Before                          | After                                                         |
| ------------------------ | ------------------------------- | ------------------------------------------------------------- |
| ADM-03 inbox             | one flat table                  | 372 cards (thumbnail · supplier · amount) beside the register |
| Allocation               | a method nobody called          | a 480 panel: one obra, a split, or an overhead category       |
| Gaps 10-11               | not modelled                    | `sourcePath` · `reference` · `notes`, editable and searchable |
| ADM-02 stages            | seven pills                     | three counters — Oferta · Pedido · Facturado — that filter    |
| ADM-02 detail            | a 480 drawer                    | full screen: quote at 620 with zoom, record at 480            |
| Purchase order documents | `docRefs` existed, always empty | a captured document links to the order it belongs to          |
| Schema                   | v13                             | v14                                                           |

## The question the left column answers

**What puts a document on the left is that it is UNALLOCATED — not that it is
unvalidated.** This is the whole design of the screen and it is not what the
status names suggest.

S6 confirms a document at capture time: a person presses Confirmar and the
record is written `validated`. So a left/right split on _validation_ would
leave the inbox permanently empty and the two zones would be two zones in
name only. What is actually outstanding at that moment is the thing nobody has
said yet — **who pays for it** — and that is exactly the question the
allocation panel exists to ask.

Cards are **newest first**. A worklist that appends to the bottom asks the
person who has just photographed a delivery note to scroll past everything
they already dealt with to reach it.

## One destination, not two boxes

Rule 4 of the mapping's entity model: every cost lands on a project **or** an
account. The engine now refuses a line that names both — and refuses one that
names neither, an unknown overhead category, an unknown cost kind, a project
that has been deleted and a non-positive amount.

So the panel offers **one select holding both kinds of answer**, obras in one
optgroup and gastos generales in the other. A screen that lets somebody tick
two boxes and then says no is a screen that asked the question badly.

The split arithmetic is asserted **only against a confirmed total**. An
unconfirmed document has none, and deriving one from the split itself would
make the check agree with whatever it was handed. Filing an unread photograph
stays possible, and stays honest about what was not checked.

## Receiving stopped being a stage without being deleted

The mapping's ADM-02 row says _3 states only, no goods receipt_. Read
literally that removes `receivePurchase`, its partial accumulation and
`purchaseReconciliation` — the evidence a delivery note gives.

It is read instead as **receipt is not a STAGE**. `purchaseStage` derives
three values from the same facts `purchaseStatus` already derives seven from,
so an order that has been received reads **Pedido · Recibida**: stage in the
bar, status in the pane, both true, neither stored. The receiving action moved
into the 480 record pane with the other five.

That distinction is S1b's, and it is worth restating because it keeps coming
up: **retiring a stage is not the same as un-testing an engine.** The e2e
check now asserts both readings in the same breath, so nobody can quietly
resolve the tension by deleting one of them.

A cancelled order is in **none** of the three counters. It is in the list; it
is counted nowhere. A counter that includes work nobody will do has to be
explained every time somebody reads it.

## The two things that did not exist

**A link between an order and the supplier's paperwork.** `docRefs` has been
in `addPurchase`'s defaults since session 10b and nothing ever wrote to it.
`attachPurchaseDocument` links a **captured** document rather than uploading a
second copy, so the reading, the date and the file's origin are the same
object on both screens — and the migration normalises the array on every order
written before the default existed.

**The three archive fields.** `updateCapture` is deliberately separate from
`confirmCapture`: the three say nothing about what the document contains, so
adding a note must not re-derive the standard name or re-run duplicate
detection. A filed invoice that renames itself because somebody typed a note
is a lost document. `sourcePath` is filled at capture from
`webkitRelativePath || name` — less than the workbook's "Ruta completa", and
what a browser actually knows.

## Decisions worth knowing

- **Purchase orders stay single-line** (ASSUMPTIONS #109). The pane renders the
  line table §3.2 asks for, over the one line an order stores. The blocker is
  not the table: `receivePurchase` completes an order when the received
  quantity reaches the ordered quantity, and there is no honest single quantity
  for an order whose lines are in different units. The table renders however
  many rows it is handed, so adding lines later is data plus one engine
  decision, not a second rewrite.
- **ADM-03 keeps its second tab** for the payables register (#110). Partial
  supplier payments and one payment across several invoices are engine rules
  with no screen in the v4 document; retiring the only interface that
  exercises them would un-cover them.
- **Necesidades and the arrivals calendar survive** below ADM-02's list (#111).
  Necesidades is the only place the committed-versus-pending figure per
  capítulo is visible, and an order created from an open need already knows its
  capítulo.
- **The counter strip is a primitive, not this screen's decoration.** The doc
  gives five screens a strip at five different widths, so the width is the
  caller's through `--cw`. A strip that rounds them all to one number has
  stopped following the document.
- **Thumbnails are cached per blob key** for the life of the page and fall back
  to the icon by letting the image load fail — which is the only test that
  works for a PDF on both the local and the served path.

## The Catalan ratchet moved for the first time

97 new ES/EN/CA triples, and **eight entries that were on the ES/EN spine with
no Catalan at all** — `Referencia`, `Quitar`, `Alquiler`, `Seguros`,
`Subcontrata`, `Sí`, `Descripción`, `Guardar` — are now translated, because
all eight are on S7's two panels and a Catalan user was reading Spanish words
in them. `CA_BACKLOG` is **1326 → 1316**. The ceiling has only ever been held before;
this is the first session it came down.

Driving both screens under CA and EN also found that the **shared list
primitive's own chrome was never translated** — `⬇ Exportar`, `Filas por
pantalla`, `‹ Anterior`, `Siguiente ›`, `＋ Nuevo` — nor ADM-02's two
surviving blocks (`Necesidades`, `Calendario de llegadas`, `＋ Nueva orden de
compra`). Those strings have been on every list screen since S2 and on
compras since session 10b, in Spanish, in all three languages. They are fixed
here because they are on this session's screens; the render check is what
found them, and the dictionary guard could not have.

One more of S5's lesson, in a new place: the inbox card rendered
`«Factura proveedor · 06/04/2026»` as a single text node, so the type stayed
Spanish in a Catalan interface while the same word one column to the right was
translated. Split into two elements, as S5 said to.

The count nouns in the shared list primitive (`3 documentos`, `12 órdenes`)
follow S4's established convention: an EN regex rule, because the count and
the noun share one text node. Where the noun is a label of its own — the three
counters — it is a plain pair, and reaches Catalan as well.

## Verification

Site E2E **249/249** (23 new browser checks) · manageability **155/155** (24
new engine checks) · migrations **48/48** (ladder to v14) · year 149/149 ·
import 25/25 · scheduling 30/30 · i18n coverage (EN 100%, CA ceiling lowered
1326 → **1316**) · site-sync 17/17 · ownership guard 27 areas · lint ·
boundaries · check-types · unit tests 118/118 · build · `make gates` ·
`make demo`.

The committed bundle is unchanged: nothing in this session touched a bundled
capability, and `pnpm --filter @repo/erp-browser build` leaves
`site/erp-factory.{js,cjs}` byte-identical.

## The one thing the reader still cannot find

The **issuer name** comes back `null` on the e2e's own fixture, and on the
S0b spike's scans before it. Nothing introduces it with a keyword and nothing
can validate it, so it is amber by construction — and now the card says
«Emisor por confirmar» rather than showing an empty line where the doc asks
for the detected supplier.

That is honest and it is not finished. The obvious improvement is available
and was deliberately **not** taken here: when the tax id reads green and a
party in master data holds it, the supplier's name is known. Doing that at
save time would put a value into `confirmed` that nobody saw before pressing
Confirmar, which is exactly the rule S6 exists to hold; doing it on the
validation screen, as a visible proposal, is the version that respects CAP-04.
It is a small, self-contained piece of work for whichever session next opens
that screen.

## What S8 inherits

S8 owns PRY-01's integration and PRY-02 Avance Económico.

- **The 780 centre panel with a 372 compressed list is still not built.** It is
  the layout both PRY screens need and the one shared primitive S7 did not have
  a use for.
- **The counter strip is available** (`.counters` + `--cw`) — PRY-03, ADM-01 and
  ADM-07 all want it, and so does the Torre.
- **PRY-02's pending-assignment block is now half-built elsewhere.** ADM-03
  allocates a whole document to obras and overheads; PRY-02 splits a cost by
  **capítulo** inside one obra. The allocation row already carries `chapterNum`,
  so the second is a narrower editor over the same field, not a new model.
- **Item 14 of the money chain is still unverified** — whether moving a hito's
  date moves the expected cash. The doc asks; S8 confirms or builds it.

**Every string S8 adds must ship with Catalan AND a real-browser render
assertion.** That rule has now caught a gap in four consecutive sessions.
