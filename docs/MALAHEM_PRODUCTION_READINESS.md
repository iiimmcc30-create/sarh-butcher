# MALAHEM SARH — PRODUCTION READINESS

**Product:** ملاحم سرح / Malahem Sarh  
**Repository:** `https://github.com/iiimmcc30-create/sarh-butcher`  
**Local tree:** `/home/ubuntu/sarh-butcher`  
**Audited commit:** `cf4875a2756fbf217e8d5f00d2cf4e6e07916519`  
**Date:** 2026-09-19  
**Scope:** audit + plan only. No production deploy, no `prisma migrate deploy` on production, no DNS/SSL changes, no live payment, no secret creation, no Sarh edits, no commit/push/PR.

```
CONDITIONAL GO
```

The extracted codebase and local isolation are ready to receive **new** Malahem production resources. Independent production infrastructure, domain, secrets, payment outlet, Twilio Verify, Firebase, and callback routing are **not** provisioned. Do not deploy to production from this audit.

---

## 1. Current architecture

Independent repository on GitHub (`origin/main` = `cf4875a`). Runtime graph is butcher-only Nest (`AppModule`): Auth, Users, Settings, Notifications, Payments, Integrations, Daftra, Butchers, Applications, Messages, Upload, Admin, Health, Support, Banners, Queue, Gateway.

```
Mobile (Expo, com.sarh.butcher, scheme malahm)
Butcher dashboard (Next, cookie butcher_token)
Admin panel (Next, admin login)
        │
        ▼
   Nest API :3001   prefix /api
   (excludes /payment/result, /payment/cancel, /join, /privacy)
        │
        ├── Socket :3002
        ├── Worker (BullMQ + cron + heartbeat)
        ├── PostgreSQL database name sarh_butcher
        └── Redis prefix butcherapp:
```

**Process roles** (`SERVICE_MODE` / `docker-entrypoint.sh`):

| Role | Entrypoint | Port | Notes |
| ---- | ---------- | ---- | ----- |
| api | `dist/main.js` | 3001 | Production skips migrate unless `RUN_MIGRATIONS=true`; compose defaults `SKIP_MIGRATIONS=true` |
| worker | `dist/queue/worker.main.js` | none | Heartbeat, queues, Daftra cron |
| socket | `dist/gateway/socket.main.js` | 3002 | Socket.IO |

Local proven isolation (prior hardening, not re-executed as a live production test in this audit):

| Resource | Malahem | Must not use |
| -------- | ------- | ------------ |
| Postgres | `sarh_butcher` / user `butcher` | `sarouh` |
| Redis | host port **6380**, prefix `butcherapp:` | host **6379** / `bull:*` |
| JWT issuer | `malahm-sarh` | `sarh` |
| Cloudinary folder | `sarh-butcher` | `safat` |
| Merchant ref | `MALAHM-` | new `SFAT-` |

Leftover Prisma models (Listing, Post, LiveStream, Story, Plan, MEWA, feed, …) remain in the schema. They are **not** imported in `AppModule`. Do not delete in this phase.

---

## 2. Production topology

Recommended **independent** topology (not shared Sarh host):

```
Internet
   │
   ▼
Nginx :443 (TLS) / :80 ACME only
   │
   ├── /api/              → api:3001
   ├── /payment/result    → api:3001   (Nest exclude, not Expo web)
   ├── /socket.io/        → socket:3002
   ├── /butcher/          → dashboard:3003
   └── /admin/            → admin:3000
         │
         ▼
   butcher-postgres (internal only)
   butcher-redis    (internal only, AOF)
         │
         └── worker (internal only)
```

**Existing compose files:**

| File | Intent | Production-safe? |
| ---- | ------ | ---------------- |
| `docker-compose.yml` | Local Postgres :5433 + Redis :6380 | Yes for local |
| `docker-compose.prod.yml` | Full stack + nginx :80 | Isolated `malahem_internal`. `/payment/result` → `api:3001`. Public URLs required via `MALAHEM_*` / `NEXT_PUBLIC_*` (no baked domain). Redis has no `requirepass`. |
| `docker-compose.vps.yml` | Independent VPS stack | Isolated `malahem_internal` only. No `sarh_internal`. Includes API/worker/socket/postgres/redis/nginx/dashboard/admin. |
| `docker-compose.nginx-edge.yml` | Optional TLS extra for prod nginx | Does **not** overlay `/opt/sarh`. |

**Ports (recommended independent prod):**

| Public | Internal |
| ------ | -------- |
| 443, 80 | api 3001, socket 3002, dashboard 3003, admin 3000, postgres 5432, redis 6379 (container only) |

API/socket/postgres/redis must **not** be published on `0.0.0.0`. Compose prod already binds API/socket to `127.0.0.1` when nginx is the edge.

**Restart:** `unless-stopped` on all compose services.  
**Volumes:** `butcher_postgres_data`, `butcher_redis_data`.  
**Health:** Postgres `pg_isready`, Redis `PING`, API `GET /api/health` (liveness, DB) and `GET /api/health/ready` (DB + Redis + worker heartbeat).

`docker-compose.vps.yml` is a **staging/shared-host** design, not the independent production target.

---

## 3. Environment matrix

Aliases in `backend-nest/src/load-env.ts` (never reads `SARH_*`):

