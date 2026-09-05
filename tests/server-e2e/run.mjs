/**
 * End-to-end checks against a RUNNING server with a real database.
 *
 *   ERP_BASE_URL=http://127.0.0.1:3000 node tests/server-e2e/run.mjs
 *
 * Skips (exit 0) when ERP_BASE_URL is unset, so `pnpm test` on a laptop stays
 * green. The deploy workflow runs it against the published image, which is the
 * point: unit tests cannot tell you that `public/` was left out of the
 * container, or that the app is connecting with privileges it will not have in
 * production. Both have already happened here once.
 *
 * Deliberately HTTP-only — no browser — so it runs on any runner. The browser
 * side is covered by tests/site-e2e/run.mjs.
 */
const BASE = process.env.ERP_BASE_URL;
const TENANT = process.env.ERP_TEST_TENANT || "reformas-demo";
/* Optional. Set together, they make the suite sign in rather than rely on a
   single-seat operator, which is what lets it be somebody else further down. */
const ADMIN_EMAIL = process.env.ERP_E2E_ADMIN?.trim() || "";
const ADMIN_PASSWORD = process.env.ERP_E2E_ADMIN_PASSWORD ?? "";

if (!BASE) {
  console.log("server-e2e: skipped (set ERP_BASE_URL to run)");
  process.exit(0);
}

/* =============================================================================
   THIS SUITE WRITES. IT MUST NEVER WRITE INTO SOMEBODY'S REAL TENANT.

   It creates customers named «E2E <timestamp>» carrying generated tax
   identifiers, and it is meant to run against a throwaway database — the
   postgres service in the deploy workflow, or a local one. Pointed at a live
   instance it leaves records that read to the operator as corrupted data: a
   client whose name is a timestamp, anything later built on top of that
   client (a quote, a contract) inheriting the name, and a generated tax
   identifier that then blocks a real registration through the MDM-03
   uniqueness rule. All three were reported from the tenant's own screens on
   28/08, and the customer at the root of each was this suite's residue.

   So the target is checked before a single write: the tenant must look like a
   test tenant, or the operator must say out loud that they mean it. The
   allow-list is deliberately about the TENANT, not the URL — an operator can
   run a demo tenant on any host, and a production tenant on localhost.
   ========================================================================== */
const TEST_TENANTS = new Set(["reformas-demo", "e2e", "test"]);
if (!TEST_TENANTS.has(TENANT) && process.env.ERP_ALLOW_WRITES_HERE !== "yes") {
  console.error(
    `server-e2e: refusing to write into tenant "${TENANT}".\n` +
      `  This suite creates records that a person would have to clean up by hand.\n` +
      `  Known test tenants: ${[...TEST_TENANTS].join(", ")}.\n` +
      `  If you really mean this one, set ERP_ALLOW_WRITES_HERE=yes.`,
  );
  process.exit(1);
}

const results = [];
const ok = (name, detail = "") => results.push({ name, pass: true, detail });
const bad = (name, detail) => results.push({ name, pass: false, detail });
const check = (name, cond, detail = "") => (cond ? ok(name, detail) : bad(name, detail));

/**
 * WHO THIS SUITE IS, AND WHY IT CAN BE SOMEBODY ELSE.
 *
 * The server has two ways to know who is calling: one named operator in the
 * environment (`ERP_OPERATOR`, the single-seat pilot shape), or real accounts
 * with a signed session cookie. Under the first there is exactly one identity
 * and it is an administrator, so the site worker's boundary — the whole point
 * of the hours release — cannot be exercised at all: there is nobody to be.
 *
 * So the suite carries a cookie. Empty by default, which is the single-seat
 * case and behaves exactly as it did before. When `ERP_E2E_ADMIN` and
 * `ERP_E2E_ADMIN_PASSWORD` are set the suite signs in with them first, and can
 * then create a second account, sign in AS that account, and check what it is
 * refused. `as(cookie, fn)` swaps identity for the length of one block.
 */
let COOKIE = "";

const api = (path, init = {}) =>
  fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      ...(COOKIE ? { cookie: COOKIE } : {}),
      ...(init.headers ?? {}),
    },
  });

