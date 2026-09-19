# MALAHEM FEATURE PARITY MATRIX

Source of truth: `iiimmcc30-create/sarh.app` (`/workspace`)  
Independent: `iiimmcc30-create/sarh-butcher` (`/home/ubuntu/sarh-butcher`)

Status values:

- `MATCH` — same behavior, verified in code (not filename-only)
- `MATCH — ISOLATED INFRASTRUCTURE` — same behavior, independent runtime/identity
- `INTENTIONAL DIFFERENCE` — isolation or standalone identity, marketplace rules unchanged
- `MISSING` — existed in Sarh Malahem and is absent here
- `PARTIAL` — same capability, incomplete surface or leftover wiring
- `BEHAVIOR DIFFERENCE` — customer/operator outcome differs
- `UNKNOWN — REQUIRES VALIDATION` — cannot prove without live providers

Statuses were assigned by comparing implementations (controllers, services, Prisma, mobile screens, dashboard/admin), not by file-name presence.

---

## 1. Customer authentication

| Area | Sarh implementation | Independent implementation | Status | Difference | Required action |
|------|---------------------|----------------------------|--------|------------|-----------------|
| Phone + OTP | `POST /api/auth/send-otp`, `verify-otp`; Saudi `+9665`; Twilio Verify; production 503 if `DEV_OTP` | Same `auth.controller` / `auth.service` | MATCH | None | None |
| Registration / check-signup | `check-signup`, `register` | Same endpoints and DTOs | MATCH | None | None |
| JWT access + refresh | `JWT_SECRET` / `JWT_REFRESH_SECRET`; 15m / 30d; `POST /auth/refresh`, `logout` | Same expiry and endpoints; tokens signed with `iss=malahm-sarh` | MATCH — ISOLATED INFRASTRUCTURE | Independent issuer and secrets | Operator must set independent JWT secrets |
| Sarh JWT rejected | Sarh tokens have no issuer claim | Independent `JwtTokenService` + dashboard/admin JWT verify require `malahm-sarh` | INTENTIONAL DIFFERENCE | Sarh JWTs cannot authenticate Malahem | None |
| Session storage | AsyncStorage `safat_*` | AsyncStorage `butcherapp_*` | INTENTIONAL DIFFERENCE | Isolated client keys | None |
| Google login | `POST /api/auth/google` mounted | Same route remains | MATCH | Same leftover social login as Sarh | None |
| Logout / expiry / errors | Same status codes and Arabic messages | Same | MATCH | None | None |

---

## 2. Butcher dashboard authentication

| Area | Sarh implementation | Independent implementation | Status | Difference | Required action |
|------|---------------------|----------------------------|--------|------------|-----------------|
| Username/password login | `auth.service` + cookie `butcher_token` | Same cookie and refresh flow | MATCH | None | None |
| JWT verify | No `iss` check in `butcher-jwt.ts` | Requires `iss === malahm-sarh` | MATCH — ISOLATED INFRASTRUCTURE | Independent issuer | None |
| Secret | `JWT_SECRET` | `BUTCHER_JWT_SECRET \|\| JWT_SECRET` | MATCH — ISOLATED INFRASTRUCTURE | Optional dedicated secret | Operator may set `BUTCHER_JWT_SECRET` |
| Invalid session | Redirect `/login` | Redirect `/login?reason=session` | INTENTIONAL DIFFERENCE | Query only; same lockout | None |
| Roles / account status | `Role.BUTCHER`; inactive user rejected | Same guards | MATCH | None | None |

---

## 3. Butcher management

| Area | Sarh implementation | Independent implementation | Status | Difference | Required action |
|------|---------------------|----------------------------|--------|------------|-----------------|
| Profile fields | `Butcher` scalars: names, phone, address, lat/lng, hours, closedDays, type, isOpen | Same schema + `commissionExempt` | MATCH — ISOLATED INFRASTRUCTURE | Extra local exemption flag | None |
| Admin edit | `PATCH /api/admin/butchers/:id` via `updateButcherSchema` | Same + `commissionExempt` | MATCH | Isolation replacement for Sarh `storeCommission` | None |
| Products / images / prices / units / stock / visibility | `GET/POST/PUT/DELETE /api/butchers/products` | Identical `butchers.controller` + `butchers.service` | MATCH | None | None |
| Ratings / reviews / favorites | `GET/POST :id/reviews`, favorite routes | Same | MATCH | None | None |
| Customer-facing butcher card | Mobile `app/butchers/[id].tsx` + directory service | Byte-identical butcher screens (`diff -rq app/butchers`) | MATCH | None | None |

