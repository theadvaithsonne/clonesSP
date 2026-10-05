# Unilevel Plus + Third-Party Sub Combo API

Endpoints for the **Buy UP ($25), get the first month of a partner subscription FREE** offer — and, optionally, buy a discounted multi-month term in the same cart.

1. **`GET /unilevel-plus/product`** — the catalog. Returns combo eligibility plus the **bundled** term prices available right now.
2. **`POST /unilevel-plus/checkout/create-combo-invoice`** — creates the cart invoice ($25, or $25 + a bundled term) with the combo intent stamped on it. The FE pays it through the standard invoice payment system (any method).
3. **`GET /unilevel-plus/checkout/combo-status/:upInvoiceId`** — polled after payment to confirm activation.
4. **`GET /api/third-party/subscriptions`** / **`PATCH /api/third-party/subscriptions/:id/term`** — see and change the term afterwards. See §4.

Base URL: `https://api.garage.app` (prod) / `https://test.garage.app` (test).

---

## How the offer works

| Step | What happens |
|---|---|
| 1. FE calls `create-combo-invoice` with the partner's `thirdPartyClientId`, optionally `termMonths` | Backend validates eligibility, creates a UP `Invoice` with `metadata.combo` stamped on it. Without `termMonths` it's $25; with one it's the bundled cart total. |
| 2. FE pays via **any** invoice payment endpoint (Razorpay, Stripe, store wallet, affiliate wallet, crypto) | Once cleared, the invoice transitions to `paid` and `fulfillInvoice` runs. |
| 3. Backend fulfillment runs `case "unilevel_plus"` | Activates the buyer's UP, distributes UP commissions **on the $25 licence value** (never the cart total), **then** issues a $0 `third_party_subscription` invoice for the free first month, marks it paid, and fires the partner webhook. |
| 4. If a term was bundled | The prepaid term is minted as cycle 2 — already paid, covering the months **after** the free one. |
| 5. FE polls `combo-status` until `overall = "success"` | Confirms both pieces activated. |
| 6. At the end of the paid period, the recurring cron generates the next cycle at the **standalone** price | The bundle is a one-time acquisition rate; it never recurs. |

**Eligibility (one-time per user, partner-agnostic):**
- User has NEVER redeemed this combo offer before. *(Already owning UP does **not** disqualify — the redundant seat is parked as a reserve licence.)*
- The chosen partner (`ThirdPartyClient`) is active and has a `productConfig.recurringPeriod`.
- Bundled term pricing additionally requires a live $25 payment in this cart. Users who already own UP and use `claim-free-month` get **standalone** prices only (that response carries `bundleEligible: false`).

---

## Pricing

The subscription lists at **$36/month**. Terms are discounted, and buying one in the same cart as the licence is cheaper still.

| Term | Standalone (buy later / renewals) | Bundled cart total | of which subscription | Months of access |
|---|---|---|---|---|
| 1 month | $36 | *(no bundle)* | — | 1 free, then $36/mo |
| 3 months | $100 | **$100** | $75 | 1 free + 3 paid |
| 6 months | $200 | **$216** | $191 | 1 free + 6 paid |
| 12 months | $396 | **$421** | $396 | 1 free + 12 paid |

The bundled cart **includes** the $25 licence — it is one payment. The licence is always counted at its full $25; the discount applies entirely to the subscription portion. The free month sits **on top of** the paid term.

There is no bundled monthly tier: requesting `termMonths: 1` is a plain combo (free month, then $36/mo).

---

## 0) `GET /unilevel-plus/product`

The catalog call the checkout page makes first. `Authorization: Bearer <user JWT>`.

Returns the UP plan, whether the combo is still available, and — under `comboTerms` — the **bundled** term prices per eligible partner.

