/* The client-review Part 1, as ONE story, in one browser, in order — the way
   the operator will actually live it.
   Run: node tests/real-life/run.mjs Not a re-test of each stage (the suites own
   that); a proof that the stages CHAIN: the statement that was imported is the
   movement that gets matched to the invoice that was registered from the
   captured document, the card purchase pays by card, the cash payment lands on
   the partida, the hours price from the overtime band, the variation joins the
   economics, and the quarter leaves as a ZIP whose xlsx names them all. */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..", "..");
const ROOT = path.resolve(REPO, "site");
// Same resilient resolution the site-e2e harness uses: the pinned pnpm path,
// then whatever the environment provides.
let chromium = null;
for (const spec of [
  path.resolve(
    REPO,
    "node_modules/.pnpm/playwright-core@1.61.1/node_modules/playwright-core/index.js",
  ),
  "playwright-core",
  "playwright",
]) {
  try {
    const m = await import(spec);
    chromium = (m.default || m).chromium;
    if (chromium) break;
  } catch {}
}
if (!chromium) throw new Error("playwright-core not found (run `pnpm install`)");
const CHROME =
  process.env.CHROME_PATH ||
  ["/opt/pw-browsers/chromium", "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"].find((x) =>
    fs.existsSync(x),
  ) ||
  undefined;