---

## 4. Products / inventory (KG and fixed)

| Area | Sarh implementation | Independent implementation | Status | Difference | Required action |
|------|---------------------|----------------------------|--------|------------|-----------------|
| KG price | `pricePerKg * weightKg` or Daftra KG × `weightKg` | Same `order-line.util.ts` / `product-sale-unit.util.ts` | MATCH | Files byte-identical | None |
| Fixed unit | `priceFixed` flat, or Daftra unit-count × `round(weightKg)` | Same | MATCH | Same hold-vs-price quirk: reserve uses raw `weightKg` | None |
| Validation / increments | `validateAndPriceOrderLine` | Same | MATCH | None | None |
| Stock reserve / release / decrement | Reserve on checkout; release on cancel; decrement on delivered | Same SQL and lifecycle | MATCH | None | None |
| Create / update / delete / hide | Product CRUD in `butchers.service` | Same | MATCH | None | None |

---

## 5. Cart

| Area | Sarh implementation | Independent implementation | Status | Difference | Required action |
|------|---------------------|----------------------------|--------|------------|-----------------|
| UI add/remove/weight | `ButcherCartContext` + `butcherCart.ts` + product modal | Same in-memory cart | MATCH | Not persisted in either repo | None |
| Butcher separation | Switching butcher clears lines | Same | MATCH | None | None |
| Backend authority | Checkout/order validates lines, stock, prices | Same `validateCheckoutLines` | MATCH | None | None |
| Stale / unavailable | Server rejects missing/out-of-stock products | Same | MATCH | None | None |

---

## 6. Checkout and order finalization

| Area | Sarh implementation | Independent implementation | Status | Difference | Required action |
|------|---------------------|----------------------------|--------|------------|-----------------|
| Flow | Cart → validate → reserve → N-Genius → callback → `fulfillPaidCheckout` → order `pending`/`paid` → notify | Same `butcher-checkout.lifecycle.ts` | MATCH | None | None |
| TTL | 30 minutes (`BUTCHER_ORDER_UNPAID_EXPIRES_MINUTES`) | Same | MATCH | None | None |
| Late capture | `capturedAfterCancel` + `needsReconciliation`; no order recreated | Same `payments.repository.ts` | MATCH | None | None |
| Legacy `POST /orders` | Still creates unpaid reserved order | Same leftover path | MATCH | Same as Sarh | None |
| Payment types | Full marketplace initiate (listings, plans, boosts, butcher) | Only `butcher_checkout` / `butcher_order` | INTENTIONAL DIFFERENCE | Non-Malahem payment types rejected | None |

---

## 7. N-Genius

| Area | Sarh implementation | Independent implementation | Status | Difference | Required action |
|------|---------------------|----------------------------|--------|------------|-----------------|
| Create / amount / currency | `PaymentsService.initiate` SAR | Same NI client | MATCH — ISOLATED INFRASTRUCTURE | Merchant ref `MALAHM-` vs `SFAT-` | Operator configures same NI outlet if contract allows |
| Callback / cancel | `{APP_URL}/payment/result`, `/payment/cancel` | Same paths via `publicSiteUrl()` | MATCH — ISOLATED INFRASTRUCTURE | Independent `APP_URL` | Operator must set Malahem `APP_URL` and nginx |
| Webhook | `POST /api/payments/webhook` + `POST /api/integrations/ni/webhook` | Same | MATCH | None | Operator must point NI webhook at Malahem API |
| Duplicate / late / capture / refund | Same repository + success event set | Same | MATCH | Legacy `SFAT-` still classified as internal | None |
| Reconciliation flags | `needsReconciliation`, `capturedAfterCancel` | Same | MATCH | None | None |
| Description string | `سرح Payment` | `دفعة ملاحم سرح` | INTENTIONAL DIFFERENCE | Copy only | None |

