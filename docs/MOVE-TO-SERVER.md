# Moving the company onto the server

What changes, what to do, and what is still missing. Written for whoever is
actually going to do it.

---

## What changed

The ERP used to live in a browser. The whole company dataset was one JSON
document in that browser's local storage, on one laptop. It worked, and it had
two properties nobody wants for a business:

- **only one person could use it** — a second person meant a second, separate
  copy of the company;
- **the data lived on a device**, so a lost or wiped laptop was a lost company.

The ERP now runs on the server as well. Same engine, same figures — it was
written to run in both places and did not need rewriting — but the records live
in PostgreSQL on the Hetzner box, and the browser asks the server to make each
change.

The offline version still exists and still works. Nothing published today
changed.

---

## Which one am I looking at?

|                      | Offline (as before)                 | On the server                                                     |
| -------------------- | ----------------------------------- | ----------------------------------------------------------------- |
| Address              | the published site, or a local file | `http://localhost:3000/workspace/erp.html` through the SSH tunnel |
| Data lives           | in that browser                     | in PostgreSQL, on the server                                      |
| Who can use it       | whoever is at that computer         | anyone who can reach the server                                   |
| Backed up            | no                                  | nightly, encrypted                                                |
| "Reset to demo data" | available                           | refused                                                           |

The server copy shows the tenant name in the URL: `?tenant=diorka`.

---

## Reaching the server

There is no public address yet, deliberately — **the application still has no
login of its own**, so publishing it would publish the customer's records. Open
a tunnel instead:

```bash
ssh -i ops/.provisioned/id_ed25519 -L 3000:localhost:3000 root@<SERVER_IP>
```

Leave it running and open **http://localhost:3000/workspace/erp.html**.

---

## Moving existing data across

Only worth doing if a browser holds records that matter. If the browser only
ever held the demo dataset, **start clean on the server instead** — importing
demo figures into a production company is worse than an empty one, because
empty is obviously empty.

1. Open the ERP in the browser that has the data.
2. Click **⤓ Exportar**. You get `canei-erp.json`.
3. With the tunnel open:

   ```bash
   ERP_BASE_URL=http://localhost:3000 ./ops/import-erp-state.sh canei-erp.json diorka
   ```

It prints what arrived — how many customers, invoices, projects — so you can
check the numbers rather than trust a success message.

It **refuses** to import over a tenant that already holds data. If you mean it,
it tells you the exact command to re-run. That is not bureaucracy: "import" is a
word people click twice.

---

## Before real invoices go in

Three things are true today and need to stop being true:

1. **There is no login.** Access is controlled entirely by who has the SSH key.
   Every change is stamped with the name in `ERP_OPERATOR`, which is one person
   named in configuration — honest while there is one operator, useless the
   moment there are two.
2. **Backups are on the same machine as the database.** Encrypted, nightly, and
   worth little if the machine or the Hetzner account is lost. Turn on Hetzner's
   own snapshots, and finish the Cloudflare R2 step
   (`docs/INTERIM-HETZNER-ONLY.md`) before the register is real.
3. **The restore drill has never run against real data.** A backup that has not
   been restored is a hope.

---

## Checking it is working

```bash
# on the server
cd /opt/canei-erp
docker compose -f docker-compose.prod.yml ps        # db, migrate (exited 0), db-role (exited 0), app

# the ERP, end to end, from your machine with the tunnel open
ERP_BASE_URL=http://localhost:3000 node tests/server-e2e/run.mjs
```

The last one exercises the real thing: the workspace is served, commands run,
the command list holds, and a second person's stale save is refused rather than
silently overwriting the first. CI runs the same file against every published
image.

---

## Two people at once

Try it: open the workspace in two windows, change something in each.

The second one is told **"Otra persona ha guardado antes"**, reloads the current
figures, and asks you to repeat the change. It does not overwrite. That
behaviour is the difference between a shared system and a shared way to lose
work, and it is checked on every deploy.