```
MALAHEM_DATABASE_URL → DATABASE_URL
MALAHEM_DIRECT_URL → DIRECT_URL
BUTCHER_JWT_SECRET → JWT_SECRET
BUTCHER_JWT_REFRESH_SECRET → JWT_REFRESH_SECRET
MALAHEM_REDIS_URL → REDIS_URL
MALAHEM_NI_* → NI_*
```

Production fail-fast: `validateProductionEnv()` when `NODE_ENV=production`. It does **not** require Firebase, Daftra, `CLOUDINARY_FOLDER`, or `REDIS_KEY_PREFIX`, and it does **not** assert `JWT_ISSUER === malahm-sarh`.

### A — Mandatory secrets

| NAME | USED BY | SECRET / PUBLIC | DEFAULT | PRODUCTION REQUIRED | SOURCE |
| ---- | ------- | --------------- | ------- | ------------------- | ------ |
| `DATABASE_URL` | API, worker, socket, Prisma | SECRET | none | YES | New Malahem Postgres |
| `DIRECT_URL` | API migrate | SECRET | aliased from DATABASE_URL | YES if pooled URL used | Same cluster, direct |
| `JWT_SECRET` / `BUTCHER_JWT_SECRET` | API, dashboard middleware | SECRET | none (≥32) | YES | New, not Sarh |
| `JWT_REFRESH_SECRET` | API | SECRET | none (≥32) | YES | New |
| `SECRETS_ENCRYPTION_KEY` | Daftra row crypto | SECRET | none | YES | New, not JWT_SECRET |
| `CRON_SECRET` | Admin/worker cron auth | SECRET | none | YES | New |
| `TWILIO_ACCOUNT_SID` | OTP | SECRET | none | YES | **New Verify service** |
| `TWILIO_AUTH_TOKEN` | OTP | SECRET | none | YES | New |
| `TWILIO_VERIFY_SERVICE_SID` | OTP | SECRET | none | YES | New SID, not Sarh |
| `NI_API_KEY` / `MALAHEM_NI_API_KEY` | Payments | SECRET | none | YES | **New NI outlet** |
| `NI_OUTLET_ID` | Payments | SECRET | none | YES | New |
| `NI_WEBHOOK_SECRET` | Webhook HMAC | SECRET | none | YES | New |
| `NI_BASE_URL` | Payments | PUBLIC-ish | KSA gateway in examples | YES | NI KSA or sandbox URL |
| `CLOUDINARY_API_SECRET` | Uploads | SECRET | none if `STORAGE_PROVIDER=cloudinary` | YES | New or isolated folder+keys |
| `CLOUDINARY_API_KEY` | Uploads | SECRET | none | YES if cloudinary | New |
| `DAFTRA_OAUTH_CLIENT_SECRET` | Daftra | SECRET | none | YES if Daftra live | New redirect on Malahem API |
| `FIREBASE_PRIVATE_KEY` | Push worker | SECRET | none | YES for FCM | New Firebase project |
| `FIREBASE_CLIENT_EMAIL` | Push | SECRET | none | YES for FCM | New |
| `REDIS_PASSWORD` | Redis | SECRET | empty in templates | YES on public/shared hosts | New |
| `POSTGRES_PASSWORD` | Compose DB | SECRET | placeholder | YES | New |

`DEV_OTP=true` is **forbidden** in production (`validateProductionEnv` + runtime throw).

### B — Infrastructure

| NAME | USED BY | SECRET / PUBLIC | DEFAULT | PRODUCTION REQUIRED | SOURCE |
| ---- | ------- | --------------- | ------- | ------------------- | ------ |
| `NODE_ENV` | All | PUBLIC | development | `production` | Deploy |
| `APP_URL` | Payment return, deep-link HTML | PUBLIC | localhost:3001 | YES, `https://` | **DOMAIN REQUIRED** |
| `PUBLIC_API_URL` | Templates / mobile docs | PUBLIC | localhost | YES | DOMAIN |
| `PUBLIC_SOCKET_URL` | Templates | PUBLIC | localhost:3002 | YES | DOMAIN |
| `REDIS_URL` / `MALAHEM_REDIS_URL` / `REDIS_HOST`+`REDIS_PORT` | API, worker, socket | SECRET if password | fail-fast, no silent :6379 | YES | New Redis |
| `REDIS_KEY_PREFIX` | Cache/queues | PUBLIC | `butcherapp:` | YES (keep) | Code/templates |
| `REDIS_ENABLED` | Redis module | PUBLIC | true | true | Deploy |
| `PORT` | API/socket | PUBLIC | 3001 / 3002 | container | Compose |
| `SERVICE_MODE` | Entrypoint | PUBLIC | api | api\|worker\|socket | Compose |
| `ALLOWED_ORIGINS` | CORS | PUBLIC | empty prod list | YES | Dashboard+admin origins |
| `FRONTEND_URL` / `BUTCHER_DASHBOARD_URL` | CORS extras | PUBLIC | none | Recommended | Deploy |
| `JWT_ISSUER` | JWT | PUBLIC | `malahm-sarh` | YES, value must stay `malahm-sarh` | Env |
| `JWT_EXPIRES_IN` | JWT | PUBLIC | 15m | Recommended | Env |
| `JWT_REFRESH_EXPIRES_IN` | JWT | PUBLIC | 30d | Recommended | Env |
| `STORAGE_PROVIDER` | Uploads | PUBLIC | none in prod validator | `cloudinary` or `s3` | Env |
| `CLOUDINARY_FOLDER` | Uploads | PUBLIC | `sarh-butcher` | YES | Must not be `safat` |
| `CLOUDINARY_CLOUD_NAME` | Uploads | PUBLIC | none | YES if cloudinary | New |
| `SKIP_MIGRATIONS` | API boot | PUBLIC | false | Decide per release | Ops |
| `SENTRY_DSN` | Errors | SECRET | empty | Recommended | New Malahem project |