---

## 8. Order state machine

| Area | Sarh implementation | Independent implementation | Status | Difference | Required action |
|------|---------------------|----------------------------|--------|------------|-----------------|
| States | `pending → confirmed\|cancelled`; `confirmed → preparing\|cancelled`; `preparing → ready`; `ready → delivered`; terminals empty | Identical `order-state-machine.service.ts` | MATCH | None | None |
| Who | Butcher/admin: allowed transitions; customer: unpaid cancel only; system expiry actor | Same `updateOrder` | MATCH | None | None |
| Confirm gate | `confirmed` requires `paymentStatus=paid` (402) | Same | MATCH | None | None |
| Cancel / deliver stock | Release reserved; deliver decrements available+reserved | Same | MATCH | None | None |
| Customer-visible status | Mobile order screens | Identical butcher order screens | MATCH | None | None |

---

## 9. Delivery

| Area | Sarh implementation | Independent implementation | Status | Difference | Required action |
|------|---------------------|----------------------------|--------|------------|-----------------|
| Type / address | `deliveryType` pickup\|delivery; address max 300 | Same | MATCH | No delivery fee in either butcher pricing | None |
| Distance / free-delivery rules | Not implemented in Sarh butcher module | Not implemented | MATCH | Do not invent | None |
| Display | `ButcherDeliverySegment` | Same | MATCH | None | None |

---

## 10. Notifications

| Area | Sarh implementation | Independent implementation | Status | Difference | Required action |
|------|---------------------|----------------------------|--------|------------|-----------------|
| In-app list / unread / mark-read | `GET/PATCH /api/notifications` | Same controller | MATCH | None | None |
| Push queue | Bull `push-notifications` job `send`; Firebase Admin if `FIREBASE_*` set | Same processor | MATCH — ISOLATED INFRASTRUCTURE | Independent Android app `com.sarh.butcher` | Operator: Firebase Android app + `google-services.json` |
| Token keys | `safat_push_*` | `butcherapp_push_*` | INTENTIONAL DIFFERENCE | Isolated storage | None |
| Order/payment events | Notification create on order/payment path | Same services | MATCH | None | None |

---

## 11. Socket.IO / realtime

| Area | Sarh implementation | Independent implementation | Status | Difference | Required action |
|------|---------------------|----------------------------|--------|------------|-----------------|
| Path / namespace | Default `/socket.io`, `/` | Same; client may use `/api/butcher/socket.io` if URL still has that prefix | MATCH — ISOLATED INFRASTRUCTURE | Independent socket process | Operator: independent socket host |
| Events | `order:status`, `chat:*`, `notifications:read`, `support:*`, leftover `live:*` | Same event names | MATCH | Leftover live events unused by AppModule | None |
| Rooms | `user:{id}` | `butcherapp:user:{id}` | MATCH — ISOLATED INFRASTRUCTURE | Prefixed rooms | None |
| Auth | JWT on handshake | Same + issuer | MATCH — ISOLATED INFRASTRUCTURE | Sarh JWT rejected | None |

---

## 12. Redis / queues / workers

| Area | Sarh implementation | Independent implementation | Status | Difference | Required action |
|------|---------------------|----------------------------|--------|------------|-----------------|
| Connection | Shared Sarh Redis | `MALAHEM_REDIS_URL` / `REDIS_URL`; fail-fast | MATCH — ISOLATED INFRASTRUCTURE | Independent Redis | Operator: provision Redis |
| Prefix | Unprefixed / default Bull | `butcherapp:` (`REDIS_KEY_PREFIX`) | MATCH — ISOLATED INFRASTRUCTURE | Isolated keys | None |
| Queues registered | notifications, emails, push, image, fee-checks, subscriptions | notifications, emails, push, image | INTENTIONAL DIFFERENCE | Sarh listing/plan jobs not mounted | None |
| Daftra cron | 10 min, lock `cron:daftra_products:{id}` | Same interval; lock `butcherapp:cron:daftra_products:{id}` | MATCH — ISOLATED INFRASTRUCTURE | Prefix only | None |
| Unpaid expiry | 5 min tick, 30 min TTL in API process | Same | MATCH | None | None |

