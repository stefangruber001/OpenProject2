# Changing a password — one way, for every role

Written 6 Sep 2026. Operator: _"create standard solution and design to change
the password … for administrator and for site worker and the rest of users. One
password for each user, keep it simple."_

## What exists today, and the hole in it

Three password operations, all of them somebody else acting on your account:

| Today                      | Who                       | Route                                                            |
| -------------------------- | ------------------------- | ---------------------------------------------------------------- |
| Issue an invitation        | administrator             | `POST /api/~/users/<email>` → temporary password + one-time link |
| Reset somebody             | administrator             | the same route                                                   |
| Set a password from a link | the person, not signed in | `POST /api/auth/activate`                                        |

**There is no way for a signed-in person to change their own password.** Not for
the administrator, not for the crew.

That is worse than an omission, because the invitation email already promises
it. It says, in the credential band: _"Es temporal y la conoce quien le ha dado
de alta. **Cámbiela cuando entre.**"_ — and then there is nowhere to change it.
Every account is therefore still using a password that the person who created
it knows and that was sent by email.

## Where it goes — and why not Settings

The instruction said Settings → Users. That works for an administrator and
**cannot work for the crew**: Settings is behind `user.manage`, and a site
account's whole navigation is a single _Horas_ tab. Putting the only route
there would repeat this morning's bug — a control that exists for people who
cannot reach it.

The one surface every role already has is the **profile menu**: it carries the
account name, the permission, the language and Sign out. That is where "who am
I" lives, so that is where "change my password" belongs.

| Who                                 | Where                             | What                                                                           |
| ----------------------------------- | --------------------------------- | ------------------------------------------------------------------------------ |
| **Everyone**, crew included         | Profile menu → 🔑 Change password | Their own password. One screen, identical for every role.                      |
| **Administrator**, for other people | Settings → Users → row → Reset    | Issues a temporary password, exactly like an invitation. Route already exists. |

Nobody changes anybody else's password directly — an administrator resets, and
the person then sets their own. That keeps "one password per user, known only
to that user" true after the first sign-in.

## The screen

Three fields, one button, one message.

```
Change password
  Current password      [            ]
  New password          [            ]   at least 10 characters
  Repeat new password   [            ]
                                    [ Change ]
```

- Wrong current password → one error, the same wording whichever field is at
  fault, and the attempt is rate-limited.
- Success → a short confirmation, the menu closes, **you stay signed in on this
  device**.

## The rules, deliberately few

One rule for every role, because a rule the crew cannot follow on a building
site is a rule that produces passwords written inside a helmet:

- at least **10 characters** — the number the invitation email already states
- **not** the current one
- nothing else: no expiry, no character classes, no history

## The endpoint

`POST /api/~/users/me/password` — `{ current, next }`

1. Resolve the caller with `requireUser`; no permission needed beyond being
   signed in, because the only account it can touch is the caller's own.
2. Verify `current` through the same scrypt path as sign-in. Refuse with
   `FORBIDDEN` (403) — not 401, which the workspace reads as an expired session.
3. Write the new hash and move `sessionsValidFrom` to now.
4. **Re-issue this device's cookie in the response.** Step 3 ends every session
   for the account, this one included; without step 4 changing your password
   signs you out of the device you just did it on, which reads as a failure.
   Every _other_ device is signed out, which is the point.
5. Rate-limit on the account with the same `check()` / `recordFailure()` the
   login route uses. Without it this is an oracle for guessing the current
   password from inside a low-privilege session.

An `ERP_USERS` bootstrap account has no database row to write to, so it is
refused with a message naming that — it is configured in the environment and
changes there.

## The gate

`tests/server-e2e`, against a real account:

- the old password stops working, the new one works
- **this device is still signed in** after the change
- another device's cookie is refused afterwards
- a wrong current password is refused, does not change anything, and is
  rate-limited after repeats
- a site worker can do it — the boundary is about the company's data, not about
  their own account

## Cost

Half a session. The endpoint is small; most of the care is step 4 and the rate
limit, and both are already patterns this codebase has.