### C — Public configuration

| NAME | USED BY | SECRET / PUBLIC | DEFAULT | PRODUCTION REQUIRED | SOURCE |
| ---- | ------- | --------------- | ------- | ------------------- | ------ |
| `EXPO_PUBLIC_API_URL` | Mobile | PUBLIC | localhost / **eas.json = sarhsa.online/api/butcher** | YES, Malahem API | EAS + domain |
| `EXPO_PUBLIC_SOCKET_URL` | Mobile | PUBLIC | eas.json = sarhsa.online | YES | Domain |
| `EXPO_PUBLIC_SOCKET_PATH` | Mobile | PUBLIC | `/socket.io` or `/api/butcher/socket.io` | YES, match nginx | Domain topology |
| `NEXT_PUBLIC_API_URL` | Dashboard, admin | PUBLIC | localhost; Docker ARG `sarhsa.online/api/butcher` | YES, baked at **build** | Rebuild after domain |
| `NEXT_PUBLIC_SOCKET_URL` | Dashboard, admin | PUBLIC | same | YES | Domain |
| `NEXT_PUBLIC_BUTCHER_BASE_PATH` | Dashboard | PUBLIC | `/butcher` | Keep if path-based | Nginx |
| `NEXT_PUBLIC_ADMIN_BASE_PATH` | Admin | PUBLIC | `/admin` | Keep if path-based | Nginx |
| `NEXT_PUBLIC_BROWSER_API_BASE` | Dashboard browser | PUBLIC | derived | Optional | Shared-host `/api/butcher` |
| `APP_DEEP_LINK_SCHEME` | Payments / app | PUBLIC | `malahm` | YES | App |
| `APP_ANDROID_PACKAGE` | Payments | PUBLIC | `com.sarh.butcher` | YES | App |
| `FIREBASE_PROJECT_ID` | Push | PUBLIC | none | YES for FCM | New project |

No live secret values are recorded in this document.

---

## 4. Resource isolation

| Boundary | Code / template | Cross-reference found (do not auto-fix) |
| -------- | --------------- | --------------------------------------- |
| DB | Target name `sarh_butcher`; migrate script refuses dest `sarouh` | Same **machine** may still host `sarouh` locally. Production must be a **new** cluster. |
| Redis | Fail-fast; loopback `:6379` throws; prefix `butcherapp:` | Compose uses `malahem_internal` only. Still need a new production Redis (not host `:6379`). |
| JWT | Default/issuer `malahm-sarh`; guard verifies issuer | Dashboard/admin must use the **same** new `JWT_SECRET`. |
| Payments | New refs `MALAHM-`; legacy `SFAT-` still accepted for lookup | Nginx `/payment/result` → `api:3001`. NI outlet still missing. |
| Cloudinary | Folder default `sarh-butcher` | Leftover Expo `safat_*` keys / unused `googleOAuth` `@zeinabmostafa/safat`. |
| Network | All compose files use `malahem_internal` | Nginx `server_name _;` until `MALAHEM_DOMAIN` exists. |

**Confirmed isolation defaults:**

```
Redis prefix = butcherapp:
JWT issuer   = malahm-sarh
Cloudinary   = sarh-butcher
```

**Sarh production resources must not be copied.** Treat any existing local `DATABASE_URL` to `127.0.0.1/sarh_butcher` as **dev only**.

---

## 5. Database readiness

**Command results (local `127.0.0.1:5432` / `sarh_butcher` only — not production):**

```
npx prisma validate          → schema valid
npx prisma migrate status    → 48 migrations, database schema is up to date
```

`prisma migrate deploy` was **not** run against production.

| Item | Finding |
| ---- | ------- |
| Migration count | 48 under `backend-nest/prisma/migrations` |
| Order | Timestamp folders from `20250706000000_init` through `20260919140000_user_rating_review_align` |
| Pending (local) | None |
| Destructive `DROP TABLE` / `DROP COLUMN` | None found in migration SQL |
| Seed | No `prisma.seed` in `package.json` |
| Leftover models | Listing/Post/Live/Story/Plan/MEWA/Feed remain in schema; unused by `AppModule` |
| Production process | API container runs `prisma migrate deploy` on boot unless `SKIP_MIGRATIONS=true`. That is a **release-gated** step, not something to fire against an unknown production URL. |
| Risk | Entrypoint comments still mention Supabase/Render. Pointing `DATABASE_URL` at the wrong host would migrate that host. |

**Production-safe sequence (later, not now):** snapshot → set new `DATABASE_URL` → `migrate status` → `migrate deploy` once → start API with `SKIP_MIGRATIONS=true` on subsequent restarts if desired.

---

## 6. Redis readiness

`resolveMalahemRedisTarget()`:

- Requires `MALAHEM_REDIS_URL` / `REDIS_URL` / `REDIS_HOST`
- Refuses missing host (no silent `localhost:6379`)
- Refuses loopback port `6379`
- Allows Docker-internal hostname + container `6379` (e.g. `butcher-redis`)

