# How to fill the rest of the prospect data

Written 2026-09-13. The pipeline workbook holds 128 firms. **73 of them have no
telephone and 101 no email.** This document says why, what the options are, what
each costs, and — for each one — exactly where the switch is and what to click.

Read section 1 once. Then do section 2; it is free, takes about two minutes, and
it is the one that unlocks the emails. Everything after that is optional.

---

## 1 · The cause is not the research method. It is that this session cannot open a web page.

Tested against real targets, with four different clients:

| Route                                                 | Result                                             |
| ----------------------------------------------------- | -------------------------------------------------- |
| `WebFetch` on `einforma.com`, `paginasamarillas.es`   | `EGRESS_BLOCKED`                                   |
| `curl` on `google.com` and on a firm's own site       | HTTP 403, header `x-deny-reason: host_not_allowed` |
| Node `fetch` on the same hosts                        | the same 403                                       |
| Headless Chromium (a real browser, already installed) | `ERR_TUNNEL_CONNECTION_FAILED`                     |

The proxy's own message is the instruction:

> `Host not in allowlist: www.google.com. Add this host to your network egress settings to allow access.`

Only **web search** gets out. That is exactly why the data looks the way it
does. A company-directory search result carries the activity code, the address
and often the administrator **in its snippet**, so those filled well. A
telephone and an email live on a contact page, behind a link nobody could
follow, so those did not.

### Coverage today, all 128 firms

| Field                 | Filled | Why                                        |
| --------------------- | ------ | ------------------------------------------ |
| Activity code (CNAE)  | 103    | in the directory snippet                   |
| Address               | 97     | in the directory snippet                   |
| Founded year          | 58     | in the directory snippet                   |
| Employees band        | 53     | in the directory snippet                   |
| **Telephone**         | **55** | needs the contact page or Google Maps      |
| Website               | 40     | sometimes in the snippet                   |
| Administrator / owner | 33     | registry republishers, partial in snippets |
| **Email**             | **27** | contact page only — nothing else has it    |
| Revenue band          | 16     | behind a paywall on every source           |

**Nothing about the prospect list is wrong. It is simply as full as snippets can
make it.** The remaining fields need a door opened.

---

## 2 · Door 1 — the environment's network setting · free · about two minutes · yours to flip

Every Claude Code cloud environment has one **network access level**, chosen
when the environment was created and editable at any time. It governs every
outbound connection a session makes.

| Level       | Outbound access                                                       |
| ----------- | --------------------------------------------------------------------- |
| None        | nothing                                                               |
| **Trusted** | package registries, GitHub, cloud SDKs — **this environment is here** |
| **Custom**  | your own domain allowlist                                             |
| **Full**    | any domain                                                            |

Setting it to **Full** makes `WebFetch`, `curl` and the headless browser work
immediately, and the enrichment pipeline can then read each firm's own contact
page — which is where the missing emails are.

### How to change it

1. Open a Claude Code session on the web (`claude.ai/code`), or the desktop app.
2. In the prompt box, open the **environment dropdown** — the control that names
   the environment the session will run in — and choose to **manage / edit
   environments**. The environment used for this work is the one this session is
   running in; if only a `Default` environment exists, that is it.
3. In the environment dialog, find the **Network access** selector.
4. Choose **Full**, and save.
5. Start a **new session** (an environment change does not reach a session that
   is already running) and run the probe in section 6. `direct` must now say
   `OPEN`.

Only an account or organisation owner can change this; a session cannot change
its own network level, which is why this is the one step that has to be done by
a person.

### If Full is too wide — the Custom list

**Custom** takes a domain allowlist and covers the registries perfectly well:

```
einforma.com
empresite.eleconomista.es
axesor.es
iberinform.es
datoscif.es
infocif.es
librebor.me
ranking-empresas.es
paginasamarillas.es
habitissimo.es
houzz.es
www.google.com
maps.google.com
openstreetmap.org
```

But the firms' own websites are **128 arbitrary domains** that no allowlist can
anticipate, and those pages are the ones holding the emails. So Custom recovers
the registry fields and leaves the main gap open.

**Full is the recommendation**, with the standing rule this work has followed
throughout: read public business pages, write nothing, and keep the GDPR posture
set out in `04a-SOURCE-PLAN.md` (section 7 below repeats it).

### Putting it back

The same selector. Set it to **Trusted** when the enrichment run is finished and
the environment returns to ordinary development work. Nothing in the repository
depends on the wider setting; only the enrichment run does.

---

## 3 · Door 2 — an MCP connector · free · no network change needed

Connector traffic travels through Anthropic's servers rather than through the
session's own network, so **it is not subject to the environment's allowlist at
all**. A connector that can fetch a page therefore works today, with the network
level left exactly where it is.

| Connector           | Why it fits                                                                       | Cost    |
| ------------------- | --------------------------------------------------------------------------------- | ------- |
| **Parallel Search** | _authless_ — no account, no key — and exposes both `web_search` and `web_fetch`   | free    |
| Firecrawl           | scraping plus search, for heavier extraction                                      | account |
| Exa                 | search                                                                            | account |
| Clay · Crustdata    | purpose-built B2B enrichment (`find-and-enrich-company`) — built for exactly this | paid    |

