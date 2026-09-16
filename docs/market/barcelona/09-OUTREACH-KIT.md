# 09 — OUTREACH KIT

This document is Phase 9 of the Barcelona market roadmap (`docs/market/barcelona/ROADMAP.md`), written on **2026-09-13**, and it contains the words a seller actually sends, says and leaves behind with a Tier A firm — written first for Segment 2, the renovation-led general building contractors that `08-GTM-PLAN.md` §2 puts first (Edificaciones Y Reformas Mollet 2000 SL, Delgado & Dilla Construccions I Reformes Integrals SL, Reformas Lluca Les Corts SL), and usable for the Segment 1 finishing firms with the job size scaled down. One rule governs every line below: **every factual claim traces to a numbered line of `06-VALUE-CASE.md`**, is registered in the table immediately following this paragraph, and is worded as that file allows — a modelled assumption is asked as a question about the prospect's own job, never asserted as a fact about their firm; a product capability is stated only where §2.4 of that file names the module that performs it; and the one obligation with a date on it, the 1 January 2027 certified-billing regime, is described exactly as `08-GTM-PLAN.md` §6 objection 9 and `03-TRIGGER-MAP.md` §1 permit, which is "the hard half is built, the last mile to the tax authority is not", never "compliant". No statistic, customer name or quotation is invented; where a testimonial belongs the text reads `[REQUIRES CUSTOMER CONSENT]`. Because `04-EXTRACTION-QA.md` certifies only `legal_name`, `trade_name`, `nif` and `cnae` — municipality failed its audit at 30.8% error — every reference to something specific about the prospect is a bracketed merge field in capitals carrying its own verification instruction, e.g. `[CARRER, MUNICIPI — comprovar al web o al permís d'obres abans d'enviar]`, and a message still containing a bracket does not leave the building. The Castellano and Català versions are each written from scratch in their own language and take different angles on purpose; the English versions exist for internal review and may be more literal. The seller who uses the Català material with a Catalan-first prospect must be a Catalan speaker (`08-GTM-PLAN.md` §5), and a native reviewer reads the Català once before the first send, because the product's own Catalan dictionary is machine-authored and awaiting that same review.

---

## Claims register

Every claim used anywhere in the six sections, its source line in `06-VALUE-CASE.md` (line numbers of the file as it stands on 2026-09-13), its evidential status there, and the wording rule that follows from that status. Two non-06 sources are used for exactly two things and are listed at the foot of the table: the Verifactu date history and penalty, which `06-VALUE-CASE.md` itself cites from `03-TRIGGER-MAP.md`, and the fact that a demonstration is run on the prospect's own documents, from `08-GTM-PLAN.md` §4, used without any figure attached.

