# MALAHEM SARH — P4 FEATURE PARITY REPORT

## 1. Overall Status

PARITY CONFIRMED WITH DOCUMENTED DIFFERENCES

## 2. Executive Summary

The independent repository reproduces the original Malahem marketplace that ran inside Sarh: butcher discovery, KG/fixed products, in-memory cart, payment-first checkout, N-Genius (including late-capture reconciliation), the six-state order machine, delivery type without a fee, 10% delivered-only commission (`BOC-{orderId}`), Daftra product sync, butcher dashboard, and Malahem admin operations.

It does **not** share Sarh’s database, Redis, JWT issuer, Docker network, or production URLs. New payments use `MALAHM-*`. The JWT issuer is `malahm-sarh`. Cloudinary uses folder `sarh-butcher`. The mobile package is `com.sarh.butcher`.

A customer who used Malahem **inside Sarh** cannot open the independent app and continue that same account: there is no data migration, and Sarh tokens are rejected. That is intentional.

A customer who uses the **independent** Malahem app, against a configured Malahem runtime with butchers and products created in `sarh_butcher`, gets the same marketplace behavior and business logic as the original Malahem module.

Passing tests are evidence. Parity was established by comparing Sarh (`/workspace`) and independent (`/home/ubuntu/sarh-butcher`) controllers, services, Prisma models, mobile butcher screens, dashboard pages, and admin APIs — not by filename presence.

This phase also closed two extraction gaps:

- Admin could not set `commissionExempt` (the isolation replacement for Sarh plan `storeCommission`). The flag is now on `PATCH /api/admin/butchers/:id` and the butcher edit modal.
- The admin commissions page still described listing 1% / `storeCommission` and called unmounted listing-fee APIs. It now reports order commission only. Admin brand copy is `ملاحم سرح`.

Sarh was not modified. Nothing was deployed. `scripts/migrate-from-sarh.mjs` was not executed.

## 3. Feature Parity

### Customer

Phone OTP, verification, registration, JWT refresh/logout, butcher home, directory, profile, cart, checkout, payment result, orders, invoices, favorites, reviews, join/application, chat, support. **MATCH** on Malahem screens (`diff -rq app/butchers` empty). Boot goes to `/butchers` instead of Sarh tabs — **INTENTIONAL DIFFERENCE**. Leftover Sarh tabs/listings/ministry remain on disk and are not the default path — **PARTIAL** leftover.

### Butcher

Dashboard login, session cookie, products, inventory, orders and status changes, customers, reports, settings, Daftra panel. **MATCH**. JWT issuer check is **MATCH — ISOLATED INFRASTRUCTURE**. Brand `ملاحم سرح` is intentional.

### Products

CRUD, images, visibility, Daftra-linked units. **MATCH**.

### Inventory

KG (`pricePerKg` or Daftra KG × weight), fixed unit, Daftra unit-count (`round(weightKg)`), reserve/release/decrement. `order-line.util.ts` and `product-sale-unit.util.ts` are byte-identical. **MATCH**.

### Cart

Add/remove/weight, butcher isolation, server-side validation at checkout. In-memory only in **both** repos. **MATCH**.

### Checkout

Validate → reserve (`held`) → N-Genius → fulfill → order `pending`/`paid` → reservations `converted`. TTL 30 minutes. Late capture sets `needsReconciliation` / `capturedAfterCancel` without creating an order. **MATCH**.

### Orders

States and transitions identical. Confirm requires paid. Customer cannot cancel a paid order. Unpaid expiry actor unchanged. **MATCH**.

### Delivery

`pickup` / `delivery` + address. No delivery fee and no free-delivery rule in either butcher module. **MATCH**.

### Payments

Same NI client, webhooks, sync, refund, reconciliation flags. New merchant prefix `MALAHM-`; legacy `SFAT-` classified only. Initiate accepts butcher checkout/order only. **MATCH — ISOLATED INFRASTRUCTURE**.

### Notifications

Same in-app API and FCM processor. Isolated push storage keys and package id. **MATCH — ISOLATED INFRASTRUCTURE**. Provider account may be shared; app identity is `com.sarh.butcher`.

### Realtime

Same events and `/socket.io`. Rooms prefixed `butcherapp:user:`. Independent socket process. **MATCH — ISOLATED INFRASTRUCTURE**.

### Daftra

Same encryption, per-butcher client, product poll (10 min / 9 min lock), KG/unit mapping. No sales-invoice outbound in **either** repo. OAuth default is localhost unless env is set. **MATCH — ISOLATED INFRASTRUCTURE**.