| Consumer | DB / prefix | Fail-fast |
| -------- | ----------- | --------- |
| API cache/sessions | 0 / 2, `butcherapp:` | Yes |
| BullMQ worker | 1 | Yes |
| Socket | same resolver | Yes |
| Heartbeat | cache + `readWorkerHeartbeat` | Readiness requires it |
| Locks / queues | BullMQ + checkout locks | Yes |

**P0 for shared hosts:** set `REDIS_PASSWORD`; do not expose Redis on a public interface.  
**P0:** do not point `REDIS_URL` at Sarh `6379`.  
Compose Redis AOF is enabled (`appendonly yes`). Policy `noeviction` is correct for queues.

---

## 7. Payment readiness

| Topic | Status |
| ----- | ------ |
| Outlet / API key / webhook secret | Templates only (`CHANGE_ME`). No Malahem live outlet in repo. |
| New merchant refs | `MALAHM-` via `buildMerchantOrderReference` |
| Legacy refs | `SFAT` / `FTR` / `PRM` / `PIN` / `BOTH` still classified internal |
| Nest callback | `GET /payment/result` (global prefix **exclude**). Deep link `malahm://payment/result` |
| Unused path | `GET /api/payment/result` is **404 by design** |
| Redirect built as | `` `${APP_URL}/payment/result?...` `` |
| Capture / refund / cancel / late capture / `needsReconciliation` | Implemented + unit tests. Not live-verified with NI. |
| Currency | Inherited NI/KSA path; no live charge in this audit |
| Webhook | HMAC `NI_WEBHOOK_SECRET`; raw body bypasses JSON limiter |
| Mock | `dev-complete` / empty NI key is **not** allowed when `NODE_ENV=production` |

**Routing conflict (record only):**

1. Nest expects NI to hit **`APP_URL/payment/result`** on the **API**.
2. `nginx/payment-bridge.conf` sends `/payment/result` to **`web:80`** (Expo web).
3. `docker-compose.prod.yml` includes that file and **does not define `web`**.
4. Shared-host snippet `nginx/butcher-api-location.conf` correctly maps `/api/butcher/payment/result` → Nest `/payment/result`.

Independent production must pick one callback URL and make nginx match it. Do not reuse Sarh NI credentials or webhook.

---

## 8. OTP / Auth readiness

Customer path (required, already implemented):

```
Phone → OTP (Twilio Verify) → customer account → customerId → JWT (iss=malahm-sarh)
→ refresh → logout
```

No customer username/password primary path was added.

| Control | Finding |
| ------- | ------- |
| Twilio Verify | Required in production; placeholder SID rejected |
| DEV_OTP | Forbidden in production |
| OTP expiry | Twilio service-side; email verify cooldown 600s exists |
| Rate limit | `RateLimitService` + guard present |
| Brute force | Rate limit + Twilio; no extra production WAF documented |
| Refresh | Separate `JWT_REFRESH_SECRET`, session store |
| Logout | Invalidates session (prior E2E) |
| Isolation | `iss=sarh` rejected |
| Dashboard | Username/password against **this** API; cookie `butcher_token`; middleware `BUTCHER_JWT_SECRET\|\|JWT_SECRET` |
| Admin | Separate login + `JWT_SECRET` middleware |
| Google OAuth | Leftover Expo helper still references `@zeinabmostafa/safat` — unused if Google sign-in off |

---

## 9. Dashboard readiness

`butcher-dashboard/` exists. **No UI rebuild in this audit.**

| Area | Ready? | Note |
| ---- | ------ | ---- |
| Login / session | Yes (code) | `/login?reason=session` |
| Middleware | Yes | Needs production `JWT_SECRET` match |
| API URL | **Build-time** | Docker/EAS leftovers default `sarhsa.online/api/butcher` |
| Health | Via API | Dashboard does not expose its own k8s probe |
| Daftra / products / orders / delivery | Present | Talks to Nest butcher APIs |
| Brand | ملاحم سرح | Hardening already applied |

Must be rebuilt after `NEXT_PUBLIC_*` is set to the Malahem domain. Must not keep a baked Sarh/shared-host API URL.

---

## 10. Admin readiness

| Area | Finding |
| ---- | ------- |
| Auth | Username/password → Nest admin session |
| Authorization | Nest admin module + roles |
| API URL | Dockerfile ARG default `https://sarhsa.online/api/butcher` |
| CORS | Depends on `ALLOWED_ORIGINS` including admin origin |
| Session | Cookie/JWT aligned with `JWT_SECRET` |
| Production build | Next standalone image |

**Domain recommendation:** subdomain `admin.<malahem-domain>` **or** same-host path `/admin` (current nginx). Either works. Do not implement DNS in this phase.

Admin is **not** safe to expose without HTTPS, locked CORS, and a unique admin password set **after** secrets exist.

---

## 11. Mobile / EAS readiness

| Item | Current | Target / gap |
| ---- | ------- | ------------ |
| `app.json` name | ملاحم سرح | OK |
| slug | `malahm` | Confirm Expo dashboard still matches projectId `66fbef22-…` |
| scheme | `malahm` | OK |
| Android/iOS id | `com.sarh.butcher` | Independent of `com.sarh.app` |
| Expo owner | `sarh000` | Unchanged; do not invent a new owner |
| EAS projectId | `66fbef22-4a7b-45de-9280-c4dc8d7afb80` | Unchanged |
| `eas.json` production/preview URLs | not baked | Set `EXPO_PUBLIC_*` in EAS secrets after DOMAIN |
| Socket path | `/socket.io` | Optional `/api/butcher/socket.io` only if path-prefix remains |
| Notifications | expo-notifications + FCM worker | **No `google-services.json` in tree**; `FIREBASE_*` not in prod validator |
| Deep link | `malahm://` | OK |
| Payment return | Nest HTML + `malahm://payment/result` | Must match APP_URL/nginx |

