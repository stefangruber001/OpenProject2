# S1c · Add a colleague without handing over the keys

> Context pack. What exists now, the three bugs verification caught, and what
> S2 inherits.

## What was wrong

Accounts were one environment variable:

```
ERP_USERS="ana@example.com:scrypt$…,luis@example.com:scrypt$…"
```

That file also holds the database password, so **adding a colleague meant
handing somebody the keys to everything**, and the pilot write-up's "any limit
on what a visitor may do: NONE" was literally true. There was also no way to
remove somebody: rotating `SESSION_SECRET` was the only lever, and it signs out
the whole company to take one person's access away.

## What exists now

|                        | Before                                | After                                         |
| ---------------------- | ------------------------------------- | --------------------------------------------- |
| Where accounts live    | `.env`, next to the database password | `erp_users`, tenant-scoped, FORCED RLS        |
| Adding somebody        | edit `.env`, redeploy                 | DMC-08 Usuarios                               |
| Who knows the password | the admin generated and read it out   | **only the person**, chosen on `/activate`    |
| Removing somebody      | rotate the secret, sign out everybody | disable — their sessions die, nobody else's   |
| What they may do       | everything                            | admin · back-office · site · gestoría         |
| Guessing passwords     | unlimited                             | 8 per 10 minutes, per address and per network |

**Roles are permissions, not role checks.** A screen asks
`may(session, "user.manage")`, never `role === "admin"` — the first survives a
fifth role, the second does not. Gestoría's exclusion from margins and
commercial prices is the reason that role exists, so it is an _absent
permission_ with a test on it rather than a line in a document.

**Disable, never delete.** The audit trail has to keep resolving who did what.
Disabling moves `sessionsValidFrom` forward; every token carries its issue time,
and one older than the stamp is refused.

## Verified against a live server, not reasoned about

A real Postgres, a real Next server, real cookies:

1. admin creates Luis (site) → account created, link returned, `delivered:false`
2. Luis cannot sign in — an invitation is not a password
3. a password under ten characters is refused
4. the link works **once**; the second attempt says it is no longer valid
5. Luis signs in and can read the register — a real session
6. Luis is refused `user.manage` with 401 — roles, not authentication
7. admin disables Luis → **his existing session dies on the next request**
8. the last admin can neither step down nor disable themselves
9. re-enabling Luis works, and **his old token stays dead**

## The three bugs that verification caught

All three would have shipped. None would have been visible in a diff.

1. **Login never read the users table.** `authenticate()` still checked
   `ERP_USERS` only, so somebody could be invited, could set a password, and
   still could not sign in. The screen would have looked like it worked.
2. **Half the API never calls `requireUser`.** Seven of fourteen tenant routes
   only read, so they take the middleware's word that the caller is signed in.
   The account-state check sat in `requireUser` — so **a disabled colleague kept
   reading the register**. It moved into the middleware, the one place every
   request passes. Half a rule is not a rule.
3. **The users screen mentioned `name="erp-api"`.** `sync-workspace.mjs` decides
   a page is already marked server-backed by looking for exactly that string, so
   `erp.html` was skipped — and would have been served **without its marker**,
   silently dropping the entire workspace to browser storage. `ErpStore` now
   exposes `apiBase()` so no screen has to name it. That assertion exists
   because this failure is invisible until somebody's work goes missing; it
   earned its keep today.

## Decisions worth knowing

- **`ERP_USERS` still works, as the bootstrap.** A server with no rows must
  still let somebody in to create the first account. Those accounts read as
  admin/active — they are the people who held the keys before there was a
  screen — and a row always wins over an environment entry for the same address.
  Migrating somebody is: create them here, then delete the `.env` line. In that
  order.
- **A database that cannot be reached does not lock anybody out.** The signature
  was still valid; an outage stays an outage rather than becoming a lockout.
- **The rate limiter is in-process and says so.** Right for one container, wrong
  behind several — a shared store is the thing to build if this outgrows one.
- **SMTP is deferred by operator decision.** With it, the invitation is mailed.
  Without it, the admin gets a copyable link and the screen says plainly that no
  mail was sent. The fallback is a working path, not a degraded one. What is
  never acceptable — and never happens — is a success message for a message
  nobody will receive.

## What S2 inherits

`may(tenant, email, permission)` and `require_(…)` exist and are enforced.
S2 builds DMT-01…04 as the **first screens to inherit the permission check
rather than have it retrofitted**, which is the entire reason S1c came before
the screens instead of after them.

Ten subsecciones are still placeholders. Four of them are S2's.
