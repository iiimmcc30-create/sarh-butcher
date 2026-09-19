# HISTORICAL / OPTIONAL EXTRACTION TOOL — NOT PART OF PRODUCTION LAUNCH

**Script:** `scripts/migrate-from-sarh.mjs`

> `migrate-from-sarh.mjs` is **NOT required** for Malahem production launch.  
> Malahem production starts with a clean PostgreSQL database and zero migrated users/data.

Keep this file and the script in the repo for optional, later extraction from a **local/staging snapshot**.  
Do **not** put this script on the launch checklist.  
Do **not** execute it as part of going live.

```
SARH DATA MIGRATION: NOT REQUIRED
```

---

## What the script is

A read-source / upsert-destination tool for butcher-domain rows. Dry-run is the default. Destination cannot be `sarouh`. Source is never written. Sessions are not copied.

It is **not reversible**. It is **not** the production initialization path.

Canonical launch: `docs/MALAHEM_FRESH_PRODUCTION_INITIALIZATION.md`.

---

## If an operator later chooses to extract a snapshot (optional)

SAFE TO RUN LOCALLY against **local snapshots only**:

```bash
SARH_SOURCE_DATABASE_URL='postgresql://…/sarh_snapshot' \
MALAHEM_DATABASE_URL='postgresql://…/sarh_butcher' \
  node scripts/migrate-from-sarh.mjs --dry-run
```

`--execute` is **not** a launch step. Do not run it against live Sarh or as a substitute for `prisma migrate deploy` on an empty production database.
