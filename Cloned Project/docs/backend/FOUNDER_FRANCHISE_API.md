# Founder Franchise — API Reference (end-to-end)

Complete API surface for the founder-run franchise system: enroll → pay → configure → sell territories → buyer pays → commissions on sales → owner views earnings → resale. **No frontend** — these are the backend endpoints; payments reuse the existing invoice system.

- **Base URL:** your backend origin (e.g. `https://api.garage.app`)
- **Auth:** all endpoints require `Authorization: Bearer <JWT>` (the site's existing login). Founder-scoped endpoints additionally require the caller to be a **founder** (or `fullAccess` stakeholder) of the office in the URL.
- **Currency:** franchise prices are **USD**. The $650/yr is a fixed business rule (`FRANCHISE_PRICE_USD`).
- **Money model (recap):**
  - Founder pays **$650/yr** per office to run a program.
  - Founder configures per-level commission % carved from the office's **seller-gross**.
  - Founder sells territories at **≥ $650/yr**; **$650 → platform, excess → founder**, and the price **recurs yearly** (excess to founder each year).
  - On each sale at the office, the **buyer's location** decides which territory owner earns; chain-integrity (sub → territory → country).
  - Resale: new owner pays the resale price (≥$650); at transfer **$650 → platform, excess → reseller (one-time)**; thereafter recurs to the founder. Founder must approve.

---

## 0. The full sequence (1→100)

```
FOUNDER                                                         PLATFORM / SYSTEM
  │
  │ 1. POST /franchise-program/offices/:officeId/enroll
  │──────────────────────────────────────────────────────────▶ creates program (pending_payment) + $650 invoice
  │ 2. pay that invoice  (POST /api/invoices/:id/select-payment → /verify-payment)
  │──────────────────────────────────────────────────────────▶ fulfilment → program ACTIVE (1-yr window)
  │ 3. PATCH …/commissions   { subTerritory:15, territory:5, country:5 }
  │ 4. GET …/catalog?country=India&state=Karnataka   (pick a territory)
  │ 5. POST …/assignments    { geoLevel, geoEntityId, ownerEmail, priceUSD }
  │──────────────────────────────────────────────────────────▶ assignment (pending_payment) + buyer invoice
  │
BUYER (territory owner)
  │ 6. find invoice (GET /api/invoices/my/list) → pay it
  │──────────────────────────────────────────────────────────▶ fulfilment → assignment ACTIVE; markup excess → founder
  │
ANY SALE at the office (product/course/call/…)
  │ 7. existing checkout → invoice paid → distributeCommissions()
  │──────────────────────────────────────────────────────────▶ STEP 5: buyer-location → territory owner credited (15/5/5)
  │
OWNER
  │ 8. GET /franchise-program/my/assignments , /my/earnings
  │ 9. POST /franchise-program/assignments/:id/reassign-request  { newOwnerEmail, resalePriceUSD }
  │
FOUNDER
  │ 10. GET …/reassignments → POST …/reassignments/:id/approve  (bills new owner) | /reject
NEW OWNER
  │ 11. pay resale invoice → ownership transfers, reseller gets one-time markup
```

---

## 1. Founder — enroll & program

### `POST /franchise-program/offices/:officeId/enroll`
Create (or re-activate) the program for an office and get the $650/yr invoice to pay.
Founder of `:officeId` only.

**Request body:** _(none)_

**201 Response**
```json
{
  "program": {
    "id": "665f…",
    "officeId": "6620…",
    "founderUserId": "6610…",
    "status": "pending_payment",
    "currency": "USD",
    "commissionConfig": { "country": 0, "territory": 0, "subTerritory": 0 },
    "subscription": { "priceUSD": 650, "period": "yearly", "invoiceId": "667a…", "startedAt": null, "expiresAt": null }
  },
  "invoiceId": "667a…",
  "invoiceNumber": "INV-LZ4…-AB12",
  "amountUSD": 650
}
```
Then **pay `invoiceId`** via §6. On payment the program flips to `active` with a 1-year `expiresAt`.

**Errors:** `409` program already active · `403` not a founder of this office · `404` office not found.

### `GET /franchise-program/offices/:officeId`
Founder only. Returns `{ "program": { …same shape… } }`. `404` if not enrolled.

### `PATCH /franchise-program/offices/:officeId/commissions`
Set per-level commission % (each 0–100, carved from seller-gross). Send any subset.

**Request body**
```json
{ "subTerritory": 15, "territory": 5, "country": 5 }
```
**200 Response:** `{ "program": { … updated … } }`
**Errors:** `400` value out of 0–100 / none provided · `404` no program.

---

## 2. Founder — browse catalog & sell territories

### `GET /franchise-program/offices/:officeId/catalog?country=&state=`
Drill the read-only geo catalog to pick what to sell. Founder only.

- no params → **countries**
- `?country=India` → **territories (states)** in India
- `?country=India&state=Karnataka` → **sub-territories (cities)** in Karnataka

**200 Response (sub-territory level)**
```json
{
  "level": "subTerritory",
  "items": [
    { "geoLevel": "subTerritory", "geoEntityId": "5f…", "name": "Bengaluru Urban",
      "country": "India", "parentTerritory": "Karnataka", "zipCodesCount": 1,
      "flag": "🇮🇳", "continent": "Asia", "coverImage": "https://…", "image": null }
  ]
}
```
Every level (country / territory / sub-territory) now also returns display fields:
`flag` (emoji), `continent` (falls back to `region` for country/territory), `coverImage`
(from `coverImageUrl`, sub-territory only today), and `image` (forward-compat, may be `null`).
`country`/`territory` items also carry `region`.

### `POST /franchise-program/offices/:officeId/assignments`
Assign/sell a territory to a buyer. Creates the assignment (`pending_payment`) and the buyer's $650/yr (or custom) invoice. Program must be **active**.

**Request body**
```json
{
  "geoLevel": "subTerritory",            // country | territory | subTerritory
  "geoEntityId": "5f…",                  // from the catalog
  "ownerEmail": "buyer@example.com",     // must be an existing Garage user
  "priceUSD": 800                         // ≥ 650
}
```
**201 Response**
```json
{
  "assignment": {
    "id": "6701…", "programId": "665f…", "officeId": "6620…",
    "geoLevel": "subTerritory", "geoEntityId": "5f…", "geoEntityName": "Bengaluru Urban",
    "geoCountry": "India", "geoParentTerritory": "Karnataka",
    "ownerUserId": "66c1…", "ownerEmail": "buyer@example.com",
    "priceUSD": 800, "status": "pending_payment",
    "subscription": { "startedAt": null, "expiresAt": null },
    "pendingReassignment": null
  },
  "invoiceId": "6702…", "invoiceNumber": "INV-…", "amountUSD": 800
}
```
The **buyer** pays `invoiceId` (§6). On payment the assignment flips to `active`; the markup `(price − 650)` is credited to the founder's office wallet, and the price recurs yearly.

**Errors:** `409` program not active / territory already assigned · `404` catalog entity or buyer-email not found · `400` invalid level / price < 650.

### `GET /franchise-program/offices/:officeId/assignments`
Founder only. `{ "assignments": [ …assignment objects… ] }` (newest first).

### `DELETE /franchise-program/offices/:officeId/assignments/:assignmentId`
Founder only. Sets the assignment to `cancelled`. Returns `{ "assignment": {…} }`.
(Any unpaid invoice for it simply expires via the stale-invoice sweep.)

### `GET /franchise-program/offices/:officeId/summary`
Founder dashboard: totals + per-territory earnings.
```json
{
  "program": { … },
  "assignments": 3,
  "statusCounts": { "active": 2, "pending_payment": 1 },
  "totalPaidOut": 1.42,
  "byEntity": [
    { "level": "subTerritory", "geoEntityId": "5f…", "geoEntityName": "Bengaluru Urban", "total": 0.75, "transactions": 4 }
  ]
}
```

---

## 3. Territory owner

### `GET /franchise-program/my/assignments`
Territories the authenticated user owns. `{ "assignments": [ …assignment objects… ] }`.
Each assignment now includes a top-level **`invoiceId`** (the subscription invoice for that territory, also mirrored in `subscription.invoiceId`) — handy for linking the owner to pay/renew.

### `GET /franchise-program/my/earnings?limit=&cursor=`
Founder-program commission history for the authenticated user (cursor-paginated, `limit` 1–200, default 50).
```json
{
  "earnings": [
    { "id": "…", "amount": 0.0075, "currency": "USD", "level": "subTerritory",
      "geoEntityId": "5f…", "geoEntityName": "Bengaluru Urban",
      "franchiseProgramId": "665f…", "franchiseOfficeId": "6620…",
      "relatedItemName": "Consulting Call", "relatedSaleAmount": 5, "createdAt": "2026-06-01T…" }
  ],
  "nextCursor": "66f0…"   // pass back as ?cursor= ; null when no more
}
```

---

## 4. Resale (Phase 2 — buyer→buyer, founder-approved)

### `POST /franchise-program/assignments/:assignmentId/reassign-request`
Current **owner** requests to resell to a new user. Requires founder approval before billing.

**Request body**
```json
{ "newOwnerEmail": "newbuyer@example.com", "resalePriceUSD": 1000 }
```
**201 Response:** `{ "assignment": { …, "pendingReassignment": { "status": "pending_approval", "newOwnerEmail": "…", "resalePriceUSD": 1000, "resellerUserId": "…", "requestedAt": "…" } } }`
**Errors:** `403` not the current owner · `409` not active / a request is already pending · `404`/`400` bad new owner.

### `GET /franchise-program/offices/:officeId/reassignments`
Founder only. Lists assignments with a `pendingReassignment.status = "pending_approval"`.

### `POST /franchise-program/offices/:officeId/reassignments/:assignmentId/approve`
Founder approves → bills the new owner the resale price. Returns the invoice.
```json
{ "assignment": { … "pendingReassignment": { "status": "approved", "invoiceId": "…" } },
  "invoiceId": "…", "invoiceNumber": "INV-…", "amountUSD": 1000 }
```
The **new owner** pays it (§6). On payment: ownership transfers, the **reseller** is credited `(price − 650)` one-time, the old owner's recurring subscription is cancelled, and the price recurs yearly to the founder thereafter.

### `POST /franchise-program/offices/:officeId/reassignments/:assignmentId/reject`
Founder rejects; the territory stays with the current owner. `{ "assignment": {…} }`.

### Resale history (durable ledger)
Every reassignment is recorded in a persistent `franchise_reassignments` ledger that survives completion (the assignment's `pendingReassignment` is wiped on transfer, so it can't be the history source). Statuses: `pending_approval → approved → completed`, or `rejected` / `cancelled`.

**`GET /franchise-program/offices/:officeId/reassignments/history?status=&limit=&cursor=`** (founder)
All resales for the program, any status, newest-first, cursor-paginated. Optional `status` filter.
```json
{
  "reassignments": [
    { "id": "…", "assignmentId": "…", "geoLevel": "country", "geoEntityName": "Bhutan",
      "status": "completed", "resellerEmail": "a@x.com", "newOwnerEmail": "b@x.com",
      "resalePriceUSD": 1000, "invoiceId": "…",
      "requestedAt": "…", "decidedAt": "…", "completedAt": "…" }
  ],
  "nextCursor": null
}
```

**`GET /franchise-program/my/reassignments?role=reseller|buyer&status=&limit=&cursor=`** (any user)
The caller's resales — as `reseller` (sold), `buyer` (bought via resale), or both (omit `role`). Each row adds `myRole`.

### Direct vs resale acquisition
Every assignment now carries **`acquisitionType`**: `"original"` (bought directly from the founder) or `"resale"` (acquired via a completed reassignment), plus `acquiredReassignmentId` linking to the ledger row. Surfaced on all assignment payloads (`/my/assignments`, `/offices/:id/assignments`, etc.), so you can tell at a glance how a territory was obtained.

> **Note:** the ledger is populated going forward. Resales completed *before* this change have no ledger row (the data was only in the now-cleared `pendingReassignment`), though their resale invoices still exist in the `invoices` collection.

---

## 5. Sale → commission (automatic — no endpoint)

There is **no API to call** for commissions. Any normal sale at an enrolled office (product/course/call/etc.) runs through the existing checkout → `distributeCommissions()`, whose **STEP 5** resolves the **buyer's address** (invoice shipping → billing → buyer profile) to a geo leaf and credits the matching territory owners under chain-integrity:

| Buyer falls in… | Who earns (if assigned & active) |
|---|---|
| a sub-territory | sub owner `subTerritory%`, territory owner `territory%`, country owner `country%` |
| sub assigned only | sub owner only |
| no sub assigned | nothing (territory/country can't earn without the sub below) |

Carved from the office's seller-gross; clipped if the wallet can't cover; lapsed owners are skipped (slice stays with the founder). Earnings land on the owner's `TerritoryWallet` and appear in §3 `/my/earnings`.

---

## 6. Payment endpoints (existing — used to pay every franchise invoice)

Franchise `enroll`/`assign`/`approve` all return an `invoiceId`. Pay it with the standard invoice flow. (Full detail in `CHECKOUT_API_DOCUMENTATION.md`.)

### `GET /api/invoices/:invoiceId`
Fetch invoice details (status, amount, line items, issuer org).

### `GET /api/invoices/my/list`
The authenticated user's invoices — how a **buyer/new owner discovers** the invoice created for them. (Filter client-side by `lineItems[0].itemType` = `franchise_program` | `franchise_territory`.)

### `GET /api/invoices/payment-options?country=&amount=&itemCurrency=USD`
Available rails for the amount/currency.

### `POST /api/invoices/:invoiceId/select-payment`
Pick a method; returns gateway handles (Razorpay order / Stripe client secret / crypto URL / short URL).
```json
{ "paymentCurrency": "USD", "paymentMethodCategory": "card", "paymentPlatform": "stripe", "returnUrl": "https://…" }
```
> Franchise invoices are USD — choose a USD-capable `paymentPlatform` (e.g. `stripe`, `crypto_wallet`). `paymentMethodCategory` ∈ `card | upi | crypto`.

### `POST /api/invoices/:invoiceId/verify-payment`
Confirm the gateway payment → marks paid → **fulfils** (activates the program/assignment, transfers ownership on resale, credits markups).
```json
{ "razorpayOrderId": "order_…", "razorpayPaymentId": "pay_…", "razorpaySignature": "…" }
```
(For Stripe/crypto the corresponding confirm path applies — see checkout docs.)

### `POST /api/invoices/:invoiceId/pay-with-wallet`
Pay an invoice from the user's store/affiliate wallet balance (alternative to a gateway).

**Recurring renewals:** the daily cron `POST /api/invoices/cron/generate-recurring` creates the next yearly invoice (same price). The franchise lapse sweep also runs here — programs/assignments past `expiresAt` flip to `suspended`/`paused_lapsed` (earning pauses, slot kept) until renewed.

---

## 6.1 Frontend: paying an invoice (step-by-step)

You get an `invoiceId` back from `enroll` / `assign` / `approve`. Paying it is **3 calls**. `payment-options` is only the *menu* — it does not charge anything.

### Step 1 — render the methods (fixes an empty "no methods" modal)
`GET /api/invoices/payment-options?itemCurrency=USD&amount=650&country=IN` returns methods **nested under the currency** — you must index by `methods["USD"]`, not read `methods` directly:

```jsonc
{ "currencies": ["USD","INR"],
  "methods": {
    "USD": [
      { "category":"card",   "enabled":true, "platforms":[ {"id":"stripe","name":"Stripe","enabled":true}, {"id":"razorpay","name":"RazorPay","enabled":true} ] },
      { "category":"wallet", "enabled":true, "platforms":[ {"id":"affiliate_wallet","name":"Affiliate Vault","enabled":true} ] },
      { "category":"crypto", "enabled":true, "platforms":[ {"id":"crypto_wallet", ...} ] }
    ],
    "INR": [ ... ]
  } }
```
```js
const groups = res.methods["USD"] || [];               // ← franchise invoices are USD
const buttons = groups.filter(g => g.enabled)
  .flatMap(g => g.platforms.filter(p => p.enabled)
    .map(p => ({ category: g.category, id: p.id, name: p.name })));
// Render `buttons`. Default to Stripe for the $650 USD charge (Razorpay is mainly INR).
```

### Step 2 — on method click, get the gateway handles
```js
const sel = await api.post(`/api/invoices/${invoiceId}/select-payment`, {
  paymentCurrency: "USD",
  paymentMethodCategory: "card",   // the chosen group's category
  paymentPlatform: "stripe",       // the chosen button's id
});
```

### Step 3 — run the gateway, then finish

**Stripe (recommended for USD)** — `sel` has `stripeClientSecret` + `stripePublishableKey`:
```js
const stripe = Stripe(sel.stripePublishableKey);
const { error } = await stripe.confirmCardPayment(sel.stripeClientSecret, {
  payment_method: { card: cardElement },
});
if (error) return showError(error.message);
// Do NOT call verify-payment for Stripe — our webhook marks it paid + fulfils.
// Poll the invoice and refresh when it flips to paid:
const t = setInterval(async () => {
  const inv = await api.get(`/api/invoices/${invoiceId}`);
  if (inv.status === "paid") { clearInterval(t); reloadProgram(); }
}, 2000);
```

**Razorpay** — `sel` has `razorpayOrderId` + `razorpayKeyId`: open Razorpay checkout with those, then on its success callback:
```js
await api.post(`/api/invoices/${invoiceId}/verify-payment`, {
  razorpayOrderId, razorpayPaymentId, razorpaySignature,   // all from Razorpay's callback
});
// Returns immediately as paid + fulfilled — no polling needed. Then reloadProgram().
```

**Crypto** — `sel` has `cryptoPaymentUrl`: redirect the user there; the webhook fulfils (poll like Stripe).

**Wallet** — skip `select-payment`; call `POST /api/invoices/${invoiceId}/pay-with-wallet` directly.

### Summary
| Gateway | After SDK success | Activation signal |
|---|---|---|
| Stripe / crypto | nothing to call | webhook → poll `GET /api/invoices/:id` until `status:"paid"` |
| Razorpay | `POST …/verify-payment` (3 ids) | response is already `paid` |

Once `status:"paid"`, the program/assignment is active server-side — just re-fetch and the dashboard updates.

---

## 6.2 Coupons (franchise — two product types)

Admins can discount franchise invoices with platform coupons. There are **two franchise coupon product types**, picked at creation:

| productType | Applies to | Discounts |
|---|---|---|
| **`franchise_program`** | the founder's $650/yr enroll | the $650 fee |
| **`franchise_territory`** | a buyer's territory purchase/resale | **only the $650 platform floor** — the founder/reseller markup above $650 is never reduced; the platform absorbs the cut |

Rules (both types):
- **Garage admin only** — created via the admin platform-coupon endpoints (founder coupon endpoints reject these), since the discount comes out of **platform** revenue.
- **Subscription types** — `cycleCount` controls how many yearly renewals the discount applies to (`1` = first year only).
- A coupon of one type cannot be applied to the other type's invoice (product-type match).

**Territory floor-only math (example):** a `franchise_territory` 20%-off coupon on an **$800** territory → 20% of the **$650 floor** = **$130** off → buyer pays **$670**; founder still gets **$150**; platform keeps **$520**. A fixed discount is capped at $650.

### Admin: create a franchise coupon
`POST /platform-coupons` (admin auth) — set `productType` to `franchise_program` **or** `franchise_territory`:
```json
{
  "code": "TERRITORY20",
  "name": "Territory launch — 20% off the platform fee",
  "productType": "franchise_territory",
  "discountType": "percent",
  "discountValue": 20,
  "cycleCount": 1
}
```
Fixed-amount also works (`"discountType":"fixed","discountValue":65000`). For territory, the discount is computed on / capped at the $650 floor.

### Founder/buyer: apply it
- **Program coupon** — at enroll: `POST /franchise-program/offices/:officeId/enroll` `{ "couponCode": "…" }`; or after: `POST /api/invoices/:programInvoiceId/apply-platform-coupon`.
- **Territory coupon** — at assignment: `POST /franchise-program/offices/:officeId/assignments` `{ …, "couponCode": "…" }`; or the buyer applies it on the territory invoice: `POST /api/invoices/:territoryInvoiceId/apply-platform-coupon`. In both cases the discount hits only the $650 floor; `amountUSD` in the response reflects it.
- **Resale (Phase 2)** — the same `franchise_territory` coupon works on resales. At approval: `POST /franchise-program/offices/:officeId/reassignments/:assignmentId/approve` `{ "couponCode": "…" }`; or the new owner applies it on the resale invoice via `apply-platform-coupon`. The discount comes off the $650 floor only — the **reseller's** markup above $650 is never reduced (e.g. resale $1,000, 20% off → new owner pays $870, reseller keeps $350, platform $520).

Optionally pre-validate before paying: `POST /validate-platform-coupon` with `productType:"franchise_program"`, `amountCents:65000`.

Then pay the (discounted) invoice via §6.1. If a coupon makes it free, the zero-amount path marks it paid and activates the program automatically.

---

## 7. Status values

- **Program** `status`: `pending_payment` → `active` → (`suspended` on lapse) → `cancelled`.
- **Assignment** `status`: `pending_payment` → `active` → (`paused_lapsed` on lapse) → `cancelled`.
- **Invoice** `status`: `draft` → `pending` → `paid` (also `failed`/`cancelled`/`refunded`/`expired`).
- **pendingReassignment** `status`: `pending_approval` → `approved` (invoice issued) / `rejected`.

## 8. Auth & errors (common)

- Missing/invalid token → `401`.
- Non-founder hitting a founder endpoint → `403 { "error": "Only founders of this office can do this" }`.
- Validation → `400` with `{ "error": "…" }`. Not found → `404`. Conflicts (already active / already assigned / pending) → `409`.