```json
{
  "success": true,
  "plan": { "_id": "6963…", "name": "Unilevel Plus", "productPrice": 25, "currency": "USD" },
  "purchased": false,
  "comboUsed": false,
  "comboEligible": true,
  "comboTerms": [{
    "thirdPartyClientId": "69e1d6109247c7bd0693ee3b",
    "clientName": "NetworkChain",
    "productCode": "GU_SUB_36",
    "defaultTermMonths": 1,
    "terms": [
      { "termMonths": 3,  "label": "3 months",  "cartTotal": 100, "cartTotalCents": 10000, "subscriptionUsd": 75,  "standaloneUsd": 100, "savingUsd": 25, "monthsOfAccess": 4 },
      { "termMonths": 6,  "label": "6 months",  "cartTotal": 216, "cartTotalCents": 21600, "subscriptionUsd": 191, "standaloneUsd": 200, "savingUsd": 9,  "monthsOfAccess": 7 },
      { "termMonths": 12, "label": "12 months", "cartTotal": 421, "cartTotalCents": 42100, "subscriptionUsd": 396, "standaloneUsd": 396, "savingUsd": 0,  "monthsOfAccess": 13 }
    ],
    "standaloneTerms": [
      { "termMonths": 1,  "totalAmount": 36,  "totalAmountCents": 3600,  "monthlyEquivalent": 36.00 },
      { "termMonths": 3,  "totalAmount": 100, "totalAmountCents": 10000, "monthlyEquivalent": 33.33 },
      { "termMonths": 6,  "totalAmount": 200, "totalAmountCents": 20000, "monthlyEquivalent": 33.33 },
      { "termMonths": 12, "totalAmount": 396, "totalAmountCents": 39600, "monthlyEquivalent": 33.00 }
    ]
  }]
}
```

| Field | Notes |
|---|---|
| `comboEligible` | `false` once the user has redeemed the combo — the offer is one-time per user |
| `comboTerms[].terms` | Render the picker from this. `cartTotal` is the single payment; `savingUsd` vs buying the same term later |
| `comboTerms[].standaloneTerms` | What each term costs if bought or switched to later. Includes the 1-month tier |
| `defaultTermMonths` | Always `1` — picking no term is a plain $25 combo |

`comboTerms` is best-effort: if the catalog lookup fails it comes back `[]` rather than failing the page.

---

## 1) `POST /unilevel-plus/checkout/create-combo-invoice`

Creates the $25 UP invoice. Returns the invoice for the FE to pay via the standard invoice payment system. This endpoint does **not** create a Razorpay order or take any payment — the FE picks the payment method afterwards.

### Auth
`Authorization: Bearer <user JWT>`

### Request body

