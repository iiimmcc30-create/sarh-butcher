# MALAHEM — REPOSITORY BOOTSTRAP REPORT

**Local tree:** `/home/ubuntu/sarh-butcher`  
**Intended GitHub:** `iiimmcc30-create/sarh-butcher`  
**Date:** 2026-09-19  
**This pass:** inspect + gitignore safety only. **No commit. No push. No PR. No production.**

---

## 1. Repository Status

**GitHub `iiimmcc30-create/sarh-butcher` is empty.**

Evidence:

- `GET /repos/iiimmcc30-create/sarh-butcher/git/ref/heads/main` → **409 Git Repository is empty**
- `list_branches` → `[]`

Local remotes already point at that repo:

```
origin  https://github.com/iiimmcc30-create/sarh-butcher.git
```

Local git is **not** empty. Current branch `cursor/butcher-app-icon-2174` has the full Malahem tree plus uncommitted hardening/isolation work. `main` exists locally (`1ac5126`) but was never accepted by the empty GitHub default branch.

**Do not push until the operator asks.**

---

## 2. Local Project Status

The local project **exists and is the independent Malahem system**, not a leftover Sarh clone.

Present (verified by `ls` / `find`):

| Path | Role |
| ---- | ---- |
| `backend-nest/` | NestJS API + Prisma + worker + socket |
| `butcher-dashboard/` | Existing Next.js butcher console |
| `app/` | Expo customer app |
| `admin-panel/` | Admin (butcher ops) |
| `scripts/` | `migrate-from-sarh.mjs`, phase3 E2E |
| `docs/` | Architecture + extraction + hardening |
| `docker-compose.yml` + prod/vps/nginx variants | Isolated compose |
| `nginx/` | Hostinger path snippets |
| `.env.example` / `.env.development.example` / `.env.production.example` | Templates only |
| `backend-nest/prisma/schema.prisma` | Prisma schema |
| `app/app.json` / `app/eas.json` | Expo identity |

**No root `package.json`.** Each package has its own (`backend-nest`, `app`, `butcher-dashboard`, `admin-panel`). That is the workspace layout.

**No accidental duplicate trees** `backend/`, `dashboard/`, `mobile/`.

No live `.env` / `.env.local` / `.env.production` files on disk.

---

## 3. Architecture

```
Customer Expo (app/)                 butcher-dashboard (Next :3003)
        │                                      │
        └──────── Malahem Nest API :3001 ──────┘
                     │
          ┌──────────┼──────────┐
          ▼          ▼          ▼
   Postgres        Redis      Socket
   sarh_butcher    :6380      :3002
   (never sarouh)  butcherapp:
                     │
                   Worker
```

`AppModule` registers: Auth, Users, Settings, Notifications, Payments, Integrations, **Daftra**, Butchers, Applications, Messages, Upload, Admin, Health, Support, Banners, Queue, Gateway.

It does **not** import Listings, Posts, Livestreams, Feed, or social modules.

---

## 4. Independence

| Layer | Independent? | Evidence |
| ----- | ------------ | -------- |
| DB | Yes | `MALAHEM_DATABASE_URL` aliases to `DATABASE_URL`. Target name `sarh_butcher`. Prisma `env("DATABASE_URL")`. Migration script refuses dest `sarouh`. |
| Redis | Yes | `MALAHEM_REDIS_URL` → `REDIS_URL`. Dev: `127.0.0.1:6380`. Loopback `:6379` **fail-fast** (already hardened). |
| JWT | Yes | `iss = malahm-sarh`. Sarh JWT rejected (401) in prior live E2E. |
| API | Yes | Local `:3001`. Leftover `/api/listings` `/posts` `/livestreams` `/feed` are 404. |
| Worker | Yes | Same Redis prefix `butcherapp:`. Same `sarh_butcher`. |
| Dashboard | Yes | `NEXT_PUBLIC_API_URL` default `http://127.0.0.1:3001`. Next rewrite `/api/*` → Malahem. |
| Mobile | Yes | Slug `malahm-sarh`, scheme `malahm`, package `com.sarh.butcher`. Dev API localhost:3001. Prod path is `/api/butcher` on the shared host, not Sarh Nest `/api`. |

