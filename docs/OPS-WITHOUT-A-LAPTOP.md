# Running the ERP without a laptop

Everything here is done from a browser — phone, tablet, borrowed machine. No
terminal, no SSH key, no cloned repository.

There are three separate things people mean by "use the server", and they are in
very different states. Read this table before anything else.

| What you want to do                                     | Works from a browser today?                        |
| ------------------------------------------------------- | -------------------------------------------------- |
| Ship a code change to the server                        | **Yes** — push to `main`, nothing else needed      |
| Check the server is alright                             | **Yes** — once the two secrets below are set       |
| Take a backup now                                       | **Yes** — same                                     |
| **Actually use the ERP** (enter a customer, an invoice) | **Not yet** — needs the publishing step at the end |

That last row is the honest one. The application still binds to localhost and
the firewall admits a couple of addresses, because it has no login of its own.
Until the publishing step is done, using the ERP means an SSH tunnel from a
machine with the key — which is exactly the laptop we are trying to stop needing.

---

## 1. Deploying code — already browser-only

Push to `main`. That is the entire procedure.

CI builds two container images, runs them against a real database, exercises the
ERP end to end, and only then moves the `main` tag. The server checks for a new
image every 60 seconds and restarts itself when it finds one. Nothing logs into
the machine; the machine pulls.

Two consequences worth knowing:

- Work pushed to a feature branch is **built and tested but not released**. Only
  `main` moves the tag.
- A change that touches only documentation does not redeploy, by design.

Both you and anyone else with write access to the repository can do this. No
extra setup per person.

---

## 2. One-time setup for the ops button

Two secrets, pasted once, from a browser.

**GitHub → the repository → Settings → Secrets and variables → Actions → New
repository secret.**

| Name             | What to paste                                                               |
| ---------------- | --------------------------------------------------------------------------- |
| `HCLOUD_TOKEN`   | The Hetzner API token (Cloud console → the project → Security → API tokens) |
| `SERVER_SSH_KEY` | The **whole** private key file, `BEGIN` and `END` lines included            |

The key is the one provisioning generated: `ops/.provisioned/id_ed25519`. It is
gitignored, so it exists only on the machine that ran provisioning. Open it,
copy everything, paste it. If you no longer have it, skip to "If the key is
gone" below.

### Understand what this costs

Storing the key here means **anyone who can push a workflow to this repository
can read it**, and therefore reach the server. Repository write access and
production SSH access become the same thing. That is a real widening and it is
the price of not needing a laptop.

Tighten it like this, in the same browser:

**Settings → Environments → `production` → Required reviewers → add yourself.**

Every ops run then waits for your approval before it starts. Someone with write
access can still start one; they cannot complete one without you.

### If the key is gone

Generate a new pair from the Hetzner web console (Console → log in as root →
`ssh-keygen -t ed25519 -f /root/.ssh/newkey -N ""`, then append
`/root/.ssh/newkey.pub` to `/root/.ssh/authorized_keys` and copy the private
half out). Paste that as `SERVER_SSH_KEY`.

---

## 3. Using the ops button

**Actions → Ops (run from a browser) → Run workflow → pick one → Run.**

| Action             | What it tells you                                                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `status`           | Everything: server up, backups enabled, SSH narrow, containers running, database connected, tenant isolation real, timers armed, dumps present, disk headroom |
| `backup-now`       | Runs the nightly backup immediately and lists the dumps on disk                                                                                               |
| `list-ssh-allowed` | Which addresses may reach SSH right now                                                                                                                       |

Read the log. Every line is a `✓`, a `!`, or a `✗`, and the ones that are not
`✓` say what to do.

### What it does to the firewall, and why

SSH is restricted to a short list of addresses. A GitHub runner gets a different
address every run, so each run adds its own, does the work, and removes it again
— including when the run fails, which is the case that matters: a cleanup that
only ran on success would slowly fill the allow-list with addresses nobody
recognises.

The add and remove touch **one entry**. They never replace the list, so a run
cannot evict you. This is also what makes it safe for two people to be on the
list at once — see below.

---

## 4. Two people, one server

`ops/narrow-ssh.sh` sets the list to exactly one address. That is right for one
person at one desk and wrong the moment there are two: the second person runs
it and silently locks out the first.

Use `ops/ssh-allow.sh` instead, which changes one entry and leaves the rest:

```
./ops/ssh-allow.sh list
./ops/ssh-allow.sh add
./ops/ssh-allow.sh add 1.2.3.4
./ops/ssh-allow.sh remove 1.2.3.4
```

Locking yourself out is recoverable and not an emergency. The firewall is
managed through the API, so running `add` from wherever you are now fixes it,
and Hetzner's web console reaches the machine regardless of the firewall:
**console.hetzner.com → the server → Console**.

---

## 5. The remaining step: publishing the ERP so it can actually be used

This is what turns "the server is healthy" into "we run the company on it", and
it is the only part not yet done.

The plan is already written into `ops/provision.sh` and switched off behind
`SKIP_CLOUDFLARE=1`. Turning it on creates a tunnel from the server outward, a
DNS record, and a **login page** in front of the application. Nothing is opened
on the firewall — the tunnel dials out.

The result is `https://erp.caneisubirats.com`, openable from a phone, asking
whoever opens it to sign in with a company email address first.

What has to be true before it is switched on:

1. `caneisubirats.com` is in a Cloudflare account with its nameservers pointed
   there. Check at **dash.cloudflare.com** — if the domain is listed and marked
   Active, this is done.
2. The Access application exists and its policy admits the right addresses.
   `provision.sh` creates both.
3. The two identity variables reach the application, so that the person who
   signed in is the person recorded in the audit trail:

   ```
   CF_ACCESS_TEAM_DOMAIN="<team>.cloudflareaccess.com"
   CF_ACCESS_AUD="<the Access application's AUD tag>"
   ```

   Set **both or neither**. The application refuses to start with only one,
   rather than quietly falling back to the single shared operator name and
   crediting everybody's work to one person.

Until step 3 is done, every change is stamped with `ERP_OPERATOR` from the
server's `.env` — which is correct while one person uses it over a tunnel, and
wrong the moment two people are signing in.

### What publishing does and does not give you

It gives you: the ERP openable from any device, a login in front of it, per-person
attribution in the audit trail, and off-site backups.

It does not give you: a full project lifecycle. The server accepts nine commands
today — parties, collections, bills, progress, change orders, the quarterly
archive — and quotes, contracts and invoices are not among them. Running a job
from lead to close through the server is a separate piece of work.
