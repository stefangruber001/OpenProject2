-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aggregates" (
    "tenant_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aggregates_pkey" PRIMARY KEY ("tenant_id","kind","id")
);

-- CreateTable
CREATE TABLE "artifacts" (
    "tenant_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "artifacts_pkey" PRIMARY KEY ("tenant_id","kind","id")
);

-- CreateTable
CREATE TABLE "counters" (
    "tenant_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL,

    CONSTRAINT "counters_pkey" PRIMARY KEY ("tenant_id","key")
);

-- CreateTable
CREATE TABLE "kv_state" (
    "tenant_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "kv_state_pkey" PRIMARY KEY ("tenant_id","key")
);

-- CreateTable
CREATE TABLE "events" (
    "tenant_id" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "at" TEXT NOT NULL,
    "payload" JSONB NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("tenant_id","seq")
);


-- ---------------------------------------------------------------------------
-- Row-Level Security (ADR-0007): every tenant-scoped table is isolated by the
-- app.tenant_id GUC, set per transaction by the store adapters. FORCE applies
-- the policy to the table owner too (Prisma connects as owner in dev).
-- ---------------------------------------------------------------------------

ALTER TABLE "aggregates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "aggregates" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "aggregates"
  USING ("tenant_id" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true));

ALTER TABLE "artifacts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "artifacts" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "artifacts"
  USING ("tenant_id" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true));

ALTER TABLE "counters" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "counters" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "counters"
  USING ("tenant_id" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true));

ALTER TABLE "kv_state" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "kv_state" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "kv_state"
  USING ("tenant_id" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true));

ALTER TABLE "events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "events" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "events"
  USING ("tenant_id" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true));