```json
{
  "thirdPartyClientId": "69e1d6109247c7bd0693ee3b",
  "productCode": "GU_SUB_36",
  "termMonths": 3
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `thirdPartyClientId` | string (ObjectId) | yes | `_id` of the `ThirdPartyClient` (e.g. NetworkChain) |
| `productCode` | string | no | Sanity check — must equal `client.productConfig.productCode` |
| `termMonths` | int 1–60 | no | Buy this term **in the same cart** at the bundled rate. Omit (or `1`) for the plain $25 combo. Must be an active term. |

### Response — `200 OK` (with `termMonths: 3`)

```json
{
  "success": true,
  "invoice": {
    "_id": "6a3b0e91c1f87b0001e5d4a2",
    "invoiceNumber": "INV-MQQ7C0U5-VXAZ",
    "totalAmount": 10000,
    "itemCurrency": "USD",
    "status": "draft"
  },
  "plan": { "name": "Unilevel Plus", "productPrice": 25, "currency": "USD" },
  "combo": {
    "clientName": "NetworkChain",
    "productCode": "GU_SUB_36",
    "recurringPeriod": "monthly",
    "freeFirstCycle": true,
    "fullPriceFromCycle2": 36,
    "selectedTermMonths": 3,
    "bundle": {
      "licenceUsd": 25,
      "subscriptionUsd": 75,
      "cartUsd": 100,
      "termMonths": 3,
      "standaloneUsd": 100,
      "savingUsd": 25,
      "monthsOfAccess": 4,
      "renewsAtUsd": 100
    },
    "terms": [
      { "termMonths": 3,  "label": "3 months",  "cartTotal": 100, "cartTotalCents": 10000, "subscriptionUsd": 75,  "standaloneUsd": 100, "savingUsd": 25 },
      { "termMonths": 6,  "label": "6 months",  "cartTotal": 216, "cartTotalCents": 21600, "subscriptionUsd": 191, "standaloneUsd": 200, "savingUsd": 9 },
      { "termMonths": 12, "label": "12 months", "cartTotal": 421, "cartTotalCents": 42100, "subscriptionUsd": 396, "standaloneUsd": 396, "savingUsd": 0 }
    ]
  },
  "nextSteps": {
    "paymentOptions": "GET /api/invoices/payment-options",
    "payWithCardOrCrypto": "POST /api/invoices/6a3b0e91c1f87b0001e5d4a2/select-payment",
    "payWithWallet": "POST /api/invoices/6a3b0e91c1f87b0001e5d4a2/pay-with-wallet"
  }
}
```

| Field | Notes |
|---|---|
| `invoice._id` | Use this for all subsequent payment + status-poll calls |
| `invoice.totalAmount` | Smallest currency unit. `2500` = $25 (no term), `10000` = $100 (3-month bundle). **GST is added on top for Indian buyers.** |
| `combo.bundle` | `null` when no term was bundled. `cartUsd` = what they pay now; `monthsOfAccess` includes the free month; `renewsAtUsd` is the standalone price charged from the cycle after the term. |
| `combo.terms` | The **bundled** catalog — prices available in this cart right now. Buying the same term later costs `standaloneUsd`. Never contains a 1-month entry. |
| `combo.fullPriceFromCycle2` | Monthly rate, used only when no term was bundled |
| `nextSteps` | Hint URLs — the standard invoice payment endpoints |

> The whole cart is a single `unilevel_plus` invoice, so every existing payment method works unchanged. The subscription is issued server-side at fulfilment, not as a second invoice to pay.

### Error responses

| HTTP | `error` code | When |
|---|---|---|
| 400 | `invalid_third_party_client_id` | `thirdPartyClientId` isn't a valid ObjectId |
| 400 | `product_code_mismatch` | `productCode` doesn't match the partner's configured product |
| 400 | `invalid_term` | `termMonths` isn't configured for this product, or the term is currently disabled |
| 400 | `invalid_bundle_price` | Misconfiguration — the bundled cart total doesn't exceed the $25 licence |
| 400 | `invoice_creation_failed` | `createInvoice` threw (validation, etc.) |
| 404 | `client_not_eligible` | Partner missing, inactive, or has no `productConfig.recurringPeriod` |
| 404 | `No active Unilevel Plus plan found` | No active UP plan in DB |
| 409 | `already_has_up` | User already has active Unilevel Plus |
| 409 | `combo_already_used` | User has already redeemed this combo offer |
| 500 | (generic) | Unhandled error |

Example:
```json
{ "success": false, "error": "already_has_up", "message": "You already have an active Unilevel Plus plan." }
```

### How the FE pays after this

Pick any of these — all converge on the same fulfillment that triggers the combo activation:

#### Razorpay (card / UPI)
```
POST /api/invoices/:invoiceId/select-payment
{
  "paymentCurrency": "USD",
  "paymentMethodCategory": "card",
  "paymentPlatform": "razorpay"
}
```
Returns `razorpayOrderId`. FE opens Razorpay modal, then on success:
```
POST /api/invoices/:invoiceId/verify-payment
{
  "razorpayOrderId": "...",
  "razorpayPaymentId": "...",
  "razorpaySignature": "..."
}
```

#### Stripe
```
POST /api/invoices/:invoiceId/select-payment
{
  "paymentCurrency": "USD",
  "paymentMethodCategory": "card",
  "paymentPlatform": "stripe"
}
```
FE uses Stripe Elements; Stripe webhook completes fulfillment server-side.

#### Crypto (NowPayments)
```
POST /api/invoices/:invoiceId/select-payment
{
  "paymentCurrency": "USD",
  "paymentMethodCategory": "crypto",
  "paymentPlatform": "crypto_wallet",
  "returnUrl": "https://app.garage.app/checkout/done"
}
```
FE redirects to the returned `invoice_url`; NowPayments IPN completes fulfillment.

#### Store wallet
```
POST /api/invoices/:invoiceId/pay-with-wallet
{
  "walletType": "store",
  "orgId": "<orgId>"
}
```
Synchronous — debits + fulfills immediately.

#### Affiliate wallet
```
POST /api/invoices/:invoiceId/pay-with-wallet
{
  "walletType": "affiliate"
}
```
Synchronous.

---

## 2) `GET /unilevel-plus/checkout/combo-status/:upInvoiceId`

Polled after the FE submits payment, to confirm both pieces (UP activation + free-month third-party activation) have landed. Safe to call repeatedly — read-only.

### Auth
`Authorization: Bearer <user JWT>` — must be the buyer.

### URL params

| Param | Notes |
|---|---|
| `upInvoiceId` | The `_id` returned from `create-combo-invoice` |

### Response — `200 OK`

```json
{
  "success": true,
  "overall": "success",
  "upInvoice": {
    "_id": "6a3b0e91c1f87b0001e5d4a2",
    "invoiceNumber": "INV-MQQ7C0U5-VXAZ",
    "status": "paid",
    "totalAmount": 2500,
    "itemCurrency": "USD",
    "paidAt": "2026-06-24T10:14:22.331Z",
    "paymentMethodCategory": "wallet",
    "paymentPlatform": "store_wallet"
  },
  "unilevelPlus": {
    "activated": true,
    "purchaseId": "6a3b0e91c1f87b0001e5d4b8",
    "activatedAt": "2026-06-24T10:14:22.984Z",
    "status": "active"
  },
  "thirdParty": {
    "clientName": "NetworkChain",
    "productCode": "GU_SUB_36",
    "activated": true,
    "comboInvoice": {
      "_id": "6a3b0e92c1f87b0001e5d4f1",
      "invoiceNumber": "INV-MQQ7C0U6-AB12",
      "status": "paid",
      "totalAmount": 0,
      "isRecurring": true,
      "recurringPeriod": "monthly",
      "nextDueDate": "2026-07-24T10:14:23.221Z",
      "paidAt": "2026-06-24T10:14:23.117Z"
    },
    "completedAt": "2026-06-24T10:14:23.404Z",
    "failureReason": null,
    "failedAt": null
  }
}
```

### Field reference

#### Top-level
| Field | Type | Notes |
|---|---|---|
| `overall` | `"pending_payment" \| "pending_combo" \| "success" \| "failed"` | Single field the FE can switch on |

State machine:

| `overall` | Meaning | FE behavior |
|---|---|---|
| `pending_payment` | UP invoice still `draft` or `pending` — user hasn't paid yet | Show payment UI |
| `pending_combo` | UP paid but combo not yet stamped — race window between mark-paid and fulfillInvoice, OR fulfillment in progress | **Keep polling** — typically resolves in <2s |
| `success` | UP activated AND combo invoice is `paid` | Show success screen |
| `failed` | UP activated but combo failed (`failureReason` populated) | Show partial-success with support-contact CTA |

Polling guidance: poll every 1–2s for up to 30s after payment. If still `pending_combo` after 30s, surface a "we're still activating, check back shortly" message.

#### `upInvoice`
| Field | Type | Notes |
|---|---|---|
| `_id` / `invoiceNumber` | string | The UP invoice |
| `status` | `"draft" \| "pending" \| "paid" \| "cancelled" \| ...` | Lifecycle state |
| `totalAmount` | number | Cents (`2500` = $25.00) |
| `itemCurrency` | string | `"USD"` typically |
| `paidAt` | ISO date or null | When payment cleared |
| `paymentMethodCategory` | `"card" \| "wallet" \| "crypto" \| "upi" \| null` | How it was paid |
| `paymentPlatform` | `"razorpay" \| "stripe" \| "store_wallet" \| "affiliate_wallet" \| "crypto_wallet" \| ...` | Specific gateway |

#### `unilevelPlus`
| Field | Type | Notes |
|---|---|---|
| `activated` | boolean | `true` once a `UnilevelPlusPurchase` with `status: "active"` exists |
| `purchaseId` | string | The UP purchase record `_id` (only when activated) |
| `activatedAt` | ISO date | `purchasedAt` on the UP record (only when activated) |
| `status` | `"active"` | UP record status |

#### `thirdParty`
| Field | Type | Notes |
|---|---|---|
| `clientName` | string | Partner name (e.g. `"NetworkChain"`) |
| `productCode` | string | Partner product code (e.g. `"GU_SUB_36"`) |
| `activated` | boolean | `true` once the combo invoice exists and is `paid` |
| `comboInvoice` | object or null | The $0 first-cycle invoice (null until created) |
| `comboInvoice.totalAmount` | number | `0` — free first cycle |
| `comboInvoice.isRecurring` | boolean | `true` |
| `comboInvoice.recurringPeriod` | `"weekly" \| "monthly" \| "quarterly" \| "yearly"` | Inherited from partner config |
| `comboInvoice.nextDueDate` | ISO date | When cycle 2 will be billed at full price |
| `completedAt` | ISO date or null | When the combo activation finished |
| `failureReason` | string or null | Error message if combo activation failed |
| `failedAt` | ISO date or null | When the failure was recorded |

### Error responses

| HTTP | `error` code | When |
|---|---|---|
| 400 | `invalid_invoice_id` | `upInvoiceId` isn't a valid ObjectId |
| 400 | `not_a_combo_invoice` | The invoice exists but wasn't created via `create-combo-invoice` |
| 403 | `not_your_invoice` | Auth'd user is not the buyer |
| 404 | `invoice_not_found` | No such invoice |
| 500 | (generic) | Unhandled error |

---

## End-to-end example

```bash
# 1. Create the UP invoice with combo intent
curl -X POST "https://api.garage.app/unilevel-plus/checkout/create-combo-invoice" \
  -H "Authorization: Bearer $USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{ "thirdPartyClientId": "69e1d6109247c7bd0693ee3b" }'
