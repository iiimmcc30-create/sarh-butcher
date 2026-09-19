# Extraction log — Phase 1

Source: `iiimmcc30-create/sarh.app` at commit `2b1bce4e8ccf94c1b52d58dfb56452f9b5203a06`  
Method: **COPY → ADAPT → VERIFY** (never MOVE/DELETE from SARH)  
SARH working tree was not reset, cleaned, or committed.

## Classification legend

- **KEEP** — butcher domain, copied with behavior intact
- **ADAPT** — required, SARH coupling removed or isolated
- **REMOVE** — SARH-only; not part of the butcher product (still present in some copied trees until a later phase if compile depends on it)
- **REPLACE** — same capability, new credentials/URLs/identity

## Copied packages

| Tree | Decision | Notes |
|---|---|---|
| `backend-nest/src/butchers/` | KEEP | Domain core |
| `backend-nest/src/butcher-applications/` | KEEP | Join/KYC |
| `backend-nest/src/butcher-banners/` | KEEP | Market banners |
| `backend-nest/src/integrations/daftra/` | ADAPT | New encryption key + redirects |
| `backend-nest/src/payments/` | ADAPT | Same architecture; new NI outlet |
| `backend-nest/src/auth/` | ADAPT | Independent issuer/secrets |
| `backend-nest/src/queue/` | ADAPT | Prefix + drop SARH-only jobs when unused |
| `backend-nest/src/gateway/` | ADAPT | Room prefix |
| `backend-nest/src/upload/` + `shared/lib/storage.ts` | ADAPT | Folder `sarh-butcher` |
| `butcher-dashboard/` | KEEP | Operator UI |
| `app/app/butchers/` + join + payment | KEEP/ADAPT | New Expo identity; home = butcher market |
| `admin-panel/` butcher pages | ADAPT | SARH livestock admin routes still in tree — REMOVE later |

## SARH domain leftover in copied backend (REMOVE / later strip)

These modules were copied because Admin/Payments/Auth still import them. They are **not** the butcher product. Do not wire them in the long-term `AppModule` surface.

| Module | Class | Action |
|---|---|---|
| `listings/` | livestock marketplace | REMOVE |
| `posts/` | social feed | REMOVE |
| `livestreams/` | live | REMOVE |
| `official-services/` | MEWA | REMOVE |
| `feed-suppliers/` | feed catalog | REMOVE |
| `explore-sarh-banners/` | SARH home CMS | REMOVE |
| `editorial-stories/` | SARH home | REMOVE |
| `knowledge/` | knowledge base | REMOVE |
| `fees/` | listing fees | REMOVE |
| `market-categories/` | listings | REMOVE |
| `home-explore/` | SARH home | REMOVE |
| `queue` `FEE_CHECKS` | listing fees | REMOVE |
| `queue` `SUBSCRIPTIONS` | SARH plans cron | REVIEW — commission exemption uses `SubscriptionEntitlementService` |

## ADAPT decisions executed in Phase 1

| Item | Change |
|---|---|
| Expo identity | `com.sarh.butcher`, slug `malahm-sarh`, scheme `malahm`, name `ملاحم سرح` |
| EAS projectId | **removed** (do not reuse SARH `fc410a8a-...`) |
| Firebase files | **not copied** |
| Deep links | `APP_DEEP_LINK_SCHEME=malahm` |
| Cloudinary folder default | `sarh-butcher` (not `safat`) |
| Redis prefix | `REDIS_KEY_PREFIX=butcherapp:` applied in cache + rate-limit + heartbeat |
| Worker heartbeat | `butcherapp:worker:heartbeat` |
| Queue names | prefixed `butcherapp:` |
| Socket rooms | `butcherapp:user:{id}` |
| Docker | project `sarh-butcher`, DB `sarh_butcher`, ports 5433/6380 |
| JWT | same code path; **new secrets required** — tokens from SARH are invalid here |
| Boot navigation | authenticated/guest market entry → `/butchers` not `/(tabs)` |

## Phase 1 test evidence (local)

| Suite | Result |
|---|---|
| Prisma `validate` | pass |
| `backend-nest` butchers + banners + heartbeat + payment-redirect | 12 suites / 117 tests pass |
| `backend-nest` payments + Daftra + applications + commissions | 35 suites / 283 tests pass |
| `butcher-dashboard` | 14 suites / 58 tests pass |
| Expo butcher checkout/directory/join | 5 suites / 28 tests pass |
| Admin butcher docs + Daftra panel | 2 suites / 3 tests pass |

Not run in Phase 1: full `nest build` against slim AppModule, E2E against live NI, Prisma migrate on a real empty DB, Expo device, production webhook.

## Unresolved (next phase)

1. GitHub remote `iiimmcc30-create/sarh-butcher` — create permission denied for this agent token (403). Local repo is ready to push.
2. Slim Prisma: drop SARH_ONLY models after Admin/Payments no longer import them.
3. Slim `AppModule` to butcher imports only and keep `nest build` green.
4. Slim admin-panel nav to butcher pages only.
5. Remove Expo SARH tabs/listings screens once butcher-only navigation has no leftover imports.
6. Replace `SubscriptionEntitlementService` with a local butcher exemption flag **or** keep a slim Plan table.
7. New EAS project + FCM/APNs files (not SARH).
8. Staging NI outlet + webhook (not production).

## Dual behaviors preserved on purpose

- Payment-first `POST /butchers/checkout` **and** legacy `POST /butchers/orders` + `butcher_order`
- Public `/join` **and** authenticated `/butchers/apply`
- Direct chat remains **disabled** (`direct_chat_disabled`)
- `POST /butchers` still 403 `application_required`

Do not “simplify” these in Phase 1.