### How to add Parallel Search

The server needs no account and no API key. Its endpoint is:

```
https://search.parallel.ai/mcp
```

**From claude.ai** (this is the route that reaches a web session):

1. Go to **Settings → Connectors**.
2. **Add custom connector** — some builds call it _Browse connectors_ and list
   Parallel Search directly; if it is listed, one click is enough.
3. Paste the URL above. Leave authentication empty — the free tier is authless.
4. Save, and make sure the connector is **enabled for Claude Code** sessions.

**From the Claude Code CLI**, if you prefer it there:

```
claude mcp add --transport http parallel-search https://search.parallel.ai/mcp
```

**To confirm it is live**, start a new session and run `/mcp`. `parallel-search`
should be listed with its two tools, `web_search` and `web_fetch`.

Free-tier rate limits apply. At 128 firms that is not a constraint; if a run
does hit one, waiting and re-running is enough, and the pipeline never
overwrites what it already has, so a re-run only fills what is still empty.

**What this door does not give you:** a verified telephone number for a business
that has no website. Only a maps product has that. Hence door 3.

---

## 4 · Door 3 — Google Places · free at this volume · about fifteen minutes

This is the direct answer to the actual gap. A local business's telephone number
is exactly what Google Maps is authoritative for, and the gap is telephone
numbers. It also returns something no other source gives cheaply: **whether the
business is still operating**.

| Source                          | Fills                                                                             | Cost                              |
| ------------------------------- | --------------------------------------------------------------------------------- | --------------------------------- |
| **Google Places API (New)**     | telephone, website, rating, review count, opening hours, verified address, status | **free at 128 firms** — see below |
| Apify Google Maps actors        | the same, scraped                                                                 | $1–5 per 1,000 → ~$0.50 for 128   |
| eInforma · Axesor · Informa D&B | administrators, employees, revenue, filings, credit                               | quote-based                       |
| **libreBORME**                  | administrators and appointments, republished from the official BORME              | **free**                          |

### What it actually costs

Google replaced its old shared $200 monthly credit on 1 March 2025 with a **free
monthly allowance per SKU**: 10,000 calls for Essentials, 5,000 for Pro, 1,000
for Enterprise. The allowance resets on the first of the month and does not roll
over. Which SKU a call bills at is decided by **the fields you ask for**, not by
a plan you subscribe to.

`scripts/market-enrich.mjs` makes two calls per firm:

| Call                         | Fields asked for                        | SKU        | Free/month | Used by 128 firms |
| ---------------------------- | --------------------------------------- | ---------- | ---------- | ----------------- |
| Text Search — find the place | `id`, `displayName`, `formattedAddress` | Pro        | 5,000      | 128               |
| Place Details — read it      | phone, website, rating, hours, status   | Enterprise | 1,000      | 128               |

So the whole list runs **inside the free allowance, twice over**. Outside it, at
list price ($32 and $20 per 1,000), the 128 firms would cost about **$6.70**.

**Billing must still be enabled on the project even to use the free allowance** —
Google requires a card on file. That is the one step that surprises people.

### How to set it up

1. Go to **console.cloud.google.com** and sign in.
2. **Create a project** — the project selector at the top, then _New project_.
   Name it something you will recognise (`canei-prospects`).
3. **Enable billing.** Left menu → **Billing** → _Link a billing account_, and
   create one if there is none. A card is required; with the free allowances
   above, 128 firms will not reach a charge. If you want certainty, set a budget
   alert at €1 under Billing → _Budgets & alerts_.
4. **Enable the API.** Left menu → **APIs & Services → Library**, search for
   **Places API (New)**, open it, click **Enable**. Take the one labelled _(New)_ —
   the legacy Places API is a different, older product.
5. **Create the key.** **APIs & Services → Credentials** → _Create credentials_ →
   **API key**. Copy it now; the console will not show it in full again.
6. **Restrict the key** — click it, and under _API restrictions_ choose
   **Restrict key** and select only **Places API (New)**. This is what stops a
   leaked key from being usable for anything else. Leave application
   restrictions unset, or the server-to-server call will be refused.
7. **Store it in the environment, not in the repository.** In the same
   environment dialog as section 2, add an environment variable:

   ```
   GOOGLE_PLACES_API_KEY=AIza…
   ```

   Never commit it, never paste it into a file in the repo, never put it in
   `.env` in a branch — the repository rule is `.env` stays local and secrets
   never enter git.

8. Start a new session and run the probe. `places` must say `OPEN`.

### What Places gives that nothing else does

`businessStatus`. The QA audit of the existing data found **two dissolved
companies and one with no registry record at all** — one of them Tier B, on next
week's call list. Places returns the operating status on every lookup, so from
then on that check is automatic rather than something an auditor has to notice.

---

## 5 · The free extras, worth ten minutes each

- **libreBORME** (`librebor.me`) republishes the official _Boletín Oficial del
  Registro Mercantil_: company administrators, their appointments and their
  resignations, free and with an open API. It is the right source for the 95
  firms with no administrator name, and it is a public registry republisher,
  which is the only category this work takes director names from. It needs
  door 1 or door 2 to be readable.
