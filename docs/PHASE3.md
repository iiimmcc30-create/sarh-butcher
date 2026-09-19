# Phase 3 — Independent Runtime Validation

Branch: `cursor/butcher-runtime-validation-phase-3`  
HEAD at start: `19574d3` (Phase 2 complete)  
Work tree: `/home/ubuntu/sarh-butcher` only. `/workspace` was not edited.  
Remote: none (local repo). Validation completed locally.  
No merge to `main`. No EAS build.

## Git baseline

| Item | Value |
|---|---|
| Branch | `cursor/butcher-runtime-validation-phase-3` |
| Parent | `cursor/butcher-extraction-phase-2` @ `19574d3` |
| Remote | none |
| Isolated DB | `sarh_butcher` / role `butcher` on local Postgres 16 `:5432` |
| Isolated Redis | `127.0.0.1:6380` (own dir `/tmp/sarh-butcher-redis`) |
| Foreign Redis | `:6379` observed, never written (`butcherapp:*` count = 0) |
| Foreign DBs | `sarouh`, `sarh_daftra` listed and untouched |

Docker was unavailable. Compose project name remains `sarh-butcher`. Local processes used the same env contract (ports 3001/3002/3003/3000).

## 1. Runtime

```
Postgres: PASS
Redis:    PASS  (isolated :6380, prefix butcherapp:)
API:      PASS  GET /api/health + /api/health/ready
Worker:   PASS  heartbeat butcherapp:worker:heartbeat
Socket:   PASS  :3002, JWT auth, room butcherapp:user:{id}
Dashboard:PASS  Next :3003 HTTP 307 (middleware → login)
Admin:    PASS  Next :3000 /login HTTP 200
```

First boot failed because BullMQ rejects `:` in queue *names*. Phase 2 had put `REDIS_KEY_PREFIX=butcherapp:` into the queue name. Smallest fix: queue names are plain (`notifications`, …) and isolation is BullMQ `prefix: butcherapp` so Redis keys stay `butcherapp:<queue>:…`. Cache/locks/heartbeat still use `butcherapp:`.

Schema drift: copied `User.rating` / `User.reviewCount` existed in Prisma but not in migrations. Additive migration `20260919140000_user_rating_review_align` applied on the isolated DB only.

## 2. Authentication

```
Register:            PASS  (OTP 123456 + /api/auth/register)
OTP:                 PASS  (send / reject 000000 / verify 123456)
Login:               PASS  (customer, butcher shop account, admin)
Refresh:             PASS
Logout:              PASS  (access token blacklisted → 401)
SARH JWT rejection:  PASS  (foreign secret + iss=sarh → 401)
JWT issuer:          PASS  iss=malahm-sarh
```

Secrets used were local Phase 3 values, not SARH production JWT.

## 3. Butcher flow

```
Onboarding:  PASS  public join + 4 local document uploads
Approval:    PASS  POST /api/admin/butcher-applications/:id/approve
Directory:   PASS  GET /api/butchers?sort=rating
Store:       PASS  GET /api/butchers/:id
Product:     PASS  POST /api/butchers/products
Cart:        PASS  empty / invalid / over-qty rejected
Checkout:    PASS  POST /api/butchers/checkout → butcher_checkout
Payment:     PASS  POST /api/payments/:id/dev-complete (mock NI)
Order:       PASS  butcher sees order; confirmed → delivered
Delivery:    PASS
Commission:  PASS  Payment amount=10 referenceType=order_commission
Legacy:      PASS  POST /api/butchers/orders + butcher_order initiate
```

`listing_fee` initiate → `unsupported_payment_type`. Unauthorized admin and order updates rejected (403). Duplicate checkout reused the same checkout id.

`commissionExempt` local rule: column present; policy unit tests from Phase 2; live 10% accrued on a non-exempt butcher.

## 4. Infrastructure isolation

```
Database:   PASS  sarh_butcher only; 48 migrations
Redis:      PASS  :6380 only; keys butcherapp:*
Queue:      PASS  BullMQ prefix butcherapp
JWT:        PASS  independent secret + issuer malahm-sarh
Socket:     PASS  own process :3002, not SARH /socket.io
Cloudinary: PASS  STORAGE_PROVIDER=local; folder default sarh-butcher
Daftra:     NOT RUN — credentials intentionally unavailable
Payments:   PASS  mock mode (empty NI_API_KEY); no SARH outlet
```

Daftra boundary still uses independent `SECRETS_ENCRYPTION_KEY`. Live OAuth was not attempted.