# → { success: true, invoice: { _id: "6a3b...d4a2", ... }, ... }

# 2. Pay via store wallet (sync)
curl -X POST "https://api.garage.app/api/invoices/6a3b...d4a2/pay-with-wallet" \
  -H "Authorization: Bearer $USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{ "walletType": "store", "orgId": "68f1fe05876fcc5fadb61951" }'
# → { success: true, ... } — invoice paid, fulfillInvoice runs, combo fires

# 3. Confirm activation (FE polls every 1–2s up to 30s)
curl "https://api.garage.app/unilevel-plus/checkout/combo-status/6a3b...d4a2" \
  -H "Authorization: Bearer $USER_JWT"
# → { overall: "success", unilevelPlus: { activated: true }, thirdParty: { activated: true, ... } }
```

For Razorpay / Stripe / crypto, step 2 is a 2-call flow (`/select-payment` then completion via modal or webhook) — same final result.

---

## Commission distribution

| Event | UP comp tree ($25 distribution) | Third-party comp (upPortion + platform share) |
|---|---|---|
| User pays $25 for UP | ✅ **Distributes** on `saleAmount: 25`. Pools: company 4%, direct 36%, level 43.2%, infinity T1/T2 7.2% each, manager 2.4%. | n/a |
| User pays a **bundled cart** (e.g. $100 for $25 + 3 months) | ✅ **Distributes on $25 only** — never the cart total. `metadata.bundle.licenceUsd` pins the base; without it the tree would pay out on $100. | see below |
| Free first month ($0) | n/a | ❌ **SKIPPED** — the zero-pay branch marks `commissionDistributed=true` and only fires the webhook. Nothing was collected. |
| Bundle-prepaid cycle (`totalAmount: 0`, `metadata.prepaidViaBundle`) | n/a | ✅ **Distributes** — exempt from the zero-pay skip, because the cash was collected on the licence invoice. Revenue comes from `metadata.bundle.subUsd`. |
| Any paid cycle, 1 month | n/a | ✅ Comp **scales** with what was paid (`scale = paid / price`). This is the only plan that accepts coupons, so compression is wanted. |
| Any paid cycle, 3 / 6 / 12 months | n/a | ✅ Comp is **list-based and uncompressed** — `upPortion` per month covered, run as N separate distributions (`tp_<invoiceId>_<cycle>_m1…mN`). A 12-month prepay pays the upline exactly what 12 monthly invoices would. The platform takes the residual and absorbs the whole discount. |

`paymentId` for a 1-month cycle stays `tp_<invoiceId>_<recurringPaymentNumber>` with **no** suffix, so historical distributions remain idempotent. The platform credit is deduped on `tp_platform_<invoiceId>_<cycle>`.

### Why the combo parent looks the way it does

The combo invoice is shaped so the recurring cron generates **paid** children at the partner's **full price** (otherwise the user gets free months forever and commission never distributes on the recurring revenue):

| Field | Value | Why |
|---|---|---|
| `lineItems[0].unitPrice` | partner full price in cents (e.g. `3600` for $36) | So children inherit full price |
| `subtotal` | full price | Same reason |
| `discount` | full price | Drives `totalAmount` to 0 for the parent |
| `totalAmount` | `0` | Free first cycle |
| `metadata.kind` | `"combo_free_first_month"` | Discriminator that the cron strips before generating children |

Child invoices are **always** recomputed from the parent's component fields (`subtotal − discount + tax`), never from `parent.totalAmount` — so a $0 parent can't propagate $0 forever. That makes the old `combo_free_first_month` special-case redundant; the marker is now only stripped from the child's metadata so fulfilment doesn't re-enter the zero-pay branch.

For third-party subscriptions the child's price comes from the **selected term**, not from the parent's line items: `priceThirdPartyChildCycle` resolves `metadata.pendingTermMonths ?? metadata.termMonths` against `productConfig.termPlans` at **standalone** rates, and recomputes GST for the new base. Bundled pricing never recurs.

### Recurring billing after the free cycle

The free cycle is a fully recurring `Invoice` with `nextDueDate = now + 1 month`. The daily cron (`POST /api/invoices/cron/generate-recurring`) picks it up 5 days before `nextDueDate` and generates the next cycle; the on-payment trigger also mints it immediately whenever a cycle is paid. The user pays via whichever method they configured; comp distributes on each paid cycle.

With a bundled term the shape is: free month → the **prepaid** term (already paid, `totalAmount: 0`) → renewals at the standalone price. A 3-month bundle therefore runs free, $0 (covering months 2–4), then $100 every 3 months.

If the user wants to cancel before the free cycle ends → `POST /api/invoices/:comboInvoiceId/cancel-subscription`. The current period stays honored (they keep access for the free cycle); no further cycles are generated.

### Auditing distribution after deploys

A read-only diagnostic script walks every combo activation and reports any commission anomalies:

```bash
cd garagenew-backend && npx ts-node src/scripts/audit-combo-commissions.ts
```

Reports per-combo: shape correctness (subtotal/discount/total), whether the combo invoice correctly SKIPPED third-party commission, whether the trigger UP invoice fired UP commission, and whether each paid child distributed third-party commission as expected.

---

## Failure mode + admin recovery

If UP is activated (the $25 cleared) but the combo $0 invoice fails to create (e.g. partner config invalid at fulfillment time), the UP invoice gets stamped:
- `metadata.comboFailureReason: "..."`
- `metadata.comboFailedAt: <date>`

UP stays active (user got what they paid for). Combo-status returns `overall: "failed"`.

Support can retry via the internal endpoint:
```bash
curl -X POST "https://api.garage.app/unilevel-plus/checkout/retry-combo/<upInvoiceId>" \
  -H "X-Internal-Api-Key: $INTERNAL_API_KEY"
