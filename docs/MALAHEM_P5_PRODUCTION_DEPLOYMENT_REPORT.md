# MALAHEM SARH — PRODUCTION DEPLOYMENT REPORT

## 1. Deployment Status

`BLOCKED`

Independent Malahem infrastructure is running on the existing Hostinger VPS, isolated from Sarh runtime. Public HTTPS and the remaining customer/payment smoke path stop at DNS/TLS because no Malahem production domain exists.

## 2. Production URL

**Not published.**

Required operator value:

```text
MALAHEM_DOMAIN
```

DNS must point that hostname at VPS `92.113.25.157`. Do not use `sarhsa.online`, `localhost`, Railway, or Render.

Internal (VPS loopback only):

- API `http://127.0.0.1:3101`
- Socket `http://127.0.0.1:3102`

## 3. Infrastructure

| Piece | Status |
|-------|--------|
| Server | Hostinger `srv1922732` / `92.113.25.157` — `/opt/sarh-butcher` |
| Docker | Compose project `sarh-butcher` |
| Network | `sarh-butcher_malahem_internal` only. Detached from `sarh_internal`. |
| PostgreSQL | `sarh-butcher-butcher-postgres-1` — database `sarh_butcher` (not `sarouh`) |
| Redis | `sarh-butcher-butcher-redis-1` — prefix `butcherapp:`. Sarh Redis has **zero** `butcherapp*` keys. |
| API | `127.0.0.1:3101` — health/ready OK |
| Worker | Up — `butcherapp:worker:heartbeat` present |
| Socket.IO | `127.0.0.1:3102` — `{status:ok,service:socket}` |
| Nginx | Sarh nginx still owns `:80/:443`. Malahem nginx **not** bound to 80 (would take down Sarh). Internal edge reserved on `127.0.0.1:3180` after domain. |
| Dashboard / admin images | Not rebuilt on this host (need `MALAHEM_DOMAIN` for `NEXT_PUBLIC_*`). Admin/butcher **API** smoke passed. |

Sarh production `https://sarhsa.online` remained HTTP 200 after the isolation recreate.

## 4. Database

- Name: `sarh_butcher`
- `npx prisma migrate status`: **48 migrations, schema up to date**
- Clean launch database (no Sarh customer import)
- After smoke seed: 1 test butcher, 1 test product, admin + butcher users
- `scripts/migrate-from-sarh.mjs` **not executed**

## 5. External Integrations

### N-Genius

Same Sarh account credentials copied **on the server only** (`NI_API_KEY`, `NI_OUTLET_ID`, `NI_WEBHOOK_SECRET`). New merchant prefix remains `MALAHM-*`. Public callback cannot be registered until `MALAHEM_DOMAIN` exists (`https://<MALAHEM_DOMAIN>/payment/result`). Separate outlet was **not** created (needs NI portal). Controlled live payment **not executed**.

### Twilio

Same Sarh Account SID / Auth Token / Verify Service copied on the server. `DEV_OTP=false`. Invalid-phone request returns the Saudi format error (real Verify path). No customer SMS was sent.

### Firebase

Project id + client email copied. `FIREBASE_PRIVATE_KEY` **not** written to `.env` (multiline would corrupt the file). Android app `com.sarh.butcher` was **not** registered in the Firebase console (needs operator permission). No `google-services.json` committed.

### Cloudinary

Same account keys copied. Folder `CLOUDINARY_FOLDER=sarh-butcher`.

### Daftra

OAuth client id/secret copied where present. Per-butcher model unchanged. Worker is running. Redirect is loopback until domain exists.

## 6. Authentication

| Check | Result |
|-------|--------|
| OTP | Production Verify configured; `DEV_OTP=false`; invalid phone rejected |
| JWT issuer | `malahm-sarh` |
| Admin login | `200` (`malahem_admin`) |
| Butcher login | `200` (`malahem_butcher`) |
| Refresh / logout | Same endpoints as Sarh Malahem module (not re-exercised this run beyond login) |
| Malahem JWT (`iss=malahm-sarh`) | `200` on `/api/admin/auth/me` |
| Wrong issuer (`iss=sarh`) | `401 invalid_token` |
| JWT secrets vs Sarh | Different hashes — not reused |

## 7. Smoke Tests

| Area | Result |
|------|--------|
| Customer browse | `GET /api/butchers?country=SA` → 1 butcher; products load |
| Customer register/OTP/paid checkout | **Blocked** — no public app URL / no payment callback host |
| Butcher login | Pass |
| Admin login / dashboard stats | Pass (API) |
| Commission exemption API | Not re-verified on the **running VPS image** (older image than this tree). Local DTO + admin checkbox are in source. |
| Payment | **Blocked** — no public `MALAHEM_DOMAIN` callback |
| Order / notification / realtime E2E | Socket health pass; full order/push path not run (empty paid flow) |

## 8. Mobile Build

| Item | Value |
|------|--------|
| Package | `com.sarh.butcher` |
| Slug | `malahm` |
| Build ID | **not created** |
| Status | EAS production build not started (no domain + Firebase Android config + EAS credentials on this runner) |
| Artifact | none |

Legal/info screens no longer link to `sarhsa.online`. Privacy URL is empty until `EXPO_PUBLIC_APP_URL` is set.

## 9. Security

| Check | Status |
|-------|--------|
| Independent DB | Yes — `sarh_butcher` |
| Independent Redis | Yes — dedicated container; no Malahem keys on Sarh Redis |
| Independent JWT | Yes — different secrets, issuer `malahm-sarh` |
| Independent runtime network | Yes — `malahem_internal` only |
| Sarh JWT accepted | No (wrong issuer rejected) |
| Sarh filesystem required | No |
| CORS wildcard | Not set for Sarh origin on health |
| Secrets in Git | No (server `/opt/sarh-butcher/.env` mode 600) |

## 10. Remaining Issues

| Severity | Issue |
|----------|--------|
| P0 | **`MALAHEM_DOMAIN` missing.** Public HTTPS, payment callback, CORS production origins, Expo/EAS URLs, Daftra OAuth redirect, and Play privacy URL all wait on this single DNS value. |
| P1 | Firebase Android app `com.sarh.butcher` + private key file + `google-services.json` not installed. |
| P1 | N-Genius public webhook/redirect not pointed at Malahem; optional dedicated outlet not created in the NI portal. |
| P2 | Independent dashboard/admin Docker images not built (need public API URL). |
| P2 | `NODE_ENV` left `staging` so production env validator does not refuse loopback origins before DNS exists. |
| P3 | Sentry not configured for Malahem identity. Monitoring optional. |
| P3 | Leftover Expo listing screens still on disk (not default boot). |

## 11. Git

Source changes for isolation, legal cleanup, and this report live on branch `cursor/p5-production-deploy-48ae` in `iiimmcc30-create/sarh-butcher`. VPS `/opt/sarh-butcher` is a deploy tree, not a git checkout.

## 12. Final

BLOCKED BY OPERATOR INPUT

Required:

```text
MALAHEM_DOMAIN
```

Create a DNS A record for that hostname → `92.113.25.157`. Do not use `sarhsa.online`. After it exists, TLS, public nginx, production `NODE_ENV`, payment callback, and the remaining customer/payment smokes can continue on the same isolated stack.

```text
MALAHEM PRODUCTION DEPLOYMENT: BLOCKED
SARH DATA MIGRATION: NOT REQUIRED
SARH REPOSITORY MODIFIED: NO
DATABASE: INDEPENDENT
REDIS: INDEPENDENT
JWT: INDEPENDENT
EXTERNAL PROVIDERS: SHARED WHERE SUPPORTED
```