| #   | Claim as used in the copy                                                                                                                                                 | Line in 06-VALUE-CASE.md                           | Status in 06                                            | Wording rule in the copy                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| C1  | On a five-month job, work executed in month four is billed in month five if someone remembers the measurement, and partly never                                           | line 169 (§2.2)                                    | Modelled assumption, ranges stated                      | Stated as "what happens on long jobs", never as a figure about their firm           |
| C2  | The progress valuation is computed as executed minus already billed; it is arithmetic the system performs, not a habit the owner must form                                | lines 169, 207 (§2.2, §2.4), line 219 (§2.5)       | Product fact (engine `invoiceBases`), capture 70%       | May be asserted; the 70% capture rate is never quoted to a prospect                 |
| C3  | Extras accepted on site and never invoiced (modelled at 2.5 per job, about €3,000, 30% never invoiced)                                                                    | line 167 (§2.2)                                    | Modelled assumption                                     | Only as a question: "what share of extras on that job were invoiced?" No figure     |
| C4  | A variation is a real budget joined to the original by acceptance; acceptance freezes what was agreed; the graphic annex keys photos to chapter and line                  | lines 64, 99 (§1.2, §1.4), line 205 (§2.4)         | Product fact                                            | May be asserted                                                                     |
| C5  | Comparing supplier and subcontract prices by hand costs hours per job, and incomplete comparison overpays — the least-evidenced number in the file                        | lines 157–159 (§2.1)                               | Modelled assumption; author flags it as least evidenced | Only as the "measure one closed job" ask; the 1.5% is never quoted                  |
| C6  | Sourcing compares several bidders line by line with per-chapter totals, and a missing price shows as missing rather than zero                                             | line 203 (§2.4), line 96 (§1.4)                    | Product fact                                            | May be asserted                                                                     |
| C7  | Verifactu: an S.L. must have adapted its invoicing software before 1 January 2027; the user's exposure is €50,000 per financial year                                      | line 189 (§2.3), citing `03-TRIGGER-MAP.md` §1     | Sourced (statute cited in 03)                           | May be asserted; re-check against `03-TRIGGER-MAP.md` §1 before every send          |
| C8  | The product holds gapless immutable numbering and a per-tenant SHA-256 chain, but NOT the official record layout, the QR content, the event log or the submission channel | line 209 (§2.4), line 403 (§4.2), 08 objection 9   | Product fact, stated as a gap                           | Mandatory whenever 2027 is mentioned; the word "compliant" is never used            |
| C9  | The reduced-rate justification (inputs, rule, legal basis, pack version) is persisted on the invoice at issue; one failed condition re-rates the whole invoice            | line 26 (§0.2), line 209 (§2.4)                    | Sourced via `LEGAL_REVIEW.md` §2; product fact          | May be asserted; the tax rates themselves are never quoted                          |
| C10 | The quarter is reconstructed from paper (modelled at five administrative days plus one owner day per quarter)                                                             | line 177 (§2.3)                                    | Modelled assumption                                     | Stated as "someone will reconstruct the quarter", never as "it costs you six days"  |
| C11 | The archive for the adviser refuses to build while any bank movement is unallocated; the export format is pending the adviser's own format                                | line 100 (§1.4), line 203 (§2.4)                   | Product fact; export adapter unbound                    | May be asserted; the "ask your adviser which format" line is the honest consequence |
| C12 | The gestoría retainer does not fall when the product is bought; 86–91% of the incumbent's cash cost survives; the product is additive spend                               | lines 388–390 (§4.1)                               | Modelled, and the author's strongest commercial caveat  | Must be said plainly in every asset: "we do not replace your gestoría"              |
| C13 | The Libro de Subcontratación must be on site; the product does NOT provide the authorised book, only dated subcontractor and worker documents with expiry alerts          | line 193 (§2.3), line 209 (§2.4), line 249 (§2.6)  | Statute sourced; capability carried at 0%               | Must be disclaimed wherever subcontractor paperwork is mentioned                    |
| C14 | Earlier visibility of an overdue balance against an unsigned variation would have stopped work sooner                                                                     | line 187 (§2.3)                                    | Modelled assumption; mechanism is a product fact        | Mechanism may be asserted; the €9,000 write-off figure is never quoted              |
| C15 | Price: €60 per active site per month, floor €400, cap €900 per legal entity, all users and all projects included; billed on sites opened in the period                    | lines 260–264 (§2.7), line 413 (§5)                | Pricing hypothesis, recommended                         | Quoted as the price; the 9.7:1 value-to-price ratio is never quoted                 |
| C16 | The firm already buys per site — skip hire, scaffolding, site insurance, prevention coordination                                                                          | line 262 (§2.7)                                    | Author's observation                                    | May be used as framing                                                              |
| C17 | Crew see line items and measurements, never money: every money figure is removed server-side before it reaches a worker's device                                          | line 266 (§2.7), line 419 (§5)                     | Product fact                                            | May be asserted                                                                     |
| C18 | Payback modelled at month 5 central, month 8 on the slow ramp                                                                                                             | lines 217–219 (§2.5)                               | Modelled                                                | Never quoted as a promise; only "on our model, and you can check the model"         |
| C19 | Three qualifying questions before anything is designed: turnover against the €6,010,121.04 threshold, the last pre-qualification pack, an accounting package in place     | line 256 (§2.6)                                    | Author's verdict                                        | Used in the pitch and the referral note as questions we ask, not claims we make     |
| C20 | No revenue growth is claimed anywhere — not more jobs won, not bigger jobs, not a price premium                                                                           | line 13 (§0.1)                                     | Deliberate method                                       | The copy never promises more work                                                   |
| C21 | Segment definition: renovation-led general builders, 12–40 employees, several concurrent sites, months-long jobs, most of the cost through subcontractors and suppliers   | lines 151, 42 (§2 box, §0.3)                       | Segment sizing assumption                               | Used only to describe who we work with, not to describe the prospect                |
| N1  | Verifactu date moved twice, last to 1 January 2027; "hard half built, last mile not"                                                                                      | `03-TRIGGER-MAP.md` §1; `08-GTM-PLAN.md` §6 obj. 9 | Sourced                                                 | Wording checked against 03 before each send (see closing checklist)                 |
| N2  | The demonstration is run on the prospect's own firm name, tax identifier and catalogue                                                                                    | `08-GTM-PLAN.md` §4 stage 3                        | Process fact                                            | Used as "we look at it on your numbers"; no cost or day figure quoted               |

