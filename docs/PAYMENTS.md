# Payments — extract, do not redesign

Copied from SARH:

1. Payment-first: `ButcherCheckout` + reservations + `referenceType=butcher_checkout` → NI → `fulfillPaidCheckout`
2. Legacy: unpaid `ButcherOrder` + `butcher_order`
3. Idempotency: pending payment unique, webhook event table, checkout lock
4. Commission ledger 10% on delivered (`order_commission`), plan exemption still via `SubscriptionEntitlementService` (REVIEW)

## Reconfigure (mandatory before any live charge)

- New N-Genius outlet / API key
- New `NI_WEBHOOK_SECRET`
- New webhook URL on **this** API only — never dual-write with SARH
- New return/cancel hosts
- `APP_DEEP_LINK_SCHEME=malahm`
- `APP_ANDROID_PACKAGE=com.sarh.butcher`

Phase 1: local/dev only. No production webhook cutover.
