# MALAHEM — FINAL HARDENING REPORT

**Work tree:** `/home/ubuntu/sarh-butcher`  
**Date:** 2026-09-19  
**Rules:** no Sarh repo edits, no production DB/Redis/credentials, no secret printing, no commit/push/PR/deploy.

---

## 1. Executive Summary

Independence from the previous audit still holds. This pass closed the remaining **P0 release-gate** gaps:

- Redis no longer falls back to `localhost:6379`.
- Env templates no longer default Cloudinary to `safat`.
- `scripts/migrate-from-sarh.mjs` reaches URL guards and can dry-run locally.
- Payment callback is proven at `GET /payment/result` (`malahm://`). `/api/payment/result` 404 is expected.
- New merchant refs are `MALAHM-`; leftover `SFAT-` rows still resolve.
- Dashboard title/metadata/PWA strings use **ملاحم سرح**.

Live re-test: **E2E 56/56**, backend domain **396**, mobile **870**, dashboard **59**.  
New payments after API restart start with `MALAHM-`. Commission `BOC-` still 10% on delivered.

```
READY FOR PRODUCTION CONFIGURATION
```

This means the **code and local stack** are safe to configure with **new** Malahem credentials. It does **not** mean production secrets exist, or that a production deploy was performed.

---

## 2. Issues Found

### H-01 — Silent Redis fallback to host :6379
- **Severity:** P0
- **Problem:** `redisConnection()` used `localhost` + port `6379` when env was missing. On this machine that is Sarh Redis (`bull:*` keys).
- **Root Cause:** Shared leftover defaults from the Sarh Nest client.
- **Fix:** `resolveMalahemRedisTarget()` requires `MALAHEM_REDIS_URL` / `REDIS_URL` / `REDIS_HOST`. Loopback **must** set a port and **must not** be 6379. Docker-internal hosts may use container port 6379.
- **Files:** `backend-nest/src/redis/redis-connection.ts`, `redis-connection.spec.ts`, `config/validate-production-env.ts`, `validate-production-env.spec.ts`
- **Verification:** Missing env throws `MALAHEM_REDIS_URL is required…`. `redis://127.0.0.1:6379` throws. `redis://127.0.0.1:6380` accepted. Live sockets: API/worker/socket **6380 only**.

### H-02 — `.env.render.example` Cloudinary folder `safat`
- **Severity:** P0
- **Problem:** Render template copied Sarh folder name.
- **Root Cause:** Extraction leftover + “copy from sarh-api” comments.
- **Fix:** Rewrote template: `CLOUDINARY_FOLDER=sarh-butcher`, independent DB/Redis/JWT/NI/Twilio warnings, no Sarh copy instruction.
- **Files:** `backend-nest/.env.render.example`, `.env.example`, `scripts/vps.env.example`
- **Verification:** `rg CLOUDINARY_FOLDER=safat` in templates → no matches. Live `CLOUDINARY_FOLDER=sarh-butcher`. Runtime default in `storage.ts` remains `sarh-butcher`.

### H-03 — Migration script died before URL guards
- **Severity:** P0
- **Problem:** ESM `import { PrismaClient }` from repo root failed (`@prisma/client` not at root).
- **Root Cause:** Script imported Prisma before validating URLs, and resolved from the wrong package root.
- **Fix:** Validate URLs first; `createRequire(backend-nest/package.json)`; refuse identical URLs, hosted URLs, dest db `sarouh`; then load Prisma. `ButcherOrder.customerId` / `ButcherReview.reviewerId` (schema-correct).
- **Files:** `scripts/migrate-from-sarh.mjs`
- **Verification:** missing source, missing dest, same URL, dest `sarouh`, hosted URL → exit 1 with clear messages. Local dry-run source=`sarh_butcher` dest=`malahem_migrate_dry` → exit 0, counts printed, **no writes**.

### H-04 — `GET /api/payment/result` 404 looked like a broken callback
- **Severity:** P0 (audit false path)
- **Problem:** Previous audit probed `/api/payment/result`.
- **Root Cause:** Nest `setGlobalPrefix('api')` **excludes** `payment/result` and `payment/cancel`. NI redirect is `${APP_URL}/payment/result` (`payments.service.ts`).
- **Fix:** No architecture change. Contract tests + live E2E. Document unused `/api` path.
- **Files:** `backend-nest/src/payments/payment-return-url.spec.ts`, `scripts/phase3-runtime-e2e.mjs`
- **Verification:** `GET /payment/result` → 200 HTML with `malahm://`. `GET /api/payment/result` → 404 (expected).

