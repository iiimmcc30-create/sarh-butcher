# MALAHEM SARH — FINAL PRODUCTION DEPLOYMENT REPORT

## 1. Production URL

`https://malahem.sarhsa.online`

DNS: `malahem.sarhsa.online → 92.113.25.157`. Apex `sarhsa.online` was not modified.

## 2. HTTPS status

LIVE. Dedicated Let's Encrypt certificate `CN=malahem.sarhsa.online` (expires 2026-12-18).

Verified independently:

| Host | Check | Result |
|------|--------|--------|
| `https://malahem.sarhsa.online/` | 200 | Customer Expo web (not admin/butcher) |
| `https://malahem.sarhsa.online/api/health` | 200 | Malahem API |
| `https://malahem.sarhsa.online/api/health/ready` | 200 | db/redis/queue/worker ready |
| `https://malahem.sarhsa.online/admin/login` | 200 | Malahem admin |
| `https://malahem.sarhsa.online/butcher/login` | 200 | Malahem dashboard |
| `https://malahem.sarhsa.online/socket.io/?EIO=4&transport=polling` | 200 | Malahem socket |
| `https://sarhsa.online/api/health` | 200 | Sarh unchanged |
| `https://sarhsa.online/` | 200 | Sarh unchanged |

TLS names are independent: Malahem cert SAN is only `malahem.sarhsa.online`; Sarh cert SAN remains `sarhsa.online` / `www.sarhsa.online`.

## 3. Infrastructure

| Piece | Status |
|-------|--------|
| Server | Hostinger `92.113.25.157` `/opt/sarh-butcher` |
| Compose | `sarh-butcher` |
| Network | `sarh-butcher_malahem_internal` only. Not on `sarh_internal`. |
| PostgreSQL | `sarh-butcher-butcher-postgres-1` — database `sarh_butcher` |
| Redis | `sarh-butcher-butcher-redis-1` — prefix `butcherapp:` |
| API | `127.0.0.1` + `172.20.0.1:3101` — production |
| Worker | Up — `butcherapp:worker:heartbeat` present |
| Socket | `127.0.0.1` + `172.20.0.1:3102` |
| Dashboard | `127.0.0.1` + `172.20.0.1:3103` |
| Admin | `127.0.0.1` + `172.20.0.1:3100` |
| Customer web | `127.0.0.1` + `172.20.0.1:3104` — Expo static export. Root `/` proxies here. |
| Public edge | Existing Sarh nginx (`:80/:443`) with SNI vhost only. Upstreams are host publishes on `172.20.0.1`, not Sarh `api`/`socket` names. |

Sarh nginx was recreated only to remount the combined edge files. Sarh application containers were not restarted.

## 4. Database migration status

48 Prisma migrations, schema up to date. Fresh `sarh_butcher`. `scripts/migrate-from-sarh.mjs` was not executed.

## 5. Redis

Independent Malahem Redis. Prefix `butcherapp:`. Sarh Redis scan of `butcherapp*` is empty.

## 6. JWT

Issuer `malahm-sarh`.

| Token | Result |
|-------|--------|
| Malahem JWT | 200 `/api/admin/auth/me` |
| `iss=sarh` | 401 |
| wrong issuer | 401 |

## 7. N-Genius

Same Sarh account credentials (including `NI_BASIC_AUTH` / `NI_REALM` copied on the server). Merchant references `MALAHM-*`.

Public callback: `https://malahem.sarhsa.online/payment/result`.

Safest live verification performed: hosted checkout session created (`checkoutUrl` on `paypage.ksa.ngenius-payments.com`), `orderId=MALAHM-E0F0E989-MU8BA27M`, then checkout abandoned. No card capture. Unsigned webhook returns 401.

No new N-Genius account. No extra outlet created.

## 8. Twilio

Shared Sarh account. `DEV_OTP=false`. Invalid phone `POST /api/auth/send-otp` returns 400. No live SMS was sent (no dedicated test handset provided).

## 9. Firebase

Project `alsafat-d5f63` now includes Android clients `com.safat.app`, `com.sarh.app`, and `com.sarh.butcher` (`1:720837081602:android:1174ae8ca473f6f0e1051b`). Operator-supplied `google-services.json` is placed at `app/google-services.json` and `app/android/app/google-services.json` (gitignored, not committed). `app.json` points at `android.googleServicesFile`, and the `com.google.gms.google-services` Gradle plugin is enabled.

Sarh Android identity was not modified. Server Admin SDK is still blocked: `/opt/sarh-butcher/secrets/firebase-private-key.pem` is a 29-byte stub (`0600`), so worker init fails with `Invalid PEM`. No private key was written or fabricated.