### Admin

Malahem butcher/application/order/payment/commission/user/support/settings/banner pages **MATCH**. Platform social/listing admin unmounted — **INTENTIONAL DIFFERENCE**. Leftover pages remain on disk.

### Commissions

10%, delivered+paid only, `BOC-{orderId}`, idempotent, refund hook. Exemption is `commissionExempt` instead of Sarh plans. **MATCH** rate/timing; **INTENTIONAL DIFFERENCE** exemption source.

## 4. Integration Parity

### N-Genius

**MATCH**

Same create/capture/webhook/sync/refund/reconciliation behavior. Isolated merchant prefix and callback host. Same account allowed; Malahem must have its own redirect/webhook URLs.

### Twilio

**MATCH**

Same OTP service and production `DEV_OTP` refuse. Same account allowed. Independent env values — do not copy secrets.

### Firebase

**MATCH**

Same Admin SDK push processor. Independent Android application `com.sarh.butcher`. `google-services.json` is an operator artifact, not in this repo.

### Cloudinary

**MATCH**

Same upload/delete model. Folder `sarh-butcher` (Sarh default was `safat`). Production validation rejects `safat`/`sarh` folder names.

### Daftra

**MATCH**

Same integration model, units, polling, locking, retries, per-butcher isolation. Isolated OAuth callback base and Redis lock prefix. No simplified rewrite.

## 5. API Parity

Malahem endpoints present in both (same method/path/auth):

| Method | Path |
|--------|------|
| * | `/api/auth/*` (login, register, refresh, logout, OTP, google, password) |
| * | `/api/butchers` and products, offers, orders, checkout, checkout abandon, favorites, reviews, stories, dashboard, stats, customers, reports |
| * | `/api/butchers/daftra/*` |
| POST | `/api/payments/initiate`, `/:id/sync`, `/webhook` |
| GET | `/payment/result`, `/payment/cancel` |
| POST | `/api/integrations/ni/webhook` |
| * | `/api/notifications`, `/api/messages`, `/api/upload/*`, `/api/users/*`, `/api/support/*`, `/api/health` |
| * | `/api/admin/auth/*`, users, butchers, orders, settings, butcher-applications, cleanup |

Intentionally **absent** from the independent runtime (present in Sarh, leftover files unmounted here):

- `/api/listings`, boosts, promotions
- `/api/posts`, `/api/stories`, `/api/livestreams`
- `/api/subscriptions`, `/api/plans`, `/api/fees`
- `/api/official-services`, `/api/explore-sarh-banners`, `/api/feed-suppliers`
- `/api/admin/listing-fee-compliance`, listing/post/livestream/section admin routes

Those domains are not Malahem dependencies.

## 6. Database Parity

Butcher commerce models match field-for-field (`ButcherProduct`, `ButcherOrder`, checkout/reservations, reviews, favorites, applications, Daftra, banners, `Payment`, order enums).

**Single schema delta:** independent `Butcher.commissionExempt Boolean @default(false)` (migration `20260919120000_butcher_commission_exempt`). Required for isolated exemption.

No dedicated `Commission` / ledger model in **either** repo; commission is a `Payment` row.

Leftover Listing/Post/Live/Plan/etc. models remain in the Prisma file and are unused by AppModule. That is leftover schema, not missing Malahem fields.

Database name must be `sarh_butcher`, never `sarouh`.

## 7. Security Isolation

| Check | Result |
|-------|--------|
| Independent DB | Yes — `sarh_butcher`; migrate script refuses `sarouh` destination |
| Independent Redis | Yes — `MALAHEM_REDIS_URL` / prefix `butcherapp:`; fail-fast |
| Independent JWT | Yes — `iss=malahm-sarh`; production validator requires it |
| Independent runtime | Yes — `malahem_internal`; no `sarh_internal` |
| Sarh authentication accepted | No — issuer + secret isolation |
| Sarh production dependency | No runtime default to `sarhsa.online`; validators reject it |

Do not copy production secrets. Shared **provider accounts** are allowed; shared **application infrastructure** is not.

## 8. Performance Findings

Concrete only:

- Leftover Expo routes (`/(tabs)`, listings, ministry) still registered. If a user deep-navigates there, the client will call unmounted Sarh APIs and receive 404s. Default boot does not use those routes.
- Leftover admin pages (`/listings`, `/posts`, …) still exist as files. Sidebar does not link them; opening the URL hits unmounted admin APIs.
- Prisma still contains unused Listing/Post/Live tables. AppModule does not query them. Extra tables on a blank DB are unused, not N+1.
- Dashboard/admin HTTP surfaces for Malahem pages match Sarh; no new polling loops were introduced in this phase.
- Socket leftover `live:*` handlers remain in the gateway file; livestream module is not mounted, so those events have no producer.