### H-05 — Merchant prefix `SFAT-`
- **Severity:** P0 (branding / ops)
- **Problem:** New `Payment.orderId` values used leftover Safat prefix.
- **Root Cause:** `buildNIOrderReference` hardcoded `SFAT-`.
- **Fix:** New refs `MALAHM-`. `INTERNAL_MERCHANT_PREFIXES` includes `MALAHM` **and** `SFAT`/`FTR`/… so old rows still classify as internal (not NI UUIDs).
- **Files:** `backend-nest/src/payments/merchant-ref.ts`, `payments.service.ts`, `ni-client.ts`, specs
- **Verification:** After local API restart, newest rows are `MALAHM-…`. Older `SFAT-` remain. E2E checkout/pay/deliver/commission still pass.

### H-06 — Dashboard branding still “Sarh”
- **Severity:** P1
- **Problem:** Title, PWA name, install prompt, login brand constants said سرح / Sarh.
- **Root Cause:** Copy from Sarh dashboard extract.
- **Fix:** Identity **ملاحم سرح** / **Malahem Sarh** in metadata, manifest, brand constants, PWA copy. No layout redesign.
- **Files:** `butcher-dashboard/src/constants/brand.ts`, `src/app/layout.tsx`, `src/app/manifest.ts`, `InstallPrompt.tsx`, `dashboard/orders/page.tsx`, `__tests__/pwa.test.ts`
- **Verification:** Dashboard Jest 59/59. `next build` pass.

### H-07 — S3 default bucket `safat-uploads`
- **Severity:** P1
- **Problem:** Unused S3 default could collide with Sarh naming if S3 enabled without a bucket env.
- **Fix:** Default `sarh-butcher-uploads`. Production already requires `AWS_S3_BUCKET` when `STORAGE_PROVIDER=s3`.
- **Files:** `backend-nest/src/shared/lib/storage.ts`
- **Verification:** Code review + production validator tests still pass.

### H-08 — `main.ts` loaded leftover `../backend/.env`
- **Severity:** P1
- **Problem:** Accidental path from a nested Sarh tree; could have read the wrong file.
- **Fix:** API entry uses `import './load-env'` (same as worker/socket). Aliases `MALAHEM_*` / `BUTCHER_*` only.
- **Files:** `backend-nest/src/main.ts`
- **Verification:** Restarted local API with Malahem env only; health ok.

---

## 3. Redis Isolation

```
6380 = Malahem   (butcherapp: keys, worker heartbeat)
6379 = not used  (leftover Sarh bull:* keys, 0 butcherapp writes)
```

| Process | :6379 | :6380 |
| ------- | ----- | ----- |
| API (pre-restart pid 1341761) | 0 | 4 |
| Worker 1341768 | 0 | 6 |
| Socket 1341775 | 0 | 5 |

Fail-fast (this pass): empty env → throw; `127.0.0.1:6379` → throw; `127.0.0.1:6380` → accept.  
Phase3: “Did not write butcherapp: to SARH Redis 6379 — 0”. Heartbeat present.

---

## 4. Database Isolation

```
Malahem → sarh_butcher / user butcher
Malahem → NEVER sarouh
```

`pg_stat_activity` during verification: `sarh_butcher | butcher` only. No `sarouh` sessions.  
Migration script refuses dest database name `sarouh`.

---

## 5. Authentication Isolation

Customer path (live):

```
Phone → OTP (DEV_OTP 123456) → register → customerId → JWT iss=malahm-sarh
→ authenticated request → refresh → logout → 401
```

- Forged / Sarh `iss=sarh` JWT → **401** on `/api/butchers`.
- Butcher dashboard: username/password against **this** API (unchanged).
- Phone uniqueness and OTP remain as before. No customer-password-primary path added.

---

## 6. Payment Verification

- Payment-first checkout → `dev-complete` → order → confirm → delivered → **10%** `order_commission` / `BOC-{orderId}` (idempotent distinct refs).
- Lifecycle unit tests still cover `capturedAfterCancel` / late capture.
- Production NI **not** called (`NI_API_KEY` empty / mock).
- Callback: `APP_URL/payment/result` + `malahm://payment/result`.
- New merchant refs: `MALAHM-`. Legacy `SFAT-` still recognized.

---

## 7. Dashboard Verification

| Request | Result |
| ------- | ------ |
| `GET /dashboard` no cookie | 307 `/login?reason=session` |
| Valid Malahem butcher JWT cookie | 200 |
| Forged `iss=sarh` cookie | 307 `/login?reason=session` |
| `GET /api/health` via Next rewrite | Malahem checks all true |

A one-off **500** occurred while `next build` ran against a live `next dev` (compile race). Immediate retry and later checks were **200**. Not a login-loop regression.

---

## 8. Daftra Verification

