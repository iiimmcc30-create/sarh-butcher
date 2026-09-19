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
- New PostgreSQL database `sarh_butcher` (default local port **5433**)
- New Redis (default local port **6380**)
- Redis/BullMQ key prefix `butcherapp:`
- Independent `JWT_SECRET` / `JWT_REFRESH_SECRET`
- Independent N-Genius outlet and webhook URL
- Deep links `malahm://` and package `com.sarh.butcher`

See `EXTRACTION.md` for KEEP/ADAPT/REMOVE decisions.
