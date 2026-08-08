-- Site photographs, on the server rather than in whoever's browser took them.
--
-- Until now `ErpStore.putBlob` wrote to IndexedDB in EVERY mode, including the
-- one where the rest of the company's data lives on the server. A photograph of
-- a wall taken on the phone was therefore on that phone and nowhere else: not
-- in a backup, not on the laptop, not recoverable if the phone was lost, and
-- silently missing from any quote line that referenced it when opened anywhere
-- else. The state blob held a `storageKey` pointing at bytes that existed on
-- exactly one device.
--
-- Bytes live here rather than in `erp_state.payload` because that document is
-- re-serialised on a debounce while somebody types. Megabytes of JPEG inside it
-- would be re-encoded and re-sent on every keystroke.

-- CreateTable
CREATE TABLE "erp_blob" (
    "tenant_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "mime" TEXT NOT NULL DEFAULT 'application/octet-stream',
    "bytes" BYTEA NOT NULL,
    "size" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "erp_blob_pkey" PRIMARY KEY ("tenant_id","key")
);

-- Same isolation as every other tenant-scoped table (ADR-0007): keyed on the
-- app.tenant_id GUC the store adapters set per transaction, and FORCE so it
-- applies to the table owner too.
ALTER TABLE "erp_blob" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "erp_blob" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "erp_blob"
  USING ("tenant_id" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true));
