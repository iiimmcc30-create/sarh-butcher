# Fresh Malahem production initialization

Malahem is a **brand-new** production platform.

```
New Infrastructure
        ↓
New PostgreSQL (empty sarh_butcher)
        ↓
prisma migrate deploy   (once, explicit)
        ↓
Fresh schema — customers=0 butchers=0 orders=0 products=0
        ↓
Deploy application  (SKIP_MIGRATIONS=true)
        ↓
Configure external services
        ↓
Create first operator / butcher accounts
        ↓
Smoke tests
        ↓
Enable public traffic
```

There is **no** Sarh → Malahem data migration on this path.  
`scripts/migrate-from-sarh.mjs` is a historical / optional extraction tool. It is **not** a launch step.

Do not execute production commands from this file without explicit approval.

---

## 1. Provision infrastructure

Independent of Sarh (`/opt/sarh`, `sarh_internal`, host Redis `:6379`, `sarouh`):

- VPS (or equivalent) with Docker
- New PostgreSQL, database name `sarh_butcher`
- New Redis (compose service `redis:6379` is fine; host `127.0.0.1:6379` is not)
- Cloudinary folder `sarh-butcher` (or S3)
- DNS for `<MALAHEM_PRODUCTION_DOMAIN>`
- TLS for that name (not issued in this phase)

---

## 2. Configure secrets

Copy `.env.production.example`. Generate **new** values (do not run these into git):

```bash
openssl rand -hex 32   # BUTCHER_JWT_SECRET
openssl rand -hex 32   # BUTCHER_JWT_REFRESH_SECRET
openssl rand -hex 32   # CRON_SECRET
openssl rand -hex 32   # SECRETS_ENCRYPTION_KEY  (≥32 chars; hashed with SHA-256 at rest)
openssl rand -hex 24   # POSTGRES_PASSWORD / Redis password
```

Fill:

- `MALAHEM_DATABASE_URL` / `DATABASE_URL`
- `MALAHEM_REDIS_URL` — prefix `REDIS_KEY_PREFIX=butcherapp:`
- JWT pair + `JWT_ISSUER=malahm-sarh`
- `APP_URL`, `PUBLIC_API_URL`, `MALAHEM_*` URLs → `https://<MALAHEM_PRODUCTION_DOMAIN>`
- `ALLOWED_ORIGINS` — exact https, no `*`, no localhost, no `sarhsa.online`
- `MALAHEM_NI_*`, Twilio Verify, `FIREBASE_*`, Cloudinary
- `SKIP_MIGRATIONS=true`
- `DEV_OTP=false`

---

## 3. Validate environment

SAFE TO RUN LOCALLY:

```bash
node scripts/check-production-config.mjs
cd backend-nest && npx prisma validate
```

Production boot runs `validateProductionEnv()` when `NODE_ENV=production`.

---

## 4. Initialize database

Empty database only. Apply the 48 Prisma migrations **once**.

PRODUCTION — RUN ONLY AFTER EXPLICIT APPROVAL:

```bash
cd backend-nest
npx prisma migrate deploy
```

Do not start the API with `RUN_MIGRATIONS=true` as the normal restart path.

---

## 5. Verify migrations

PRODUCTION — RUN ONLY AFTER EXPLICIT APPROVAL:

```bash
npx prisma migrate status
```

Expected: all 48 migrations applied. Tables exist. Row counts are zero until operators create data.

---

## 6. Start services

PRODUCTION — RUN ONLY AFTER EXPLICIT APPROVAL:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

`SKIP_MIGRATIONS` defaults to `true` on the API. Network: `malahem_internal`.

Services: postgres, redis, api, worker, socket, butcher (dashboard), admin, nginx.

---

## 7. Verify health

```bash
curl -sS https://<MALAHEM_PRODUCTION_DOMAIN>/api/health
curl -sS https://<MALAHEM_PRODUCTION_DOMAIN>/api/health/ready
```

| Check | Endpoint |
| ----- | -------- |
| API / DB | `GET /api/health` |
| DB + Redis + worker | `GET /api/health/ready` |
| Socket | socket process `/health` |

---

## 8. Create first operator / butcher accounts

Only after health is ready. There are no imported users.

- First customer: Phone → OTP → JWT
- First butcher: dashboard username/password
- First admin: `ADMIN_EMAIL` / `ADMIN_PASSWORD` as configured

---

## 9. Run smoke tests

`docs/MALAHEM_PRODUCTION_SMOKE_TEST.md` — first-launch (blank database) matrix.

---

## 10. Enable public traffic

DNS + TLS + NI webhook + Twilio + EAS store build.  
Enable daily Postgres backups **before** inviting the public.

```
PRODUCTION DEPLOYMENT: NOT EXECUTED
PRODUCTION DATABASE MIGRATION: NOT EXECUTED
SARH DATA MIGRATION: NOT REQUIRED
```