Remaining operator action:

1. Place the real Admin SDK private key at `/opt/sarh-butcher/secrets/firebase-private-key.pem` (`0600`).

## 10. Cloudinary

Shared account. `CLOUDINARY_FOLDER=sarh-butcher`. `STORAGE_PROVIDER=cloudinary`.

## 11. Daftra

Existing per-butcher model unchanged. Production redirect set to `https://malahem.sarhsa.online/api/butchers/daftra/oauth/callback`. OAuth client id/secret are empty on this server (same as before). Worker starts with production configuration.

## 12. Dashboard / admin

Rebuilt with `NEXT_PUBLIC_API_URL=https://malahem.sarhsa.online`.

- `https://malahem.sarhsa.online/butcher` → login 200; bundle contains the Malahem origin
- `https://malahem.sarhsa.online/admin` → login 200; bundle contains the Malahem origin
- Public-domain logins: `malahem_admin`, `malahem_butcher` → 200

## 13. Mobile EAS build

Configured:

- package `com.sarh.butcher`
- slug `malahm` / project `@sarh000/malahm` (`8e9f6143-e3cd-4ad9-97de-9b96b3dd473b`)
- production API `https://malahem.sarhsa.online`
- FCM `google-services.json` for `alsafat-d5f63` + `com.sarh.butcher` (gitignored)

Previous production AAB without FCM: `3f6e0d16-d622-49df-9f55-165be4a3ca76`. A FCM-enabled production rebuild is the current step.

Do not use `com.sarh.app` or `@sarh0/safat`.

## 14. Customer smoke

| Step | Result |
|------|--------|
| register / OTP | Path live (`DEV_OTP=false`); invalid phone 400. Full SMS register not run (no test number). Seeded `malahem_customer` used for the rest. |
| login | 200 |
| browse butchers | 200 (shop `54804a5a-…`) |
| product | 200 |
| cart / checkout | Payment-first checkout 201 |
| payment | Hosted NI session created; abandoned; no capture |
| order / tracking | No paid order (by design — no real charge) |

## 15. Butcher smoke

login 200 → dashboard `GET /api/butchers/me` 200 → products 200 → orders 200. Status update not exercised (no live paid order).

## 16. Admin smoke

login 200 → butcher management 200 → order management 200 → `PATCH commissionExempt=true` 200. Commission listing is delivered-order-only (empty, no delivered orders).

## 17. Payment smoke

| Check | Result |
|-------|--------|
| `MALAHM-*` reference | `MALAHM-E0F0E989-MU8BA27M` |
| payment initiation | 201 + NI paypage URL |
| callback route | `/payment/result` on Malahem HTTPS |
| verification / finalization / stock | Not completed — session abandoned, no capture |
| notification | FCM Admin key missing (see Firebase) |
| duplicate callback | Unsigned webhook 401 |
| `needsReconciliation` / `capturedAfterCancel` | Unchanged in code; not live-exercised without a late capture |

## 18. Realtime

Socket.IO engine handshake 200 on `https://malahem.sarhsa.online/socket.io`. WebSocket upgrade headers configured on the Malahem SNI vhost.

## 19. Notifications

Mobile FCM client config is in place (`com.sarh.butcher` in `alsafat-d5f63`). Server path is still Firebase Admin via `/run/secrets/firebase-private-key.pem`; init currently fails on the stub PEM.

## 20. Security

- Malahem JWT accepted; Sarh issuer and wrong issuer 401
- DB `sarh_butcher`
- Redis independent, prefix `butcherapp:`
- Network `sarh-butcher_malahem_internal` only
- CORS exact origin `https://malahem.sarhsa.online`; Sarh apex gets no ACAO
- No production secret committed

## 21. Remaining issues

1. **Firebase Admin key** — replace the 29-byte stub PEM on the VPS. Android client `com.sarh.butcher` is registered.
2. **EAS production AAB with FCM** — rebuild after placing `google-services.json`.
3. **Live OTP SMS** — needs an operator test MSISDN.
4. **Paid-order / late-capture path** — not run; would be a real charge.
5. **Daftra OAuth client** — empty on this host; redirect URL is production-ready.

## 22. Git commit / push

Pushed to `iiimmcc30-create/sarh-butcher` branch `cursor/p5-production-deploy-48ae`:

- `a73a4e6` — prior isolation
- `9de2211` — production domain/validator/EAS URLs/SNI
- follow-up commit — live TLS vhost, Sarh-edge overlay, Cloudinary/NI apply-script fixes, this report

Sarh repository was not modified.
