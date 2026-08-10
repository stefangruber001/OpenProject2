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
