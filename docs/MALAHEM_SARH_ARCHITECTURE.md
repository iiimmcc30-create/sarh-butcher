# MALAHEM SARH — ARCHITECTURE CONTRACT

This document is the architectural contract for `iiimmcc30-create/sarh-butcher`.

It describes what must stay the same as the original Malahem implementation inside `iiimmcc30-create/sarh.app`, and what must stay different because of isolation.

```
                    ┌──────────────────────┐
                    │  Shared External     │
                    │  Provider Accounts   │
                    │                      │
                    │ N-Genius             │
                    │ Twilio               │
                    │ Firebase             │
                    │ Cloudinary           │
                    │ Daftra               │
                    └──────────┬───────────┘
                               │
                 ┌─────────────┴─────────────┐
                 │                           │
           SARH PLATFORM              MALAHEM SARH
                 │                           │
        Sarh DB / Redis              Malahem DB / Redis
                 │                           │
        Sarh JWT/runtime             Malahem JWT/runtime
```

Shared providers do **not** mean shared application infrastructure.

---

## Same as Sarh

Marketplace behavior, business rules, customer flows, butcher flows, and integration *semantics* are copied from the original Malahem code — not redesigned.

### Marketplace behavior

- Butcher discovery, profile, products, offers, stories, favorites, reviews
- In-memory cart, single-butcher cart, checkout preparation
- Payment-first checkout: validate → stock hold → N-Genius → callback → order
- KG vs fixed-unit pricing (`pricePerKg`, Daftra KG, Daftra unit-count, flat `priceFixed`)
- Stock: reserve on checkout, release on cancel/expiry, decrement on delivered
- Delivery type `pickup` | `delivery` with address; **no delivery fee** in order total
- Customer phone OTP (Twilio Verify), JWT access + refresh, logout
- Butcher dashboard: login cookie `butcher_token`, products, inventory, orders, customers, reports, settings, Daftra catalog
- Admin: butchers, applications, orders, payments, commissions, users, banners, support, settings

### Order state machine

```
pending    → confirmed | cancelled
confirmed  → preparing | cancelled
preparing  → ready
ready      → delivered
delivered  → (terminal)
cancelled  → (terminal)
```

- Butcher or ADMIN: any allowed transition
- Customer: `cancelled` only, and only when `paymentStatus !== paid`
- `confirmed` requires `paymentStatus === paid`
- System actor `system:unpaid-order-expiry` cancels stale unpaid pending orders
- Checkout TTL default 30 minutes

### Payments (N-Genius)

- Initiate checkout payment, redirect `/payment/result`, cancel `/payment/cancel`
- Webhooks: `/api/payments/webhook`, `/api/integrations/ni/webhook`
- Late capture after cancel: `capturedAfterCancel` + `needsReconciliation`; **do not** recreate the order
- Duplicate callback / sync: same repository idempotency
- New merchant references: `MALAHM-*` (legacy `SFAT-` / `FTR` / … still recognized)

### Commissions

- **10%** of `totalPrice` when order becomes `delivered` and `paymentStatus === paid`
- Ledger row: `Payment.referenceType = order_commission`, merchant id `BOC-{orderId}`
- Idempotent; refunds reverse the ledger row
- Exemption is **local** `Butcher.commissionExempt` (replaces Sarh plan `storeCommission`)

### Integrations (same accounts, same model)

| Provider | Contract |
|----------|----------|
| N-Genius | Same outlet/account where contractually allowed; Malahem callback URLs |
| Twilio | Same Verify service where allowed; no production DEV_OTP |
| Firebase | Same project where allowed; **independent Android/iOS app** `com.sarh.butcher` |
| Cloudinary | Same account; folder **`sarh-butcher`** (never `safat`) |
| Daftra | Same per-butcher encrypted API key / OAuth; 10-minute product poll; KG/unit mapping unchanged |

### Realtime and jobs

- Socket.IO path `/socket.io`, events `order:status`, chat, notifications, support
- Push via Bull queue `push-notifications` job `send`
- Daftra product sync every 10 minutes with per-butcher lock
- Unpaid order / checkout expiry in the API process

### Data

- **SARH DATA MIGRATION: NOT REQUIRED**
- Production Malahem database starts empty
- `scripts/migrate-from-sarh.mjs` is historical / optional only

---

## Intentionally different

These differences exist so Malahem cannot share Sarh runtime, identity, or data. They are not marketplace redesigns.

### Application identity

| Item | Sarh | Malahem |
|------|------|---------|
| Product name | سرح | ملاحم سرح |
| Expo name / slug / scheme | Sarh / `safat` / `sarh` | ملاحم سرح / `malahm` / `malahm` |
| Android / iOS package | `com.sarh.app` | `com.sarh.butcher` |
| JWT issuer | none | `malahm-sarh` |
| Client storage prefix | `safat_` | `butcherapp_` |
| Deep link | `sarh://` | `malahm://` |
| Boot route | `/(tabs)` Sarh home | `/butchers` |
| Admin / dashboard brand | سرح | ملاحم سرح |