---

## 1 · First-touch email

Under 120 words in each language including subject, salutation, merge-field instructions and signature. The Castellano version opens on the month-four / month-five gap (C1, C2). The Català version opens on cobrar — what is already done and not yet certified — because that is how a Vallès owner phrases the same problem. Both end with the same ask: half an hour on one closed job of theirs (C5, N2). Neither promises anything about 2027; that is deliberately held for the first follow-up.

### Castellano

```text
Asunto: [CALLE — verificar]: ejecutado y sin certificar

Hola [NOMBRE — solo si consta; si no, "Buenos días"]:

[La obra de CALLE, MUNICIPIO — verificar en su web o en el permiso] durará meses. En una obra así, lo del mes cuatro se certifica en el mes cinco si alguien hizo la medición. Y una parte, nunca.

Hacemos una cosa: la certificación sale sola de lo ejecutado menos lo facturado. Y el extra que el cliente acepta a pie de obra queda por escrito, dentro del presupuesto, no en un WhatsApp.

Vuestra gestoría y vuestro Excel se quedan.

¿Media hora en la obra? Traigo una obra vuestra cerrada y lo miramos sobre vuestros números.

[NOMBRE], [MÓVIL]
```

### Català

```text
Assumpte: [CARRER — verificar]: feina feta, feina cobrada?

Bon dia,

A [CARRER, MUNICIPI — verificar al web o al permís d'obres] hi teniu gent des de fa setmanes. Pregunta incòmoda: quant d'això ja està certificat? I quant és en un paper del cap d'obra, esperant l'amidament?

A les obres llargues passa a tothom. Es fa feina, es cobra tard, i alguna cosa no es cobra.

Fem que la certificació surti sola: executat menys facturat. I l'extra que el client accepta a peu d'obra queda per escrit, dins del pressupost, no en un WhatsApp.

La gestoria us la quedeu.

Mitja hora a l'obra? Porteu una obra tancada i ho mirem amb els vostres números.

[NOM], [MÒBIL]
```

### English (review)

```text
Subject: [STREET — verify]: executed and not valued

Hello [NAME — only if on record; otherwise "Good morning"]:

[The job at STREET, MUNICIPALITY — verify on their website or the permit] will last months. On a job like that, month four's work gets valued in month five if someone did the measurement. And part of it, never.

We do one thing: the progress valuation comes out by itself from executed minus billed. And the extra the client accepts on site is put in writing, inside the budget, not in a WhatsApp.

Your gestoría and your spreadsheet stay.

Half an hour on site? I bring one of your closed jobs and we look at it on your numbers.

[NAME], [MOBILE]
```

---

## 2 · Follow-ups

Two follow-ups, two angles, each under 100 words per language. **Follow-up A** is the 1 January 2027 obligation (C7, C8, N1), worded so that it never claims compliance and hands the prospect the honest exit of objection 2 in `08-GTM-PLAN.md` §6 — if their gestoría is supplying a conforming tool before 2027, we stop pushing that line. **Follow-up B** is the quarter (C9, C10, C11, C12): sent in the last week of a quarter, when the reconstruction is about to begin. Send A no sooner than four working days after the first touch; send B a week after A. Neither is sent if the first touch got a reply.

### Follow-up A — the 2027 invoicing obligation

#### Castellano

```text
Asunto: 1 de enero de 2027 y vuestras facturas

Sois una S.L. Desde el 1 de enero de 2027, el programa de facturas tiene que dejar un registro encadenado y un QR en cada factura. La fecha ya se ha movido dos veces. Facturar con un sistema que no cumple: 50.000 € por ejercicio.

Tal cual: ya tenemos la numeración sin huecos y la cadena de registros. El tramo final hacia Hacienda (formato, QR, envío) se está construyendo ahora. Si vuestra gestoría os va a dar una herramienta antes, decídmelo y no insisto.

¿Un café esta semana?

[NOMBRE]
```

#### Català

```text
Assumpte: L'1 de gener del 2027 i les vostres factures

Una cosa que no us vaig dir.

Sou una S.L. Des de l'1 de gener del 2027, el programa amb què factureu ha de deixar un registre encadenat i un codi QR a cada factura. Si no ho fa: 50.000 € de multa per exercici.

Tenim la part dura feta: numeració sense forats i registres encadenats. El tram cap a Hisenda —format, QR, enviament— l'estem acabant. No us diré que ja hi som; us diré on som.

Si la gestoria ja us ho té resolt, digueu-m'ho.

[NOM]
```

