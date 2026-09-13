# How to fill the rest of the prospect data

Written 2026-09-13. The pipeline sheet has 128 firms, of which **73 have no
telephone and 103 no email**. This document says why, what the options are,
what each costs, and which one to take first.

---

## The cause is not the research method. It is that this session cannot open a web page.

Tested today, all three against real targets:

| Route                                                    | Result                                             |
| -------------------------------------------------------- | -------------------------------------------------- |
| `WebFetch` on `einforma.com`, `paginasamarillas.es`      | `EGRESS_BLOCKED`                                   |
| `curl` / Node `fetch` on `google.com`, a firm's own site | HTTP 403, header `x-deny-reason: host_not_allowed` |
| Headless Chromium (a real browser, already installed)    | `ERR_TUNNEL_CONNECTION_FAILED`                     |

The proxy's own message is the instruction:

> `Host not in allowlist: www.google.com. Add this host to your network egress settings to allow access.`

Only **web search** gets out. That is exactly why the data looks the way it
does: a company-directory search result carries the activity code, the address
and often the administrator **in its snippet**, so those filled well — CNAE on
103 of 128, addresses on 97. A telephone and an email live on a contact page,
behind a link nobody could follow, so those did not.

**Nothing about the prospect list is wrong. It is simply as full as snippets can
make it.** The remaining fields need a door opened.

---

## Three doors. They stack — opening one does not preclude the others.

### Door 1 — the environment's own network setting · free · about two minutes · yours to flip

Every cloud environment has a **Network access** level, chosen when it was
created and editable any time:

| Level       | Outbound access                                                       |
| ----------- | --------------------------------------------------------------------- |
| None        | nothing                                                               |
| **Trusted** | package registries, GitHub, cloud SDKs — **this environment is here** |
| **Full**    | any domain                                                            |
| Custom      | your own allowlist, optionally plus the Trusted defaults              |

Setting it to **Full** makes `WebFetch`, `curl` and the browser work
immediately, and the enrichment pipeline can then read each firm's own contact
page — which is where the missing emails are.

**Custom** is the tighter option and works for the directories:

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

But the firms' own websites are 128 arbitrary domains that no allowlist can
anticipate, and those pages are the ones holding the emails. **Full is the
recommendation**, with the standing rule this work has followed throughout: read
public business pages, write nothing, keep the GDPR posture in `04a-SOURCE-PLAN.md`.

### Door 2 — an MCP connector · free · no network change needed

Connector traffic travels through Anthropic's servers rather than the session's
network, so it is not subject to the allowlist at all. A connector that can
fetch a page therefore works **today**, with nothing else changed.

| Connector           | Why it fits                                                                             | Cost    |
| ------------------- | --------------------------------------------------------------------------------------- | ------- |
| **Parallel Search** | _authless_ — no account, no key — and exposes both `web_search` and `web_fetch`         | free    |
| Firecrawl           | scraping plus search, for heavier extraction                                            | account |
| Exa                 | search                                                                                  | account |
| Clay · Crustdata    | purpose-built B2B enrichment (`find-and-enrich-company`) — built for precisely this job | paid    |

Parallel Search is the cheapest possible unblock: enable it in this chat's
connector settings and the fetch problem is gone.

### Door 3 — pay for what search structurally cannot give · a few euros

| Source                          | Fills                                                                                                                        | Cost                                                                                                                |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Google Places API**           | **telephone**, website, rating, review count, opening hours, verified address, _and whether the business is still operating_ | ~$35 per 1,000 at the Enterprise tier; **1,000 free per month** → 128 firms is **free**, or ~$4.50 outside the tier |
| Apify Google Maps actors        | the same, scraped                                                                                                            | $1–5 per 1,000 → ~$0.50 for 128                                                                                     |
| eInforma · Axesor · Informa D&B | administrators, employees, revenue, filings, credit                                                                          | quote-based                                                                                                         |
| **libreBORME**                  | administrators and appointments, republished from the official BORME                                                         | **free**                                                                                                            |

Google Places is the direct answer to the actual gap. A local business's
telephone number is exactly what Maps is authoritative for, and 128 firms sits
inside the free monthly allowance.

---

## What each source fills, column by column

| Workbook column                      | Best source                                     | Have now                                    |
| ------------------------------------ | ----------------------------------------------- | ------------------------------------------- |
| Phone                                | **Google Places** → firm's own site             | 55/128                                      |
| Email                                | firm's own contact page (**needs Door 1 or 2**) | 25/128                                      |
| Website                              | Google Places → search                          | 40/128                                      |
| Rating · Reviews · Opening hours     | **Google Places** only                          | 0 — not yet collected                       |
| Address                              | Google Places → directories                     | 97/128                                      |
| Owner / administrator                | libreBORME, eInforma, Axesor, Empresite         | 33/128                                      |
| CNAE · Founded · Employees · Revenue | company directories, SABI for the full accounts | 103 / 58 / 53 / 16                          |
| **Still trading?**                   | **Google Places `businessStatus`** + registry   | 3 already caught as dissolved or unfindable |

That last row earns its place. The audit already found two dissolved companies
and one with no registry record — one of them Tier B, on next week's call list.
Google Places returns `businessStatus` on every lookup, so this becomes
automatic rather than a thing an auditor has to notice.

---

## Recommendation

1. **Set Network access to Full.** Free, two minutes, and it is what unlocks the
   emails. Everything else is optional after this.
2. **Add a Google Places API key** to the environment's API credentials (so the
   key stays outside the session). Free at this volume, and it is the best
   single source for the telephone numbers — plus it tells you which firms have
   closed.
3. Leave the paid registry products until the pipeline has proved itself on a
   first pilot. eInforma or SABI is worth a quote when the question becomes
   "which of 7,000 firms" rather than "which of 128".

## Then run one command

`scripts/market-enrich.mjs` implements all three doors as interchangeable
sources. It probes what is open before doing anything and refuses to run on
snippets alone, because snippets are what left the cells empty:

```
node scripts/market-enrich.mjs --probe            # what is open, writes nothing
node scripts/market-enrich.mjs --only "Gonzvilarsa"   # one firm, to check
node scripts/market-enrich.mjs                    # all 128 → 04d-ENRICHED.jsonl
```

Today it reports:

```
  direct : closed — egress blocked — empresite.eleconomista.es: host_not_allowed
  places : closed — GOOGLE_PLACES_API_KEY not set
  search : OPEN (snippets only — this is what produced the current gaps)
```

Flip either switch and the same command fills the columns, every value carrying
the URL it came from, nothing overwriting an audited figure, and a sampled
re-derivation before the workbook is trusted — the same discipline the existing
data was held to.

**One caution worth keeping.** An early version of that probe accepted "any
status below 500" as success, and the proxy answers a blocked host with a real
HTTP 403 — so it cheerfully reported the door OPEN while every page was being
refused. It now identifies the block by the proxy's own `x-deny-reason` header
and requires a body large enough to be a page. A check that cannot tell open
from shut is worse than no check, because it sends someone to spend an
afternoon on an enrichment that cannot fetch anything.
