# Malahem production deployment runbook (fresh launch)

**Do not execute production steps from this document without explicit approval.**

Malahem production starts with a **clean PostgreSQL database** and **zero migrated users/data**.

`scripts/migrate-from-sarh.mjs` is **not** part of this procedure.

```
PRODUCTION DEPLOYMENT: NOT EXECUTED
PRODUCTION DATABASE MIGRATION: NOT EXECUTED
SARH DATA MIGRATION: NOT REQUIRED
```

Canonical init sequence: `docs/MALAHEM_FRESH_PRODUCTION_INITIALIZATION.md`.  
Env contract: `docs/MALAHEM_PRODUCTION_ENVIRONMENT.md`.  
Compose: `docker-compose.prod.yml` (`malahem_internal`).

Every command is marked **SAFE TO RUN LOCALLY** or **PRODUCTION — RUN ONLY AFTER EXPLICIT APPROVAL**.

---

## STEP 0 — Prerequisites

| Prerequisite | Independent of Sarh? |
| ------------ | -------------------- |
| Domain `<MALAHEM_PRODUCTION_DOMAIN>` + DNS | Yes |
| TLS certificate for that name | Yes — new cert |
| Server with Docker | Yes — not `/opt/sarh` |
| Empty PostgreSQL `sarh_butcher` | Yes — new cluster |
| Redis (not host `:6379`) | Yes |
| New secrets | Yes |
| N-Genius outlet + webhook | Yes — new |
| Twilio Verify | Yes — new |
| Firebase for `com.sarh.butcher` | Yes — new |
| Cloudinary folder `sarh-butcher` | Yes |

SAFE TO RUN LOCALLY: `node scripts/check-production-config.mjs`

---

## STEP 1 — Configure environment

Copy `.env.production.example` off-git. Replace `<MALAHEM_PRODUCTION_DOMAIN>` and `CHANGE_ME`.

Required: `SKIP_MIGRATIONS=true`, `DEV_OTP=false`, `JWT_ISSUER=malahm-sarh`, `CLOUDINARY_FOLDER=sarh-butcher`, `REDIS_KEY_PREFIX=butcherapp:`.

Secret generation (later, operator machine):

```bash
openssl rand -hex 32
```

---

## STEP 2 — Validate environment

SAFE TO RUN LOCALLY:

```bash
cd backend-nest
npx prisma validate
NODE_ENV=production npx jest --runInBand --forceExit --testPathPatterns='validate-production-env'
```

PRODUCTION — RUN ONLY AFTER EXPLICIT APPROVAL: `validateProductionEnv()` runs on process start.

---

## STEP 3 — Initialize the empty database

PRODUCTION — RUN ONLY AFTER EXPLICIT APPROVAL:

```bash
cd backend-nest
npx prisma migrate deploy
npx prisma migrate status
```

Expected: 48 migrations applied; no imported Sarh rows.

Do **not** use `prisma migrate dev` or `db push`.  
Do **not** leave `RUN_MIGRATIONS=true` on for everyday restarts.

---

## STEP 4 — Deploy containers

SAFE TO RUN LOCALLY:

```bash
docker compose -f docker-compose.yml up -d postgres redis
```

PRODUCTION — RUN ONLY AFTER EXPLICIT APPROVAL:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

API defaults to `SKIP_MIGRATIONS=true`. Schema does not change on restart.

Do not attach to `sarh_internal`. Do not compose onto `/opt/sarh`.

---

## STEP 5 — Verify health

SAFE TO RUN LOCALLY:

```bash
curl -sS http://127.0.0.1:3001/api/health
curl -sS http://127.0.0.1:3001/api/health/ready
```

| Endpoint | Meaning |
| -------- | ------- |
| `GET /api/health` | API + DB |
| `GET /api/health/ready` | DB + Redis + queue + worker |
| Socket `:3002 /health` | Socket process |

---

## STEP 6 — Nginx / TLS

`/api/*` → `api:3001`  
`/socket.io/*` → `socket:3002`  
`/payment/result` and `/payment/cancel` → `api:3001`  
`/butcher` dashboard, `/admin` panel

After DNS: bind `<MALAHEM_PRODUCTION_DOMAIN>`, place new certs.  
PRODUCTION — RUN ONLY AFTER EXPLICIT APPROVAL.

---

## STEP 7 — First operator accounts

Blank database. Create the first admin, first butcher, first customer **after** health is green.

There is no imported user list.

---

## STEP 8 — Smoke tests

`docs/MALAHEM_PRODUCTION_SMOKE_TEST.md` (first-launch / empty DB).

PRODUCTION — RUN ONLY AFTER EXPLICIT APPROVAL.

---

## STEP 9 — Monitor and backups

Enable daily Postgres dumps before public traffic. See `docs/MALAHEM_BACKUP_AND_RECOVERY.md`.

---

## EAS / mobile (later)

PRODUCTION — RUN ONLY AFTER EXPLICIT APPROVAL — create EAS secrets:

- `EXPO_PUBLIC_API_URL=https://<MALAHEM_PRODUCTION_DOMAIN>`
- `EXPO_PUBLIC_SOCKET_URL=https://<MALAHEM_PRODUCTION_DOMAIN>`
- `EXPO_PUBLIC_SOCKET_PATH=/socket.io`

Do not run `eas build --profile production` in this phase.

---

## Out of scope

Sarh data copy, `migrate-from-sarh.mjs`, sharing Sarh networks/secrets/outlets.
