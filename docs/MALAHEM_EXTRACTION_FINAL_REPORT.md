# Malahem Extraction — Final Report

**Work tree:** `/home/ubuntu/sarh-butcher` (`iiimmcc30-create/sarh-butcher`)  
**SARH source:** `/workspace` (`sarh.app`) — **not deleted, not committed, not deployed**  
**This turn:** no git commit, no push, no PR, no production writes, no secrets copied.

The independent stack already existed on branch `cursor/butcher-app-icon-2174` (Phases 1–4). This pass completed remaining isolation, login-loop fix, env aliases, and a dry-run data migration script.

---

## 1. What was migrated

| Layer | Location | Status |
| ----- | -------- | ------ |
| Nest API (butcher surface) | `backend-nest/` | Slim `AppModule`: auth, users, butchers, applications, payments, Daftra, upload, queue, socket, support, admin butcher ops |
| Prisma + migrations | `backend-nest/prisma/` | Independent DB `sarh_butcher`; leftover SARH models remain for compile |
| Worker + Socket | `backend-nest` worker/socket entrypoints | Redis prefix `butcherapp` |
| Dashboard | `butcher-dashboard/` | Points at Malahem API; login loop fixed |
| Mobile | `app/` | Expo identity `com.sarh.butcher` / scheme `malahm` / slug `malahm-sarh` |
| Docker | `docker-compose.yml`, `docker-compose.vps.yml` | `butcher-postgres`, `butcher-redis` |
| Env templates | `.env.example`, `.env.development.example`, `.env.production.example` | Independent names + aliases |
| Data migration | `scripts/migrate-from-sarh.mjs` | Dry-run by default |

SARH livestock/social modules remain on disk but are **not imported** in `AppModule`.

---

## 2. What remains in Sarh

Unchanged in `/workspace`:

- `app/app/butchers/` customer marketplace
- `backend-nest` butcher modules
- `butcher-dashboard/`
- Production DB / Redis / JWT / NI

Do not delete these until Malahem production is proven.

---

## 3. New architecture

```
Customer Expo (malahm)          Butcher dashboard (Next)
        │                                │
        └──────── Malahem API :3001 ─────┘
                     │
          ┌──────────┼──────────┐
          ▼          ▼          ▼
     Postgres     Redis      Socket
   sarh_butcher  butcherapp:  :3002
                     │
                  Worker
```

No runtime read of SARH `DATABASE_URL`, Redis, JWT, or worker.

Optional later: Sarh → Malahem **HTTP API** only (not shared DB).

---

## 4. Database models migrated (runtime / copy script)

Copied by `scripts/migrate-from-sarh.mjs` when `--execute`:

`User` (butcher-related ids only), `Butcher`, `ButcherProduct`, `ButcherOrder`, `ButcherOrderItem`, `ButcherCheckout`, `ButcherCheckoutReservation`, butcher-linked `Payment`.

Also present in schema (keep for behavior; copy in a later pass if needed):

`ButcherOffer`, `ButcherStory`, `ButcherReview`, `ButcherFavorite`, `ButcherApplication*`, `ButcherDaftra*`, `ButcherMarketBanner`, `OrderTimeline`, `OrderStatusAudit`, `OrderNumberSequence`, `UserSession` (not copied — force re-login), `Notification`, `IntegrationOrder`.

SARH_ONLY still in Prisma for compile: Listing, Post, LiveStream, Plan, … — **do not drop until admin/payments queries are rewritten**.

---

## 5. API modules migrated

Registered: Auth, Users, Settings, Notifications, Payments, Integrations, Daftra, Butchers, ButcherApplications, Messages, Upload, Admin (butcher ops), Health, Support, ButcherBanners, Queue, Gateway.

Not registered: Listings, Posts, Stories, Livestreams, Knowledge, OfficialServices, FeedSuppliers, ExploreSarhBanners, HomeExplore, Fees, MarketCategories.

---

## 6. Dashboard modules migrated

Full `butcher-dashboard/` tree. Login no longer health-checks SARH `/api/health`. Middleware uses `BUTCHER_JWT_SECRET || JWT_SECRET`. Failed cookie verify redirects to `/login?reason=session` so restore cannot bounce.

