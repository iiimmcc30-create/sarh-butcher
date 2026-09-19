# Malahem production environment contract

**Product:** ملاحم سرح  
**Authoritative templates:** `.env.production.example`, `scripts/vps.env.example`, `backend-nest/.env.render.example`  
**Aliases:** `backend-nest/src/load-env.ts`  
**Fail-fast:** `validateProductionEnv()` when `NODE_ENV=production`

Do not invent a final hostname. Use `<MALAHEM_PRODUCTION_DOMAIN>` until DNS exists.  
Do not copy Sarh secrets. Every production credential must be **new**.

Production is a **fresh install**: empty `sarh_butcher`, then `prisma migrate deploy` once.  
`SKIP_MIGRATIONS=true` on normal API restarts. `scripts/migrate-from-sarh.mjs` is not a launch step.

Operator secret generation (do not paste results into git):

```bash
openssl rand -hex 32   # BUTCHER_JWT_SECRET, BUTCHER_JWT_REFRESH_SECRET,
                       # CRON_SECRET, SECRETS_ENCRYPTION_KEY (≥32 chars)
openssl rand -hex 24   # POSTGRES_PASSWORD / Redis password
```

`SECRETS_ENCRYPTION_KEY` is any string ≥32 characters; the runtime SHA-256 hashes it for AES-256-GCM.

Aliases applied at boot (source → runtime key):

```
MALAHEM_DATABASE_URL        → DATABASE_URL
MALAHEM_DIRECT_URL          → DIRECT_URL
BUTCHER_JWT_SECRET          → JWT_SECRET
BUTCHER_JWT_REFRESH_SECRET  → JWT_REFRESH_SECRET
MALAHEM_REDIS_URL           → REDIS_URL
MALAHEM_NI_*                → NI_*
MALAHEM_API_URL             → PUBLIC_API_URL
MALAHEM_APP_URL             → APP_URL
MALAHEM_DASHBOARD_URL       → BUTCHER_DASHBOARD_URL
```

`SARH_*` is never read.

---

## DATABASE

| Item | Contract |
| ---- | -------- |
| Preferred URL | `MALAHEM_DATABASE_URL` (aliased to `DATABASE_URL`) |
| Direct / migrate URL | `MALAHEM_DIRECT_URL` → `DIRECT_URL` (same as `DATABASE_URL` if unset) |
| Engine | PostgreSQL 18 (compose image `postgres:18-alpine`) |
| Database name | `sarh_butcher` — **never** `sarouh` |
| Default user | `butcher` (`POSTGRES_USER`) |
| Host (compose) | `postgres` or `butcher-postgres` on `malahem_internal` |
| Port | `5432` inside the network. Local publish is `127.0.0.1:5433` only. |
| SSL | Required for any managed/public host (`?sslmode=require`). Compose-internal may omit SSL. |
| Pool | Prisma default. Do not point migrate (`DIRECT_URL`) at a transaction pooler that rejects `prisma migrate deploy`. |
| Backup | See `docs/MALAHEM_BACKUP_AND_RECOVERY.md`. Daily logical dump minimum. |

Production must use a **new empty** cluster. Sharing the Sarh Postgres instance or the `sarouh` database is forbidden. Launch counts are zero until operators create accounts.

---

## REDIS

| Item | Contract |
| ---- | -------- |
| Preferred URL | `MALAHEM_REDIS_URL` → `REDIS_URL` |
| Host/port fallback | `REDIS_HOST` + `REDIS_PORT` |
| Auth | Password in the URL or `REDIS_PASSWORD`. Production Redis must not be anonymous on a published port. |
| TLS | Supported if the URL is `rediss://`. Compose-internal Redis is plain TCP. |
| DB index | Default `0` unless the URL path sets another. |
| Prefix | `REDIS_KEY_PREFIX=butcherapp:` (BullMQ-safe; no `:` in queue names) |
| Isolation | Fail-fast: loopback `:6379` throws (`MalahemRedisConfigError`). Never silent Sarh Redis. |

Share with Sarh? **No.**

---

## AUTH

| Variable | Required | Notes |
| -------- | -------- | ----- |
| `BUTCHER_JWT_SECRET` / `JWT_SECRET` | Yes (≥32) | New secret. Not Sarh `JWT_SECRET`. |
| `BUTCHER_JWT_REFRESH_SECRET` / `JWT_REFRESH_SECRET` | Yes (≥32) | Independent of access secret. |
| `JWT_ISSUER` | Yes | **Must be `malahm-sarh`.** Validator rejects any other value. |
| `JWT_EXPIRES_IN` | Default `15m` | Access token. |
| `JWT_REFRESH_EXPIRES_IN` | Default `30d` | Refresh token + Redis session. |
| `TWILIO_ACCOUNT_SID` | Yes in production | New Verify project. |
| `TWILIO_AUTH_TOKEN` | Yes | |
| `TWILIO_VERIFY_SERVICE_SID` | Yes | New service SID. |
| `DEV_OTP` | Must be `false` / unset | `true` aborts production boot and OTP runtime. |

Issuer on issued tokens and on the JWT guard is `malahm-sarh`. A Sarh token (`iss=sarh`) is rejected.

---

## URLS

Do not bake a hostname in code. After DNS:

```
MALAHEM_APP_URL=https://<MALAHEM_PRODUCTION_DOMAIN>
MALAHEM_API_URL=https://<MALAHEM_PRODUCTION_DOMAIN>
MALAHEM_DASHBOARD_URL=https://<MALAHEM_PRODUCTION_DOMAIN>
MALAHEM_ADMIN_URL=https://<MALAHEM_PRODUCTION_DOMAIN>
APP_URL=https://<MALAHEM_PRODUCTION_DOMAIN>
PUBLIC_API_URL=https://<MALAHEM_PRODUCTION_DOMAIN>
PUBLIC_SOCKET_URL=https://<MALAHEM_PRODUCTION_DOMAIN>
```

