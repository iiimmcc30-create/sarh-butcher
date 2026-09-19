# Malahem first-launch smoke-test matrix

Assumes a **blank** production database after `prisma migrate deploy`:

```
customers = 0
butchers = 0
orders = 0
products = 0
```

No Sarh-imported rows. Create the first butcher and product **during** this matrix.

Run against the Malahem API only.  
Live payment and live SMS: **PRODUCTION — RUN ONLY AFTER EXPLICIT APPROVAL**.

Base URL: `https://<MALAHEM_PRODUCTION_DOMAIN>` (or `http://127.0.0.1:3001` locally).

---

## Infrastructure

| # | Case | How | Expected |
| - | ---- | --- | -------- |
| I1 | API alive | `GET /api/health` | 200, `checks.db` true |
| I2 | Ready | `GET /api/health/ready` | 200 — DB + Redis + worker |
| I3 | Redis | ready `redis_cache` / `redis_session` | true (not host `:6379`) |
| I4 | Worker | ready `worker` + `queue` | true |
| I5 | Socket | socket `/health` | `{ status: 'ok', service: 'socket' }` |
| I6 | Empty directory | `GET /api/butchers?sort=rating` | 200, empty list |

---

## Customer

| # | Case | How | Expected |
| - | ---- | --- | -------- |
| C1 | OTP request | `POST /api/auth/send-otp` `+9665…` | 200; not `dev_mode` |
| C2 | OTP verify | `POST /api/auth/verify-otp` | JWT `iss=malahm-sarh` |
| C3 | Registration | signup OTP + profile | first customer created |
| C4 | Login | login OTP | access + refresh |
| C5 | Refresh | refresh | new access token |
| C6 | Logout | logout | next auth 401 |

`DEV_OTP=true` is SAFE TO RUN LOCALLY only.

---

## Marketplace (create first catalog)

| # | Case | How | Expected |
| - | ---- | --- | -------- |
| M0 | Create first butcher | dashboard / apply / admin | butcher row exists |
| M1 | Create first product | butcher products API | product row exists |
| M2 | Customer sees butcher | `GET /api/butchers?sort=rating` | 200, ≥1 |
| M3 | Customer sees store | `GET /api/butchers/:id` | 200 |
| M4 | Customer sees product | products query | 200 |
| M5 | Empty checkout | `POST /api/butchers/checkout` empty | 4xx |
| M6 | Checkout | payment-first checkout | checkout id |

---

## Payment

| # | Case | How | Expected |
| - | ---- | --- | -------- |
| P1 | Initialize | checkout → NI | merchant ref `MALAHM-` |
| P2 | Redirect | hosted page | `https://<MALAHEM_PRODUCTION_DOMAIN>/payment/result` |
| P3 | Callback | `GET /payment/result` | Nest — not `web:80` |
| P4 | Cancel | `GET /payment/cancel` | Nest |
| P5 | Webhook | `POST /api/payments/webhook` | signed update |
| P6 | Order status | butcher/customer order | paid / pending as designed |
| P7 | Invalid callback | bad id / signature | 4xx |

No leftover `SFAT-` rows on a fresh DB. Compat lookup may stay in code.

---

## Dashboard

| # | Case | How | Expected |
| - | ---- | --- | -------- |
| B1 | First butcher login | username/password → `butcher_token` | `/butcher` |
| B2 | Dashboard data | `GET /api/butchers/dashboard` | counts (may be zeros) |
| B3 | Product management | create/update | 200 |
| B4 | Order management | after a paid order | status transitions |
| B5 | Unauthorized | no cookie | `/butcher/login?reason=session` |

---

## Admin

| # | Case | How | Expected |
| - | ---- | --- | -------- |
| A1 | First admin login | configured admin creds | `admin_token` |
| A2 | Unauthorized | no cookie | `/admin/login` never root `/login` |

---

## Notifications

| # | Case | How | Expected |
| - | ---- | --- | -------- |
| N1 | FCM register | device token `com.sarh.butcher` | stored |
| N2 | Push | `FIREBASE_*` set | send or skip invalid token |
| N3 | Unset Firebase | no project id | worker does not crash |

---

## Security

| # | Case | How | Expected |
| - | ---- | --- | -------- |
| S1 | Invalid JWT | garbage Bearer | 401 |
| S2 | Sarh JWT | `iss=sarh` | 401 |
| S3 | Forged issuer | wrong secret | 401 |
| S4 | Unauthorized dashboard | no session | login |
| S5 | Unauthorized admin | customer JWT | 401 / redirect |
| S6 | CORS Sarh origin | `Origin: https://sarhsa.online` | rejected |