---

## 7. Mobile modules migrated

`app/app/butchers/*` plus shared design-system / auth / payments. Boot routes to `/butchers`. Package `com.sarh.butcher`. Leftover `(tabs)` / listing screens exist on disk; boot does not use them.

---

## 8. Payment architecture

Same `PaymentsService` + payment-first checkout + legacy `butcher_order`. Env: `MALAHEM_NI_*` aliased to `NI_*`. **New outlet/webhook required** — never SARH production credentials. Staging may use mock NI (`NODE_ENV=staging`).

Commission: 10% on delivered; ledger `BOC-{orderId}`; `storeCommission` / `commissionExempt` preserved.

---

## 9. Daftra architecture

`backend-nest/src/integrations/daftra/` with independent `SECRETS_ENCRYPTION_KEY` and OAuth redirect under Malahem `APP_URL`. KG vs count sale units unchanged.

---

## 10. Redis / Worker architecture

- Dedicated Redis (compose `:6380` / `butcher-redis`)
- Cache/heartbeat keys: `butcherapp:`
- BullMQ `prefix: butcherapp` (queue *names* stay plain — `:` is illegal in names)
- Heartbeat: `butcherapp:worker:heartbeat`

---

## 11. Remaining Sarh dependencies

| Item | Class | Notes |
| ---- | ----- | ----- |
| Shared Hostinger hostname `sarhsa.online/api/butcher` | VALID / edge | Path isolation, not shared process |
| Prisma leftover listing/post models | LEGACY | Compile only |
| Expo leftover screens / `safat` localStorage keys | LEGACY | Non-boot |
| `googleOAuth.ts` expo slug leftover | MIGRATION REQUIRED | unused if Google sign-in off |
| Play Store `com.sarh.app` in unused more.tsx | FALSE POSITIVE / leftover | |
| Data still lives in SARH prod until `--execute` migration | MIGRATION REQUIRED | |

Runtime process dependency on SARH API/DB/Redis/JWT/worker: **zero** when this stack is booted with its own `.env`.

---

## 12. Migration scripts

`scripts/migrate-from-sarh.mjs`

```bash
SARH_SOURCE_DATABASE_URL=... MALAHEM_DATABASE_URL=... \
  node scripts/migrate-from-sarh.mjs --dry-run
```

Refuses identical URLs. Does not copy sessions. Does not run against production unless both URLs and `--execute` are supplied deliberately.

---

## 13. Tests

See §14. Existing Phase 3 E2E documented in `docs/PHASE3.md` (isolated Postgres + Redis :6380).

---

## 14. Build results (this pass)

Superseded by **FINAL INDEPENDENCE VERIFICATION** below (re-run 2026-09-19). Headline: backend 51/386 + lifecycle 47; dashboard 14/59 + `next build`; mobile 84/870 + `tsc`; phase3 E2E 54/54; Docker not run.

---

## 15. Known issues

1. Prisma still contains unused SARH models.
2. Dashboard and API **must share** `BUTCHER_JWT_SECRET` / `JWT_SECRET` **and** `JWT_ISSUER=malahm-sarh` or middleware will reject a valid API token.
3. Google Services / FCM files are not SARH’s; a new Firebase app is required for push.
4. Leftover Expo routes can still be opened manually.
5. Accidental extra trees `backend/` `dashboard/` `mobile/` from this session were **deleted** (they were a second copy of SARH).

---

## 16. Production blockers

1. Do not `--execute` migration on SARH production until a staging copy is validated.
2. Do not reuse SARH NI webhook or JWT.
3. Push to GitHub / merge to `main` not done (operator request).
4. Dedicated public hostname for Malahem is still optional (path `/api/butcher` works).
5. Twilio / Cloudinary / NI values must be **new** CHANGE_ME credentials.

---

## 17. Exact next steps