#### English (review)

```text
Subject: 1 January 2027 and your invoices

You are an S.L. From 1 January 2027, the software you invoice with has to leave a chained record and a QR on every invoice. The date has already moved twice. Invoicing with a system that does not comply: €50,000 per financial year.

Said plainly: we already have the gapless numbering and the chained records. The last stretch to the tax authority (format, QR, submission) is being built. If your gestoría is going to give you a tool before then, tell me and I will drop it.

Coffee this week?

[NAME]
```

### Follow-up B — the quarter and the gestoría

#### Castellano

```text
Asunto: Del 1 al 20

Entre el 1 y el 20 alguien va a reconstruir el trimestre: compras, ventas, qué factura va con qué movimiento del banco, y por qué aquella reforma fue al tipo reducido. Si nadie lo apuntó entonces, Hacienda puede re-tipar la factura entera.

Con nosotros, el paquete para la gestoría no se cierra con un movimiento sin casar, y el motivo del tipo reducido queda grabado en la factura al emitirla. La gestoría sigue siendo la vuestra; le llega el trimestre ordenado.

Decidme qué gestoría tenéis y le pregunto qué formato quiere.

[NOMBRE]
```

#### Català

```text
Assumpte: El trimestre, aquest cop sense refer-lo

Aviat toca trimestre. Algú de l'oficina es passarà dies lligant factures amb moviments del banc i buscant per què aquella reforma va anar al tipus reduït. Si ningú ho va apuntar llavors, balla tota la factura.

Amb nosaltres el paquet per a la gestoria no es tanca si queda un moviment sense casar, i el motiu del tipus reduït queda gravat a la factura el dia que s'emet. La gestoria és la de sempre; li arriba la feina feta.

Digueu-me quina gestoria teniu i li pregunto en quin format ho vol.

[NOM]
```

#### English (review)

```text
Subject: The 1st to the 20th

Between the 1st and the 20th someone is going to reconstruct the quarter: purchases, sales, which invoice matches which bank movement, and why that renovation went at the reduced rate. If nobody wrote it down then, the tax authority can re-rate the whole invoice.

With us, the package for the gestoría does not close with an unmatched movement, and the reason for the reduced rate is recorded on the invoice at issue. The gestoría stays yours; it receives the quarter in order.

Name your gestoría and I ask which format they want.

[NAME]
```

---

## 3 · LinkedIn message

Under 300 characters each, counted with spaces and merge fields included; the counts are stated after each message and are recomputed by the counting script in the closing checklist. Sent only where the owner's own profile shows the firm; a message to an employee's profile is not sent.

### Castellano

```text
Hola [NOMBRE]. Obras de meses, certificaciones que salen tarde y extras que se quedan en un WhatsApp: eso es lo que arreglamos, sobre vuestros números y sin tocar a vuestra gestoría. ¿Media hora en la obra de [CALLE — comprobar]? Traigo una obra vuestra cerrada.
```

Character count: 262.

### Català

```text
Bon dia [NOM]. Obres llargues, certificacions que surten tard i extres que es queden en un WhatsApp. Això és el que arreglem, amb els vostres números i sense tocar-vos la gestoria. Mitja hora a l'obra de [CARRER — comprovar]? Porteu una obra tancada.
```

Character count: 250.

### English (review)

```text
Hello [NAME]. Months-long jobs, valuations that go out late and extras that stay in a WhatsApp: that is what we fix, on your own numbers and without touching your gestoría. Half an hour at the [STREET — verify] site? I bring one of your closed jobs.
```

Character count: 249.

---

## 4 · One-page leave-behind

Printed on one side of A4, left on the site table after the first visit. Plain type, no photographs, no logo larger than the firm's own name at the top. The "what it does not do" block is not optional and is not moved below the fold: it is the block that makes the rest believable to a buyer who is sold to daily (C8, C12, C13). Where a customer statement belongs there is a placeholder; the page prints without it until a real one exists.

### Castellano

