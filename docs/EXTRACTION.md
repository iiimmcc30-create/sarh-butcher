# Extraction log — Phase 1

Source: `iiimmcc30-create/sarh.app` at commit `2b1bce4e8ccf94c1b52d58dfb56452f9b5203a06`  
Method: **COPY → ADAPT → VERIFY** (never MOVE/DELETE from SARH)  
SARH working tree was not reset, cleaned, or committed.

## Classification legend

- **KEEP** — butcher domain, copied with behavior intact
- **ADAPT** — required, SARH coupling removed or isolated
- **REMOVE** — SARH-only; not part of the butcher product (still present in some copied trees until a later phase if compile depends on it)
- **REPLACE** — same capability, new credentials/URLs/identity

## Copied packages

| Tree | Decision | Notes |
|---|---|---|
| `backend-nest/src/butchers/` | KEEP | Domain core |
| `backend-nest/src/butcher-applications/` | KEEP | Join/KYC |
| `backend-nest/src/butcher-banners/` | KEEP | Market banners |
| `backend-nest/src/integrations/daftra/` | ADAPT | New encryption key + redirects |
| `backend-nest/src/payments/` | ADAPT | Same architecture; new NI outlet |
| `backend-nest/src/auth/` | ADAPT | Independent issuer/secrets |
| `backend-nest/src/queue/` | ADAPT | Prefix + drop SARH-only jobs when unused |
| `backend-nest/src/gateway/` | ADAPT | Room prefix |
| `backend-nest/src/upload/` + `shared/lib/storage.ts` | ADAPT | Folder `sarh-butcher` |
| `butcher-dashboard/` | KEEP | Operator UI |
| `app/app/butchers/` + join + payment | KEEP/ADAPT | New Expo identity; home = butcher market |
| `admin-panel/` butcher pages | ADAPT | SARH livestock admin routes still in tree — REMOVE later |

## SARH domain leftover in copied backend (REMOVE / later strip)

These modules were copied because Admin/Payments/Auth still import them. They are **not** the butcher product. Do not wire them in the long-term `AppModule` surface.

| Module | Class | Action |
|---|---|---|
| `listings/` | livestock marketplace | REMOVE |
| `posts/` | social feed | REMOVE |
| `livestreams/` | live | REMOVE |
| `official-services/` | MEWA | REMOVE |
| `feed-suppliers/` | feed catalog | REMOVE |
| `explore-sarh-banners/` | SARH home CMS | REMOVE |
| `editorial-stories/` | SARH home | REMOVE |
| `knowledge/` | knowledge base | REMOVE |
| `fees/` | listing fees | REMOVE |
| `market-categories/` | listings | REMOVE |
| `home-explore/` | SARH home | REMOVE |
| `queue` `FEE_CHECKS` | listing fees | REMOVE |
| `queue` `SUBSCRIPTIONS` | SARH plans cron | REVIEW — commission exemption uses `SubscriptionEntitlementService` |

## ADAPT decisions executed in Phase 1

| Item | Change |
|---|---|
| Expo identity | `com.sarh.butcher`, slug `malahm-sarh`, scheme `malahm`, name `ملاحم سرح` |
| EAS projectId | **removed** (do not reuse SARH `fc410a8a-...`) |
| Firebase files | **not copied** |
| Deep links | `APP_DEEP_LINK_SCHEME=malahm` |
| Cloudinary folder default | `sarh-butcher` (not `safat`) |
| Redis prefix | `REDIS_KEY_PREFIX=butcherapp:` applied in cache + rate-limit + heartbeat |
| Worker heartbeat | `butcherapp:worker:heartbeat` |
| Queue names | prefixed `butcherapp:` |
| Socket rooms | `butcherapp:user:{id}` |
| Docker | project `sarh-butcher`, DB `sarh_butcher`, ports 5433/6380 |
| JWT | same code path; **new secrets required** — tokens from SARH are invalid here |
| Boot navigation | authenticated/guest market entry → `/butchers` not `/(tabs)` |

## Phase 1 test evidence (local)

| Suite | Result |
|---|---|
| Prisma `validate` | pass |
| `backend-nest` butchers + banners + heartbeat + payment-redirect | 12 suites / 117 tests pass |
| `backend-nest` payments + Daftra + applications + commissions | 35 suites / 283 tests pass |
| `butcher-dashboard` | 14 suites / 58 tests pass |
| Expo butcher checkout/directory/join | 5 suites / 28 tests pass |
| Admin butcher docs + Daftra panel | 2 suites / 3 tests pass |

