# tests/fixtures/

Frozen, real state blobs — never hand-written — used by the schema-migration
work (planned session 3 of the CANEI feature programme; see
`docs/worklog/WORKLOG.md`).

## `state-v1-seed.json`

The output of `ErpSeed.build().toJSON()` (`site/erp-seed.js` over
`site/erp-engine.js`) at the point this fixture was captured: **32 top-level
keys, no `schemaVersion` field** — today's implicit "version 1" shape.

It exists so the migration ladder (`site/erp-migrations.js`, session 3) has a
real pre-migration blob to replay forward, even after `erp-seed.js` itself has
moved on to a newer shape. Do not regenerate it casually — regenerating
replaces the "before" picture the migration tests are proving against.

Regenerate only when you deliberately want to replace the frozen baseline
(for example, once the v1→v2 migration has shipped and a fresh "last shape
before v2→v3" snapshot is needed):

```bash
node tests/fixtures/capture-state-fixture.mjs
```