```text
[NOMBRE DEL PRODUCTO — según decida el operador]
Para constructoras de reformas de 12 a 40 personas, con varias obras abiertas a la vez

LA OBRA MANDA. EL PAPEL, NO.

Tres cosas que pasan en una obra de cinco meses:

1. Lo ejecutado no se certifica a tiempo. La medición del mes cuatro se factura en el mes cinco si alguien se acuerda. Y una parte, nunca.
2. El extra que el cliente aceptó de palabra se ejecuta y se discute al final. Sin la firma del cliente, se absorbe.
3. Del 1 al 20, alguien reconstruye el trimestre para la gestoría desde papeles y el extracto del banco.

Qué hace:
- Certificación = ejecutado − ya facturado. La calcula el sistema, no la memoria de nadie.
- El extra es un presupuesto más, enlazado al original. El cliente lo acepta; lo aceptado queda congelado, con las fotos enganchadas a la partida. Se factura porque existe.
- Compras por capítulo: comparas varias ofertas partida a partida, y el precio que falta se ve como que falta, no como un cero.
- La factura vencida se ve junto al extra sin firmar de esa misma obra. Se para antes.
- El paquete para la gestoría no se cierra con un movimiento del banco sin casar. El motivo del tipo reducido queda grabado en la factura el día que se emite.
- Los encargados ven partidas y mediciones. No ven dinero.

Qué no hace (mejor decirlo aquí que descubrirlo después):
- No sustituye a vuestra gestoría. Le llega el trimestre ordenado, en su formato; su cuota sigue siendo suya.
- No lleva el Libro de Subcontratación autorizado. Guarda los papeles de subcontratas y trabajadores con su fecha de caducidad y avisa cuando vencen. El libro sigue en la obra.
- No es todavía el sistema completo para la norma de facturación de 2027. Tiene la numeración sin huecos y la cadena de registros; el formato oficial, el QR y el envío a Hacienda se están construyendo con esa fecha delante.

Precio: 60 € al mes por obra activa. Mínimo 400 €, máximo 900 € al mes por empresa. Todos los usuarios y todas las obras, sin límite. Se cuentan las obras abiertas durante el mes, no las que quedan abiertas el día 31.

Lo que dice un cliente: [REQUIRES CUSTOMER CONSENT]

Siguiente paso: media hora con una obra vuestra ya cerrada. Miramos qué parte de las compras se comparó antes de comprometerlas y qué extras se llegaron a facturar. Con eso sabréis si os sale a cuenta antes de que os lo digamos nosotros.

[NOMBRE] · [MÓVIL] · [CORREO]
```

### Català

```text
[NOM DEL PRODUCTE — segons decideixi l'operador]
Per a constructores de reformes de 12 a 40 persones amb més d'una obra oberta

TRES PREGUNTES ABANS DE LLENÇAR AQUEST FULL

Primera. De l'última obra que vau tancar, quanta feina feta va trigar més d'un mes a certificar-se? I n'hi va haver que no es va certificar mai?
Segona. Quants extres va demanar el client a peu d'obra, i quants es van acabar facturant?
Tercera. Quants dies es va passar algú de l'oficina refent el trimestre per a la gestoria?

Si les tres respostes us fan mal, continueu llegint.

Què fem:
- La certificació surt sola: executat menys ja facturat. Ho calcula el sistema, no la memòria del cap d'obra.
- L'extra és un pressupost més, lligat a l'original. El client l'accepta i queda congelat, amb les fotos enganxades a la partida. Es factura perquè existeix.
- Les compres es comparen per capítol, oferta contra oferta, partida per partida. Un preu que falta es veu que falta; no surt com un zero.
- La factura vençuda es veu al costat de l'extra sense signar de la mateixa obra. S'atura abans.
- El paquet per a la gestoria no es tanca si hi ha un moviment del banc sense casar. El motiu del tipus reduït queda gravat a la factura el dia que s'emet.
- Els encarregats veuen partides i amidaments. Diners, cap.

Què no fem, i ho diem aquí:
- No us traiem la gestoria. Li arriba el trimestre fet, en el format que ens digui. La seva quota és seva.
- No portem el Llibre de Subcontractació autoritzat. Guardem els papers de subcontractes i treballadors amb la data de caducitat i avisem quan vencen. El llibre continua a l'obra.
- Encara no som el sistema complet per a la norma de facturació del 2027. La numeració sense forats i la cadena de registres hi són; el format oficial, el QR i l'enviament a Hisenda els estem acabant amb aquesta data al davant.

Preu: 60 € al mes per obra activa. Mínim 400 €, màxim 900 € al mes per empresa. Tots els usuaris i totes les obres, sense límit. Es compten les obres obertes durant el mes, no les que queden obertes el dia 31.

El que en diu un client: [REQUIRES CUSTOMER CONSENT]

Per començar: mitja hora amb una obra vostra tancada. Mirem quines compres es van comparar abans de comprometre-les i quins extres es van facturar. Amb això ja sabreu si us surt a compte, sense que us ho hàgim de dir nosaltres.

[NOM] · [MÒBIL] · [CORREU]
```

### English (review)