Not run in Phase 1: full `nest build` against slim AppModule, E2E against live NI, Prisma migrate on a real empty DB, Expo device, production webhook.

## Unresolved after Phase 2

1. GitHub remote `iiimmcc30-create/sarh-butcher` — create permission denied for this agent token (403). Local repo is ready to push. No origin.
2. Prisma still contains SARH_ONLY models (listings/posts/plans/…) because `admin.repository` / `payments.repository` compile against them. Do not drop until those queries are rewritten.
3. Leftover source dirs remain on disk (listings, posts, livestreams, …). They are excluded from `nest build` and backend Jest. Do not `rm -rf`.
4. Expo leftover `(tabs)` / listing / ministry screens remain in the tree. Boot routing sends `(tabs)` and root → `/butchers`.
5. New EAS project + FCM/APNs files (not SARH).
6. Staging NI outlet + webhook (not production). Operator must include `butcher-api-location.conf` on the live host **before** `location /api/`.
7. Isolated Redis `:6380` was not available in this environment (no Docker). Code prefixes keys `butcherapp:`. Existing Redis `:6379` was not written to.

## Dual behaviors preserved on purpose

- Payment-first `POST /butchers/checkout` **and** legacy `POST /butchers/orders` + `butcher_order`
- Public `/join` **and** authenticated `/butchers/apply`
- Direct chat remains **disabled** (`direct_chat_disabled`)
- `POST /butchers` still 403 `application_required`

Do not “simplify” these in Phase 1 or Phase 2.

---

# Extraction log — Phase 2

Branch: `cursor/butcher-extraction-phase-2`  
Work tree: `/home/ubuntu/sarh-butcher` only. `/workspace` (SARH) was not edited.  
No merge to `main`. No new DNS. No SARH DB / Redis / JWT / payment credentials.

## 1. Public API routing verification

Question: can the public URL be `https://sarhsa.online/api/butcher/butchers/checkout` while Nest stays `http://butcher-api:3001/api/butchers/checkout`?

**Yes — Nginx only. Safe. Implemented.**

`location ^~ /api/butcher/` is longer than `/api/` and uses a trailing slash, so it does **not** steal SARH `/api/butchers` or `/api/butcher-applications`. Two rewrites:

1. Compat: `/api/butcher/api/(.*)` → `/api/$1` (mobile still calls `${API_BASE}/api/butchers/checkout`)
2. Canonical: `/api/butcher/(.*)` → `/api/$1`

Exclude locations keep Nest unprefixed routes (`/join`, `/privacy`, `/payment/result|cancel`, `/uploads/`, `/socket.io/`). Controllers and business routes were not changed for the prefix.

## 2. Runtime module graph

`AppModule` keeps config/common/prisma/redis/queue/gateway/auth/users/settings/notifications/payments/integrations/daftra/butchers/applications/messages/upload/admin/health/support/banners.

Removed from runtime: listings, posts, stories, subscriptions, plans, livestreams, knowledge, fees, search, reports, official-services, content, editorial, explore, feed, market-categories, home-explore.

`tsconfig.build.json` now excludes those leftover dirs so `nest build` compiles the butcher graph only.

## 3. Prisma and local database

- `Butcher.commissionExempt BOOLEAN NOT NULL DEFAULT false` (migration `20260919120000_butcher_commission_exempt`)
- `prisma validate` passed
- `prisma migrate deploy` applied 47 migrations onto a **new** empty database `sarh_butcher` owned by role `butcher`
- Existing DBs `sarouh` and `sarh_daftra` were listed and **not** touched
- Docker Compose port 5433 was unavailable (no Docker). Local Postgres 16 on 5432 was used with an isolated DB name/role only

SARH_ONLY models remain in `schema.prisma` (compile leftovers).

## 4. Commissions

`SubscriptionEntitlementService` / SARH `storeCommission` is no longer on the butcher order path. Exemption is `ButcherCommissionPolicy.isExemptForUser` → `Butcher.commissionExempt`. Rate stays 10% on delivered+paid orders (`BOC-{orderId}`).

## 5. Auth / JWT

Issuer required: `JWT_ISSUER` (default `malahm-sarh`). Production validator requires `JWT_ISSUER` and `SECRETS_ENCRYPTION_KEY`. SARH tokens are invalid here. Dashboard/admin cookies still verify against **this** app’s `JWT_SECRET`, not SARH’s.

## 6. Redis / queues / sockets