1. Review this tree locally; do not push until you ask.
2. `cp .env.example .env` and fill CHANGE_ME (never SARH prod).
3. `docker compose up -d` postgres/redis → `prisma migrate deploy` → `npm run start:dev` + worker + socket + dashboard.
4. Dry-run `migrate-from-sarh.mjs` against a **snapshot**, not live prod.
5. Confirm dashboard login with matching JWT secret (no refresh loop).
6. When ready: commit/push on `sarh-butcher` only.

---

## Login loop — root cause and fix

**Cause:** Next middleware verified `JWT_SECRET` only. If the dashboard process lacked the secret (or issuer), it 307’d to `/login` while `localStorage` still held a token the **API** accepted. Login `tryRestoreSession` then sent the user back to `/dashboard`.

**Fix:**

- Middleware reads `BUTCHER_JWT_SECRET || JWT_SECRET`
- Failed verify → `/login?reason=session`
- Login skips restore when `reason=session` and clears cookies on `/` and basePath
- Health check uses `NEXT_PUBLIC_API_URL`, not host `/api/health` (SARH)
- 401 interceptor does not redirect when already on login

---

## FINAL INDEPENDENCE VERIFICATION

**Date:** 2026-09-19  
**Work tree:** `/home/ubuntu/sarh-butcher` (`iiimmcc30-create/sarh-butcher`)  
**Branch:** `cursor/butcher-app-icon-2174` @ `a128324` plus local isolation/login edits (not committed)  
**Rules honored:** no new dashboard, no remigration, no Sarh deletes, no production secrets/DB/Redis/worker, no commit/push/PR.

**Verdict: `INDEPENDENT`**

Runtime process isolation is proven by live sockets, live E2E, and fail-fast config. The tree is still a Sarh-derived codebase with leftover models, leftover screens, and leftover branding. That is not a live dependency on Sarh API / PostgreSQL / Redis / JWT / worker.

---

### Verdict table

| Area                    | Status | Evidence |
| ----------------------- | ------ | -------- |
| Backend isolation       | PASS   | Live `AppModule` registers butcher surface only. `GET /api/listings`, `/posts`, `/livestreams`, `/feed`, `/plans`, `/fees` → **404**. Health `db+redis+queue+worker` all true on `:3001`. |
| Database isolation      | PASS   | `pg_stat_activity`: user `butcher`, db `sarh_butcher` only (10 backends). Zero connections to `sarouh` / `sarh_daftra`. Prisma datasource is `env("DATABASE_URL")`; live URL path=`/sarh_butcher` host=`127.0.0.1`. |
| Redis isolation         | PASS   | API/worker/socket TCP: **6380 only, 6379 = 0**. Keys on 6380 are `butcherapp:*`. 6379 still has leftover Sarh `bull:*` keys and was not written (`phase3`: “Did not write butcherapp: to SARH Redis 6379 — 0”). |
| Worker isolation        | PASS   | `src/queue/worker.main.ts` in this tree; heartbeat `butcherapp:worker:heartbeat`; BullMQ prefix `butcherapp`. Same Redis 6380 as API. |
| Auth isolation          | PASS   | Customer OTP signup/login/refresh/logout E2E. JWT `iss=malahm-sarh`. Forged `iss=sarh` → **401**. Production `validateProductionEnv` throws if `JWT_SECRET` missing. |
| Dashboard               | PASS   | Login `shop_08280211` against Malahem `/api/auth/login`. Cookie `butcher_token` → `GET /dashboard` **200**. No cookie → **307 `/login?reason=session`**. Forged Sarh issuer cookie → **307 `/login?reason=session`**. `/api/*` rewrite hits Malahem health/dashboard/products/orders/customers/notifications (all 200). |
| Mobile                  | PASS   | `app.json` package `com.sarh.butcher`, scheme `malahm`, slug `malahm-sarh`. `tsc --noEmit` 0. Jest 84/84 suites, 870 tests. `butcher-api-base` asserts no generic `sarhsa.online/api`. Checkout starts at `POST /api/butchers/checkout`. |
| Payments                | PASS   | Live payment-first checkout + `dev-complete` created paid order. `unsupported_payment_type` rejects Sarh listing payment types. Lifecycle unit tests 47/47 (`needsReconciliation` / `capturedAfterCancel` / late capture). Gateway credentials empty — sandbox NI not invoked (production gateway untouched). |
| Daftra                  | PASS   | Module registered; `GET /api/butchers/daftra/status` → **401** (Malahem auth, not Sarh). OAuth default `http://localhost:3001/api/butchers/daftra/oauth/callback` (spec asserts not `sarhsa.online`). 0 integration rows. Secrets use `SECRETS_ENCRYPTION_KEY` + prefix `butcherapp-daftra-v1`. No live Daftra tenant in this env. |
| Cloudinary              | PASS   | Runtime default `CLOUDINARY_FOLDER=sarh-butcher` (`storage.ts:63`, live env). Upload not executed against Cloudinary (keys empty). |
| Notifications           | PASS   | Redis queues `butcherapp:notifications` / `emails` / `push-notifications`. Butcher token `GET /api/notifications` → 200, 5 items after delivered order. Socket `:3002/health` → `{"status":"ok","service":"socket"}`. |
| E2E order               | PASS   | `scripts/phase3-runtime-e2e.mjs`: **54/54**. OTP → register → butcher join → approve → product → checkout → pay → butcher sees order → confirm → delivered → 10% `BOC-` ledger. |
| Migration script        | FAIL   | `scripts/migrate-from-sarh.mjs` cannot start: ESM `ERR_MODULE_NOT_FOUND @prisma/client` from repo root (no root `node_modules`). Source guards (missing URL, identical URL) were **not reachable**. Do not `--execute`. |
| Build                   | PASS   | `prisma validate` OK. `nest build` 0. Dashboard `tsc` + `next build` 0 (13 routes). Docker/compose **not installed** — Docker image build not run. |
| Sarh runtime dependency | PASS   | No process in this stack talks to Sarh API, `sarouh` DB, Redis 6379, or a Sarh JWT. Disabling those Sarh leftovers did not affect Malahem (they were already unused). |