```text
[PRODUCT NAME — as the operator decides]
For renovation building contractors of 12 to 40 people with several sites open at once

THE SITE RULES. THE PAPER DOES NOT.

Three things that happen on a five-month job:

1. Executed work is not valued on time. Month four's measurement is billed in month five if someone remembers. And part of it, never.
2. The extra the client accepted verbally gets built and gets argued about at the end. Without the client's signature, it is absorbed.
3. From the 1st to the 20th, someone reconstructs the quarter for the gestoría from paper and the bank statement.

What it does:
- Valuation = executed minus already billed. The system computes it, not anyone's memory.
- The extra is one more budget, linked to the original. The client accepts it; what was accepted is frozen, with the photos attached to the line item. It gets billed because it exists.
- Purchasing by chapter: you compare several bids line by line, and a missing price shows as missing, not as a zero.
- The overdue invoice is visible next to the unsigned extra on the same job. Work stops sooner.
- The package for the gestoría does not close with an unmatched bank movement. The reason for the reduced rate is recorded on the invoice the day it is issued.
- Foremen see line items and measurements. They do not see money.

What it does not do (better said here than found out later):
- It does not replace your gestoría. The quarter arrives in order, in their format; their fee stays theirs.
- It does not keep the authorised Libro de Subcontratación. It stores subcontractor and worker documents with their expiry dates and warns when they lapse. The book stays on site.
- It is not yet the complete system for the 2027 invoicing rule. Gapless numbering and the chained records are there; the official format, the QR and the submission to the tax authority are being built against that date.

Price: €60 per active site per month. Minimum €400, maximum €900 per month per company. All users and all sites, no limit. Sites open during the month are counted, not those still open on the 31st.

What a customer says: [REQUIRES CUSTOMER CONSENT]

Next step: half an hour with one of your closed jobs. We look at what share of purchases was compared before being committed and which extras actually got billed. That tells you whether it pays before we tell you.

[NAME] · [MOBILE] · [EMAIL]
```

---

## 5 · The 90-second spoken pitch

Written to be said, not read: short breaths, no subordinate clauses that need a second hearing, and the "what we do not do" block spoken before the price so that the price lands on an honest surface. About 220 words in each language. The Castellano and Català are different speeches with the same skeleton — problem, what we do, what we do not do, price, the ask — and the Català leans on the closed-job question more heavily because that is the ask a Vallès owner is most likely to accept on the spot.

### Castellano

```text
Minuto y medio, y luego decidís si merece un café.

Trabajo con constructoras de reformas como la vuestra: de doce a cuarenta personas, varias obras abiertas a la vez. La obra dura cinco meses. Lo del mes cuatro se certifica en el mes cinco, si alguien hizo la medición. Y algo se queda sin certificar. El cliente pide un cambio a pie de obra, el encargado lo hace, y al final se discute si estaba o no. Sin la firma del cliente, se absorbe. Y del uno al veinte, alguien reconstruye el trimestre para la gestoría desde papeles.

Lo que hacemos es concreto. La certificación sale de lo ejecutado menos lo facturado; la calcula el sistema. El extra es un presupuesto más, enlazado al original: el cliente lo acepta, queda congelado, se factura. El paquete para la gestoría no se cierra con un movimiento del banco sin casar.

Lo que no hacemos: no sustituimos a la gestoría. No llevamos el libro de subcontratación autorizado. Y para la norma de facturación de 2027 tenemos la cadena de registros; el envío a Hacienda se está terminando ahora.

Cuesta sesenta euros por obra activa al mes, entre cuatrocientos y novecientos por empresa. Todo el mundo dentro.

Lo que os pido: una obra cerrada. Miramos qué compras se compararon y qué extras se facturaron. Si no sale, os lo digo yo primero.
```

### Català

```text
Un minut i mig, i després em dieu si val un cafè.

Treballo amb constructores de reformes com la vostra. Dotze, vint, quaranta persones. Més d'una obra oberta alhora. Obra de cinc mesos: el que es fa el mes quatre es certifica el mes cinc, si algú va fer l'amidament. I sempre hi ha un tros que no es certifica. El client demana un canvi a peu d'obra, l'encarregat el fa, i al final ve la discussió de si hi era o no. Sense la signatura del client, ho pagueu vosaltres. I quan toca trimestre, algú de l'oficina es passa dies refent-lo per a la gestoria.

Nosaltres fem tres coses. La certificació surt sola: executat menys facturat, ho calcula el sistema. L'extra és un pressupost lligat a l'original: el client l'accepta, queda congelat, es factura. I el paquet per a la gestoria no es tanca mentre hi hagi un moviment del banc sense casar.

El que no fem, dit ara: no us traiem la gestoria. No portem el llibre de subcontractació autoritzat. I per a la norma de facturació del 2027 tenim la cadena de registres; l'enviament a Hisenda l'estem acabant.

Val seixanta euros per obra activa al mes, entre quatre-cents i nou-cents per empresa, tothom inclòs.

El que us demano és una obra tancada. Mirem quines compres vau comparar i quins extres vau cobrar. Si no surt a compte, us ho dic jo abans que ningú.
```