- **Apify's Google Maps actors** do what Places does, by scraping, for about
  €0.50 at this volume. Cheaper than Places outside the free tier, but it is
  scraped rather than first-party, so it carries a terms question Places does
  not. Use it only if the Google billing step is a blocker.
- **eInforma / Axesor / Informa D&B / SABI** are the real registry products:
  administrators, filed accounts, credit opinions. They are quote-based and
  worth a conversation only when the question becomes _"which of 7,000 firms"_
  rather than _"which of 128"_ — i.e. after the first pilot has proved the
  pipeline.

---

## 6 · What each source fills, column by column

| Workbook column                      | Best source                                     | Have now                                    |
| ------------------------------------ | ----------------------------------------------- | ------------------------------------------- |
| Phone                                | **Google Places** → firm's own site             | 55/128                                      |
| Email                                | firm's own contact page (**needs door 1 or 2**) | 27/128                                      |
| Website                              | Google Places → search                          | 40/128                                      |
| Rating · Reviews · Opening hours     | **Google Places** only                          | 0 — not yet collected                       |
| Address                              | Google Places → directories                     | 97/128                                      |
| Owner / administrator                | libreBORME, eInforma, Axesor, Empresite         | 33/128                                      |
| CNAE · Founded · Employees · Revenue | company directories; SABI for the full accounts | 103 / 58 / 53 / 16                          |
| **Still trading?**                   | **Google Places `businessStatus`** + registry   | 3 already caught as dissolved or unfindable |

---

## 7 · Then run one command

`scripts/market-enrich.mjs` implements all three doors as interchangeable
sources. It probes what is open before doing anything, and it **refuses to run
on snippets alone**, because snippets are what left the cells empty:

```
node scripts/market-enrich.mjs --probe               # what is open, writes nothing
node scripts/market-enrich.mjs --only "Gonzvilarsa"  # one firm, to check the result
node scripts/market-enrich.mjs                       # all 128 → 04d-ENRICHED.jsonl
```

Then rebuild the workbook, which reads `04d` automatically:

```
python3 scripts/market-pipeline-xlsx.py
```

Today the probe reports:

```
  direct : closed — egress blocked — empresite.eleconomista.es: host_not_allowed
  places : closed — GOOGLE_PLACES_API_KEY not set
  search : OPEN (snippets only — this is what produced the current gaps)

128 firms · 73 without a phone · 103 without an email
```

(The probe counts against the two enrichment files it writes to; the workbook
resolves across all four and finds 27 emails rather than 25. Both numbers are
the same gap seen from different ends of the chain.)

Flip either switch and the same command fills the columns, with every value
carrying the URL it came from, nothing overwriting an audited figure, and a
sampled re-derivation before the workbook is trusted — the same discipline the
existing data was held to.

### The rules that hold whichever door is open

These do not relax because the fetching got easier:

- **Company-level data only.** Names of administrators come from public registry
  republishers (libreBORME, eInforma, Empresite, Axesor, Iberinform, DatosCif,
  Infocif, Datos-Empresas, Ranking-Empresas) and from nowhere else — never from
  LinkedIn personal profiles, Facebook, review sites or news articles.
- **No personal mobile numbers and no personal email addresses.** Company
  switchboards and `info@` style addresses only.
- **Legal basis:** legitimate interest, B2B, on published business data. Anyone
  who objects is marked **Lost** in the workbook and is never contacted again.
- **The three DO NOT CALL firms stay flagged** — two dissolved, one with no
  registry record — and the Focus column keeps excluding them regardless of
  tier.

---

## 8 · Cost and order of attack

| Step                                     | Cost              | Time    | What it buys                                                         |
| ---------------------------------------- | ----------------- | ------- | -------------------------------------------------------------------- |
| **1. Network access → Full**             | free              | ~2 min  | the emails, the registry pages, libreBORME — the largest single gain |
| **2. Parallel Search connector**         | free              | ~5 min  | the same fetching without touching the network level                 |
| **3. Google Places API key**             | free at 128 firms | ~15 min | telephones, ratings, opening hours, and "is it still trading"        |
| 4. Apify, if Google billing is a blocker | ~€0.50            | ~10 min | the same as 3, scraped                                               |
| 5. eInforma / SABI                       | quote             | days    | accounts and credit, at 7,000-firm scale — after the first pilot     |

Steps 1 and 3 together are under twenty minutes and under a euro, and between
them they close both of the two real gaps. Do those; leave the rest until the
pipeline has earned it.

---

**One caution worth keeping.** An early version of that probe accepted "any
status below 500" as success — and the egress proxy answers a blocked host with
a real HTTP 403 carrying a short plain-text body. So it cheerfully reported the
door OPEN while every page was being refused. It now identifies the block by the
proxy's own `x-deny-reason` header and requires a body large enough to be a
page. A check that cannot tell open from shut is worse than no check, because it
sends someone to spend an afternoon on an enrichment that cannot fetch anything.
