# Cashback Codes API

External-integrator reference for the **Garage Cashback Codes** system. This is the contract the external **Garage e-commerce platform** (and any other Garage-SSO client) uses to:

1. Let a logged-in user **create / manage** a cashback code bound to one of their products.
2. **Apply** a cashback code at checkout — in the same `couponCode` field that already accepts platform coupons.
3. Show buyers / creators their **cashback history**.

---

## Table of contents

- [1. Concept in one paragraph](#1-concept-in-one-paragraph)
- [2. Auth — SSO + Bearer JWT](#2-auth--sso--bearer-jwt)
- [3. Base URLs](#3-base-urls)
- [4. End-to-end flows](#4-end-to-end-flows)
  - [4.1 Create a code](#41-create-a-code)
  - [4.2 Apply a code at checkout (ecommerce)](#42-apply-a-code-at-checkout-ecommerce)
  - [4.3 Post-payment: what the backend does](#43-post-payment-what-the-backend-does)
- [5. Endpoint reference](#5-endpoint-reference)
  - [POST /cashback-codes](#post-cashback-codes)
  - [GET /cashback-codes](#get-cashback-codes)
  - [GET /cashback-codes/me/summary](#get-cashback-codesme-summary)
  - [GET /cashback-codes/me/received](#get-cashback-codesme-received)
  - [GET /cashback-codes/eligible-items](#get-cashback-codeseligible-items)
  - [GET /cashback-codes/eligible-buyers](#get-cashback-codeseligible-buyers)
  - [GET /cashback-codes/:id](#get-cashback-codesid)
  - [PATCH /cashback-codes/:id](#patch-cashback-codesid)
  - [POST /cashback-codes/:id/activate](#post-cashback-codesidactivate)
  - [POST /cashback-codes/:id/deactivate](#post-cashback-codesiddeactivate)
  - [GET /cashback-codes/:id/distributions](#get-cashback-codesiddistributions)
- [6. Ecommerce checkout endpoints (existing — coupon field accepts cashback codes)](#6-ecommerce-checkout-endpoints-existing--coupon-field-accepts-cashback-codes)
- [7. Eligibility rules](#7-eligibility-rules)
- [8. Validation rules at checkout](#8-validation-rules-at-checkout)
- [9. Error codes](#9-error-codes)
- [10. Data shapes (TypeScript)](#10-data-shapes-typescript)
- [11. Worked example — end-to-end](#11-worked-example--end-to-end)
- [12. FAQ + edge cases](#12-faq--edge-cases)

---

## 1. Concept in one paragraph

A **creator** (any UP-active affiliate with ≥1 direct downline, or the platform super-admin) issues a **cashback code** bound to **exactly one product** at **exactly one rate %**, optionally restricted to a whitelist of their direct downline. When a whitelisted buyer applies the code at checkout, they pay full price; after payment, the configured % is **transferred from the creator's `AffiliateWallet` → the buyer's `StoreWallet` for the seller's org**. The rate is **capped at the actual level-1 commission rate** earned on the sale, so the creator can never go negative.

The system runs in parallel with `PlatformCoupon`. A single checkout input handles both; if the code matches a `PlatformCoupon`, it wins; otherwise it's tried as a `CashbackCode`.

---

## 2. Auth — SSO + Bearer JWT

All endpoints require a Garage user JWT in the `Authorization` header:

```
Authorization: Bearer <garage-jwt>
```

The JWT carries `{ userId, email }`. The external e-commerce platform is expected to forward the **same** Garage JWT it already uses for the rest of the Garage API (SSO assumption). No platform-key / API-key mode is exposed for these routes — they are always user-scoped.

**Mutating routes** + the two **picker** routes (`/eligible-items`, `/eligible-buyers`) additionally enforce **creator eligibility**: the caller must be an active `UnilevelPlusPurchase` holder with ≥1 direct downline, OR the platform super-admin (`GarageAdminModel { role: "garage-super-admin", isActive: true }`).

---

## 3. Base URLs

| Surface | Base URL |
|---|---|
| Cashback Codes router | `<API_URL>/cashback-codes` |
| Ecommerce invoice router | `<API_URL>/api/ecommerce` |

`<API_URL>` is the Garage backend host the SSO is configured against.

---

## 4. End-to-end flows

### 4.1 Create a code

```
external storefront            Garage backend
       │
       │ user opens "Create cashback code" UI
       │
       │  ── GET /cashback-codes/eligible-items
       │     ?productType=ecommerce
       │     &orgId=<store-org-id>
       │     Authorization: Bearer <user-jwt>
       │ ───────────────────────────────►
       │ ◄─── 200 { items: [{ itemId, title, price, ... }] }
       │
       │ user picks ONE item from the list, sets rate %, optional buyers
       │
       │  ── (optional) GET /cashback-codes/eligible-buyers
       │     Authorization: Bearer <user-jwt>
       │ ───────────────────────────────►
       │ ◄─── 200 { buyers: [{ _id, name, email, ... }] }
       │
       │  ── POST /cashback-codes
       │     { code, name, productType: "ecommerce",
       │       itemId, ratePct: 5, allowedBuyerIds?: [...] }
       │ ───────────────────────────────►
       │ ◄─── 201 { code: <CashbackCode> }
       │
       │ store the returned code._id locally if you want to manage it
       │ from your UI; or always re-fetch via GET /cashback-codes
       ▼
```

### 4.2 Apply a code at checkout (ecommerce)

The user pastes the code into the same `couponCode` input the storefront already uses for platform coupons. Nothing new on the request side — the validator on the backend decides what kind of code it is.

```
storefront checkout                Garage backend
       │
       │  ── POST /api/ecommerce/cart/preview
       │     { items: [...], displayCurrency: "USD",
       │       couponCode: "SAVE5" }
       │     Authorization: Bearer <buyer-jwt>
       │ ─────────────────────────────────►
       │
       │   Backend tries:
       │     1. PlatformCoupon lookup → if it matches, returns discounted total
       │     2. Else: CashbackCode lookup
       │          → if valid, total stays full,
       │            response includes appliedCashbackCode +
       │            cashbackEstimateUsd
       │          → if invalid, 400 with the typed error
       │
       │ ◄─── 200 { subtotal, discount, total, displayCurrency,
       │            appliedCashbackCode: "SAVE5",
       │            appliedCashbackCodeId: "...",
       │            cashbackEstimateUsd: 7.50 }
       │
       │ Show the buyer:
       │   "Pay $150 now — you'll receive ~$7.50 cashback to your
       │    Store Wallet after payment."
       │
       │  ── POST /api/ecommerce/invoices  (same body, with shipping etc.)
       │ ─────────────────────────────────►
       │ ◄─── 200 { invoice: { _id, totalAmount, ... }, payUrl }
       │
       │ buyer completes payment via payUrl as normal
       ▼
```

### 4.3 Post-payment: what the backend does

After the buyer pays, `fulfillInvoice()` runs the existing pipeline, then calls `executeCashback(invoice)`. The external platform does NOT need to do anything for this — it is fully internal:

1. Read `invoice.cashbackCodeId`. If null, return (no cashback on this invoice).
2. Re-validate: code is still active, buyer still direct downline, level-1 recipient on the just-written `CommissionDistribution` equals the code's creator.
3. Compute `appliedRatePct = min(code.ratePct, level1RatePct)` — capping rule.
4. Atomically:
   - Debit `AffiliateWallet[creator].balance` by the cashback USD.
   - Credit `StoreWallet[buyer, sellerOrgId].balance` (auto-create if missing).
   - Write a `WalletTransaction` row for each side.
   - Write one `CashbackDistribution` row with `status: "completed"` (or `"skipped"` / `"failed"` with a reason if anything tripped).
5. Increment `code.currentUsageCount`.

**Failure semantics** — if a step fails, no exception bubbles to the caller, the invoice + commission stay finalized, and a `CashbackDistribution` row is written with `status: "failed"` / `"skipped"` and a `failureReason`. The buyer's payment is never reversed for a cashback issue.

---

## 5. Endpoint reference

> All non-trivial responses are `application/json`. Every response has a `success: boolean`. On `success: false`, an `error: string` (and sometimes a `reason` / `details`) is included.

### POST /cashback-codes

Create a code. **Eligibility gate** enforced.

**Body**

| Field | Type | Required | Notes |
|---|---|---|---|
| `code` | string | ✓ | 3–20 chars, `[A-Za-z0-9_-]`. Stored uppercase. |
| `name` | string | ✓ | 1–100 chars. Display label. |
| `description` | string | – | ≤ 500 chars. Internal note. |
| `productType` | enum | ✓ | One of `"product" \| "channel" \| "course" \| "workshop" \| "service" \| "call" \| "ecommerce"`. |
| `itemId` | ObjectId string | ✓ | The ID of the product in its native collection (StoreProduct for ecommerce, Channel for channel, etc.). |
| `ratePct` | number | ✓ | `> 0` and `≤ 100`. Cashback % of sale (cap'd at the real level-1 rate at payout). |
| `allowedBuyerIds` | ObjectId[] | – | ≤ 500 buyers. Every entry MUST be a direct downline of the caller (validated). Empty/omitted = any direct downline. |
| `cycleCount` | int ≥ 1 | – | For subscription products, how many cycles the code applies per buyer. Defaults to 1. |
| `validFrom` | ISO datetime | – | Defaults to "now". |
| `validUntil` | ISO datetime | – | If set, code stops working after this. |
| `maxUsageCount` | int ≥ 1 | – | Cap total usages across all buyers. |
| `maxUsagePerUser` | int ≥ 1 | – | Cap usages per individual buyer. |
| `minOrderAmountCents` | int ≥ 0 | – | Min cart amount before the code applies. |

**Responses**

| Code | Body |
|---|---|
| `201` | `{ success: true, code: <CashbackCode> }` |
| `400` | `{ success: false, error: "Invalid body", details: ZodIssues[] }` — zod failed |
| `400` | `{ success: false, error: "Selected product not found" }` — itemId doesn't exist / is archived |
| `400` | `{ success: false, error: "allowedBuyerIds contains non-direct entries", invalidIds: [...] }` |
| `403` | `{ success: false, error: "Not eligible to create cashback codes", reason: "no_direct_downline" \| "unilevel_plus_required" }` |
| `409` | `{ success: false, error: "Code already exists" }` |
| `409` | `{ success: false, error: "Code is already used by a platform coupon" }` |
| `500` | unexpected |

**Example**

```bash
curl -X POST "$API_URL/cashback-codes" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "SAVE5",
    "name": "5% back for early supporters",
    "productType": "ecommerce",
    "itemId": "65f8d2c1a3b4e5d6f7a8b9c0",
    "ratePct": 5,
    "allowedBuyerIds": ["65f8d2c1a3b4e5d6f7a8b900"],
    "cycleCount": 1,
    "maxUsagePerUser": 1
  }'
```

---

### GET /cashback-codes

List the caller's codes. No eligibility gate (read-only).

**Query**

| Param | Type | Notes |
|---|---|---|
| `status` | `"active" \| "inactive"` | Optional. |
| `productType` | enum | Optional. |
| `limit` | int | Default 50, max 200. |
| `skip` | int | Default 0. |

**Response — `200`**

```json
{
  "success": true,
  "codes": [<CashbackCode>, ...],
  "total": 17
}
```

---

### GET /cashback-codes/me/summary

Aggregated creator summary for a dashboard strip (one round-trip).

**Response — `200`**

```json
{
  "success": true,
  "totalPaidOutUsd": 127.50,
  "activeCodesCount": 4,
  "totalCodesCount": 9
}
```

---

### GET /cashback-codes/me/received

Per-buyer cashback history. Returns completed distributions where `buyerId === me`.

**Query**: `limit`, `skip` — same as listing.

**Response — `200`**

```json
{
  "success": true,
  "distributions": [<CashbackDistribution>, ...],
  "total": 12,
  "totalReceived": 87.30
}
```

---

### GET /cashback-codes/eligible-items

Populate the **product picker** in the create form.

**Eligibility gate** enforced.

**Query (required)**

| Param | Type | Notes |
|---|---|---|
| `productType` | enum | Required. One of the 7 cashback product types. |
| `orgId` | ObjectId | Required. The org whose catalog you want to list. For the external storefront, pass your store's org ID. |

**Behavior** — bounded list of items in that org (Channel for channel, Course for course, …, StoreProduct for ecommerce). Sort: most-recently-updated first.

**Response — `200`**

```json
{
  "success": true,
  "items": [
    {
      "itemId": "65f8...",
      "productType": "ecommerce",
      "orgId": "65a1...",
      "title": "Garage Beauty — Vitamin Serum",
      "price": 4500,
      "currency": "INR",
      "image": "https://..."
    }
  ]
}
```

**Errors**: `400` for missing/invalid params, `403` for ineligible caller (with `reason`).

---

### GET /cashback-codes/eligible-buyers

Populate the **buyer-whitelist picker** in the create form. Returns the caller's full direct downline.

**Eligibility gate** enforced.

**Response — `200`**

```json
{
  "success": true,
  "buyers": [
    {
      "_id": "65f8...",
      "name": "Asha Reddy",
      "email": "asha@example.com",
      "profilePicture": "https://..."
    }
  ]
}
```

---

### GET /cashback-codes/:id

Fetch one. Only returns the doc if the caller owns it.

**Response — `200`**: `{ success: true, code: <CashbackCode> }`
**Response — `404`**: `{ success: false, error: "Not found" }`

---

### PATCH /cashback-codes/:id

Update mutable fields. **`code`, `productType`, `itemId` are IMMUTABLE** — omit them.

**Mutable fields**: `name`, `description`, `ratePct`, `allowedBuyerIds`, `cycleCount`, `validFrom`, `validUntil`, `maxUsageCount`, `maxUsagePerUser`, `minOrderAmountCents`.

**Eligibility gate** enforced.

**Response — `200`**: `{ success: true, code: <CashbackCode> }`

---

### POST /cashback-codes/:id/activate

Flip status → `"active"`.

**Response — `200`**: `{ success: true, code: <CashbackCode> }`

---

### POST /cashback-codes/:id/deactivate

Flip status → `"inactive"`. Existing distributions are NOT clawed back.

**Response — `200`**: `{ success: true, code: <CashbackCode> }`

---

### GET /cashback-codes/:id/distributions

Creator analytics — paginated list of payout rows for one code.

**Query**: `limit`, `skip`.

**Response — `200`**

```json
{
  "success": true,
  "distributions": [<CashbackDistribution>, ...],
  "total": 23,
  "totals": {
    "completedCount": 21,
    "completedAmount": 105.40,
    "skippedCount": 1,
    "failedCount": 1
  }
}
```

Returns empty + `totals: null` if the caller doesn't own the code.

---

## 6. Ecommerce checkout endpoints (existing — coupon field accepts cashback codes)

These are NOT new routes; they are the existing ecommerce-checkout endpoints, now extended so the **same `couponCode` input accepts a CashbackCode** as a fallback.

### POST /api/ecommerce/cart/preview

**Body**

```json
{
  "items": [
    { "productId": "65f8...", "quantity": 2, "variantId": "65f8..." }
  ],
  "displayCurrency": "USD",
  "couponCode": "SAVE5"
}
```

**Resolution order** (server-side):
1. `couponCode` → tried as a `PlatformCoupon`. If found AND applicable → coupon path (discount applied inline).
2. If no `PlatformCoupon` matches → tried as a `CashbackCode`. If valid → cashback path (no discount; preview surfaces the estimate).
3. Otherwise → `400 INVALID_COUPON`.

**Response (cashback path, `200`)**

```json
{
  "success": true,
  "lineItems": [...],
  "subtotal": 15000,
  "discount": 0,
  "total": 15000,
  "displayCurrency": "USD",
  "exchangeRate": null,
  "inventoryIssues": [],
  "appliedCashbackCode": "SAVE5",
  "appliedCashbackCodeId": "65f8...",
  "cashbackEstimateUsd": 7.50,
  "currency": "USD"
}
```

> `cashbackEstimateUsd` is an **upper bound**. Real amount at payout = `min(code.ratePct, actualLevel1RatePct) × matched-line-total`.

**Response (coupon path, `200`)** — existing behavior; `appliedCouponCode` set, `discount > 0`.

**Errors**

| Code | Body |
|---|---|
| `400 INVALID_COUPON` | The input matched no PlatformCoupon AND no CashbackCode, OR the matched code failed its eligibility gates (not direct downline, expired, etc.). The user-facing message is in `error`. |
| `400 INVALID_INPUT` | Cart shape problems (empty cart, > 50 items, bad currency, bad ObjectId). |

### POST /api/ecommerce/invoices

Same body + `couponCode` field, plus shipping address etc. On success, the invoice doc is created with `invoice.cashbackCodeId` stamped (if the input resolved to a cashback). After the buyer pays, the post-payment hook fires automatically (see §4.3).

---

## 7. Eligibility rules

### Creator (at code-create / update / activate, AND re-checked at payout time)

| Check | Pass condition |
|---|---|
| Super-admin bypass | `GarageAdminModel.exists({ email: <caller>, role: "garage-super-admin", isActive: true })` |
| OR has at least one direct | `User.exists({ referredBy: <callerId> })` |
| AND has an active Unilevel Plus | `UnilevelPlusPurchase.exists({ userId: <callerId>, status: "active" })` |

Reasons returned on `eligible: false`:
- `"no_direct_downline"` — caller has no direct referrals.
- `"unilevel_plus_required"` — caller has directs but no active UP.

### Buyer (at code-validate time, before invoice creation)

1. `buyer.referredBy === code.creatorId` (strict level-1).
2. `buyer._id !== code.creatorId` (no self-cashback).
3. Code is `status: "active"` AND `validFrom ≤ now ≤ validUntil`.
4. Cart contains a line where `(productType, itemId) === (code.productType, code.itemId)`.
5. If `allowedBuyerIds` is set, buyer's ID is in it.
6. `code.currentUsageCount < code.maxUsageCount` (when set).
7. Buyer's prior completed uses `< code.maxUsagePerUser` (when set).
8. Cart amount `≥ code.minOrderAmountCents` (when set).
9. For subscriptions: `completed CashbackDistribution count for (codeId, buyerId, subscriptionRootId) < code.cycleCount`.

Failing any of (1)–(8) rejects the code with a typed error at preview / invoice-create. (9) is checked at payout — earlier cycles succeed; later ones land as `status: "skipped"` with `failureReason: "cycle_count_exhausted"`.

---

## 8. Validation rules at checkout

| Step | What's checked |
|---|---|
| `code` lookup | First as PlatformCoupon, then as CashbackCode. Coupon wins on collisions. |
| Per-product | `code.productType` + `code.itemId` must appear in the cart. |
| Direct downline | Buyer's `referredBy` must equal `code.creatorId`. |
| Whitelist | If set, buyer must be in `allowedBuyerIds`. |
| Active window | `validFrom ≤ now ≤ validUntil`; `status === "active"`. |
| Usage caps | Total + per-user caps not yet hit. |
| Min order | Cart amount meets the floor. |

If everything passes, the preview returns the cashback estimate and the invoice is created with `cashbackCodeId` stamped — the buyer pays the **full** amount.

---

## 9. Error codes

### Validation / business-rule errors (cart preview, invoice creation)

| HTTP | `code` | When | Sample `error` |
|---|---|---|---|
| `400` | `INVALID_COUPON` | Code doesn't match any PlatformCoupon AND any CashbackCode | `"Invalid coupon code"` |
| `400` | `INVALID_COUPON` | Cashback code matched but cart doesn't contain its bound product | `"This code doesn't apply to any item in your cart"` |
| `400` | `INVALID_COUPON` | Buyer is not the creator's direct downline | `"This cashback code is only valid for direct referrals of the code creator."` |
| `400` | `INVALID_COUPON` | Buyer is the creator | `"You can't use your own cashback code"` |
| `400` | `INVALID_COUPON` | Code inactive / expired / not yet valid | `"Code is not active" \| "Code has expired" \| "Code is not yet valid"` |
| `400` | `INVALID_COUPON` | Whitelist set and buyer not on it | `"This code is not valid for your account."` |
| `400` | `INVALID_COUPON` | Usage caps exhausted | `"Code usage limit reached" \| "You've already used this code"` |
| `400` | `INVALID_COUPON` | Below min order amount | `"Order doesn't meet the minimum amount"` |
| `400` | `INVALID_INPUT` | Cart shape problems | issue-specific |

### CRUD errors (cashback CRUD endpoints)

| HTTP | When |
|---|---|
| `400` `"Invalid body"` + `details` | Zod failure |
| `400` `"Selected product not found"` | `itemId` doesn't exist or item is archived |
| `400` `"allowedBuyerIds contains non-direct entries"` | One or more entries aren't direct downline |
| `403` `"Not eligible to create cashback codes"` + `reason` | Caller fails creator gate |
| `404` `"Not found"` | ID doesn't exist OR caller doesn't own it |
| `409` `"Code already exists"` | Duplicate code |
| `409` `"Code is already used by a platform coupon"` | Code string conflicts with a PlatformCoupon |
| `500` | Unexpected |

### Internal post-payment failure reasons (visible in `CashbackDistribution.failureReason`)

Set by `executeCashback` when the cashback couldn't flow but the invoice itself is fine.

| Reason | Meaning |
|---|---|
| `"code_inactive_at_execution"` | Code was deactivated between checkout and payment. |
| `"buyer_referredby_changed"` | Buyer is no longer a direct downline. |
| `"cycle_count_exhausted"` | All subscription cycles already paid. |
| `"level1_is_not_creator"` | Sale flowed up someone else's chain (defensive). |
| `"insufficient_creator_balance"` | Creator's `AffiliateWallet` doesn't have enough. |
| `"no_matching_line"` | Bound product not in the invoice. |
| `"no_commission_distribution"` | Distribution row not written (extremely rare). |

The buyer's payment is never reversed for a failure here. The status is logged for visibility on the creator's dashboard.

---

## 10. Data shapes (TypeScript)

```ts
type CashbackProductType =
  | "product" | "channel" | "course" | "workshop"
  | "service" | "call"    | "ecommerce";

interface CashbackCode {
  _id: string;
  code: string;                   // uppercase
  name: string;
  description?: string;
  creatorId: string;
  status: "active" | "inactive";
  productType: CashbackProductType;
  itemId: string;                 // bound to ONE product
  orgId: string;                  // derived from the bound item
  ratePct: number;                // 0 < x ≤ 100
  allowedBuyerIds: string[];      // optional whitelist; subset of creator's directs
  cycleCount: number;             // ≥ 1
  validFrom: string;              // ISO
  validUntil?: string;            // ISO
  maxUsageCount?: number;
  maxUsagePerUser?: number;
  currentUsageCount: number;
  minOrderAmountCents?: number;
  createdAt: string;
  updatedAt: string;
}

interface EligibleItem {
  itemId: string;
  productType: CashbackProductType;
  orgId: string;
  title: string;
  price: number;                  // smallest unit in `currency`
  currency: "USD" | "INR";
  image?: string;
}

interface EligibleBuyer {
  _id: string;
  name?: string;
  email?: string;
  profilePicture?: string;
}

interface CashbackDistribution {
  _id: string;
  codeId: string;
  invoiceId: string;
  invoiceLineItemIndex: number;
  subscriptionRootId: string;
  creatorId: string;
  buyerId: string;
  sellerOrgId: string;            // the StoreWallet that got credited
  productType: string;
  itemId?: string;
  saleAmountCents: number;
  saleCurrency: string;
  level1RatePct: number;          // the real rate at payout
  configuredRatePct: number;      // what the code was set to
  appliedRatePct: number;         // = min(configuredRatePct, level1RatePct)
  cashbackAmount: number;         // float USD
  cycleNumber: number;            // 1 = first sale, 2 = first renewal, ...
  affiliateTxId?: string;         // ref WalletTransaction (the debit)
  storeTxId?: string;             // ref WalletTransaction (the credit)
  status: "completed" | "skipped" | "failed";
  failureReason?: string;
  createdAt: string;
}

interface CashbackPreviewSurface {  // fields added to /api/ecommerce/cart/preview response
  appliedCashbackCode?: string;
  appliedCashbackCodeId?: string;
  cashbackEstimateUsd?: number;
}
```

---

## 11. Worked example — end-to-end

**Setup** — creator `Asha` ($1,000 in AffiliateWallet, active UP, has direct downline `Ravi`). Asha wants to give Ravi 5% cashback on the storefront's "Vitamin Serum" StoreProduct (`itemId = SERUM_ID`, sold for ₹4,500 by org `STORE_ORG_ID`).

**1) Asha creates the code on the storefront.**

```bash
POST /cashback-codes
{
  "code": "ASHA5",
  "name": "5% for Ravi",
  "productType": "ecommerce",
  "itemId": "SERUM_ID",
  "ratePct": 5,
  "allowedBuyerIds": ["RAVI_ID"],
  "maxUsagePerUser": 1
}
```

→ `201 { code: { _id: "CODE_ID", currentUsageCount: 0, ... } }`

**2) Ravi previews his cart with the code.**

```bash
POST /api/ecommerce/cart/preview
{
  "items": [{ "productId": "SERUM_ID", "quantity": 1 }],
  "displayCurrency": "INR",
  "couponCode": "ASHA5"
}
```

→ `200 { subtotal: 450000, total: 450000, appliedCashbackCode: "ASHA5", cashbackEstimateUsd: 2.71 }`

(The 2.71 is `5% of ₹4500 ≈ $2.71` at the current FX rate. The actual amount is capped at the real level-1 rate at payout time.)

**3) Ravi places the order, pays.** `invoice.cashbackCodeId = "CODE_ID"`.

**4) Backend executes the cashback post-payment.**

- Looks up the `CommissionDistribution` row for this invoice. Level-1 recipient is Asha, level-1 rate is, say, 10%.
- `appliedRatePct = min(5, 10) = 5`.
- `cashbackAmount = $54 × 5% = $2.70`.
- Atomic transfer: AffiliateWallet[Asha] -$2.70, StoreWallet[Ravi, STORE_ORG_ID] +$2.70.
- Writes `CashbackDistribution { status: "completed", cashbackAmount: 2.70, ... }`.
- `code.currentUsageCount` → 1.

**5) Both parties see the result.**

- Asha: `GET /cashback-codes/me/summary` → `totalPaidOutUsd: 2.70`.
- Asha: `GET /cashback-codes/CODE_ID/distributions` → 1 row, status: completed, $2.70.
- Ravi: `GET /cashback-codes/me/received` → 1 row, +$2.70. Plus his `StoreWallet` balance for `STORE_ORG_ID` is up by $2.70.

---

## 12. FAQ + edge cases

**Q: What if the buyer is not in the creator's direct downline?**
A: The preview / invoice-create endpoint rejects with `INVALID_COUPON` and a clear error. No invoice is created. The cashback is never applied.

**Q: What if the creator's AffiliateWallet is empty when the buyer pays?**
A: The invoice + commission distribution complete normally. The cashback is logged with `status: "failed"` and `failureReason: "insufficient_creator_balance"`. The buyer is not credited; they paid full price as expected.

**Q: What if the buyer's `referredBy` changes between checkout and payment?**
A: Defensive — `executeCashback` re-checks. If broken, logs `status: "skipped"` and `failureReason: "buyer_referredby_changed"`. No movement.

**Q: Can the creator give 100%?**
A: Schema allows up to 100. At payout, the real applied rate is `min(configuredRatePct, level1RatePct)`, so they can never give more than their actual level-1 commission. If level-1 is 10% on this product, configuring 100% just means "give it all" — they'll end up giving 10%.

**Q: What about subscription products (channels, recurring workshops)?**
A: `cycleCount` controls how many renewal invoices fire cashback per buyer-subscription pair. Renewal #N's `CashbackDistribution` row uses `subscriptionRootId` (the original invoice's ID) to count prior cycles. Once `cycleCount` is hit, subsequent renewals log `status: "skipped"` with `failureReason: "cycle_count_exhausted"`.

**Q: Currency?**
A: `cashbackAmount` is always **USD float** (matches AffiliateWallet + StoreWallet's wallet currency). Sale amount in the source currency is converted via the same `convertSmallestUnit` path the rest of the platform uses.

**Q: Can a code be used at the same time as a platform coupon?**
A: No — they are mutually exclusive. The single `couponCode` field at checkout is tried as a PlatformCoupon first; only if that lookup misses is it tried as a CashbackCode. If both ever existed with the same string, the PlatformCoupon would win, but a unique-index check at code creation prevents the collision.

**Q: Refunds?**
A: Out of scope. The platform has no refund flow. If a refund flow is added later, the cashback claw-back would need a new policy decision (clawback the creator's StoreWallet credit? Or eat it?).

**Q: Is there a webhook when cashback fires?**
A: Not in v1. The external storefront should re-fetch the buyer's `StoreWallet` after the order is marked paid if it wants to display the credit. The creator dashboard can poll `GET /cashback-codes/me/summary` or `GET /cashback-codes/:id/distributions`.

**Q: Is there a rate limit?**
A: Same global rate limits as the rest of the Garage API — no endpoint-specific limits on the cashback routes.

---

## Changelog

| Version | Notes |
|---|---|
| 1.0 | Initial — single-product / single-rate model, optional buyer whitelist, post-paid wallet transfer. |