**Needs creating/linking (later, not now):**

1. Dedicated Malahem production API/socket URLs in EAS  
2. Firebase/FCM project + `google-services.json` / Apple key for `com.sarh.butcher`  
3. Play/App Store listing (out of scope)  
4. Confirm Expo dashboard slug `malahm` against existing projectId / owner

Do not rotate EAS credentials in this phase.

---

## 12. Domain architecture

```
DOMAIN REQUIRED
```

No dedicated Malahem production hostname is defined in repo as authoritative. `sarhsa.online` appears as **shared-host / path-isolation** (`/api/butcher`, `/butcher`, `/admin`), which keeps Malahem on Sarh’s public DNS.

**Proposed independent names (placeholders only):**

```
api.<malahem-domain>          Nest + /payment/result
ws / same host /socket.io     Socket
dashboard.<malahem-domain>    or https://<domain>/butcher
admin.<malahem-domain>        or https://<domain>/admin
malahm://                     mobile
https://api.<domain>/payment/result
https://<domain>/api/payments/webhook   (or documented NI webhook path)
```

SSL: `nginx/nginx.ssl.server.conf` + certbot includes exist for `sarhsa.online`. Independent domain needs **new** certificates. Not purchased or changed here.

---

## 13. Security review

| ID | Sev | Finding |
| -- | --- | ------- |
| S-01 | P0 | No independent production secrets; risk of copying Sarh JWT/NI/Twilio |
| S-02 | P0 | CORS `PRODUCTION_ORIGINS` is empty — production browsers need `ALLOWED_ORIGINS` |
| S-03 | P0 | Payment/nginx callback mismatch can black-hole NI returns |
| S-04 | P0 | Redis/Postgres must stay private; Redis templates often have empty password |
| S-05 | P0 | FCM private key not in validator; push can silently no-op |
| S-06 | P1 | No `helmet` package; some headers set manually (nosniff, DENY, HSTS if proto https) |
| S-07 | P1 | Dashboard/admin cookies: confirm `Secure`/`HttpOnly`/`SameSite` on HTTPS |
| S-08 | P1 | CSRF: cookie session + bearer mix; dashboard uses cookie + Authorization |
| S-09 | P1 | Rate limiting exists; no documented WAF / IP allowlist for admin |
| S-10 | P1 | Webhook signature required only when secret **and** header present — secret must be set |
| S-11 | P1 | JSON body 64kb; upload/webhook excluded — keep upload MIME/size checks |
| S-12 | P1 | API boot auto-migrates — dangerous if env points at the wrong database |
| S-13 | P1 | Swagger off in production unless `SWAGGER_ENABLED=true` — keep off |
| S-14 | P2 | Health payload still advertises leftover `listingCommentDelete` features |
| S-15 | P2 | Leftover `safat` strings in unused mobile files |
| S-16 | P2 | Admin deleted-email pattern `safat.deleted` |

---

## 14. Backup / recovery (policy only — not executed)

| Asset | Frequency | Retention | Restore | RPO | RTO |
| ----- | --------- | --------- | ------- | --- | --- |
| PostgreSQL | Daily logical dump + WAL/continuous if managed | 14–30 days + weekly older | Restore to **new** Malahem instance; never onto `sarouh` | ≤ 24h (≤ 5 min if PITR) | 1–4 h |
| Redis | AOF already in compose; snapshot RDB daily | 7 days | Rebuild queues; accept job loss or replay | Minutes–hours | < 1 h (cache warm) |
| Cloudinary | Provider versioning / folder `sarh-butcher` | Provider default | Rebind keys; do not use `safat` | Asset-level | Hours |
| Payments | Keep `Payment` + `IntegrationWebhookEvent` + NI portal export | 7 years (finance) | Reconcile `needsReconciliation` / `MALAHM-` vs `SFAT-` | Event-level | Hours |
| Logs | 7–14 days shipping | 30 days | N/A | Minutes | Minutes |
| Secrets | Sealed store / password manager, not git | Rotation 90 days | Re-inject env, rolling restart | 0 (copies) | < 1 h |

Do not delete backups or run restore in this phase.

---

## 15. Observability

| Signal | Present? |
| ------ | -------- |
| `GET /api/health` liveness (DB) | Yes |
| `GET /api/health/ready` (DB + Redis + worker) | Yes |
| Socket `/health` | Yes (`socket-health.controller`) |
| Worker heartbeat | Yes |
| Queue job counts in health | Yes |
| Pino logs (`malahm-sarh-api`) | Yes |
| Sentry | Code path + `SENTRY_DSN`; **unset** in examples |
| Payment/OTP error logs | Yes (no secret values in validator messages) |
| Central metrics/APM | **Not configured** |

Needs: Malahem Sentry project (or equivalent), log drain, alert on ready=503 and NI webhook failures.

---

## 16. GO / NO-GO table