No architecture redesign was applied.

## 9. Tests

Exact numbers from this run (independent repo):

| Suite | Suites | Tests | Result |
|-------|--------|-------|--------|
| backend (Jest `backend-nest`) | 97 | 730 | passed |
| mobile (Jest `app`) | 84 | 870 | passed |
| dashboard (Jest `butcher-dashboard`) | 14 | 59 | passed |
| admin (Jest `admin-panel`) | 12 | 71 | passed |
| integration/E2E | 12 backend `test/*.e2e-spec.ts` files present (including leftover listings/social live specs) | **not executed** against production or a live NI/Twilio account | — |

Parity-focused backend subset (admin butcher, commission policy, order lifecycle, checkout, merchant-ref, production env): **7 suites / 77 tests passed**.

Tests were not weakened. Leftover listing/social mobile tests still pass because leftover screens remain on disk.

## 10. Remaining Gaps

| Severity | Gap |
|----------|-----|
| P2 | Leftover legal/info screens (`app/info/*`, `sarhOfficial.ts`) still mention `sarhsa.online` and livestock listings. `butchers/more` links to `/info/privacy`. Marketplace flows do not depend on them. Do not delete leftover screens in this phase. Operator should replace legal copy before public launch. |
| P2 | Leftover Expo/admin routes can 404 against the trimmed API if opened. Not the default customer path. |
| P3 | Leftover Prisma models and unmounted Nest modules remain on disk (policy: do not delete unused legacy). |
| P3 | `admin.service.ts` still contains unused listing-fee client helpers. Dead after commissions page cleanup. |
| P3 | Unused `(tabs)/more.tsx` still links Play Store `com.sarh.app`. Running package is `com.sarh.butcher`. |
| P3 | `google-services.json` for `com.sarh.butcher` is not in the repo (correct — operator artifact). |

No P0 marketplace-logic gap remains after the commission-exempt / commissions-page / admin-brand fixes.

Do not treat “code exists” as the success criterion. See section 2.

## 11. Operator Actions

Only actions that need real credentials, provider consoles, DNS, or servers:

1. Provision independent Postgres `sarh_butcher` and Redis; set `DATABASE_URL`, `MALAHEM_REDIS_URL`.
2. Generate independent `JWT_SECRET`, `JWT_REFRESH_SECRET`, `SECRETS_ENCRYPTION_KEY`; set `JWT_ISSUER=malahm-sarh`.
3. Set `ALLOWED_ORIGINS`, `MALAHEM_API_URL`, `MALAHEM_APP_URL`, dashboard/admin public URLs. No `sarhsa.online`.
4. Point N-Genius redirect/webhook at the Malahem API (`/payment/result`, `/api/payments/webhook` or `/api/integrations/ni/webhook`).
5. Configure Twilio Verify (never `DEV_OTP=true` in production).
6. Add Firebase Android/iOS app `com.sarh.butcher`; place `google-services.json` in the native build; set `FIREBASE_*`.
7. Set `CLOUDINARY_FOLDER=sarh-butcher` on the shared Cloudinary account.
8. Set Daftra OAuth redirect to `{MALAHEM_API_URL}/api/butchers/daftra/oauth/callback`.
9. DNS + TLS + nginx for the Malahem hosts; do not attach `sarh_internal`.
10. One-shot `RUN_MIGRATIONS=true` / `prisma migrate deploy` on the empty database; create the first admin and butcher accounts.
11. Replace leftover legal/privacy copy before public store listing.

Do not run `scripts/migrate-from-sarh.mjs` for launch.

## 12. Final State

If a customer used Malahem inside Sarh before the extraction: they **cannot** reuse that Sarh login or history on independent Malahem (new database, new JWT issuer, migration not required and not executed).

If a customer uses independent Malahem Sarh after operators configure providers and create marketplace data: they **can** experience the same butcher marketplace behavior and business logic that existed inside Sarh.

SARH DATA MIGRATION: NOT REQUIRED
PRODUCTION DEPLOYMENT: NOT EXECUTED
PRODUCTION MIGRATION: NOT EXECUTED
EXTERNAL RESOURCES CREATED: NO
PRODUCTION SECRETS COPIED: NO
SARH REPOSITORY MODIFIED: NO