async function as(cookie, fn) {
  const was = COOKIE;
  COOKIE = cookie;
  try {
    return await fn();
  } finally {
    COOKIE = was;
  }
}

/**
 * Sign in and return the session cookie, or "" if the credentials were refused.
 *
 * The login route answers a form post with a 303 and a Set-Cookie, because it
 * has to work without JavaScript. `redirect: "manual"` is what keeps fetch from
 * following the redirect and throwing the header away.
 */
async function signIn(email, password) {
  const body = new URLSearchParams({ email, password });
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    redirect: "manual",
  });
  const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  const set = raw.length ? raw : [res.headers.get("set-cookie") ?? ""];
  const jar = set
    .filter(Boolean)
    .map((c) => c.split(";")[0])
    .join("; ");
  return jar;
}

const json = async (res) => {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text.slice(0, 200) };
  }
};

/**
 * A NIF the engine will accept: eight digits plus the check letter it derives
 * from them. Generated fresh per run, because the engine rejects a duplicate
 * tax id on an active party — rightly — and a fixed one would make this suite
 * pass once and then fail against the same database forever.
 */
const NIF_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE";
function freshTaxId(seed) {
  const digits = String(seed % 100_000_000).padStart(8, "0");
  return digits + NIF_LETTERS[Number(digits) % 23];
}
const RUN = Date.now();

/**
 * A party the engine will accept. `n` keeps tax ids distinct within a run.
 *
 * The mobile is unique per run too. A shared one made this suite intermittent:
 * the engine's soft duplicate check matches on tax id OR name OR phone, so an
 * accumulated pile of test parties sharing 600000000 changed which record it
 * matched. That intermittency was worth chasing — it was the engine admitting
 * genuine duplicate tax ids, now fixed and pinned in manageability-sim.mjs.
 */
const party = (name, n = 0) => ({
  name,
  taxId: freshTaxId(RUN + n),
  roles: ["customer"],
  billStreet: "Carrer de Prova 1",
  billPostalCode: "08240",
  billCity: "Manresa",
  mobile: `6${String((RUN + n) % 100_000_000).padStart(8, "0")}`,
  leadSource: "Web",
});

const command = (body, query = "") =>
  api(`/api/${TENANT}/erp/command${query}`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
  });