| Area | Status | Evidence | Blocker |
| ---- | ------ | -------- | ------- |
| Repository | READY | GitHub `iiimmcc30-create/sarh-butcher`, `main` = `cf4875a` | None |
| Backend | READY* | Isolated `AppModule`, prod env validator, prefix excludes | Secrets + domain |
| Database | READY local / NOT PROD | Prisma valid, 48 migrations applied on **local** `sarh_butcher` | New production cluster + migrate plan |
| Redis | READY code | Fail-fast; prefix `butcherapp:` | New instance + password |
| Worker | READY code | `SERVICE_MODE=worker`, heartbeat | Same Redis/DB secrets |
| Socket | READY code | Separate process :3002 | Public URL + CORS |
| Payments | NOT READY | `MALAHM-` + `/payment/result` in Nest; **no** Malahem NI outlet; nginx/web conflict | New NI + callback design |
| OTP | NOT READY | Phone+OTP code; Twilio required; DEV_OTP banned in prod | New Verify service |
| Dashboard | READY code | Existing UI, Malahem brand | Rebuild with Malahem `NEXT_PUBLIC_*` |
| Admin | READY code | Existing panel | Rebuild + origin + HTTPS |
| Mobile | CONDITIONAL | `com.sarh.butcher` / `malahm`; EAS URLs still `sarhsa.online`; no Firebase files | EAS env + FCM |
| Nginx | CONDITIONAL | Path isolation for shared host; prod compose callback → missing `web` | Independent vhost + callback |
| Security | CONDITIONAL | Headers + validator; empty CORS; no Helmet | Origins + secrets + TLS |
| Backups | NOT READY | Policy only; no job in repo | Implement after DB exists |
| Monitoring | NOT READY | Health endpoints only; Sentry unset | DSN + alerts |

---

## 17. P0 / P1 / P2 and ready items

### P0 BLOCKERS

1. **DOMAIN REQUIRED** — no independent production hostname. Set `MALAHEM_APP_URL` / `MALAHEM_API_URL` / `MALAHEM_DASHBOARD_URL` / `MALAHEM_ADMIN_URL` after DNS exists.  
2. **All Malahem production secrets missing** (Postgres, Redis, JWT pair, NI, Twilio Verify, Cloudinary, Daftra, Firebase, cron, encryption key). Do not copy Sarh.  
3. **N-Genius outlet + webhook** not provisioned. Nginx `/payment/result` now routes to Nest `api:3001` (config only; no live payment test).  
4. **EAS production/preview API URLs** are no longer baked. Operators must set `EXPO_PUBLIC_API_URL` / `EXPO_PUBLIC_SOCKET_URL` in EAS secrets after the domain exists.  
5. **CORS** templates leave `ALLOWED_ORIGINS=` empty; production boot now fails if it is missing, `*`, or `sarhsa.online`.  
6. **Firebase/FCM** not packaged for `com.sarh.butcher` (placeholders only).  
7. **Production Postgres/Redis hosts** do not exist in this cleanup (local only).  
8. **Expo slug** in `app.json` is `malahm`. Confirm Expo dashboard alignment with existing `projectId` `66fbef22-4a7b-45de-9280-c4dc8d7afb80` / owner `sarh000` before a store build.

### P1 BLOCKERS

1. TLS termination not in `docker-compose.prod.yml` (HTTP :80 only).  
2. Redis without password in several templates.  
3. API auto `migrate deploy` on every container start.  
4. Sentry unset.  
5. Backup jobs absent.  
6. Helmet not installed.  
7. `JWT_ISSUER` / `CLOUDINARY_FOLDER` / `REDIS_KEY_PREFIX` not strictly asserted in validator.  
8. Daftra OAuth not in production validator.  
9. Leftover Prisma marketplace models increase migrate/ops surface.  
10. Expo leftover screens / `safat` localStorage / unused Google slug.

### P2 ITEMS

1. Health `apiFeatures` leftover listing/post flags.  
2. Admin `safat.deleted` email pattern.  
3. Confirm Expo dashboard slug still matches `app.json` (`malahm`) and projectId `66fbef22-…`.  
4. Dockerfile comments still say Supabase/Render.  
5. `package-lock` cosmetic `safat` names.  
6. `expo-doctor` deferred (prior).

### READY ITEMS

- Independent GitHub repository and bootstrap commit  
- Butcher-only Nest surface  
- Redis fail-fast (no silent `:6379`)  
- JWT issuer default `malahm-sarh`  
- Cloudinary folder default `sarh-butcher`  
- Merchant prefix `MALAHM-` with legacy lookup  
- Nest payment result route + deep link `malahm://`  
- Customer Phone → OTP → JWT path  
- Dashboard/admin exist (no rebuild required for this audit)  
- Worker / socket / API split + health/readiness  
- Local Prisma: 48 migrations, up to date, schema valid  
- Compose local isolation (5433 / 6380)

---

## 18. Exact production deployment sequence

Do **not** run this sequence in this phase. Order when operators have domain + secrets:

