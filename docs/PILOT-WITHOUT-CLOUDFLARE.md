# The pilot: two people, one server, no Cloudflare and no domain

The goal is narrow and worth stating plainly: **you and one colleague open the
ERP on your own devices, and you are both looking at the same data.** No VPN, no
laptop, no domain transfer, no third-party account.

Everything below is already built. What remains is running it.

---

## What this replaces

The earlier plan put a Cloudflare tunnel in front of the server and used
Cloudflare's login page. That needed a domain in a Cloudflare account. The
domain is not moving soon, so the ERP now has **its own login**, and reaches
your phone over **its own HTTPS**.

Both mechanisms are in the code. Configuration decides which is live, and
neither is required — an unconfigured server behaves exactly as it does today.

---

## How it works, in three sentences

The application has accounts and issues a signed session cookie; without a valid
one, every page redirects to a login screen and every API call is refused.
A small reverse proxy (Caddy) terminates HTTPS in front of it and obtains a real
certificate automatically. The certificate is issued for a hostname you do not
have to own: `<your-ip-with-dashes>.sslip.io` resolves to your server with no
registration at all, and is a real enough name for a real certificate.

When the company domain arrives, change `PUBLIC_HOSTNAME` and restart. Nothing
else changes.

---

## Setting it up

Order matters. Step 4 opens the server to the internet and refuses to run until
1–3 are genuinely done.

### 1. Make a password hash for each person

On any machine with Node — this never sends anything anywhere:

```
node apps/web/scripts/hash-password.mjs stefan@caneisubirats.com
node apps/web/scripts/hash-password.mjs ignacio@caneisubirats.com
```

It asks for the password twice, without showing it, and prints one line each.
The password itself is never stored — only a scrypt hash, which is deliberately
expensive to attack offline.

### 2. Put them on the server

In `/opt/canei-erp/.env`:

```
ERP_USERS="stefan@caneisubirats.com:scrypt$...,ignacio@caneisubirats.com:scrypt$..."
SESSION_SECRET="<output of: head -c 48 /dev/urandom | base64>"
PUBLIC_HOSTNAME="178-105-10-156.sslip.io"
ACME_EMAIL="you@example.com"
```

Use your server's real address in `PUBLIC_HOSTNAME`, with the dots replaced by
dashes.

`SESSION_SECRET` is what signs session cookies. Changing it signs everybody out
everywhere, immediately — which is how you cut off a lost phone.

Set `ERP_USERS` and `SESSION_SECRET` **both or neither**. With only one, the
application refuses to serve rather than falling back to the single shared
operator name, because that failure looks completely normal while quietly
crediting everybody's work to one person.

### 3. Start the proxy

```
cd /opt/canei-erp
docker compose -f docker-compose.prod.yml --profile pilot up -d
```

### 4. Open the door

From your clone, with `ops/provision.conf` present:

```
./ops/open-web.sh
```

This checks, **on the machine**, that the accounts are configured _and_ that the
running application actually turns away a request with no session. Configuration
only proves somebody intended a login; a request proves there is one. If the
container predates the login it refuses and opens nothing.

Give it a minute afterwards — the certificate is obtained on first request.

### 5. Check it from a phone, on mobile data

```
https://178-105-10-156.sslip.io
```

Mobile data rather than the office wifi, so you are testing the real path in.

### 6. Point the apps at it

`ios/CaneiSubirats/Support/Config.swift` and
`android/app/src/main/kotlin/com/caneisubirats/app/MainActivity.kt` currently
load the GitHub Pages site, which has no server behind it. One line each, then a
TestFlight and Play build.

Until that ships, use the address in the phone's browser — it is the same
application.

### To take it back off the internet at any time

```
./ops/open-web.sh --close
```

SSH is unaffected. Nothing is lost; the address simply stops answering.

---

## What is genuinely verified

Driven against a real build, a real PostgreSQL and the restricted database role:

- an anonymous browser is redirected to the login page; an anonymous API call
  gets 401
- a wrong password sets no cookie and says only "incorrect", never which half
  was wrong
- signing in serves the workspace
- **Stefan adds a customer, Ignacio signs in separately and adds a calendar
  task, and Stefan's session sees Ignacio's task** — the exact thing that did
  not work before
- PostgreSQL records who did what:
  `stefan@… → addParty`, `ignacio@… → addTask`
- signing out closes it again

That run also found a real bug: `addTask` accepted the acting user and ignored
it, so a task had no author anywhere. Fixed, with tests.

## What this does not give you

- **A full project lifecycle.** The server accepts twelve commands — parties,
  money in and out, bank allocation, progress, change orders, tasks, the
  quarterly archive. Quotes, contracts and invoices are not among them.
- **A shared calendar screen.** The scheduling _commands_ now work and the data
  is shared, but the calendar UI still lives in `journey.html` writing to browser
  storage. See `docs/WHY-THE-CALENDAR-IS-NOT-SHARED.md`.
- **A tested restore.** The drill has still never run against real data.
- **Password reset, lockout, or two-factor.** For two people who can edit
  `.env`, resetting a password is editing `.env`. This is a pilot arrangement and
  should not survive the third person joining.

## Honest risks

**The application is on the internet.** It is behind a login with hashed
passwords, HTTPS, HttpOnly cookies and a default-deny rule, but there is no
rate limiting on the login form yet, so a long password matters. Use the
password manager.

**sslip.io is a third-party DNS service.** If it stops resolving, the address
stops working until it returns or `PUBLIC_HOSTNAME` points elsewhere. No data is
at risk — it is on your server and in your backups. Moving to the company domain
removes this dependency entirely.

**Sessions cannot be revoked individually.** There is no session table, so
signing out clears the cookie on that device but the token stays valid until it
expires (8 hours). To cut everyone off at once, change `SESSION_SECRET`.
