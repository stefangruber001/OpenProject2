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