async function main() {
  // --- the app is alive and has a database -------------------------------
  {
    const res = await api("/api/health");
    const body = await json(res);
    check("health reports ok", body.status === "ok", JSON.stringify(body));
    check("health reports a connected database", body.database === "connected");
  }

  // --- the workspace UI is actually served -------------------------------
  // The image once shipped without tenants/ and reported healthy while every
  // tenant request failed. `public/` is the same shape of trap: it is NOT
  // traced into the standalone output and must be copied explicitly, and
  // without it the server hosts an API with no user interface.
  {
    const res = await fetch(`${BASE}/workspace/erp.html`);
    const html = await res.text();
    check("the workspace page is served", res.ok, `HTTP ${res.status}`);
    const marked = /<meta\s+name="erp-api"/.test(html);
    check(
      "and is marked to use the server, not IndexedDB",
      marked,
      marked ? "erp-api marker present" : "no erp-api marker — sync-workspace.mjs did not run",
    );
    const engine = await fetch(`${BASE}/workspace/erp-engine.js`);
    check("its scripts are served too", engine.ok, `erp-engine.js HTTP ${engine.status}`);
  }

  // --- reading state ------------------------------------------------------
  let version;
  {
    const res = await api(`/api/${TENANT}/erp/state`);
    const body = await json(res);
    check(
      "the ERP state is readable",
      res.ok,
      `HTTP ${res.status} ${JSON.stringify(body).slice(0, 120)}`,
    );
    check("it carries a version", typeof body.version === "number", `version=${body.version}`);
    version = body.version;
  }

  // --- unknown tenants are refused, not silently created ------------------
  {
    const res = await api("/api/definitely-not-a-tenant/erp/state");
    check(
      "an unknown tenant is a 404, not an empty new company",
      res.status === 404,
      `HTTP ${res.status}`,
    );
  }

  // --- the workspace's permission lookup (S2: client-side bank-details gate)
  {
    const res = await api(`/api/${TENANT}/session`);
    const body = await json(res);
    check(
      "GET /api/~/session identifies the acting user",
      res.ok && typeof body.email === "string" && body.email.length > 0,
      `HTTP ${res.status} ${JSON.stringify(body).slice(0, 120)}`,
    );
    check(
      "and reports a role and a bank-details permission",
      typeof body.role === "string" && typeof body.bankRead === "boolean",
      JSON.stringify(body).slice(0, 120),
    );
  }

  // --- the command whitelist is closed ------------------------------------
  for (const name of ["constructor", "__proto__", "issueInvoice", "toJSON"]) {
    const res = await command({ command: name, args: [], expectedVersion: version });
    check(`"${name}" is not callable`, res.status === 400, `HTTP ${res.status}`);
  }

  // --- a write must quote the version it read -----------------------------
  {
    const res = await command({ command: "addParty", args: [party("No Version", 2)] });
    check("a write without expectedVersion is refused", res.status === 400, `HTTP ${res.status}`);
  }

  // --- a real write lands and is attributed -------------------------------
  const unique = `E2E ${new Date().toISOString()}`;
  {
    const res = await command({
      command: "addParty",
      args: [party(unique)],
      expectedVersion: version,
    });
    const body = await json(res);
    check(
      "a whitelisted command succeeds",
      res.ok,
      `HTTP ${res.status} ${JSON.stringify(body).slice(0, 160)}`,
    );
    check(
      "the version advances by one",
      body.version === version + 1,
      `${version} → ${body.version}`,
    );

    const after = await json(await api(`/api/${TENANT}/erp/state`));
    check(
      "the record is in the database, not just the response",
      (after.state?.parties ?? []).some((p) => p.name === unique),
    );
    const last = (after.state?.audit ?? []).at(-1);
    check(
      "the change is attributed to a named operator",
      typeof last?.user === "string" && last.user.length > 0,
      `user=${last?.user}`,
    );
    version = body.version;
  }

  // --- the check that decides whether two people can use this -------------
  {
    const stale = version - 1;
    const res = await command({
      command: "addParty",
      args: [party("Second Writer", 1)],
      expectedVersion: stale,
    });
    const body = await json(res);
    check("a stale write is refused with 409", res.status === 409, `HTTP ${res.status}`);
    check(
      "and is told which version won",
      body.currentVersion === version,
      JSON.stringify(body).slice(0, 160),
    );

    const after = await json(await api(`/api/${TENANT}/erp/state`));
    check(
      "the earlier writer's record is untouched",
      (after.state?.parties ?? []).some((p) => p.name === unique) &&
        !(after.state?.parties ?? []).some((p) => p.name === "Second Writer"),
    );
  }

  /* --- ATTACHMENTS THAT ARE NOT PHOTOGRAPHS -------------------------------
     The page asks for a PDF wherever it asks for the document behind a
     decision — the email accepting a quote, the signed contract, the
     delivery note behind an extra: `EV_ACCEPT` is "image/*,application/pdf"
     and `evidenceField` stores a PDF byte for byte, because a document that
     has been re-encoded is no longer the document that was signed. The blob
     endpoint's allow-list was images only, so every one of those uploads was
     refused by the server while the screen offered them. Reported on 28/08.

     A real (tiny) PDF, not a renamed text file: the point is the round trip,
     and a check that would pass on bytes no reader could open is not one. */
  {
    const key = `ev_e2e_${RUN.toString(36)}`;
    const pdf = Buffer.from(
      "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
        "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
        "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 99 99]>>endobj\n" +
        "trailer<</Root 1 0 R>>\n%%EOF\n",
      "utf8",
    );
    const put = await fetch(`${BASE}/api/${TENANT}/erp/blob/${key}`, {
      method: "PUT",
      headers: { "content-type": "application/pdf" },
      body: pdf,
    });
    const putBody = await json(put);
    check(
      "a PDF attachment is accepted, not refused as 'must be an image'",
      put.ok,
      `HTTP ${put.status} ${JSON.stringify(putBody).slice(0, 140)}`,
    );

    const got = await fetch(`${BASE}/api/${TENANT}/erp/blob/${key}`);
    const back = Buffer.from(await got.arrayBuffer());
    check(
      "and comes back byte for byte, as a PDF",
      got.ok &&
        (got.headers.get("content-type") || "").startsWith("application/pdf") &&
        back.equals(pdf),
      `HTTP ${got.status} type=${got.headers.get("content-type")} bytes=${back.length}/${pdf.length}`,
    );

    // The allow-list is still a list. An SVG is a document that can carry
    // script, served from the company's own origin beside its session
    // cookie — widening the list for PDFs must not have widened it for that.
    const svg = await fetch(`${BASE}/api/${TENANT}/erp/blob/${key}_svg`, {
      method: "PUT",
      headers: { "content-type": "image/svg+xml" },
      body: '<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>',
    });
    check("an SVG is still refused", svg.status === 400, `HTTP ${svg.status}`);

    await fetch(`${BASE}/api/${TENANT}/erp/blob/${key}`, { method: "DELETE" });
  }

  // --- business rules still belong to the engine --------------------------
  {
    const res = await command({
      command: "addParty",
      args: [party(`${unique} (again)`)],
      expectedVersion: version,
    });
    const body = await json(res);
    const msg = body.message ?? "";
    check(
      "a duplicate tax id is refused by the engine, in its own words",
      res.status === 409 && /ya existe un registro activo/i.test(msg),
      `HTTP ${res.status} ${msg}`,
    );
    /* And it says WHICH record holds it. The refusal used to name only the
       identifier the operator already knew — which sent them looking through
       a register that does not list every role and does not search a tax id.
       Naming the holder is the property that made the message usable, so it
       is the property this asserts, not merely that something was refused. */
    check("…and the refusal names the record that already holds it", msg.includes(unique), msg);
  }

  // --- moving an existing document onto the server ------------------------
  {
    const importUrl = (q = "") => `${BASE}/api/${TENANT}/erp/import${q}`;
    const post = (body, q = "") =>
      fetch(importUrl(q), {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(body),
      });

    // A wrong file must not import as an empty company and look like it worked.
    const junk = await post({ hello: "world" });
    check(
      "a file that is not an ERP export is refused",
      junk.status === 400,
      `HTTP ${junk.status}`,
    );

    // A tenant that already holds records is a company already operating.
    const clobber = await post({
      _meta: {},
      data: { parties: [], seq: { id: 1 }, today: "2026-01-05" },
    });
    check(
      "importing over existing data is refused without an explicit overwrite",
      clobber.status === 409,
      `HTTP ${clobber.status}`,
    );

    // …and even then, the version has to match.
    const stale = await post(
      { _meta: {}, data: { parties: [], seq: { id: 1 }, today: "2026-01-05" } },
      "?overwrite=true&expectedVersion=99999",
    );
    check(
      "overwriting with a stale version is refused",
      stale.status === 409,
      `HTTP ${stale.status}`,
    );

    const untouched = await json(await api(`/api/${TENANT}/erp/state`));
    check(
      "and none of that emptied the company",
      (untouched.state?.parties ?? []).length > 0,
      `parties=${(untouched.state?.parties ?? []).length}`,
    );
  }

  await siteWorkerBoundary();
}