Prefix `butcherapp:` via `butcherRedisKey`, cache, rate-limit, heartbeat, BullMQ queue names, Daftra cron locks, socket rooms `butcherapp:user:{id}`. Worker module is Queue + Daftra only (no FEE_CHECKS / SUBSCRIPTIONS processors).

This environment’s Redis `:6379` was treated as foreign and was **not** used for butcher writes. Isolated `:6380` was not started (no Docker).

## 7. Payments

Architecture kept (N-Genius + `IntegrationOrder` / webhooks). `initiate` accepts only `butcher_order` and `butcher_checkout`. Other types (`listing_fee`, subscription, …) throw `unsupported_payment_type`. Leftover `planId` / `billingCycle` identifiers were removed from the initiate checkout calls so butcher checkout no longer throws `planId is not defined`.

## 8. Cloudinary / Daftra

Folder default `sarh-butcher`. Daftra encryption fallback prefix `butcherapp-daftra-v1:`. Local OAuth redirect stays `http://localhost:3001/api/butchers/daftra/oauth/callback`. Production comment: `https://sarhsa.online/api/butcher/butchers/daftra/oauth/callback`. Cron cleanup uses `publicApiPath('/api/admin/cleanup')` so it never hits SARH `/api/admin/cleanup`.

## 9. Mobile / admin / dashboard

- Mobile boot: root and leftover `(tabs)` → `/butchers`. Guests browse the market (not forced through `/auth/welcome` on index).
- Production Expo base: `https://sarhsa.online/api/butcher` + socket `/api/butcher/socket.io`
- Dashboard/admin browser base: `/api/butcher` on the shared host (axios `/butchers` → `/api/butcher/butchers`)
- Admin sidebar is butcher operations only
- Compose admin now sets `NEXT_PUBLIC_ADMIN_BASE_PATH=/admin`
- Dockerfile API defaults are `https://sarhsa.online/api/butcher` (not SARH `/api`)

## 10. Test evidence (Phase 2)

| Suite | Result |
|---|---|
| `npx prisma validate` | pass |
| `npx prisma migrate deploy` on empty `sarh_butcher` | 47 migrations applied |
| `backend-nest` `npm run build` | pass |
| `backend-nest` `npm test` | 93 suites / 708 tests pass |
| Expo `tsc --noEmit` | pass |
| Expo butcher/boot suites | 18 targeted suites pass; broader `--testPathPatterns` 84/870 pass |
| `butcher-dashboard` `npm test` | 14 suites / 59 tests pass |
| `admin-panel` `npm test` | 12 suites / 71 tests pass |

Not run: live N-Genius, EAS, device, production webhook, Docker compose stack, writing keys to Redis.

## 11. Leftovers (NON-RUNTIME — do not delete yet)

| Item | Why it stays |
|---|---|
| `src/listings`, `posts`, `livestreams`, `fees`, `plans`, `subscriptions`, … | Copied source; excluded from build/Jest |
| Prisma Listing/Post/Plan/… models | `admin.repository` / `payments.repository` still type against them |
| Admin leftover pages (`/posts`, `/listings`, …) | Files exist; **not** in `ADMIN_NAV` |
| Expo `(tabs)`, `/listing`, `/market`, ministry screens | Files exist; boot redirects away |
| Logger leftover screens / brand copy `سرح` in admin constants | Branding leftover, not SARH infra |
| `queue/processors/fee-check.processor.ts` and `subscription.processor.ts` | On disk; not registered in `WorkerModule` |

## 12. Blockers / next (A–G unchanged)

- **A** No GitHub repo permission — cannot push
- **B** Live SARH nginx still needs an operator include of `butcher-api-location.conf` before `/api/` (file lives only in this repo)
- **C** No isolated Redis/Docker in this verify environment
- **D** Prisma SARH_ONLY models cannot be dropped until admin/payments compile deps are rewritten
- **E** No EAS / FCM / production NI
- **F** `/workspace` must stay untouched
- **G** Do not merge to `main`

Phase 3 candidate: drop leftover source after rewriting admin stats / payments repository off SARH_ONLY models.

## Dual behaviors preserved on purpose

- Payment-first `POST /butchers/checkout` **and** legacy `POST /butchers/orders` + `butcher_order`
- Public `/join` **and** authenticated `/butchers/apply`
- Direct chat remains **disabled** (`direct_chat_disabled`)
- `POST /butchers` still 403 `application_required`

Do not “simplify” these in Phase 1.
