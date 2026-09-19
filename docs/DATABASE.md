# Database — independent PostgreSQL

**Forbidden:** SARH production (or staging) `DATABASE_URL`.

Local default: Postgres 18 on **localhost:5433**, database `sarh_butcher`.

## Model classification (from SARH schema copy)

### BUTCHER_CORE
`Butcher`, `ButcherProduct`, `ButcherOrder`, `ButcherOrderItem`, `ButcherCheckout`, `ButcherCheckoutReservation`, `OrderTimeline`, `OrderStatusAudit`, `OrderNumberSequence`, `ButcherApplication`, `ButcherApplicationDocument`, `ButcherApplicationTimelineEvent`

### BUTCHER_SUPPORT
`ButcherOffer`, `ButcherStory`, `ButcherReview`, `ButcherFavorite`, `ButcherMarketBanner`, `ButcherDaftraIntegration`, `ButcherDaftraProduct`, `MessageThread`, `Message` (chat disabled but schema kept)

### PAYMENT
`Payment`, `IntegrationOrder`, `IntegrationWebhookEvent`

### AUTH
`User`, `UserSession`, `UserDeviceToken`

### INTEGRATION
Daftra models (above), Cloudinary is not a table

### SARH_SHARED (still in copied schema)
`Plan`, `PlanFeature`, `Subscription`, `Notification`, `AppSetting`, `SupportTicket*`

### SARH_ONLY (copied schema leftover — do not migrate data)
`Listing*`, `Post*`, `Story` (user stories), `Live*`, `Follow`, `Activity`, `UserReview`, `AccountVerification*`, `Service`, `Knowledge*`, `EditorialStory`, `Feed*`, `ExploreSarhBanner`, `ContentSection*`

### UNKNOWN
`Faq` (has `BUTCHERS` category) — keep until support decision.

## IDs

If **CLEAN DATABASE**: generate new UUIDs; no production continuity.

If **SELECTIVE MIGRATION** (later, not this phase):

| Entity | Keep UUID? | Why |
|---|---|---|
| User (butcher owners + customers who ordered) | Yes | FK graph |
| Butcher / products / orders / checkouts | Yes | payment + inventory |
| Payment / IntegrationOrder | Yes | N-Genius reconciliation — **only if NI outlet is migrated**, which we will **not** do. Prefer new outlet + no in-flight payments. |
| Daftra secrets | Re-encrypt | New `SECRETS_ENCRYPTION_KEY` |

## Options

### CLEAN DATABASE (Phase 1 default)

- `prisma migrate deploy` on empty `sarh_butcher`
- Shops re-apply via `/join`
- Customers re-register
- Daftra reconnect
- **Safest. Use this.**

### SELECTIVE MIGRATION (not executed)

1. Export butcher graph from SARH read-replica  
2. Transform: drop SARH_ONLY FKs; re-encrypt Daftra  
3. Load into `sarh_butcher`  
4. Validate inventory identity and pending-checkout unique  
5. Do **not** dual-write NI webhooks  
6. Rollback = SARH remains source of truth  

Phase 1 does **not** copy production rows.