/**
 * R2 · what a site worker is REFUSED, checked against the running server.
 *
 * The role existed as a label for months: it named a set of permissions that
 * nothing consulted. `POST /erp/command` had no permission check at all, and
 * `PUT /erp/state` accepted a whole client-computed document from anybody who
 * was signed in — so an account meant to type its own hours could rewrite the
 * invoice register, and did receive every bank line in its state response.
 *
 * Unit tests cover the functions; this covers the WIRE, which is where it
 * actually failed. Four refusals and one redaction, as a second account, over
 * HTTP, against a real database.
 *
 * Skipped when the server has no named accounts (single-seat `ERP_OPERATOR`),
 * because then there is only one identity and it is an administrator. The
 * deploy workflow configures accounts precisely so this runs.
 */
async function siteWorkerBoundary() {
  if (!ADMIN_EMAIL || !COOKIE) {
    console.log("site-worker boundary: skipped (no named accounts configured)");
    return;
  }

  const email = `e2e-site-${RUN}@example.com`;
  const password = `Pw-${RUN}-site!`;

  // --- create the account and let it choose its own password ---------------
  {
    const res = await api(`/api/${TENANT}/users`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, name: "E2E Site Worker", role: "site" }),
    });
    const body = await json(res);
    check(
      "an administrator can create a site-worker account",
      res.status === 201,
      `HTTP ${res.status} ${JSON.stringify(body).slice(0, 160)}`,
    );
    const link = body?.invitation?.link ?? "";
    const token = link ? new URL(link).searchParams.get("token") : null;
    check("the invitation carries a token", Boolean(token), link.slice(0, 80));
    if (!token) return;

    const act = await fetch(`${BASE}/api/auth/activate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    check("and the invited person can set a password", act.ok, `HTTP ${act.status}`);
  }

  // --- link the account to a worker, the way the workspace does ------------
  // Hours are recorded against a WORKER, and an account becomes one by sharing
  // its email address. There is no whitelisted command for that, so the
  // administrator does it through the document — which is itself the thing the
  // site account is about to be refused.
  let workerId = null;
  let otherWorkerId = null;
  {
    const st = await json(await api(`/api/${TENANT}/erp/state`));
    const state = st.state ?? {};
    workerId = `wk-e2e-${RUN}`;
    otherWorkerId = (state.workers ?? []).find((w) => w.id !== workerId)?.id ?? null;
    state.workers = [
      ...(state.workers ?? []),
      { id: workerId, name: `E2E Site ${RUN}`, email, active: true },
    ];
    const res = await api(`/api/${TENANT}/erp/state`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ state, expectedVersion: st.version }),
    });
    check("an administrator may still save the whole document", res.ok, `HTTP ${res.status}`);
  }

  const siteCookie = await signIn(email, password);
  check(
    "the site worker can sign in",
    Boolean(siteCookie),
    siteCookie ? "cookie issued" : "no cookie",
  );
  if (!siteCookie) return;

  await as(siteCookie, async () => {
    const st = await json(await api(`/api/${TENANT}/erp/state`));

    // --- the read is a different document, not the same one with tabs hidden
    check(
      "the site worker's state response is marked scoped",
      st.scoped === true,
      `scoped=${st.scoped}`,
    );
    const s = st.state ?? {};
    check(
      "it carries no invoices, bank movements or supplier bills",
      !(s.invoices ?? []).length && !(s.movements ?? []).length && !(s.bills ?? []).length,
      `invoices=${(s.invoices ?? []).length} movements=${(s.movements ?? []).length} bills=${(s.bills ?? []).length}`,
    );
    check(
      "and nobody else's worker record",
      (s.workers ?? []).every((w) => w.id === workerId),
      `workers=${(s.workers ?? []).map((w) => w.id).join(",") || "(none)"}`,
    );
    const money = JSON.stringify(s).match(/"[a-zA-Z]*Cents"/g) ?? [];
    check("and not one amount in cents", money.length === 0, money.slice(0, 6).join(" "));

    // --- the other door is shut ------------------------------------------
    {
      const res = await api(`/api/${TENANT}/erp/state`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ state: s, expectedVersion: st.version }),
      });
      check(
        "a site worker may not save the whole document",
        res.status === 401,
        `HTTP ${res.status}`,
      );
    }

    // --- and so is approval, which is the office's job --------------------
    {
      const res = await command({
        command: "approveLabourWeek",
        args: [workerId, "2026-09-07"],
        expectedVersion: st.version,
      });
      check("a site worker may not approve a week", res.status === 401, `HTTP ${res.status}`);
    }

    // --- hours for somebody else ------------------------------------------
    if (otherWorkerId) {
      const res = await command({
        command: "recordHours",
        args: [{ workerId: otherWorkerId, date: "2026-09-07", hoursMilli: 8000, kind: "normal" }],
        expectedVersion: st.version,
      });
      check(
        "a site worker may not record another person's hours",
        res.status === 401,
        `HTTP ${res.status}`,
      );
    }

    // --- his own hours, but on a site nobody assigned him to ---------------
    {
      const res = await command({
        command: "recordHours",
        args: [
          {
            workerId,
            projectId: "definitely-not-assigned",
            date: "2026-09-07",
            hoursMilli: 8000,
            kind: "normal",
          },
        ],
        expectedVersion: st.version,
      });
      check(
        "nor his own hours on a site he is not assigned to",
        res.status === 401,
        `HTTP ${res.status}`,
      );
    }
  });
}

/**
 * A15 · the suite cleans up after itself.
 *
 * Every earlier run left its «E2E …» customer in the register — a test
 * fixture in a live company file. deleteParty is the engine's own door (it
 * refuses a party with economic documents), newly whitelisted; using it here
 * both removes THIS run's row and every one an older run left.
 *
 * IT RUNS FROM A `finally`, which is the point of it being its own function.
 * Cleanup that only happens when every check passed is cleanup that is absent
 * exactly when it is needed most: the run that failed halfway is the one that
 * leaves the register dirty, and a suite whose own failure is what stops it
 * tidying up will accumulate residue for as long as it stays red.
 */
async function cleanUp() {
  {
    const st = await json(await api(`/api/${TENANT}/erp/state`));
    let v = st.version;
    const leftovers = (st.state?.parties ?? []).filter((p) => /^E2E /.test(p.name));
    let removed = 0;
    for (const p of leftovers) {
      const res = await command({ command: "deleteParty", args: [p.id], expectedVersion: v });
      if (res.ok) {
        removed++;
        v = (await json(res)).version;
      }
    }
    /* The boundary section adds a worker so the site account has hours of its
       own to be refused about. It is written through the document, so it comes
       out the same way. */
    const withWorker = await json(await api(`/api/${TENANT}/erp/state`));
    const stray = (withWorker.state?.workers ?? []).filter((w) => /^E2E Site /.test(w.name ?? ""));
    if (stray.length) {
      const state = withWorker.state;
      state.workers = (state.workers ?? []).filter((w) => !/^E2E Site /.test(w.name ?? ""));
      const res = await api(`/api/${TENANT}/erp/state`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ state, expectedVersion: withWorker.version }),
      });
      check(
        "the run's own test worker is gone",
        res.ok,
        `HTTP ${res.status}, ${stray.length} removed`,
      );
    }

    const after = await json(await api(`/api/${TENANT}/erp/state`));
    check(
      "the run's own test customer is gone, and so is every older run's",
      !(after.state?.parties ?? []).some((p) => /^E2E /.test(p.name)),
      `removed ${removed} of ${leftovers.length}`,
    );
  }
}

function report() {
  for (const r of results) {
    console.log(`${r.pass ? "✓" : "✗"} ${r.name}${r.detail ? "  — " + r.detail : ""}`);
  }
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  return failed.length;
}

/* The run that throws is the run that leaves records behind, so the tidy-up is
   in a `finally` — one call site, reached whether the checks passed, failed or
   blew up. Its own failure is recorded rather than allowed to replace the
   original one: a cleanup error must not be the last thing printed when the
   real news is why the suite crashed. */
let crashed = null;
try {
  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
    COOKIE = await signIn(ADMIN_EMAIL, ADMIN_PASSWORD);
    check("the suite can sign in as its administrator", Boolean(COOKIE), ADMIN_EMAIL);
  }
  await main();
} catch (err) {
  crashed = err;
} finally {
  try {
    await cleanUp();
  } catch (tidyErr) {
    bad("cleanup left records behind", String((tidyErr && tidyErr.message) || tidyErr));
  }
}
const failedCount = report();
if (crashed) {
  console.error("\nserver-e2e crashed:", crashed);
  process.exit(1);
}
if (failedCount) process.exit(1);
