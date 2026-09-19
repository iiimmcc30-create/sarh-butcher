#!/usr/bin/env bash
# Independent Malahem Postgres backup. Does not touch Sarh dumps.
set -euo pipefail
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
DEST=${MALAHEM_BACKUP_DIR:-/opt/backups/malahem}
mkdir -p "$DEST"
docker exec sarh-butcher-butcher-postgres-1 \
  pg_dump -U butcher -d sarh_butcher --no-owner --format=custom \
  > "$DEST/sarh_butcher-${STAMP}.dump"
# Keep 14 days
find "$DEST" -name 'sarh_butcher-*.dump' -mtime +14 -delete
echo "WROTE $DEST/sarh_butcher-${STAMP}.dump"