### Database

- Independent PostgreSQL database `sarh_butcher`
- Never `sarouh` / Sarh production
- Fresh install: `prisma migrate deploy` once (`SKIP_MIGRATIONS=true` in production by default; `RUN_MIGRATIONS=true` one-shot)
- Leftover Prisma models (Listing, Post, Live, Plan, …) may remain in schema; AppModule does not use them

### Redis

- Independent Redis: `MALAHEM_REDIS_URL` / `REDIS_URL`
- Key / Bull prefix: `butcherapp` (`butcherapp:`)
- Fail-fast if unset in production (no silent `localhost:6379`)
- Socket rooms: `butcherapp:user:{userId}`
- Daftra lock: `butcherapp:cron:daftra_products:{butcherId}`

### JWT / encryption

- Independent `JWT_SECRET`, `JWT_REFRESH_SECRET`, optional `BUTCHER_JWT_SECRET`
- Independent `SECRETS_ENCRYPTION_KEY`
- Issuer must be `malahm-sarh`
- Sarh access tokens must not validate

### Docker / runtime

- Compose network `malahem_internal` (not `sarh_internal`)
- Independent API / socket / worker / nginx / dashboard / admin processes
- Payment nginx bridges to Malahem `api:3001`, not Sarh `web`
- Production URLs come from `MALAHEM_*` / `NEXT_PUBLIC_*` / `EXPO_PUBLIC_*` — no baked `sarhsa.online`

### API graph

Independent `AppModule` mounts butcher marketplace only:

Auth, Users, Settings, Notifications, Payments, Integrations, Daftra, Butchers, Butcher Applications, Messages, Upload, Admin (trimmed), Health, Support, Butcher Banners, Queue, Gateway, Redis, Prisma.

**Not mounted:** listings, posts, stories, livestreams, subscriptions, plans, fees, search, reports, official-services / MEWA, explore-sarh-banners, feed-suppliers, market-categories, home-explore, knowledge, content, editorial-stories.

Those leftover modules may remain on disk. They must not be imported into the runtime graph unless a real Malahem dependency appears.

### Payment merchant prefix

- New: `MALAHM-{uid}-{ts}`
- Legacy classify-only: `SFAT`, `FTR`, `PRM`, `PIN`, `BOTH`
- Never issue new `SFAT-` references from Malahem

### Commission exemption

- Sarh: subscription plan permission `storeCommission`
- Malahem: `Butcher.commissionExempt` (admin edit)
- Rate and delivered-only accrual stay 10% / `BOC-`

---

## External service strategy (do not create resources in this phase)

| Service | Strategy | Share Sarh runtime? |
|---------|----------|---------------------|
| N-Genius | Same account/integration where supported | No (independent callbacks) |
| Twilio | Same account where supported | No |
| Firebase | Same project where supported, independent Android app | No (independent package) |
| Cloudinary | Same account, folder `sarh-butcher` | No |
| Daftra | Same integration model | No (Malahem OAuth redirect) |
| Database | NEW / INDEPENDENT | No |
| Redis | NEW / INDEPENDENT | No |
| JWT secrets | NEW / INDEPENDENT | No |
| Encryption secrets | NEW / INDEPENDENT | No |
| Runtime infrastructure | NEW / INDEPENDENT | No |

Do not copy production secret values. Do not create provider resources during audit.

---

## Operator configuration (later)

Required before a real production customer can complete a paid order:

1. Independent Postgres `sarh_butcher` + migrate once
2. Independent Redis
3. Independent JWT / encryption secrets
4. `ALLOWED_ORIGINS`, `MALAHEM_API_URL`, `MALAHEM_APP_URL`, dashboard/admin URLs
5. N-Genius outlet + webhook + redirect to Malahem
6. Twilio Verify
7. Firebase project + `com.sarh.butcher` + `google-services.json`
8. Cloudinary folder `sarh-butcher`
9. Daftra OAuth redirect on the Malahem API
10. First admin, first butcher, first products (blank DB)

See `docs/MALAHEM_FRESH_PRODUCTION_INITIALIZATION.md` and `docs/MALAHEM_PRODUCTION_ENVIRONMENT.md`.

---

## What this contract forbids

- Redesigning Malahem UX or inventing delivery/commission/order rules
- Replacing NestJS / Next.js / Expo / Prisma / Socket.IO / N-Genius
- Sharing Sarh DB, Redis, JWT, Docker network, or runtime URLs
- Uploading Malahem assets into Cloudinary folder `safat`
- Issuing `SFAT-` merchant references for new Malahem payments
- Accepting Sarh JWTs
- Running `scripts/migrate-from-sarh.mjs` as part of launch
- Deploying or creating external resources from this repository during audit phases