```
Idempotent — safe to call repeatedly. If the combo invoice already exists, short-circuits and returns the existing one.

---

## Things to check before going live for a new partner

1. The partner's `ThirdPartyClient` row must have:
   - `isActive: true`
   - `productConfig.productCode`
   - `productConfig.totalAmount` (in dollars — the monthly list rate)
   - `productConfig.upPortion` + `productConfig.platformPortion` (the monthly list split)
   - `productConfig.platformUserEmail` resolvable to a real User
   - `productConfig.platformOrgId` resolvable to a real Org
   - `productConfig.recurringPeriod` (one of `weekly` / `monthly` / `quarterly` / `yearly`)
   - `webhookUrl` (so the partner gets notified for the free-month activation via the `invoice.paid` event)
2. `INTERNAL_API_KEY` env var must be set on the backend (required for the retry endpoint).
3. The partner's webhook handler must treat `invoice.paid` with `totalAmount: 0` as a valid activation event (the existing zero-pay branch in our fulfillment fires the webhook for free cycles exactly as it does for paid ones).
4. **For multi-month terms**, `productConfig.termPlans[]` must be seeded (`npx tsx src/scripts/seed-networkchain-term-plans.ts <clientId>`), and each term stays `isActive: false` until the partner honours `termMonths` / `periodEnd` in their webhook handler — see `THIRD_PARTY_INVOICE_API.md` §6.2. A 12-month payment against a handler that adds one month locks the customer out after 30 days. `--activate` is the go-live switch.

---

## Managing the term afterwards — `/api/third-party`

A separate surface from the `/unilevel-plus/checkout` endpoints above, session-authenticated. These work for any subscription the user owns, however it started.

### `GET /api/third-party/subscriptions`

Optional `?clientId=` filter. Returns an **array** — a user can hold more than one chain.

```json
{
  "success": true,
  "subscriptions": [{
    "parentInvoiceId": "6a3b...d4a2",
    "clientName": "NetworkChain",
    "productCode": "GU_SUB_36",
    "currentTermMonths": 3,
    "pendingTermMonths": null,
    "nextDueDate": "2027-02-07T00:00:00.000Z",
    "pendingInvoice": { "id": "6a41...", "invoiceNumber": "INV-…", "status": "draft", "totalAmount": 10000, "termMonths": 3 },
    "canChangeTerm": true,
    "changeBlockedReason": null,
    "terms": [
      { "termMonths": 1,  "totalAmount": 36,  "totalAmountCents": 3600,  "monthlyEquivalent": 36.00 },
      { "termMonths": 3,  "totalAmount": 100, "totalAmountCents": 10000, "monthlyEquivalent": 33.33 },
      { "termMonths": 6,  "totalAmount": 200, "totalAmountCents": 20000, "monthlyEquivalent": 33.33 },
      { "termMonths": 12, "totalAmount": 396, "totalAmountCents": 39600, "monthlyEquivalent": 33.00 }
    ]
  }]
}
```

`terms` here is the **standalone** price list — bundled rates are only available in the original combo cart. Pay `pendingInvoice.id` through the normal invoice rails (`/invoice/:id`).

### `PATCH /api/third-party/subscriptions/:parentInvoiceId/term`

```json
{ "termMonths": 12 }
```
```json
{
  "success": true,
  "parentInvoiceId": "6a3b...d4a2",
  "previousTermMonths": 3,
  "termMonths": 12,
  "effectiveFrom": "2027-02-07T00:00:00.000Z",
  "repricedInvoiceId": "6a41...",
  "status": "applied"
}
```

| `status` | Meaning |
|---|---|
| `applied` | The next unpaid invoice was repriced in place — `repricedInvoiceId` is it |
| `queued` | Takes effect the cycle **after** (the next one is already paid, or a payment is in flight) |
| `noop` | Already on that term; nothing written |

Always surface `effectiveFrom` — say "changes on 7 Feb 2027", never "changed".

**Errors:** `INVALID_TERM` (unknown/disabled), `FORBIDDEN` (not your subscription), `SUBSCRIPTION_NOT_ACTIVE`, `SUBSCRIPTION_CANCELLED`, `TERM_CHANGE_BLOCKED_BY_COUPON` / `TERM_CHANGE_BLOCKED_BY_TRIAL` (a coupon or trial spans cycles, so a multi-month term would multiply its value).

> **Not available:** starting a subscription from scratch. Every user-facing entry point runs through the $25 licence combo; only the partner API (`POST /api/v1/third-party/invoices`) can create a subscription for a user who has no chain.