---

### 1. Tests executed (this pass — not previous numbers)

| Suite | Result |
| ----- | ------ |
| `npx prisma validate` | pass |
| Backend Jest (butcher/auth/payments/daftra/redis/prod-env/upload/worker) | **51 suites / 386 tests pass** |
| Backend lifecycle (`butcher-checkout.lifecycle` + `order-lifecycle` + commission) | **3 suites / 47 tests pass** |
| `validateProductionEnv` with empty production env | **FAIL FAST** (missing `DATABASE_URL`, `JWT_*`, Redis, NI, Twilio, …) |
| Dashboard `tsc --noEmit` | pass |
| Dashboard Jest | **14 suites / 59 tests pass** |
| Dashboard `next build` | pass |
| Mobile `tsc --noEmit` | pass |
| Mobile Jest | **84 suites / 870 tests pass** |
| Mobile butcher-api-base + payment-first + customer-orders | **15 tests pass** |
| `expo-doctor` | 4 checks failed (SDK patch drift: expo 54.0.35 vs ~54.0.37) — not an isolation fail |
| `scripts/phase3-runtime-e2e.mjs` | **54 pass / 0 fail** |
| Docker build | **not run** (no `docker` binary) |

---

### 2. E2E flows executed

Live stack already up (started ~05:25, still healthy at audit time):

- API `ts-node src/main.ts` :3001
- Worker `src/queue/worker.main.ts`
- Socket `src/gateway/socket.main.ts` :3002
- Dashboard `next dev` :3003
- Redis `127.0.0.1:6380`
- Postgres `sarh_butcher`

Flows:

1. **Customer:** `POST /api/auth/send-otp` (DEV_OTP `123456`) → verify → register → `/api/users/me/account` → refresh → logout / token invalidation.
2. **Butcher onboarding:** join OTP → application 201 → admin approve → butcher password login.
3. **Catalog:** directory lists butcher, product create, store products.
4. **Checkout guards:** empty cart 400, bad product 404, insufficient stock rejected, Sarh payment type `unsupported_payment_type`.
5. **Payment-first:** checkout 201, duplicate reused, `dev-complete` → order, `referenceType=butcher_checkout|paid`.
6. **Order lifecycle:** butcher sees order → confirmed → delivered.
7. **Commission:** 10 on delivered; ledger `order_commission` / `BOC-`; 3 commission rows / 3 distinct `orderId` (no duplicate). Pending unpaid and cancelled unpaid rows exist with **no** commission.
8. **Dashboard:** login page 200; session reject 307 `reason=session`; valid Malahem cookie 200; dashboard data via Next rewrite.
9. **Socket:** connect with butcher JWT (phase3).
10. **Payment HTTP bridge:** `GET /api/payment/result` and `/api/payment/cancel` are **404 on the live process** even though `PaymentRedirectController` is in source. Mobile uses `malahm://payment/result`. Webhook `POST /api/payments/webhook` and `/api/integrations/ni/webhook` return 200.

---

### 3. Sarh dependencies found (classified)

| Hit | Class | Notes |
| --- | ----- | ----- |
| `sarhsa.online/api/butcher` in eas.json, docker comments, mobile prod fallback | EXPECTED | Shared hostname, **independent path**. Not Sarh Nest `/api`. |
| Prisma `Listing` / `Post` / `LiveStream` / `ExploreSarhBanner` tables | LEGACY | Present in `sarh_butcher` (0 rows). Not imported in `AppModule`. Live routes 404. **KEEP — LEGACY**. |
| Leftover `listings/` `posts/` `livestreams/` source + admin repository methods | LEGACY | Compile leftovers. Admin controller has **no** listing/post routes. |
| Mobile leftover `(tabs)`, `safat_*` localStorage keys, `googleOAuth.ts` `@zeinabmostafa/safat` | LEGACY / MIGRATION_REQUIRED | Non-boot. Google unused if sign-in off. |
| `com.sarh.app` Play Store link in unused `more.tsx` | FALSE_POSITIVE | Not the running package (`com.sarh.butcher`). |
| `SFAT-` merchant payment `orderId` prefix (`payments.service.ts:43`) | LEGACY | Branding leftover on **Malahem** payment rows. Not a Sarh API call. |
| `settings/paid-services` still returns `listingFeesEnabled` | LEGACY | Flag only; `/api/fees` 404. |
| Health `apiFeatures.listingCommentDelete` | FALSE_POSITIVE | Feature-flag leftover in payload. |
| `.env.render.example` `CLOUDINARY_FOLDER=safat` | MIGRATION_REQUIRED | Template only. Live/default is `sarh-butcher`. Do not copy. |
| S3 default bucket `safat-uploads` (`storage.ts:58`) | LEGACY | Unused unless `STORAGE_PROVIDER=s3` without bucket env. |
| Redis `localhost:6379` default if `REDIS_URL`/`REDIS_HOST` empty (`redis-connection.ts:60-61`) | HIGH (dev only) | Production fail-fast requires Redis. Current runtime sets `REDIS_URL=redis://127.0.0.1:6380`. |
| `SARH_*` env names | SAFE | `load-env.ts` aliases only `MALAHEM_*` / `BUTCHER_*`. Probe: `SARH_DATABASE_URL` / `SARH_REDIS_URL` / `SARH_JWT_SECRET` did **not** populate runtime keys. |
| Word `SARH` in comments/docs/tests | FALSE_POSITIVE | Isolation comments, not imports. |
| Same Postgres **server** also has `sarouh` + `sarh_daftra` | EXPECTED / ops | Shared machine, separate databases. Malahem never connected to them. |
| Hostinger comments / `docker-compose.vps.yml` | EXPECTED | Path isolation plan. Compose not started (no Docker). |

No `RUNTIME_DEPENDENCY` on Sarh API, Sarh DB, Sarh Redis, Sarh worker, or Sarh JWT was found in the running graph.

---

### 4. Runtime dependencies (actual)

Required for this local boot:

- `DATABASE_URL` → `postgresql://butcher@127.0.0.1:5432/sarh_butcher`
- `REDIS_URL` → `redis://127.0.0.1:6380` (`REDIS_KEY_PREFIX=butcherapp:`)
- `JWT_SECRET` / `JWT_REFRESH_SECRET` (butcher-named values, `iss=malahm-sarh`)
- `DEV_OTP=true` (Twilio unset — expected local)
- `CLOUDINARY_FOLDER=sarh-butcher`
- `APP_URL` / `PUBLIC_API_URL` / `NEXT_PUBLIC_API_URL` = `http://127.0.0.1:3001`

Not used: `MALAHEM_*` aliases (canonical keys already set), `NI_*` (empty — mock/dev complete path), Twilio, Cloudinary keys, Daftra OAuth.

No live `.env` file remains in the tree. Process env was injected by the existing tmux boot (names inspected; values not printed). `/workspace/backend-nest/.env` (Sarh source) was **not** read.

---

### 5. Database verification

```
Malahem API / worker / socket
        ↓
  DATABASE_URL (aliased from MALAHEM_DATABASE_URL if present)
        ↓
  PostgreSQL db = sarh_butcher  user = butcher
```

Proof:

- `postgres: 16/main: butcher sarh_butcher 127.0.0.1(…) idle` × N
- `SELECT datname, usename, count(*)` → `sarh_butcher | butcher` only
- Prisma schema `url = env("DATABASE_URL")` — no hardcoded host
- Production missing `DATABASE_URL` → startup throw
- Legacy tables exist, **0 rows**, unused by registered modules

---

### 6. Redis verification

```
Malahem API / worker / socket
        ↓
  MALAHEM_REDIS_URL → REDIS_URL
        ↓
  127.0.0.1:6380   prefix butcherapp
```

Proof: `/proc/<pid>/fd` sockets, `KEYS` prefixes, phase3 “Redis 6380 uses butcherapp: prefix” + “Did not write … 6379”. Worker heartbeat JSON present (`pid` 1341768).

---

### 7. Auth verification

**Customer (live):** phone OTP, no password for OTP login; register still stores a password for dashboard-style accounts. Phone uniqueness enforced (signup specs + live register). JWT + refresh + logout + 401 after logout.

**Butcher dashboard:** `POST /api/auth/login` username/password against **this** API. Middleware `BUTCHER_JWT_SECRET || JWT_SECRET` + `iss` must be `malahm-sarh`.

**Login-loop root cause (re-verified, not visual):**

| Request | Result |
| ------- | ------ |
| `GET /dashboard` no cookie | 307 `/login?reason=session` |
| `GET /login?reason=session` | 200 (page does not bounce; `searchParams.reason=session` in RSC payload) |
| `GET /dashboard` + valid Malahem butcher JWT cookie | **200** |
| `GET /dashboard` + forged `iss=sarh` cookie | 307 `/login?reason=session` |

Loop is gone because a rejected cookie can no longer restore via `tryRestoreSession`.

---

### 8. Dashboard verification

Existing `butcher-dashboard/` — not rebuilt.

- Login form talks to Malahem `/auth/login` via Next rewrite (`next.config.mjs` → `127.0.0.1:3001/api/:path*`).
- Health URL is `NEXT_PUBLIC_API_URL/api/health`, not Sarh `/api/health`.
- Authenticated: `/api/butchers/dashboard` returns `butcher`, `counts`, `salesToday`, `ordersToday`, `inventory`, `recentOrders`; products/orders/customers/notifications 200.
- Local `/butcher/dashboard` is 404 because this Next process has **empty** `basePath` (production uses `/butcher`). Expected locally.
- Title still “سرح \| لوحة الملاحم” — branding leftover, LOW.

---

### 9. Mobile verification

Existing `app/` — not rebuilt.

- Boot identity is Malahem (`com.sarh.butcher` / `malahm`).
- Dev API: `http://localhost:3001`. Prod fallback: `https://sarhsa.online/api/butcher` (Malahem path).
- `app/services/api.ts` will not fall back to generic Sarh `/api` or `sarh-new4.onrender.com` as the default base.
- Payment-first client test: `POST /api/butchers/checkout`, not `/orders`.
- Device/Expo runtime and EAS production build were **not** run this pass.

---

### 10. Payment verification

