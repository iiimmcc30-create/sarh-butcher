#!/usr/bin/env bash
# One-time migration: Railway PostgreSQL → Supabase
# Requires PostgreSQL 18 client (pg_dump/pg_restore) when source is PG 18+.
#
# Usage:
#   export RAILWAY_DATABASE_URL='postgresql://...'
#   export SUPABASE_DIRECT_URL='postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres'
#   ./scripts/migrate-db-railway-to-supabase.sh
#
set -euo pipefail

: "${RAILWAY_DATABASE_URL:?Set RAILWAY_DATABASE_URL (source)}"
: "${SUPABASE_DIRECT_URL:?Set SUPABASE_DIRECT_URL (session pooler :5432 or direct host)}"

DUMP="${DUMP_PATH:-/tmp/sarh-railway.dump}"
PG_DUMP="${PG_DUMP:-pg_dump}"
PG_RESTORE="${PG_RESTORE:-pg_restore}"

if command -v /usr/lib/postgresql/18/bin/pg_dump >/dev/null 2>&1; then
  PG_DUMP=/usr/lib/postgresql/18/bin/pg_dump
  PG_RESTORE=/usr/lib/postgresql/18/bin/pg_restore
fi

echo "==> Dumping Railway..."
"$PG_DUMP" "$RAILWAY_DATABASE_URL" --format=custom --no-owner --no-acl -f "$DUMP"
ls -lh "$DUMP"

echo "==> Restoring to Supabase..."
"$PG_RESTORE" --clean --if-exists --no-owner --no-acl -d "$SUPABASE_DIRECT_URL" "$DUMP"

echo "==> Verifying row counts..."
psql "$SUPABASE_DIRECT_URL" -c '
  SELECT
    (SELECT count(*) FROM "User") AS users,
    (SELECT count(*) FROM "Listing") AS listings,
    (SELECT count(*) FROM "_prisma_migrations") AS migrations;
'

echo "Done. Update DATABASE_URL (pooler :6543 + pgbouncer=true) and DIRECT_URL (:5432) in Railway."