| Variable | Used for |
| -------- | -------- |
| `APP_URL` / `MALAHEM_APP_URL` | NI return `…/payment/result`, deep-link host |
| `PUBLIC_API_URL` / `MALAHEM_API_URL` | Public API origin (optional `/api/butcher` suffix is path-prefix compat only) |
| `MALAHEM_DASHBOARD_URL` | CORS + butcher dashboard origin |
| `MALAHEM_ADMIN_URL` | CORS + admin origin |
| `NEXT_PUBLIC_API_URL` | Dashboard/admin **build-time** API |
| `NEXT_PUBLIC_SOCKET_URL` | Dashboard/admin **build-time** socket |
| `EXPO_PUBLIC_API_URL` | Mobile production API (EAS secret) |
| `EXPO_PUBLIC_SOCKET_URL` | Mobile production socket (EAS secret) |
| `EXPO_PUBLIC_SOCKET_PATH` | `/socket.io` on a dedicated host |

Payment callback (Nest, global prefix excluded):

```
https://<MALAHEM_PRODUCTION_DOMAIN>/payment/result
https://<MALAHEM_PRODUCTION_DOMAIN>/payment/cancel
```

Webhook:

```
https://<MALAHEM_PRODUCTION_DOMAIN>/api/payments/webhook
https://<MALAHEM_PRODUCTION_DOMAIN>/api/integrations/ni/webhook
```

---

## CORS

`ALLOWED_ORIGINS` is **required** in production. No `*`. No `sarhsa.online`. No localhost.

Once the domain exists, set at least:

```
ALLOWED_ORIGINS=https://<MALAHEM_PRODUCTION_DOMAIN>
```

If dashboard/admin are separate hosts:

```
ALLOWED_ORIGINS=https://dashboard.<MALAHEM_PRODUCTION_DOMAIN>,https://admin.<MALAHEM_PRODUCTION_DOMAIN>
```

Native mobile clients send no `Origin` and are unaffected.  
`BUTCHER_DASHBOARD_ALLOW_VERCEL=true` is ignored in production.

---

## N-GENIUS

| Variable | Required | Share with Sarh? |
| -------- | -------- | ---------------- |
| `MALAHEM_NI_BASE_URL` / `NI_BASE_URL` | Yes | No — KSA gateway URL is public, credentials are not |
| `MALAHEM_NI_OUTLET_ID` / `NI_OUTLET_ID` | Yes | **New outlet** |
| `MALAHEM_NI_API_KEY` / `NI_API_KEY` | Yes | **New key** (`test_` rejected) |
| `MALAHEM_NI_WEBHOOK_SECRET` / `NI_WEBHOOK_SECRET` | Yes | **New secret** |

New merchant refs: `MALAHM-`. Legacy `SFAT-` / `FTR-` / … are lookup-only.

---

## TWILIO VERIFY

Mandatory for production customer Phone → OTP → JWT. New Verify service. Do not reuse the Sarh SID.

---

## FIREBASE / FCM

Optional for boot (push no-ops if unset). **Required** before production push.

```
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

Android package: `com.sarh.butcher`. New Firebase project. No Sarh credentials.

`google-services.json`: required for a native EAS Android build that enables `expo-notifications` (prior EAS build failed without it). Not required for the Nest Admin SDK path. Do not commit the file.

---

## CLOUDINARY

| Variable | Required when `STORAGE_PROVIDER=cloudinary` |
| -------- | ------------------------------------------- |
| `CLOUDINARY_CLOUD_NAME` | Yes |
| `CLOUDINARY_API_KEY` | Yes |
| `CLOUDINARY_API_SECRET` | Yes |
| `CLOUDINARY_FOLDER` | Default / required value: `sarh-butcher` |

Validator rejects folder `safat` or `sarh`. `STORAGE_PROVIDER=local` is forbidden in production.

---

## DAFTRA

Per-butcher credentials stored encrypted (`SECRETS_ENCRYPTION_KEY`). Platform OAuth env:

```
DAFTRA_OAUTH_CLIENT_ID=
DAFTRA_OAUTH_CLIENT_SECRET=
DAFTRA_OAUTH_REDIRECT_URI=https://<MALAHEM_PRODUCTION_DOMAIN>/api/butchers/daftra/oauth/callback
SECRETS_ENCRYPTION_KEY=   # required in production
```

Not required to boot the API. Required for product sync. Worker interval: 10 minutes, Redis lock `butcherapp:cron:daftra_products:{id}`.

---

## SENTRY (optional)

`SENTRY_DSN` — if unset, production logs a warning and continues.

---

## OTHER REQUIRED IN PRODUCTION

| Variable | Purpose |
| -------- | ------- |
| `CRON_SECRET` | Protects cron/admin cleanup routes |
| `APP_DEEP_LINK_SCHEME` | `malahm` |
| `APP_ANDROID_PACKAGE` | `com.sarh.butcher` |
| `STORAGE_PROVIDER` | `cloudinary` or `s3` |

---

## Share-with-Sarh matrix

| Resource | Share? |
| -------- | ------ |
| Postgres | No |
| Redis | No |
| JWT | No |
| NI outlet / webhook | No |
| Twilio Verify | No |
| Cloudinary folder | No (`sarh-butcher` only) |
| Firebase | No |
| Daftra tenant / OAuth redirect | No |
| Docker network | No (`malahem_internal` only) |
| DNS / TLS certs | No |