1. Confirm `main` is still `cf4875a` (or a later **reviewed** commit).  
2. Provision **new** Postgres (`sarh_butcher`) and Redis. Never `sarouh` / host `6379`.  
3. Create **new** JWT, Twilio Verify, NI outlet, Cloudinary folder `sarh-butcher`, Daftra redirect, Firebase, cron, encryption keys. Store outside git.  
4. Fill env from `.env.production.example` / `scripts/vps.env.example` with those values only.  
5. Set `APP_URL`, `ALLOWED_ORIGINS`, public API/socket URLs to the **new** domain.  
6. Confirm nginx `payment-bridge.conf` still proxies `/payment/result` to **`api:3001`** after TLS is enabled.  
7. Register NI webhook on the Malahem API only.  
8. `prisma migrate status` against the **new** DB, then a single `migrate deploy`.  
9. Start Redis → Postgres → worker → api → socket. Confirm `/api/health/ready`.  
10. Build dashboard/admin **after** `NEXT_PUBLIC_*` is final.  
11. Terminate TLS; verify HSTS, cookies, CORS.  
12. Rebuild EAS production profile with the new API/socket. Add FCM files.  
13. Staging NI sandbox charge, then limited live smoke — not in this audit.  
14. Enable backups + Sentry before public traffic.  
15. Keep Sarh `/opt/sarh` and Sarh production **untouched**.

---

## 19. Final assessment

```
CONDITIONAL GO
```

**Meaning:** the independent codebase can be configured for production. It is **not** ready to receive live traffic, live cards, or production DNS.

**Would be NO-GO** if the question is “deploy to production today.”  
**Would become GO** only after remaining P0 blockers (domain, secrets, NI, Twilio, Firebase, production data plane) are closed and a staging smoke pass succeeds.

---

## 20. P0 Configuration Cleanup

**Date:** 2026-09-19  
**Scope:** configuration, Docker, nginx, EAS, env examples, validation, tests, this document.  
**Not in scope:** production deploy, production migrate, DNS, secrets, NI outlet, Firebase project, Postgres/Redis provisioning, Sarh edits, leftover business-logic deletion, dashboard rebuild, UI redesign, commit, push, PR.

### What was still tied to Sarh

- Runtime defaults and Docker/EAS bake-ins used `https://sarhsa.online` and `https://sarhsa.online/api/butcher`.
- `docker-compose.vps.yml` attached API/socket to external `sarh_internal`.
- `docker-compose.nginx-edge.yml` overlayed includes onto `/opt/sarh` nginx.
- Nginx `server_name` / TLS paths were `sarhsa.online`.
- `nginx/payment-bridge.conf` sent `/payment/result` to missing `web:80` instead of Nest.
- Dashboard/admin Dockerfiles defaulted `NEXT_PUBLIC_API_URL` to the shared Sarh host.
- Mobile `devHost.ts` / EAS / start scripts fell back to `sarhsa.online` when env was empty.
- Production validator accepted `APP_URL=https://sarhsa.online` and did not require `ALLOWED_ORIGINS` or a Malahem API URL.
- Env examples documented Sarh hostnames as the production pattern.

### What was separated

