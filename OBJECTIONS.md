# OBJECTIONS — where I disagree, and still comply

Per mandate §2: logged, reasoned, and then implemented your way.

1. **"Expected runtime: days" as one unattended run.** An agent session cannot
   literally run for days; pretending otherwise risks half-done work. I comply
   with the _intent_ via the resume protocol: every unit commits green,
   `PROGRESS.md` is the checkpoint, any restart continues silently. The
   mandate's own quota rule (§0) endorses exactly this.
2. **P4 fleet control plane before one paying tenant** front-loads
   infrastructure that YAGNI would defer. Risk accepted per §9 ordering — but
   I sequence P4 as the thinnest health-gated wave mechanism the §12 proof
   needs, not a product in itself.
3. **"Premium native Mac/Windows/mobile" as day-one surface.** The binding
   constraint for a 20-person reformas SME is workflow correctness and
   compliance, not native shells. Responsive web ships first; PWA + Tauri
   wrappers are packaging (P3+). Building Electron apps before the billing port
   is legally sound would be theatre.
4. **Committing a deliberately red boundary violation** conflicts with "never
   leave the repo red". Resolved by committing the violation as a **fixture**
   the linter's tests must catch (green build proving red detection). Both
   mandate sentences are satisfied; noted in ASSUMPTIONS #15.
5. **Verifactu "likely constrains the whole billing port" — yes, but less than
   feared:** the postponement to 2027 (LEGAL_REVIEW #1) means the certified
   layout can land as an es-ES adapter iteration without blocking P1. Designing
   immutability+chaining now, submission later, is the cheaper-to-reverse path.
6. **Enabling SMTP retires a guarantee that cannot be re-earned.** The mandate's
   "no real emails — fakes behind ports only" was, until now, enforced by the
   absence of any sending code: not a setting, an _impossibility_. I said so,
   recommended staying on drafts (a wrong number in Drafts is an edit; the same
   quote auto-sent is a conversation with a customer), and was asked a second
   time. Per §2 the mandate is the operator's to set, so it is implemented —
   off by default, allowlisted, rate-limited, confirmed per message, and audited.
   The objection that remains on the record is not about the rails, which I
   believe are sound: it is that from this commit onward "the ERP cannot email a
   customer" is a claim about configuration rather than about code, and every
   future reviewer has to check the former instead of trusting the latter.
   Recommendation stands that sending be left OFF until the ERP has run in anger
   for a few weeks, and then enabled first for the narrow case (payment reminders
   to existing customers) rather than the whole journey.
7. **A development stack on the production machine.** Asked for a mirrored dev
   system, I recommended a second €4.50/month server and was told to use the
   existing one. Implemented as instructed, and the objection is narrow: nothing
   about the design is unsound, but three properties that a separate machine
   would have had **by construction** are now held by **guards that have to keep
   working**. The disk is shared, so dev's database sits on a fixed-size loopback
   filesystem — if that mount is ever lost, dev silently goes back to competing
   for production's 80 GB. The compose project namespace is shared, so a dev
   stack that came up without `COMPOSE_PROJECT_NAME` would adopt and then remove
   production's containers — three separate checks refuse that, and all three are
   code somebody could delete. TLS is shared, so a Caddyfile that does not parse
   takes the real ERP off the internet — hence validating before every reload,
   and a `{$DEV_HOSTNAME:dev.invalid}` default so an unset variable cannot do it.
   Each guard is tested and each failure is loud. But the honest summary is that
   we have traded four euros a month for three mechanisms that must not rot, and
   the person who eventually removes one of them will not be told what it was
   for unless they read this file. That is why it is written here rather than
   only in a comment.

8. **Editing an issued factura in place.** Asked on 6 Nov to make issued
   invoices editable "without the need for re-invoicing — this, until the
   Factura Electrónica starts", after being shown the abono-and-replacement
   route and rejecting it. Implemented as instructed, and the objection is
   narrow but worth the record.

   What I believe is sound: the guards. A filed quarter, an existing
   rectificativa and money already collected each refuse the edit by name; the
   number, the date and the series never move; every previous version is kept
   with who changed it, when and why; and the VFU-01 chain is rebuilt from the
   edit forward so it still verifies rather than silently asserting that
   nothing happened.

   What I object to is the one thing no guard can reach: **a factura the
   customer is already holding can now be changed underneath them.** Nothing in
   this system knows whether a PDF was emailed, printed or handed over — the
   only evidence is a `commsQueue` entry, which exists solely for messages this
   ERP sent itself. So the operator can rewrite a document somebody else has a
   copy of, and the two papers will carry the same number and different
   content, with nothing on either saying which is current. That is the exact
   failure the immutability rule existed to prevent, and the reason the printed
   line now says a corrected document may arrive under the same number rather
   than claiming the factura is immutable.

   Recommendation, standing: when the Factura Electrónica regime reaches this
   company — LEGAL_REVIEW §1 puts it at 2027-01-01 for sociedades, which is
   eight weeks away, not the October the client has in mind — this path has to
   close, and closing it is a code change somebody must remember to make. A
   date-gated refusal would be better than a memory. I did not build one
   because the date itself is unverified (§15), and a hard stop on a guessed
   date would break invoicing on a day nobody chose.