### English (review)

```text
A minute and a half, then you decide whether it is worth a coffee.

I work with renovation building contractors like yours: twelve to forty people, several sites open at once. The job lasts five months. Month four's work gets valued in month five, if someone did the measurement. And something never gets valued. The client asks for a change on site, the foreman does it, and at the end it is argued over. Without the client's signature, it is absorbed. And from the 1st to the 20th, someone reconstructs the quarter for the gestoría from paper.

What we do is concrete. The valuation comes out of executed minus billed; the system computes it. The extra is one more budget, linked to the original: the client accepts it, it is frozen, it is billed. The package for the gestoría does not close with an unmatched bank movement.

What we do not do: we do not replace the gestoría. We do not keep the authorised subcontracting book. And for the 2027 invoicing rule we have the chained records; the submission to the tax authority is being finished now.

It costs sixty euros per active site per month, between four hundred and nine hundred per company. Everyone included.

What I ask: one closed job. We look at which purchases were compared and which extras were billed. If it does not add up, I tell you first.
```

---

## 6 · Referral-request note for a gestoría or aparellador to forward

Two parts: a three-line cover to the adviser, and the note itself, written so that the adviser can forward it unchanged. The cover answers the adviser's only real question — is my fee at risk — with C12 before they ask it. The note says the same two honest things the leave-behind says (C8, C13) because a referral that over-promises costs the adviser their credibility, which is the one thing the channel runs on. Two switchable lines are marked for the aparellador variant: the aparellador cares about the certificación and the accepted variation (C2, C4), the gestoría about the closed quarter (C11).

### Castellano

```text
Para [NOMBRE DEL GESTOR / APARELLADOR — verificar que tiene clientes constructores antes de enviar]:

Si tienes un cliente constructor de reformas con cuatro o más obras abiertas y un trimestre que te llega en papel, esto es para reenviárselo tal cual. Tu cuota no está en juego: el trimestre te llega cerrado, en el formato que tú nos digas, y tú sigues siendo su gestoría. Si te parece bien, dime qué formato quieres y lo preparamos así.

---

Hola:

Te escribo porque [NOMBRE DEL GESTOR / APARELLADOR] me ha dicho que os puede interesar; si no es así, con un "no" me vale.

Trabajamos con constructoras de reformas de 12 a 40 personas. Tres cosas, y nada más:

- La certificación sale sola de lo ejecutado menos lo facturado. [VARIANTE APARELLADOR: la certificación se calcula sobre la medición, no sobre lo que alguien recuerda, y el extra lleva las fotos enganchadas a la partida.]
- El extra que el cliente acepta a pie de obra queda por escrito y se factura, en vez de absorberse.
- El trimestre le llega a [NOMBRE DEL GESTOR] cerrado, sin ningún movimiento del banco sin casar, con el motivo de cada tipo reducido grabado en la factura. [NOMBRE DEL GESTOR] sigue siendo vuestra gestoría.

Lo que no hacemos, para que quede dicho: no llevamos el libro de subcontratación autorizado, y para la norma de facturación de 2027 tenemos la cadena de registros, no todavía el envío a Hacienda; eso se está terminando con esa fecha.

Si os cuadra, media hora con una obra ya cerrada. Se mira sobre vuestros números y se decide.

[NOMBRE] · [MÓVIL]
```

### Català