---

## 13. Daftra

| Area | Sarh implementation | Independent implementation | Status | Difference | Required action |
|------|---------------------|----------------------------|--------|------------|-----------------|
| Per-butcher encrypted creds | AES-256-GCM; `ButcherDaftraIntegration` | Same crypto and models | MATCH | None | Operator: per-butcher keys |
| Product sync / units / KG | Paginated products; `isKgSaleUnit` | Same files | MATCH | No sales-invoice outbound in either repo | None |
| Poll / lock / retry | 10 min, 9 min lock, OAuth 401 retry once | Same | MATCH — ISOLATED INFRASTRUCTURE | Redis lock prefix | None |
| OAuth default redirect | `https://sarhsa.online/api/butchers/daftra/oauth/callback` | `http://localhost:3001/api/butchers/daftra/oauth/callback` unless env set | INTENTIONAL DIFFERENCE | No baked Sarh production URL | Operator must set `DAFTRA_OAUTH_REDIRECT_URI` / `MALAHEM_API_URL` |

---

## 14. Cloudinary

| Area | Sarh implementation | Independent implementation | Status | Difference | Required action |
|------|---------------------|----------------------------|--------|------------|-----------------|
| Upload / delete / transforms | `shared/lib/storage.ts` | Same flow | MATCH — ISOLATED INFRASTRUCTURE | Folder `sarh-butcher` vs `safat` | Operator: same account, Malahem folder |
| Production guard | None for folder name | Rejects folder `safat` / `sarh` | INTENTIONAL DIFFERENCE | Isolation | None |

---

## 15. Admin / moderation

| Area | Sarh implementation | Independent implementation | Status | Difference | Required action |
|------|---------------------|----------------------------|--------|------------|-----------------|
| Butcher / applications / orders / payments / commissions / users / settings / banners / support | Admin pages + API | Same Malahem pages; API trimmed of listings/posts/livestreams/sections | MATCH | Listing-fee admin APIs unmounted | None |
| Sidebar | Full Sarh platform nav | Butcher-ops subset | INTENTIONAL DIFFERENCE | Leftover pages remain on disk | Do not restore Sarh social admin |
| Branding | `سرح` / livestock tagline | `ملاحم سرح` / butcher-ops tagline | INTENTIONAL DIFFERENCE | Identity isolation | None |
| Commissions UI | Listing 1% + `storeCommission` + listing-fee compliance | Order 10% + `commissionExempt` editor; listing-fee panel removed (API gone) | MATCH — ISOLATED INFRASTRUCTURE | Exemption source changed from plans to flag | None |
| Leftover listing/post/live pages | Mounted in Sarh admin | Files exist; not in nav; APIs 404 if opened | PARTIAL | Leftover UI | Do not delete (policy); do not use |

---

## 16. Commission

| Area | Sarh implementation | Independent implementation | Status | Difference | Required action |
|------|---------------------|----------------------------|--------|------------|-----------------|
| Rate / when | 10% on `delivered` + `paid` | Same `BUTCHER_ORDER_COMMISSION_PERCENT` | MATCH | None | None |
| Ledger | `Payment` `order_commission`, `BOC-{orderId}`, idempotent | Same | MATCH | No dedicated Commission model in either schema | None |
| Exemption | Plan permission `storeCommission <= 0` | `Butcher.commissionExempt` via `ButcherCommissionPolicy`; admin checkbox | INTENTIONAL DIFFERENCE | Isolated from Sarh plans | Use admin butcher edit |
| Listing 1% fee | Sarh listing marketplace | Not a Malahem runtime rule | INTENTIONAL DIFFERENCE | Listing domain unmounted | None |
| Refund | `markOrderCommissionRefunded` | Same | MATCH | None | None |

---

## 17. API surface

