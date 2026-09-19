# Architecture — ملاحم سرح

```
BUTCHER MOBILE APP (ملاحم سرح)
        │
        ▼
   BUTCHER API (NestJS)
        │
 ┌──────┼──────────────┐
 ▼      ▼              ▼
Postgres Redis      External
 │        │         N-Genius / Daftra / Cloudinary / Twilio
 │        └── Worker + Socket.IO (own processes)
 │
Butchers / Products / Checkouts / Orders / Users / Payments
```

## Processes

| Process | `SERVICE_MODE` | Port | Notes |
|---|---|---|---|
| API | `api` | 3001 | Includes in-process unpaid checkout expiry |
| Worker | `worker` | — | Notifications, push, email, Daftra cron |
| Socket | `socket` | 3002 | Rooms prefixed `butcherapp:user:{id}` |
| Dashboard | Next | 3003 | `/butcher` |
| Admin | Next | 3000 | butcher operations |

## Isolation from SARH

- New compose project name: `sarh-butcher`
- New PostgreSQL database `sarh_butcher` (default local port **5433**; Phase 2 local verify used isolated `sarh_butcher` on 5432 because Docker was unavailable)
- New Redis (default local port **6380**)
- Redis/BullMQ key prefix `butcherapp:`
- Independent `JWT_SECRET` / `JWT_REFRESH_SECRET` / `JWT_ISSUER=malahm-sarh`
- Independent N-Genius outlet and webhook URL
- Deep links `malahm://` and package `com.sarh.butcher`

## Public API on the shared host

Hostname stays `https://sarhsa.online`. SARH `/api/` is untouched.

| Role | URL |
|---|---|
| Public canonical | `https://sarhsa.online/api/butcher/butchers/checkout` |
| Public compat (mobile `${API_BASE}/api/...`) | `https://sarhsa.online/api/butcher/api/butchers/checkout` |
| Nest internal | `http://butcher-api:3001/api/butchers/checkout` |

Nginx (`nginx/butcher-api-location.conf`) is the only rewrite. Nest controllers keep `setGlobalPrefix('api')`. `location ^~ /api/butcher/` does not match SARH `/api/butchers` or `/api/butcher-applications`.

See `EXTRACTION.md` for KEEP/ADAPT/REMOVE decisions.