```text
Per a [NOM DEL GESTOR / APARELLADOR — comprovar que porta constructores abans d'enviar]:

Si tens algun client constructor de reformes amb quatre obres obertes o més, i cada trimestre t'arriba en una capsa de sabates, reenvia-li això tal com està. La teva quota no hi entra: el trimestre t'arribarà tancat, en el format que tu ens diguis, i continues sent la seva gestoria. Si et va bé, digue'm quin format vols i ho muntem així.

---

Bon dia,

Us escric perquè [NOM DEL GESTOR / APARELLADOR] m'ha dit que potser us interessa. Si no, un "no" i llestos.

Treballem amb constructores de reformes de 12 a 40 persones. Fem tres coses:

- La certificació surt sola, del que s'ha executat menys el que ja s'ha facturat. [VARIANT APARELLADOR: es calcula sobre l'amidament, no sobre el que algú recorda, i l'extra porta les fotos enganxades a la partida.]
- L'extra que el client accepta a peu d'obra queda per escrit i es cobra, en lloc d'assumir-lo vosaltres.
- El trimestre arriba a [NOM DEL GESTOR] tancat, sense cap moviment del banc sense casar, i amb el motiu de cada tipus reduït gravat a la factura. [NOM DEL GESTOR] continua sent la vostra gestoria.

El que no fem, perquè quedi dit: no portem el llibre de subcontractació autoritzat, i per a la norma de facturació del 2027 tenim la cadena de registres però encara no l'enviament a Hisenda; s'està acabant amb aquesta data al davant.

Si us quadra, mitja hora amb una obra tancada. Es mira amb els vostres números i decidiu.

[NOM] · [MÒBIL]
```

### English (review)

```text
To [ADVISER / SURVEYOR NAME — verify they have contractor clients before sending]:

If you have a renovation-contractor client with four or more sites open and a quarter that reaches you on paper, this is for forwarding as is. Your fee is not in play: the quarter reaches you closed, in the format you tell us, and you remain their gestoría. If that suits you, tell me which format you want and we prepare it that way.

---

Hello:

I am writing because [ADVISER / SURVEYOR NAME] told me this might interest you; if not, a "no" is enough.

We work with renovation building contractors of 12 to 40 people. Three things, and nothing else:

- The progress valuation comes out by itself from executed minus billed. [SURVEYOR VARIANT: the valuation is computed on the measurement, not on what someone remembers, and the extra carries the photos attached to the line item.]
- The extra the client accepts on site is put in writing and billed, instead of being absorbed.
- The quarter reaches [ADVISER NAME] closed, with no bank movement unmatched, and with the reason for every reduced rate recorded on the invoice. [ADVISER NAME] remains your gestoría.

What we do not do, so it is on record: we do not keep the authorised subcontracting book, and for the 2027 invoicing rule we have the chained records, not yet the submission to the tax authority; that is being finished against that date.

If it fits, half an hour with one closed job. It is looked at on your numbers and you decide.

[NAME] · [MOBILE]
```

---

## Do not send until

1. **Every merge field is resolved and verified.** No square-bracketed capitals remain in the outgoing text. The site reference (`[CARRER, MUNICIPI]` / `[CALLE, MUNICIPIO]`) was checked on the firm's own website or the municipal works permit, not inferred from `04-PROSPECTS.jsonl`, whose municipality field failed audit at 30.8% error. The name in the salutation appears in the Registro Mercantil or on the firm's website, or the salutation is the neutral form.
2. **The contact channel is one the GDPR posture allows.** Row 39's webmail address and row 70's mobile-shaped number get a manual look (`04-EXTRACTION-QA.md`); row 114's email field is the phone number duplicated and is not an address; Delgado & Dilla and Lluca have no recovered channel and are reached through the registry or a referral, not a guessed address.
3. **Every consent placeholder is resolved.** Each `[REQUIRES CUSTOMER CONSENT]` is either replaced with a quotation that a named customer approved in writing, or the line is deleted. The page prints without a testimonial before it prints with an unapproved one.
4. **The 2027 wording is re-checked against `03-TRIGGER-MAP.md` §1 on the day of sending.** The date (1 January 2027 for an S.L.), the user's exposure (€50,000 per financial year) and the sentence "the hard half is built, the last mile to the tax authority is not" are still true. If the submission channel has shipped since this kit was written, the wording changes to what `03-TRIGGER-MAP.md` then says, and not before. The word "compliant" does not appear in any language.
5. **No figure from the value model has crept in.** The 1.5% overpayment, the 30% of extras, the six days per quarter, the month-5 payback and the 9.7:1 ratio are modelled assumptions (`06-VALUE-CASE.md` §6) and are asked as questions about the prospect's own closed job, never stated about their firm.
6. **The Català was read once by a native speaker** before the first send to a Catalan-first prospect, and the person who will take the call is a Catalan speaker (`08-GTM-PLAN.md` §5).
7. **The word counts hold.** First-touch under 120 words per language, follow-ups under 100, LinkedIn under 300 characters, counted on the final merged text, not on this template.
8. **The three qualifying questions are ready for the call** (`06-VALUE-CASE.md` §2.6): turnover against the €6,010,121.04 threshold, the last pre-qualification pack, and whether an accounting package is already in place. A firm that fails one is told so on the call, not sold to.
