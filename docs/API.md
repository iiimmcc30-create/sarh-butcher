# API surface (butcher)

Prefix: `/api`  
Auth: JWT unless `@Public` / `@OptionalAuth`  
Butcher vs customer: object-level (`Butcher.userId`), not `@Roles('BUTCHER')` on marketplace routes.

## Marketplace / butcher

See SARH `ButchersController` — copied unchanged:

- `GET /butchers` list (optional auth, Redis list cache)
- `POST /butchers` 403 application_required
- Dashboard: `/butchers/stats|dashboard|products/mine|customers|reports`
- Products / offers CRUD
- `POST /butchers/checkout` payment-first (`RateLimit('payment')`)
- `POST /butchers/checkout/:id/abandon`
- `POST /butchers/orders` legacy unpaid
- Orders GET/PUT, stories, favorites, reviews
- `GET /butchers/:id/chat-access` always denied
- `GET /butcher-banners`
- `/butchers/daftra/*`
- `/butcher-applications/*` and public `/join`

## Payments (same architecture)

- `POST /payments/initiate` — independent DB; must only accept butcher types in a later harden
- `POST /payments/webhook` — **new URL + secret**
- `POST /payments/:id/sync`
- `GET /payment/result` `/payment/cancel` — deep link `malahm://`

## Auth

Independent issuer. SARH access tokens must be rejected (different secret).