- `GET /api/butchers/daftra/status` → **401** (Malahem auth).
- OAuth default remains `http://localhost:3001/api/butchers/daftra/oauth/callback`.
- 0 live integration rows. No connection to `sarh_daftra`.
- Credentials in templates are placeholders only.

---

## 9. Cloudinary Verification

- Live env and code default: `sarh-butcher`.
- Templates: `CLOUDINARY_FOLDER=sarh-butcher`.
- No production upload executed.
- Leftover `safat` strings remain only in unused Expo screens/tests and comments (`DEFERRED`).

---

## 10. Migration Script Verification

| Case | Result |
| ---- | ------ |
| missing `SARH_SOURCE_DATABASE_URL` | exit 1, clear message |
| missing `MALAHEM_DATABASE_URL` | exit 1 |
| same URL | exit 1 |
| dest db `sarouh` | exit 1 |
| hosted hostname | exit 1 (dry-run) |
| local dry-run `sarh_butcher` → `malahem_migrate_dry` | exit 0, counts, no writes |

`--execute` was **not** run.

---

## 11. Security Scan

No live `.env` / `.env.local` files in the tree.

| Pattern | Result |
| ------- | ------ |
| Real secret files | **NOT FOUND** |
| Template `KEY=change-me` / empty | FOUND (examples only) |
| Code `process.env.JWT_SECRET` | FOUND (runtime read, not a value) |
| `CLOUDINARY_FOLDER=safat` in templates | **NOT FOUND** after fix |
| Production host URLs as **runtime defaults** | NOT FOUND (comments / eas prod path `/api/butcher` only) |

Suspect scanner hits on `test-promote-payment-flow.js`, `daftra-live-smoke.mjs`, `jwt.ts`, migrate comments — all **code/docs**, no embedded production values.

---

## 12. Test Matrix

| Area | Result | Counts |
| ---- | ------ | ------ |
| Backend | **PASS** | 53 suites / **396** tests (was 386; +10 new isolation/prefix/callback tests, none skipped) |
| Mobile | **PASS** | 84 suites / **870** tests (unchanged) |
| Dashboard | **PASS** | 14 suites / **59** tests (unchanged; PWA assertions updated to new brand) |
| E2E | **PASS** | **56/56** (was 54; +2 payment-bridge assertions) |
| Database isolation | **PASS** | `sarh_butcher` only |
| Redis isolation | **PASS** | 6380 / never 6379 |
| JWT isolation | **PASS** | `iss=malahm-sarh`; Sarh JWT 401 |
| Worker | **PASS** | heartbeat on 6380; same prefix |
| Payments | **PASS** | lifecycle + live `MALAHM-` + `BOC-` |
| Daftra | **PASS** | isolated, unauthenticated status 401 |
| Cloudinary | **PASS** | folder `sarh-butcher` |
| Migration guard | **PASS** | five guard cases + local dry-run |
| Security scan | **PASS** | no real secret files |
| Builds | **PASS** | `prisma validate`, `nest build`, dashboard `tsc` + `next build`, mobile `tsc` |
| Expo doctor | **DEFERRED** | SDK patch drift — not upgraded |

Docker image build: **not run** (no Docker binary).

---

## 13. Remaining Blockers

### P0
None in code for this local independent stack.

### P1
- **New production credentials** must be generated (JWT, NI outlet/webhook, Twilio Verify, Cloudinary, Daftra OAuth, Redis, Postgres). Never copy Sarh’s.
- Worker/socket processes were not restarted (still old in-memory module). They already use `REDIS_URL=:6380`. Restart them before production so they load the new fail-fast.
- `expo-doctor`: expo 54.0.35 vs ~54.0.37; `eslint-config-expo` major mismatch. **POST-RELEASE MAINTENANCE** — not upgraded here.

### P2
- Shared hostname plan `sarhsa.online/api/butcher` (path isolation, optional dedicated host).
- Leftover `SFAT-` payment rows in the **local** DB (compat kept).
- Dashboard/PWA theme color still the old green (visual only).

### Deferred
- Prisma leftover models (Listing/Post/LiveStream, **0 rows**) — **KEEP / DEFERRED CLEANUP**.
- Leftover Expo screens, `safat_*` localStorage keys, `googleOAuth` `@zeinabmostafa/safat` slug — **DEFERRED CLEANUP** (boot does not use them; no delete this pass).
- `package-lock.json` names `safat` / `safat-backend-nest` — cosmetic.

---

## 14. Final Release Status

```
READY FOR PRODUCTION CONFIGURATION
```

Proven:

```
NO Sarh DB
NO Sarh Redis
NO Sarh JWT
NO Sarh worker
NO Sarh API fallback
NO production secrets copied
NO production migration
NO production deployment
```
