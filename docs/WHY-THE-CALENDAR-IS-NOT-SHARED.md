# Why a task added on one phone never appears on the other

**Reported:** a task added to the calendar in the app is not visible to a
colleague in their app. **Concluded from that:** the server is not working.

The server is working. It was verified end to end earlier the same day — a
customer typed into the workspace form landed in PostgreSQL, was read back by a
browser with no local data, and survived the application being restarted.

The calendar cannot reach a colleague for four separate reasons, each of which
is on its own sufficient. Fixing any three of them changes nothing.

---

## 1. The phone app does not point at the server

`ios/CaneiSubirats/Support/Config.swift:20` and
`android/…/MainActivity.kt:26` both load:

```
https://stefangruber001.github.io/OpenProject2/preview/
```

That is GitHub Pages — a static site with no server behind it at all. Every page
served from there keeps its data in that device's own browser storage.

This is the big one, and it is not specific to the calendar. **Nothing entered
in the phone app today can ever reach anybody else** — not a task, not a
customer, not an invoice. Two people using the app are keeping two private
notebooks that happen to look identical.

## 2. The published copy of the workspace has no server binding either

`site/erp.html` contains no `erp-api` marker — the check is one line:

```
grep -c "erp-api" site/erp.html   →   0
```

That marker is what tells the page to talk to a server, and it is injected only
into `apps/web/public/workspace/`, which the server itself serves. The GitHub
Pages copy deliberately has none, so it uses browser storage. The page looks and
behaves identically either way, which is exactly why this is worth stating: a
save that goes nowhere looks like a save that worked.

## 3. The calendar was never connected to the ERP at all

The scheduler lives in `site/journey.html:1321` — "tasks + mini timeline". Every
edit there goes through `persistSoon()` (line 525) into a browser database called
`caneiJourney`, which is a **different store** from the ERP's `caneiERP`.

So the calendar is not merely unsynced; it is not part of the company's dataset.
It has never passed through `erp-engine.js`. This is the long-standing open item
"wire journey.html through erp-engine.js".

## 4. The server would have refused the task anyway

The API accepts a closed list of commands. Until now that list was nine entries:
parties, collections, bill payments, bank allocation, progress, change orders,
and the quarterly archive. `addTask` was not among them, so even a correctly
wired calendar pointed at a correctly configured server would have been turned
away.

**This one is now fixed.** `addTask`, `updateTask` and `completeTask` are on the
list, with tests covering the round trip that matters: a task added by one person
survives being written out and read back by another, and the audit trail records
who did what. That is the server half of shared scheduling, ahead of the UI —
the remaining three reasons are why you still cannot see it working.

---

## What has to happen, in order

The order is not negotiable: each step is useless until the one before it is
done.

1. **Publish the ERP.** Until there is a URL the phones can reach, there is
   nothing to point them at. `ops/provision.sh` already builds the tunnel, the
   DNS record and the login page behind `SKIP_CLOUDFLARE=1`. See
   `docs/OPS-WITHOUT-A-LAPTOP.md` §5.
2. **Point the apps at it.** One line in `Config.swift`, one in
   `MainActivity.kt`, then a TestFlight and Play build. Trivial, and pointless
   before step 1.
3. **Move the calendar onto the ERP.** Either wire `journey.html` through the
   engine, or put the schedule in `erp.html`, which already speaks to the server.
   The second is much smaller and delivers the shared calendar on its own.
4. **Then it works**, and the optimistic-locking already in place handles two
   people editing at once — a stale write is refused with "somebody saved before
   you" rather than silently overwriting.

## How to tell the difference yourself, in ten seconds

Open the ERP workspace and look at the address bar.

- `stefangruber001.github.io/…` → **browser storage.** Nothing you do here is
  shared with anyone, however well it appears to save.
- anything else (a tunnel on `localhost:3000`, or the published address once it
  exists) → the server.

The rule with no exceptions: **if two people are looking at two different
addresses, they are looking at two different datasets.**
