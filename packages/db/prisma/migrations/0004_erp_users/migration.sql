-- Accounts move out of the server's .env and into rows.
--
-- The file they lived in also holds the database password, so adding a
-- colleague meant handing over the keys. Rows are what make a screen possible,
-- and a screen is what makes "add a colleague" something the owner can do.

CREATE TABLE "erp_users" (
    "tenant_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "role" TEXT NOT NULL DEFAULT 'backoffice',
    "state" TEXT NOT NULL DEFAULT 'invited',
    -- Empty until the invited person chooses their own password. The admin
    -- creates the account and never learns the password, unlike the script
    -- this replaces, which handed the admin the password they generated.
    "hash" TEXT NOT NULL DEFAULT '',
    -- Sessions are signed and stateless, so there is nothing to delete when
    -- somebody is disabled. Every token carries its issue time instead, and a
    -- token older than this stamp is refused: moving it forward ends that one
    -- person's sessions everywhere, which rotating SESSION_SECRET could only
    -- do by logging out the whole company.
    "sessions_valid_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL DEFAULT '',
    "updated_at" TIMESTAMP(3) NOT NULL,
    "disabled_at" TIMESTAMP(3),

    CONSTRAINT "erp_users_pkey" PRIMARY KEY ("tenant_id","email")
);

-- The raw token lives only in the link that was sent. A stolen database
-- therefore yields nothing that can be used to activate an account.
CREATE TABLE "erp_user_tokens" (
    "tenant_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'activation',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "erp_user_tokens_pkey" PRIMARY KEY ("tenant_id","token_hash")
);

CREATE INDEX "erp_user_tokens_tenant_email_idx" ON "erp_user_tokens" ("tenant_id","email");

-- Same isolation as every other tenant-scoped table (ADR-0007), and FORCE so
-- it applies to the table owner too. One tenant's account list must never be
-- readable from another's connection, whatever the query.
ALTER TABLE "erp_users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "erp_users" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "erp_users"
  USING ("tenant_id" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true));

ALTER TABLE "erp_user_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "erp_user_tokens" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "erp_user_tokens"
  USING ("tenant_id" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true));