## 5. Nginx

```
Canonical API:        PASS  /api/butcher/butchers/checkout → /api/butchers/checkout
Compatibility API:    PASS  /api/butcher/api/butchers/checkout → same Nest path
Socket:               PASS  /api/butcher/socket.io/ isolated
SARH API unaffected:  PASS  /api/butchers and /api/butcher-applications not stolen
```

Verified against `nginx/butcher-api-location.conf` rewrite rules. Live Hostinger include is still an operator step (file lives only in this repo).

## 6. Test results

```
Backend:    93 suites / 708 tests PASS + nest build PASS
Expo:       tsc --noEmit PASS; 84 suites / 870 tests PASS
Dashboard:  14 suites / 59 tests PASS
Admin:      12 suites / 71 tests PASS
Prisma:     validate PASS; migrate deploy 48/48
E2E:        54/54 live checks PASS (scripts/phase3-runtime-e2e.mjs)
```

## 7. Failures

### ERROR: Queue name cannot contain :

- FILE: `backend-nest/src/queue/constants.ts`
- ROOT CAUSE: BullMQ forbids `:` in the queue name. `REDIS_KEY_PREFIX=butcherapp:` was concatenated into the name.
- FIX: Keep Redis key prefix as `butcherapp:`. Set BullMQ `prefix` to `butcherapp` and use colon-free queue names.
- TEST AFTER FIX: API/worker/socket boot; `/api/health/ready`; backend Jest 708; live E2E 54/54.

### ERROR: User.rating does not exist

- FILE: `prisma/schema.prisma` vs extracted migrations
- ROOT CAUSE: Schema had `rating`/`reviewCount` (and `UserReview`) without a migration.
- FIX: Additive migration `20260919140000_user_rating_review_align` on isolated DB only.
- TEST AFTER FIX: `prisma migrate deploy`; register/login E2E.

### ERROR: Public join `username_required`

- FILE: E2E client (not a product bug)
- ROOT CAUSE: Join applicant username is required by `createJoinUser`.
- FIX: E2E sends `username`.
- TEST AFTER FIX: join 201 → approve 200.

## 8. Remaining blockers

```
BLOCKER      No GitHub origin — cannot push / create private remote
BLOCKER      Live nginx include of butcher-api-location.conf not applied on host
BLOCKER      EAS projectId empty; no FCM/APNs; no new EAS project
NON-BLOCKER  Docker unavailable here (local Postgres/Redis used instead)
NON-BLOCKER  Leftover SARH Prisma models / source dirs (intentional Phase 2)
NON-BLOCKER  Leftover Expo (tabs)/listing screens (boot redirects to /butchers)
NON-BLOCKER  Leftover safat localStorage keys / googleOAuth expo slug
INTENTIONAL  Compat public path /api/butcher/api/* kept
INTENTIONAL  Dual checkout + legacy /orders kept
INTENTIONAL  Daftra live OAuth not run
INTENTIONAL  No production NI credentials
```

Runtime leakage audit (word `sarh` alone is not leakage):

| Hit | Class |
|---|---|
| `https://sarhsa.online/api/butcher` in eas/env | INTENTIONAL |
| `sarhsa.online/api` without `/butcher` as generic base | not present in runtime defaults |
| `sarh-new4.onrender.com` | TEST / leftover fixtures |
| `com.sarh.app` in leftover `(tabs)/more.tsx` Play Store link | NON-RUNTIME leftover screen |
| `com.sarh.app` in `start-usb.js` | FIXED → `com.sarh.butcher` |
| `sarh://` payment scheme | FIXED → emit `malahm://`; still accept `sarh://` returns |
| `safat` Cloudinary folder / localStorage keys | NON-RUNTIME leftovers |
| SARH JWT / Redis / DB / NI | not used |

## 9. EAS readiness

```
NOT READY
```

Technical reasons only:

1. `app.json` `extra.eas.projectId` is empty (SARH id was removed on purpose; a new EAS project has not been created).
2. No FCM / APNs files.
3. No GitHub remote to attach EAS.
4. Production NI outlet / webhook not provisioned.
5. Operator has not installed `butcher-api-location.conf` on the shared host yet.

Identity config itself is in place: name `ملاحم سرح`, slug `malahm-sarh`, package/bundle `com.sarh.butcher`, scheme `malahm`. Production Expo API is `https://sarhsa.online/api/butcher` with socket path `/api/butcher/socket.io`.

**Do not start an EAS APK from this phase.**