---

## 5. Authentication

**Customer (mobile):**

```
Phone → OTP → verify → customer account (internal customerId) → JWT (iss=malahm-sarh) → Malahem API
```

`POST /api/auth/send-otp` and `verify-otp` exist. Refresh + logout exist. Phone uniqueness is enforced.

`POST /api/auth/login` (username/password) remains for **butcher dashboard / admin** accounts. That is not the customer primary path.

**Butcher dashboard:** existing login → Malahem `/api/auth/login` → cookie `butcher_token` verified with `BUTCHER_JWT_SECRET \|\| JWT_SECRET` and `iss=malahm-sarh`. Dashboard was **not** rebuilt.

---

## 6. Payments

Payment-first checkout lives on this backend:

- `POST /api/butchers/checkout`
- NI redirect: `APP_URL/payment/result` (not `/api/payment/result`)
- Deep link: `malahm://payment/result`
- New merchant refs: `MALAHM-` (legacy `SFAT-` still accepted)
- Commission: 10% on delivered, ledger `BOC-{orderId}`

Production N-Genius was **not** used. Architecture was **not** changed in this bootstrap pass.

---

## 7. Daftra

Present in the **existing** stack:

- Backend: `DaftraModule` in `AppModule`, routes under `/api/butchers/daftra`
- Dashboard: existing Daftra screens/settings (not replaced)
- OAuth default: `http://localhost:3001/api/butchers/daftra/oauth/callback`
- Credentials: placeholders only. No Sarh Daftra config copied.

---

## 8. Secrets

| Check | Result |
| ----- | ------ |
| Live `.env` in tree | **NOT FOUND** |
| Production secrets copied | **No** |
| Values printed this pass | **No** |
| Templates (`*.example`) | Placeholders / `change-me` only |
| `.gitignore` | Updated so real `.env*` cannot be committed; `*.example` and `.env.render.example` stay trackable |

Also ignored: `node_modules/`, `.next/`, `.expo/`, `dist/`, `build/`, `coverage/`, `logs/`, `*.pem`, `*.key`.

---

## 9. Tests

Run this pass (no tests rewritten to force green):

| Check | Result |
| ----- | ------ |
| `npx prisma validate` | pass |
| `npx nest build` | pass |
| Dashboard `tsc --noEmit` | pass |
| Dashboard `next build` | pass |
| Dashboard Jest | **14 suites / 59 tests pass** |
| Mobile `tsc --noEmit` | pass |
| Mobile Jest | **84 suites / 870 tests pass** |
| Backend domain Jest (butcher/auth/payments/daftra/redis) | **47 suites / 368 tests pass** |

Prior live E2E (same tree, not re-run this bootstrap-only pass): **56/56**.

---

## 10. Remaining Issues

### P0
None for bootstrap. GitHub is empty by design until the operator commits/pushes.

### P1
- First GitHub commit/push not done (explicitly forbidden here).
- Production credentials do not exist yet (correct).
- Worker/socket should be restarted on the next boot so they load Redis fail-fast (they already use `:6380`).

### P2
- No root workspace `package.json` (each package is independent).
- Shared hostname `/api/butcher` is an ops choice, not a Sarh process dependency.

### Deferred
- Leftover Prisma Listing/Post/LiveStream models (0 rows) — keep.
- Leftover Expo screens / `safat` localStorage keys — keep.
- `expo-doctor` SDK patch drift — post-release.

---

## Gitignore change this pass

Updated `/home/ubuntu/sarh-butcher/.gitignore` so a future initial commit cannot pick up secrets or build artifacts. Example env files remain addable.

---

## Verdict

Local Malahem project is complete, independent, and pointed at the empty GitHub remote.

```
READY FOR INITIAL COMMIT
```

The operator still has to: review the uncommitted hardening files, `git add` (examples only, never `.env`), commit, then push. **This agent did not commit or push.**