- Live: payment-first checkout, stock hold, `dev-complete`, order create, 10% on delivered.
- Unit: late capture after cancel → `capturedAfterCancel: true`, no Final Order; reconciliation flags covered in `butcher-checkout.lifecycle.spec.ts`.
- NI live gateway **not** called (`NI_API_KEY` empty). Production gateway untouched.
- Payment rows use leftover `SFAT-` merchant prefix inside **Malahem** DB.
- Live HTTP `/api/payment/result|cancel` 404 — bridge page not serving on this process. Deep link scheme is `malahm`.

---

### 11. Daftra verification

- Isolation: local OAuth redirect, independent encryption key, Redis lock prefix `butcherapp:cron:daftra_products:*` (unit).
- Live tenant/sync **not** exercised (0 `ButcherDaftraIntegration` rows, no Daftra credentials).
- KG vs count mappers remain in `daftra.mappers` and were covered by existing Daftra Jest in the 386-test run.
- No read of Sarh Daftra config / `sarh_daftra` database.

---

### 12. Remaining blockers (not runtime-Sarh)

| Severity | Item |
| -------- | ---- |
| HIGH | Dev Redis default port **6379** if URL/host unset — can collide with a leftover Sarh Redis on the same machine. Production already fail-fasts. |
| HIGH | `.env.render.example` still says `CLOUDINARY_FOLDER=safat` and “copy from sarh-api”. |
| HIGH | Production NI / Twilio / Cloudinary / Daftra credentials must be **new**, not Sarh’s. Currently empty. |
| MEDIUM | `scripts/migrate-from-sarh.mjs` does not run (`@prisma/client` unresolved). |
| MEDIUM | Live `GET /api/payment/result` 404. |
| MEDIUM | `SFAT-` payment references; dashboard/PWA title still “Sarh”. |
| MEDIUM | Prisma leftover social/listing models — keep until admin/payment queries that touch them are gone. |
| LOW | Leftover Expo screens, `safat` localStorage keys, `googleOAuth` slug, `com.sarh.app` store link. |
| LOW | `expo-doctor` SDK patch mismatch. |
| LOW | Shared Hostinger hostname (path-isolated). |

---

### 13. Production readiness blockers

1. Do not `--execute` data migration until the script is runnable and pointed at a **snapshot**, never live Sarh prod by accident.
2. Do not reuse Sarh `JWT_SECRET`, NI webhook, Twilio Verify SID, Cloudinary `safat` folder, or Daftra OAuth client.
3. GitHub `main` is still the old init commit; this audit branch is not pushed (operator request).
4. Push / FCM needs a Malahem Firebase app (not Sarh’s).
5. Docker/VPS compose not verified here (no Docker).
6. Dedicated public hostname is optional; `/api/butcher` on `sarhsa.online` is the current edge plan.

---

### 14. Exact next actions

1. Keep treating this tree as the independent system. Do not copy `/workspace/backend-nest/.env`.
2. Fix `scripts/migrate-from-sarh.mjs` to import Prisma from `backend-nest` (or add a root package) — then dry-run against a snapshot only.
3. Either fail-fast Redis in development when URL is missing, or keep `REDIS_PORT=6380` mandatory in every start script.
4. Replace `.env.render.example` `safat` Cloudinary folder before any Render copy-paste.
5. Restart API after confirming `PaymentRedirectController` is actually bound (`GET /api/payment/result` should return HTML, not 404).
6. Optionally rename `SFAT-` merchant refs to a Malahem prefix (behavior-safe).
7. When you ask: commit/push on `sarh-butcher` only. Never delete leftover Prisma models in that commit.

---

### Independence statement

```
INDEPENDENT
```

Evidence is from a running Malahem API/worker/socket/dashboard on isolated Postgres `sarh_butcher` and Redis `:6380` with `butcherapp:` keys, a 54/54 local E2E including “SARH JWT rejected” and “did not write to Redis 6379”, and production-env fail-fast that does not fall back to Sarh.

It is **not** production-ready and **not** a clean-room rewrite. Leftover Sarh schema, screens, and `SFAT-` strings remain. They do not make this process call Sarh at runtime.
