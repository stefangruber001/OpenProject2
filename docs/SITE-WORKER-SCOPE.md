🏗️ _CANEI ERP — WHAT A SITE WORKER CAN DO_
_For approval. Reply with the numbers you want changed._

━━━━━━━━━━━━━━━━━━━━
🔴 _WHAT WAS BROKEN (fixed today)_

1️⃣ _No navigation bar._ A site worker got a screen with no bottom bar at all — no way to reach the hours screen, nothing showing where they were. The web app and the phone app also disagreed: the app gave one tab, the web gave none.

2️⃣ _A false alarm._ "Your company details are missing — without them no invoice can be issued", with a button to a screen they are not allowed to open. It was _never true for them_: a site worker's data is filtered before it leaves the server, so the company record simply is not in it. The app was reading that filtering as a missing record.

3️⃣ _Wrong empty message._ "There are no projects yet" — when the truth is "nobody has assigned you to a job yet". Two very different things to tell a bricklayer.

4️⃣ _A dead menu entry._ "Reload demonstration data" was shown but always refused on the real server. Removed there.

━━━━━━━━━━━━━━━━━━━━
✅ _WHAT A SITE WORKER CAN DO TODAY_

_Sees_
• Their own hours, and only their own
• The jobs they are assigned to, and the chapters/line items on them — enough to say which part of the job the hours belong to
• Nothing else: no invoices, no bank, no supplier bills, no other worker's record

_Does_
• Books their own hours, per day, per job, per line item
• Takes photos on site
• Changes their interface language, changes their own password

_Cannot — refused by the server, not merely hidden_
• Save anything but their own hours
• Approve a week (that is the office's job)
• Book hours for anybody else
• Book hours on a job nobody assigned them to
• Manage users

💶 _No amount of money is ever sent to a site worker's phone._ Not their own rate, not a total, not a margin. Removed from the data before it leaves the server — not hidden on screen.

━━━━━━━━━━━━━━━━━━━━
🟡 _FIVE DECISIONS FOR YOU_

_1. Progress / Gantt — read only?_
Today: no. They cannot see the plan or the deadline of the job they are on.
Proposal: give them read-only physical progress and the finish date of _their_ jobs. No money on it.
👉 _Yes / No_

_2. Correct a mistake before approval?_
Today: they can correct an entry until the office approves the week, then it locks.
Proposal: keep as is.
👉 _Keep / Lock immediately_

_3. Photos — where do they go?_
Today: a photo attaches to a site visit.
Proposal: also allow a photo attached to a day's work on a job, so progress is documented from the site.
👉 _Yes / No_

_4. See their own hours total?_
Today: yes — hours, never money.
Proposal: keep. They see "38 h this week, 6 not yet approved", never euros.
👉 _Keep / Hours hidden too_

_5. Who is a site worker in practice?_
Every crew member gets their own account, or one shared account per crew?
Proposal: _one account per person._ Shared accounts make the hours register worthless — nobody can be asked about their own week — and it is the register that feeds payroll.
👉 _One per person / Shared_

━━━━━━━━━━━━━━━━━━━━
⚙️ _STATUS_
Fixes 1–4 are done, tested and going to production now. The five decisions above are not urgent — the system works without them; they are about how much the crew should see.