- All compose files now use **`malahem_internal` only**. No `sarh_internal`.
- Public URLs are env-driven: `MALAHEM_API_URL`, `MALAHEM_APP_URL`, `MALAHEM_DASHBOARD_URL`, `MALAHEM_ADMIN_URL` (aliased in `load-env.ts`). No invented production domain is baked into runtime config.
- `/payment/result` and `/payment/cancel` proxy to compose service **`api:3001`** (aliases `butcher-api` on prod and VPS).
- EAS preview/production no longer hardcode a host. Socket path defaults to `/socket.io`. Expo slug is `malahm`. Android package remains `com.sarh.butcher`. Expo `projectId` / owner unchanged.
- CORS templates use `ALLOWED_ORIGINS=` (empty). Production fails if empty, `*`, or `sarhsa.online`.
- Firebase/FCM placeholders (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`) are documented for a **new** project bound to `com.sarh.butcher`. No credentials created.
- Production validator requires `DATABASE_URL`, Redis, `JWT_SECRET`, `APP_URL`, `PUBLIC_API_URL` or `MALAHEM_API_URL`, `ALLOWED_ORIGINS`, and NI credentials. It rejects Sarh host defaults.

### What remains on purpose

| Match | Classification |
| ----- | -------------- |
| `SFAT-` merchant-ref lookup | INTENTIONAL LEGACY — leftover payment rows still resolve |
| `scripts/migrate-from-sarh.mjs` | HISTORICAL / optional extraction — not a launch step |
| Nest routes `/api/butchers` | SAFE TO KEEP — Malahem butcher API, not Sarh path isolation |
| `nginx/butcher-api-location.conf` `/api/butcher` rewrite | SAFE TO KEEP — optional path-prefix compatibility |
| Dashboard/admin `endsWith('/api/butcher')` | SAFE TO KEEP — backward-compatible client prefix |
| `app/constants/sarhOfficial.ts`, `legal.ts`, `app/app/info/*`, leftover share URLs | INTENTIONAL LEGACY — leftover marketplace copy; not deleted |
| `com.sarh.app` Play Store link in unused `more.tsx` | INTENTIONAL LEGACY / leftover screen |
| `privacy-page.controller.ts` Sarh legal HTML | INTENTIONAL LEGACY — leftover legal copy |
| Docs (`PHASE3.md`, `PHASE4.md`, extraction reports) | DOCUMENTATION — historical |
| Tests that assert `sarhsa.online` is **rejected** | TEST FIXTURE / SAFE TO KEEP |
| Leftover Prisma models unused by `AppModule` | INTENTIONAL LEGACY — not deleted |

### What still needs a production resource later

- Independent DNS + TLS (`MALAHEM_DOMAIN` in nginx cert paths).
- New Postgres (`sarh_butcher`) and Redis (not `sarouh`, not host `:6379`).
- New JWT, Twilio Verify, NI outlet + webhook, Cloudinary, Daftra redirect, cron, encryption key.
- `ALLOWED_ORIGINS` filled with dashboard + admin (+ optional web) https origins.
- EAS secrets for `EXPO_PUBLIC_API_URL` / `EXPO_PUBLIC_SOCKET_URL`.
- New Firebase project + `google-services.json` / APNs for `com.sarh.butcher`.
- Confirm Expo dashboard slug `malahm` vs existing project `66fbef22-…` / owner `sarh000`.

```
PRODUCTION DEPLOYMENT: NOT EXECUTED
PRODUCTION MIGRATION: NOT EXECUTED
SECRETS CREATED: NO
COMMIT: NOT CREATED
PUSH: NOT EXECUTED
```

---

## 21. P1 — Production Infrastructure Readiness

**Date:** 2026-09-19  
**Scope:** inventory, environment contract, Docker/nginx/EAS audit, Prisma/migration runbooks, backups, smoke matrix, static validation.  
**Not executed:** production deploy, `prisma migrate deploy` on production, Sarh data migration `--execute`, DNS/TLS, NI/Twilio/Firebase/Cloudinary provisioning, EAS production build, commit/push/PR.

### Infrastructure inventory

| Dependency | Used for | Mandatory | Separate prod resource | Share Sarh? |
| ---------- | -------- | --------- | ---------------------- | ----------- |
| PostgreSQL `sarh_butcher` | Orders, users, payments, Prisma | Yes | Yes — new cluster | No |
| Redis prefix `butcherapp:` | Sessions, queues, locks, heartbeat | Yes | Yes — not host `:6379` | No |
| Nest API / worker / socket | App runtime | Yes | Same compose | No Sarh process |
| Nginx | TLS edge, `/payment/result` → `api:3001` | Yes | Malahem vhost | No |
| Dashboard / admin | Butcher + admin UI | Yes | Rebuild after `NEXT_PUBLIC_*` | No |
| Expo `com.sarh.butcher` | Customer app | Yes | EAS secrets | No |
| N-Genius | Checkout | Yes for live pay | New outlet | No |
| Twilio Verify | OTP | Yes | New SID | No |
| Cloudinary folder `sarh-butcher` | Media | Yes if storage=cloudinary | New or isolated folder | No |
| Firebase Admin + `google-services.json` | FCM | For push | New project | No |
| Daftra | Per-butcher product sync | Optional at boot | New redirect + butcher tenants | No |
| Sentry | Errors | Optional | New DSN | No |

Full contract: `docs/MALAHEM_PRODUCTION_ENVIRONMENT.md`.

### Deployment dependencies

Documented in `docs/MALAHEM_PRODUCTION_DEPLOYMENT_RUNBOOK.md` (steps 0–13, each command marked local vs production-approval).

### Data migration

**Not required for launch.** `scripts/migrate-from-sarh.mjs` is a historical / optional extraction tool. It is not on the production launch path. See `docs/MALAHEM_DATA_MIGRATION_RUNBOOK.md`.

Fresh init: `docs/MALAHEM_FRESH_PRODUCTION_INITIALIZATION.md`.

### Backup / recovery readiness

Policy only: `docs/MALAHEM_BACKUP_AND_RECOVERY.md`. No job in repo.

### Smoke-test readiness

Matrix: `docs/MALAHEM_PRODUCTION_SMOKE_TEST.md`. Not executed against production.

### Unresolved blockers (operator resources — not repo defects)

1. `<MALAHEM_PRODUCTION_DOMAIN>` + DNS + new TLS.
2. New Postgres + Redis.
3. All production secrets (JWT, NI, Twilio, Cloudinary, Firebase, Daftra key, cron).
4. New N-Genius outlet + webhook URL.
5. EAS secrets `EXPO_PUBLIC_API_URL` / `EXPO_PUBLIC_SOCKET_URL`.
6. Firebase project + `google-services.json` for `com.sarh.butcher`.
7. Confirm Expo dashboard slug `malahm` vs projectId `66fbef22-…` / owner `sarh000`.

No Sarh data migration is required for launch. Malahem starts with a fresh production database.

```
PRODUCTION STATUS: READY FOR PRODUCTION PROVISIONING
```

---

## 22. P2 — Fresh production launch preparation

**Date:** 2026-09-19  
**Model:** brand-new platform. Zero production customers, orders, butchers, or marketplace rows to import.

### Launch path

New infra → empty `sarh_butcher` → explicit `prisma migrate deploy` (48 migrations) → deploy with `SKIP_MIGRATIONS=true` → configure NI/Twilio/Firebase/Cloudinary → first accounts → smoke → public traffic.

### Removed from launch

- Sarh → Malahem data copy
- Auto `prisma migrate deploy` on every production API restart
- Migration-script completeness as a go-live blocker

### Auto-migration

Production entrypoint skips schema changes unless `RUN_MIGRATIONS=true`.  
`docker-compose.prod.yml` / `vps.yml` default `SKIP_MIGRATIONS=true`.  
Development still migrates unless `SKIP_MIGRATIONS=true`.

### Docs

- `docs/MALAHEM_FRESH_PRODUCTION_INITIALIZATION.md`
- Deployment runbook no longer has a data-migration step
- Smoke matrix assumes a blank database

