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

if (!BASE) {
  console.log("server-e2e: skipped (set ERP_BASE_URL to run)");
  process.exit(0);
}

const results = [];
const ok = (name, detail = "") => results.push({ name, pass: true, detail });
const bad = (name, detail) => results.push({ name, pass: false, detail });
const check = (name, cond, detail = "") => (cond ? ok(name, detail) : bad(name, detail));

const api = (path, init) =>
  fetch(`${BASE}${path}`, { headers: { accept: "application/json" }, ...init });

const json = async (res) => {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text.slice(0, 200) };
  }
};

/** A party the engine will accept: the tax id check digit has to be right. */
const party = (name) => ({
  name,
  taxId: "B12345674",
  roles: ["customer"],
  billStreet: "Carrer de Prova 1",
  billPostalCode: "08240",
  billCity: "Manresa",
  mobile: "600000000",
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

  // --- the command whitelist is closed ------------------------------------
  for (const name of ["constructor", "__proto__", "issueInvoice", "toJSON"]) {
    const res = await command({ command: name, args: [], expectedVersion: version });
    check(`"${name}" is not callable`, res.status === 400, `HTTP ${res.status}`);
  }

  // --- a write must quote the version it read -----------------------------
  {
    const res = await command({ command: "addParty", args: [party("No Version")] });
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
      args: [party("Second Writer")],
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

  // --- business rules still belong to the engine --------------------------
  {
    const res = await command({
      command: "addParty",
      args: [party(unique)],
      expectedVersion: version,
    });
    const body = await json(res);
    check(
      "a duplicate tax id is refused by the engine, in its own words",
      res.status === 409 && /duplicate/i.test(body.message ?? ""),
      `HTTP ${res.status} ${body.message}`,
    );
  }

  for (const r of results) {
    console.log(`${r.pass ? "✓" : "✗"} ${r.name}${r.detail ? "  — " + r.detail : ""}`);
  }
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exit(1);
}

await main();
