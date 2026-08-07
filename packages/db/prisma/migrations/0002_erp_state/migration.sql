-- Whole-document state with optimistic concurrency.
--
-- `version` is the reason this is not another kv_state key. The document is
-- large and two people can hold a copy of it at the same time, so the writer
-- must prove it read the version it is replacing. A blind upsert here means one
-- person's afternoon disappears without a message.

-- CreateTable
CREATE TABLE "erp_state" (
    "tenant_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "erp_state_pkey" PRIMARY KEY ("tenant_id","key")
);

-- Same isolation as every other tenant-scoped table (ADR-0007): the policy is
-- keyed on the app.tenant_id GUC that the store adapters set per transaction,
-- and FORCE applies it to the table owner too.
ALTER TABLE "erp_state" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "erp_state" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "erp_state"
  USING ("tenant_id" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true));