const srv = http.createServer((q, r) => {
  const p = path.join(ROOT, decodeURIComponent(q.url.split("?")[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) {
    r.writeHead(404);
    return r.end();
  }
  const e = path.extname(p);
  r.writeHead(200, {
    "content-type":
      e === ".js" ? "text/javascript" : e === ".html" ? "text/html" : "application/octet-stream",
  });
  r.end(fs.readFileSync(p));
});
await new Promise((r) => srv.listen(0, "127.0.0.1", r));
const port = srv.address().port;
const br = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
const pg = await br.newPage({ viewport: { width: 1440, height: 950 } });
const steps = [];
const ok = (n, d) => steps.push({ n, pass: true, d: d || "" });
const bad = (n, d) => steps.push({ n, pass: false, d: String(d || "") });
pg.on("pageerror", (e) => bad("console", e.message));

await pg.goto(`http://127.0.0.1:${port}/erp.html#banking`);
await pg.waitForTimeout(2800);

// 1 · the BBVA statement, through the real file input, onto the bank account
await pg.evaluate(() => {
  const sel = document.getElementById("bkSel");
  const bank = erp.state.bankAccounts.find((a) => a.kind === "bank");
  sel.value = bank.id;
  sel.dispatchEvent(new Event("change", { bubbles: true }));
});
await pg.waitForTimeout(500);
const movBefore = await pg.evaluate(() => erp.state.movements.length);
await pg.setInputFiles("#bkFile", path.resolve(REPO, "tests/fixtures/bbva-movimientos.xlsx"));
await pg.waitForTimeout(900);
await pg.click("#stGo");
await pg.waitForTimeout(600);
const movAfter = await pg.evaluate(() => erp.state.movements.length);
if (movAfter === movBefore + 3) ok("statement imported", `${movBefore} → ${movAfter}`);
else bad("statement imported", `${movBefore} → ${movAfter}`);

// 2 · a captured supplier document becomes a bill whose base MATCHES the
//     statement's charge, through the promote drawer
const capInfo = await pg.evaluate(async () => {
  const sup = erp.state.parties.find((p) =>
    (p.roles || []).some((r) => ["supplier", "subcontractor", "selfEmployed"].includes(r)),
  );
  // The photographed page itself, so the export has real bytes to ship.
  await ErpStore.putBlob("rl_blob", new Blob([new Uint8Array(180)], { type: "image/jpeg" }));
  const c = erp.captureDocument({ docType: "supplierInvoice", imageRef: "rl_blob" }, "bo");
  erp.confirmCapture(
    c.id,
    {
      issuerName: sup.name,
      issuerTaxId: sup.taxId,
      docNumber: "RL-ENDESA-77",
      date: "2026-03-03",
      baseCents: 7215,
      vatCents: 1515,
      totalCents: 8730, // exactly the statement's RECIBO ENDESA line
    },
    "bo",
  );
  return { capId: c.id, supName: sup.name };
});
await pg.evaluate((id) => captureDrawer(id), capInfo.capId);
await pg.waitForTimeout(400);
await pg.click("#cd_bill");
await pg.waitForTimeout(400);
/* Since PK12 a bill must be allocated — a cost that belongs to nothing is the
   one thing the rule forbids. An electricity bill is a general expense, so it
   goes where general expenses go, and the drawer refuses before the engine if
   it does not. */
await pg.evaluate(() => {
  const dest = document.querySelector('#bd_rows [data-ai="0"][data-k="dest"]');
  dest.value = "o:office";
  dest.dispatchEvent(new Event("change", { bubbles: true }));
});
await pg.waitForTimeout(300);
await pg.click("#bd_go");
await pg.waitForTimeout(600);
const bill = await pg.evaluate(() => {
  const b = erp.state.bills.find((x) => x.number === "RL-ENDESA-77");
  return b && { id: b.id, total: b.totalCents, name: b.supplierName, taxId: b.supplierTaxId };
});
if (bill && bill.total === 8730 && bill.name && bill.taxId)
  ok("capture → bill", `${bill.name} · ${bill.taxId}`);
else bad("capture → bill", JSON.stringify(bill));

// 3 · the imported charge is MATCHED to that bill in Conciliación; the bill is paid
const matched = await pg.evaluate((billId) => {
  const m = erp.state.movements.find(
    (x) =>
      /RECIBO ENDESA/.test((x.concept || "") + " " + (x.merchantText || "")) &&
      x.status === "unallocated",
  );
  if (!m) return { fail: "movement not found" };
  erp.matchMovement(m.id, { billId }, "bo");
  return { status: m.status, outstanding: erp.billOutstandingCents(billId) };
}, bill.id);
if (matched.status === "matched" && matched.outstanding === 0)
  ok("statement line matched, bill paid by the match");
else bad("match", JSON.stringify(matched));

// 4 · the card: an account, its statement, a purchase matched → paid BY CARD;
//     the bank line that pays the card marked as its settlement
const card = await pg.evaluate(() => {
  const c = erp.addBankAccount({ name: "Visa RL", kind: "card" }, "bo");
  erp.importMovements(
    c.id,
    [{ accountingDate: "2026-03-04", concept: "FERRETERIA RL", amountCents: -6050 }],
    "bo",
  );
  const sup = erp.state.parties.find((p) => (p.roles || []).includes("supplier"));
  const b = erp.registerBill(
    {
      supplierId: sup.id,
      number: "RL-FERR-9",
      baseCents: 5000,
      vatBp: 2100,
      // This block is about the CARD path — purchase, match, settlement — not
      // about where the cost lands, so it lands where a tool purchase does.
      allocations: [{ overheadCategory: "fixedAsset", kind: "material", amountCents: 5000 }],
    },
    "bo",
  );
  const mv = erp.state.movements.find((x) => x.accountId === c.id);
  erp.matchMovement(mv.id, { billId: b.id }, "bo");
  const pay = erp.state.payments.find((x) => x.movementId === mv.id);
  const bank = erp.state.bankAccounts.find((a) => a.kind === "bank");
  const settle = erp.importMovements(
    bank.id,
    [{ accountingDate: "2026-03-31", concept: "LIQ VISA RL", amountCents: -6050 }],
    "bo",
  )[0];
  erp.markCardSettlement(settle.id, c.id, "bo");
  return {
    method: pay && pay.method,
    cls: settle.class,
    link: settle.cardSettlement.accountId === c.id,
  };
});
if (card.method === "card" && card.cls === "internalTransfer" && card.link)
  ok("card purchase paid BY CARD; settlement is an internal transfer naming the card");
else bad("card", JSON.stringify(card));

// 5 · a cash payment onto a partida, and an unexplained fee explained
const cash = await pg.evaluate(() => {
  const till =
    erp.state.bankAccounts.find((a) => a.kind === "till") ||
    erp.addBankAccount({ name: "Caja RL", kind: "till" }, "bo");
  const p = erp.state.projects.find(
    (x) =>
      x.budgetId &&
      x.acceptedVersionId &&
      !x.closed &&
      erp.version(x.budgetId, x.acceptedVersionId).chapters.some((c) => c.lines.length),
  );
  const v = erp.version(p.budgetId, p.acceptedVersionId);
  const chp = v.chapters.find((c) => c.lines.length);
  const rec = erp.recordCashMovement(
    till.id,
    {
      accountingDate: "2026-03-06",
      concept: "Tornillería RL",
      amountCents: -2350,
      supportingDocRef: "ticket",
    },
    "bo",
  );
  erp.splitMovement(
    rec.id,
    [{ projectId: p.id, lineId: chp.lines[0].id, kind: "material", amountCents: 2350 }],
    "bo",
  );
  const bank = erp.state.bankAccounts.find((a) => a.kind === "bank");
  const fee = erp.importMovements(
    bank.id,
    [{ accountingDate: "2026-03-08", concept: "COMISION MANTENIMIENTO RL", amountCents: -1450 }],
    "bo",
  )[0];
  erp.markMovementUnbacked(fee.id, "comision", "bo");
  const explained = fee.unbacked.reason;
  return {
    pid: p.id,
    alloc: rec.allocations[0],
    explained,
    drill: erp
      .chapterCosts(p.id, rec.allocations[0].chapterNum)
      .some((r) => r.ref === "Tornillería RL"),
  };
});
if (cash.alloc && cash.alloc.lineId && cash.drill)
  ok("cash payment on the partida, visible in the chapter drill-down");
else bad("cash", JSON.stringify(cash));

// 6 · hours at the overtime rate, on a partida
const hours = await pg.evaluate((pid) => {
  const w = erp.state.workers.find((x) => x.active !== false);
  erp.addWorkerRate(
    w.id,
    { from: erp.state.today, rateCentsPerHour: 2100, extraRateCentsPerHour: 2700 },
    "bo",
  );
  const p = erp.project(pid);
  const v = erp.version(p.budgetId, p.acceptedVersionId);
  const chp = v.chapters.find((c) => c.lines.length);
  const rec = erp.recordHours(
    {
      workerId: w.id,
      projectId: pid,
      lineId: chp.lines[0].id,
      kind: "extra",
      hoursMilli: 2000,
      date: erp.state.today,
    },
    "op",
  );
  return { rate: rec.rateCents, line: !!rec.lineId };
}, cash.pid);
if (hours.rate === 2700 && hours.line) ok("overtime hours priced from their band, on the partida");
else bad("hours", JSON.stringify(hours));

// 7 · a variation budget joins the project
const variation = await pg.evaluate((pid) => {
  const b = erp.createVariationBudget(pid, { reason: "RL extra", scheduleImpactDays: 5 }, "bo");
  const ch = erp.addChapter(b.id, { name: "Extra RL" }, "bo");
  erp.addLine(
    b.id,
    ch.id,
    { desc: "Trabajo extra RL", unit: "ud", qtyMilli: 1000, priceCents: 50000, costCents: 30000 },
    "bo",
  );
  erp.issueVersion(b.id, {}, "bo");
  erp.acceptVersion(b.id, erp.currentVersion(b.id).id, { evidenceRef: "firmado" }, "bo");
  const ec = erp.projectEconomics(pid);
  return { vr: ec.variationRevenueCents, cur: ec.currentRevenueCents > 0 };
}, cash.pid);
if (variation.vr >= 50000)
  ok("variation accepted and inside the economics", `+${variation.vr / 100} €`);
else bad("variation", JSON.stringify(variation));

// 8 · the quarter leaves as a ZIP, read back by the importer's own reader
const zip = await pg.evaluate(async () => {
  const q = "2026-Q1";
  for (const x of erp.exceptionsWithStatus(q).filter((r) => !r.accepted))
    erp.acceptException(q, x.key, "cierre RL", "bo");
  const pkg = erp.quarterlyPackage(q, { recipient: "Gestoría RL" }, "bo");
  const z = await buildAccountantZip(q, pkg);
  const bytes = new Uint8Array(await z.blob.arrayBuffer());
  const dir = ErpImport.zip.centralDirectory(bytes);
  const sheet = await ErpImport.zip.readEntry(bytes, dir["conciliacion.xlsx"]);
  const rows = await ErpImport.parseXlsxRows(sheet);
  /* The workbook opens with the company's identity now (PK-O), so the column
     titles are not row 1 any more, and below the table sits the legal foot.
     Found by what the header CONTAINS and counted to the first blank line —
     the same reading tests/site-e2e uses on this file, deliberately copied
     rather than invented a second time. Reading it the old way counted five
     rows of branding as movements and looked up every column in the wrong
     row, which is how this went red on a workbook that was perfectly correct. */
  const headerRow = rows.findIndex((r) => (r || []).includes("Nº documento"));
  const head = rows[headerRow] || [];
  const body = [];
  for (const r of rows.slice(headerRow + 1)) {
    if (!(r || []).some((c) => String(c || "").trim())) break;
    body.push(r);
  }
  const col = (n) => head.indexOf(n);
  const docEntries = Object.keys(dir).filter((n) => n.startsWith("docs/"));
  return {
    rows: body.length,
    movements: pkg.bankMovements.length,
    hasMatched: body.some((r) => r[col("Nº documento")] === "RL-ENDESA-77" && r[col("NIF")]),
    hasReason: body.some((r) => r[col("Motivo sin factura")]),
    entries: Object.keys(dir).length,
    docEntries: docEntries.length,
  };
});
if (zip.rows === zip.movements && zip.hasMatched && zip.hasReason && zip.docEntries > 0)
  ok(
    "quarter exported: the xlsx names the matched invoice WITH its tax id and the explained fee WITH its reason",
    `${zip.rows} rows, ${zip.entries} entries`,
  );
else bad("export", JSON.stringify(zip));

console.log("──── real-life scenario ────");
for (const st of steps) console.log(`${st.pass ? "✓" : "✗"} ${st.n}${st.d ? " — " + st.d : ""}`);
const failed = steps.filter((s) => !s.pass);
console.log(`${steps.length - failed.length}/${steps.length} steps passed`);
await br.close();
srv.close();
process.exit(failed.length ? 1 : 0);