| Area | Sarh implementation | Independent implementation | Status | Difference | Required action |
|------|---------------------|----------------------------|--------|------------|-----------------|
| Butcher / auth / payments / notifications / messages / upload / users / support / health / Daftra | Mounted | Mounted; same butcher/auth/payment routes | MATCH | None | None |
| Listings / posts / livestreams / plans / fees / MEWA / explore / feed-suppliers | Mounted (~50 controllers) | On disk, **not** in `AppModule` (~21 controllers) | INTENTIONAL DIFFERENCE | Not required by Malahem | Keep unmounted |
| Admin listing-fee / sections / posts / listings | Mounted | Removed from `admin.controller` | INTENTIONAL DIFFERENCE | Isolation | None |

---

## 18. Database

| Area | Sarh implementation | Independent implementation | Status | Difference | Required action |
|------|---------------------|----------------------------|--------|------------|-----------------|
| Butcher commerce models | `Butcher*` + Payment + Daftra + banners | Byte-identical except `Butcher.commissionExempt` | MATCH — ISOLATED INFRASTRUCTURE | Extra boolean default false | Use `sarh_butcher` only |
| Leftover Listing/Post/Live/Plan models | Present | Present, unused by AppModule | INTENTIONAL DIFFERENCE | Leftover schema, not copied data | Do not delete leftover models |
| DB instance | `sarouh` | `sarh_butcher` | MATCH — ISOLATED INFRASTRUCTURE | Independent database | Operator: empty DB + `prisma migrate deploy` |

---

## 19. Mobile customer experience

| Area | Sarh implementation | Independent implementation | Status | Difference | Required action |
|------|---------------------|----------------------------|--------|------------|-----------------|
| Butcher routes (23) + join + cart/checkout/orders | Full Malahem stack inside Sarh tabs | Same files; boot `resolveBootNavigation` → `/butchers` | INTENTIONAL DIFFERENCE | Standalone entry, not Sarh home | None |
| Package / scheme / slug | `com.sarh.app`, `sarh`, `safat` | `com.sarh.butcher`, `malahm`, `malahm` | MATCH — ISOLATED INFRASTRUCTURE | Independent app identity | EAS/Firebase for butcher package |
| Leftover tabs (market/posts/ministry) | Primary Sarh UX | Still on disk; boot redirects `(tabs)` to `/butchers` | PARTIAL | Reachable via deep nav; listing APIs 404 | Do not delete leftover screens |
| Legal/info | `sarhsa.online` privacy copy | Same leftover pages; linked from `butchers/more` | PARTIAL | Sarh legal text still shown if opened | Operator: replace legal copy later |
| API host | Default `https://sarhsa.online` | `EXPO_PUBLIC_*`; no Sarh fallback | MATCH — ISOLATED INFRASTRUCTURE | Isolated URLs | Operator: set Expo public URLs |

---

## 20. Tests

| Area | Sarh implementation | Independent implementation | Status | Difference | Required action |
|------|---------------------|----------------------------|--------|------------|-----------------|
| Butcher checkout / order / commission / NI | Present | Present + isolation specs (merchant-ref, production env, commission policy) | MATCH | Independent has extra isolation tests | None |
| Leftover social/listing tests | Run against mounted modules | Still on disk; some test leftover UI | PARTIAL | Evidence, not proof of leftover runtime | Do not weaken |

---

## 21. Static leftover references

| Term | Classification | Status |
|------|----------------|--------|
| `sarhsa.online` in validate/CORS/docs | Guard + historical docs | INTENTIONAL DIFFERENCE |
| `sarhsa.online` in `app/info/*`, `sarhOfficial.ts` | Leftover legal / official copy | PARTIAL |
| `SFAT-` in `merchant-ref.ts` | Legacy NI classification | INTENTIONAL DIFFERENCE |
| `com.sarh.app` in unused `(tabs)/more.tsx` | Dead leftover screen | PARTIAL |
| `sarh_internal` | Asserted absent from compose | INTENTIONAL DIFFERENCE |
| `scripts/migrate-from-sarh.mjs` | Historical / optional | INTENTIONAL DIFFERENCE |
| `sarouh-api`, `@sarh0/safat` | No matches | MATCH |
