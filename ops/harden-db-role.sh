#!/usr/bin/env bash
# =============================================================================
# Give the application a database role that row-level security actually applies
# to, and prove it.
#
# WHY THIS EXISTS
# ---------------
# Every tenant table carries an RLS policy keyed on the `app.tenant_id` GUC
# (ADR-0007), and the migration sets FORCE ROW LEVEL SECURITY so the policy
# applies to the table owner too. None of that has any effect on a SUPERUSER:
# Postgres lets superusers bypass RLS unconditionally, and FORCE does not change
# it. The postgres image makes POSTGRES_USER a superuser, so an application
# connecting as POSTGRES_USER gets no isolation from RLS at all — verified by
# inserting a row for one tenant and reading it back with no GUC set:
#
#   as the superuser  → every row, every tenant
#   as this role      → zero rows
#
# So the second layer of "defense in depth" was decorative until the app stopped
# connecting as the owner. This script creates the role that fixes it.
#
# The owner keeps DDL and runs migrations; this role gets DML only, on tables
# that already exist. Safe to re-run — it is the password-rotation path too.
#
#   POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB   the owner (migrations)
#   APP_DB_USER   / APP_DB_PASSWORD                    the role the app uses
# =============================================================================
set -euo pipefail

: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"
: "${APP_DB_USER:?APP_DB_USER is required}"
: "${APP_DB_PASSWORD:?APP_DB_PASSWORD is required}"
PGHOST="${PGHOST:-db}"

if [ "$APP_DB_USER" = "$POSTGRES_USER" ]; then
  echo "ERROR: APP_DB_USER must differ from POSTGRES_USER — the whole point is" >&2
  echo "       that the application does not connect as the superuser." >&2
  exit 1
fi

psql_owner() { psql -v ON_ERROR_STOP=1 -h "$PGHOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"; }

echo "→ ensuring role \"$APP_DB_USER\" exists and cannot bypass RLS"
psql_owner <<SQL
-- Create only if absent; \gexec runs whatever the SELECT returns, which is
-- nothing on a re-run. format() with %I/%L quotes the identifier and literal.
SELECT format(
  'CREATE ROLE %I LOGIN PASSWORD %L',
  '${APP_DB_USER}', '${APP_DB_PASSWORD}')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${APP_DB_USER}')
\gexec

-- Re-asserted every run: this is what keeps RLS meaningful, and it is also how
-- a password rotation lands.
ALTER ROLE "${APP_DB_USER}" WITH LOGIN PASSWORD '${APP_DB_PASSWORD}'
  NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION INHERIT;
SQL

echo "→ granting data access (no DDL, no ownership)"
psql_owner <<SQL
GRANT CONNECT ON DATABASE "${POSTGRES_DB}" TO "${APP_DB_USER}";
GRANT USAGE ON SCHEMA public TO "${APP_DB_USER}";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "${APP_DB_USER}";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "${APP_DB_USER}";

-- Tables created by future migrations are covered without re-running this.
ALTER DEFAULT PRIVILEGES FOR ROLE "${POSTGRES_USER}" IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "${APP_DB_USER}";
ALTER DEFAULT PRIVILEGES FOR ROLE "${POSTGRES_USER}" IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO "${APP_DB_USER}";

-- The migration ledger is the owner's business. An application that can rewrite
-- its own schema history has nothing left to audit.
REVOKE ALL ON TABLE "_prisma_migrations" FROM "${APP_DB_USER}";
SQL

# -----------------------------------------------------------------------------
# Prove it, rather than assert it. A grant that silently left the role able to
# read every tenant would look exactly like success up to this point.
# -----------------------------------------------------------------------------
echo "→ verifying the role cannot bypass RLS"
bypasses=$(psql_owner -tAc \
  "SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname = '${APP_DB_USER}'")
if [ "$bypasses" != "f" ]; then
  echo "FAILED: \"$APP_DB_USER\" can still bypass row-level security." >&2
  exit 1
fi

visible=$(PGPASSWORD="$APP_DB_PASSWORD" psql -v ON_ERROR_STOP=1 -tA \
  -h "$PGHOST" -U "$APP_DB_USER" -d "$POSTGRES_DB" \
  -c "SELECT count(*) FROM aggregates" 2>/dev/null || echo "ERR")
if [ "$visible" != "0" ]; then
  echo "FAILED: with no app.tenant_id set the application role saw '${visible}'" >&2
  echo "        rows in aggregates; it must see 0." >&2
  exit 1
fi

echo "✓ \"$APP_DB_USER\" is subject to row-level security (0 rows visible without a tenant)"
