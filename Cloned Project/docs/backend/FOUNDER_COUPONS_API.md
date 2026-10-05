# Founder Coupon Management API

All endpoints here are scoped to a single organization (`:orgId`) and gated by founder access (the calling user must be a `founder` of that org per `hasFounderAccess(membership)`). They split across **four mount points**, each exposing a different surface of the coupon lifecycle:

| Mount | File | Purpose |
|---|---|---|
| `/org` | [`routes/founderCoupons.ts`](src/routes/founderCoupons.ts) | Legacy founder coupons (percentage-discount only, no subscription cycle support). |
| `/org/:orgId/platform-coupons` | [`routes/founderPlatformCoupons.ts`](src/routes/founderPlatformCoupons.ts) | **Current** founder coupon system. Single-item targeting, fixed-or-percent discounts, subscription cycle support, assignment-to-users. |
| `/org/:orgId/coupon-eligible-items` | [`routes/founderCouponItems.ts`](src/routes/founderCouponItems.ts) | Lookup of sellable items inside the org, used by the coupon/rule editors to populate the item picker. |
| `/org/:orgId/coupon-rules` | [`routes/founderCouponRules.ts`](src/routes/founderCouponRules.ts) | "Buy X, get coupon Y" automation rules. |

All responses use the standard `{ success: boolean, ... }` envelope. All endpoints require a Bearer JWT (`requireAuth`).

---

## Allowed product types

`ecommerce` is now wired through every active founder coupon surface plus the redemption path. Founders can mint a coupon targeting their storefront (StoreProduct) items, the ecommerce checkout redeems it as `productType: "ecommerce"`, and the rule engine can trigger off storefront purchases.

| Surface | Allowed `productType` / `applicableTo` values | ecommerce? |
|---|---|---|
| `routes/founderCoupons.ts` (legacy `applicableTo`) | `channel`, `course`, `workshop`, `product` | ❌ |
| `routes/founderPlatformCoupons.ts` (`FOUNDER_PRODUCT_TYPES`) | `channel`, `course`, `workshop`, `product`, `service`, `call`, **`ecommerce`** | ✅ |
| `routes/founderCouponItems.ts` (`PRODUCT_TYPES`) | `channel`, `course`, `workshop`, `product`, `service`, `call`, **`ecommerce`** | ✅ |
| `routes/founderCouponRules.ts` (`PRODUCT_TYPES`) | `channel`, `course`, `workshop`, `product`, `service`, `call`, **`ecommerce`** | ✅ |
| `models/platformCoupon.model.ts` enum (model-level) | `office_plan`, `unilevel_plus`, `third_party_subscription`, `channel`, `course`, `workshop`, `product`, `service`, `call`, **`ecommerce`** | ✅ |
| `models/couponRule.model.ts` enum (`CouponRuleProductType`) | `channel`, `course`, `workshop`, `product`, `service`, `call`, `office_plan`, `unilevel_plus`, `third_party_subscription`, **`ecommerce`** | ✅ |
| `services/platformCoupon.ts` (validation friendly map) | All of the above; `ecommerce` reads as **"storefront items"** in error copy | ✅ |
| `routes/platformCoupons.ts` (garage-admin platform create) | `office_plan`, `unilevel_plus`, `third_party_subscription` | ❌ (still only platform-level types — by design) |
| `services/ecommerceInvoice.ts` (redemption) | Cart preview/create validates the coupon as `productType: "ecommerce"`. | ✅ |

**Backing collection for ecommerce items.** Storefront products live in `StoreProduct` (not the regular `Product` model). The new founder surfaces query `StoreProduct.find({ orgId, status: "active" })`. Display fields used:
- `title`, `price`, `currency`
- `featuredImage` (preferred) → `images[0].url` (fallback)
- `status`

`isRecurring` is always `false` for ecommerce — storefront items are one-time purchases, so `cycleCount` is coerced to `undefined` on the create handler.

If you want founders to create coupons valid at their ecommerce store, that requires extending `FOUNDER_PRODUCT_TYPES` in `routes/founderPlatformCoupons.ts` to include `"ecommerce"` (plus a corresponding lookup branch in `routes/founderCouponItems.ts`).

---

## 1. Legacy founder coupons (`/org`)

Mount: `app.use("/org", founderCouponsRoutes)`
File: [`routes/founderCoupons.ts`](src/routes/founderCoupons.ts)
Discount type: **percent only** (`discountValue` 1-100). No `cycleCount`, no `discountType` selector, no subscription support.

### `GET /org/:orgId/coupons/available-items`
List sellable items in the org, optionally filtered by type.

**Query** — `types` (optional, comma-separated): one or more of `channel`, `course`, `workshop`, `product`. Defaults to all four.

**Response** — `{ success: true, items: [...] }`.

---

### `POST /org/:orgId/coupons`
Create a coupon.

**Body**
```ts
{
  code: string,                // 3-20 chars, [A-Za-z0-9_-]
  name: string,                // 1-100
  description?: string,        // ≤ 500
  media?: string,              // optional URL (≤ 2048) — banner / cover image
  discountValue: number,       // 1-100 (percent)
  maxDiscountAmount?: number,  // cap on percent discount, smallest unit
  applicableTo: Array<"channel" | "course" | "workshop" | "product">,
  specificItemIds?: string[],  // restrict to these items only
  validFrom?: ISOString,
  validUntil?: ISOString,
  maxUsageCount?: number,
  maxUsagePerUser?: number,
  minOrderAmount?: number
}
```

**Response (201)** — `{ success: true, coupon }`.

---

### `GET /org/:orgId/coupons`
List org coupons.

**Query** — `status?`, `skip?`, `limit?`.

**Response** — `{ success: true, coupons: [...], total }` (forwarded from `listCoupons`).

---

### `GET /org/:orgId/coupons/:couponId`
Fetch a single coupon. 404 if the coupon doesn't belong to `:orgId`.

---

### `PATCH /org/:orgId/coupons/:couponId`
Update a coupon. Same body shape as create but all fields optional, plus `status?: "active" | "inactive"`.

---

### `DELETE /org/:orgId/coupons/:couponId`
Deactivate (soft) a coupon.

**Response** — `{ success: true, message: "Coupon deactivated", coupon }`.

---

### `GET /org/:orgId/coupons/:couponId/analytics`
Aggregate redemption metrics for a single coupon.

**Response** — `{ success: true, coupon, analytics }`.

---

## 2. Founder platform coupons (`/org/:orgId/platform-coupons`)

Mount: `app.use("/org/:orgId/platform-coupons", founderPlatformCouponsRoutes)`
File: [`routes/founderPlatformCoupons.ts`](src/routes/founderPlatformCoupons.ts)
Discount type: **fixed or percent** (`discountType`). Currency-aware. Supports subscription cycle counts.

### `GET /org/:orgId/platform-coupons`
List org-scoped platform coupons.

**Query** — `productType?`, `status?`, `limit?`, `skip?`.

**Response** — `{ success: true, coupons: [...], total, ... }`.

---

### `POST /org/:orgId/platform-coupons`
Create a platform coupon owned by this org.

**Body**
```ts
{
  code: string,                              // 3-20, [A-Za-z0-9_-]
  name: string,                              // 1-100
  description?: string,                      // ≤ 500
  media?: string,                            // optional URL (≤ 2048) — banner / cover image
  productType:
    | "channel"
    | "course"
    | "workshop"
    | "product"
    | "service"
    | "call"
    | "ecommerce",                          // storefront items (StoreProduct)
  discountType: "fixed" | "percent",
  discountValue: number,                     // fixed: smallest unit; percent: 1-100
  maxDiscountAmount?: number,
  currency?: "USD" | "INR",
  cycleCount?: number,                       // required if the targeted item isSubscription
  validFrom?: ISOString,
  validUntil?: ISOString,
  maxUsageCount?: number,
  maxUsagePerUser?: number,
  minOrderAmount?: number,
  specificItemIds?: string[]                 // exactly 1 → enables cycleCount enforcement
}
```

**Validation cross-checks**
- Percent: `discountValue` must be 1-100.
- If `specificItemIds.length === 1` and the item is a subscription (e.g. recurring channel/course/workshop/product), `cycleCount` is **required**.
- If the targeted item is NOT recurring but the caller supplies `cycleCount > 1`, it's coerced to `undefined` (one-time items get one cycle).
- `ecommerce`, `service`, `call` are always non-recurring → `cycleCount` is never required and any value > 1 is coerced to `undefined`.

**Response (201)** — `{ success: true, coupon }`.

---

### `GET /org/:orgId/platform-coupons/:id`
Fetch a single platform coupon. Verifies `scope === "organization"` and `orgId` match.

---

### `PATCH /org/:orgId/platform-coupons/:id`
Update. Allowed fields: `name`, `description`, `media`, `discountValue`, `maxDiscountAmount`, `currency`, `cycleCount`, `validUntil`, `maxUsageCount`, `maxUsagePerUser`, `minOrderAmount`.

Send `media: ""` (empty string) to clear an existing media link; omit the field to leave it unchanged.

---

### `POST /org/:orgId/platform-coupons/:id/deactivate`
Set status to `inactive`.

### `POST /org/:orgId/platform-coupons/:id/activate`
Set status to `active`.

---

### `GET /org/:orgId/platform-coupons/:id/redemptions`
List every redemption event for a coupon.

**Response** — `{ success: true, redemptions: [...] }`.

---

### `GET /org/:orgId/platform-coupons/:id/assignments`
List user-assignments for the coupon (founders can pre-attach coupons to specific users).

---

### `POST /org/:orgId/platform-coupons/:id/assignments`
Assign the coupon to a batch of users.

**Body**
```ts
{
  userIds: string[],          // 1-500
  reason?: string,            // ≤ 500
  expiresAt?: ISOString
}
```

**Response** — `{ success: true, assigned: number, failed: Array<{userId, error}> }`. Per-user assignment is `Promise.allSettled` so partial success is normal.

---

### `DELETE /org/:orgId/platform-coupons/:id/assignments/:assignmentId`
Revoke a single assignment.

---

## 3. Coupon-eligible items (`/org/:orgId/coupon-eligible-items`)

Mount: `app.use("/org/:orgId/coupon-eligible-items", founderCouponItemsRoutes)`
File: [`routes/founderCouponItems.ts`](src/routes/founderCouponItems.ts)

Populates the item picker in the coupon and rule editors.

### `GET /org/:orgId/coupon-eligible-items?productType=channel`
List items for a single productType.

**Query** — `productType` (required): one of `channel`, `course`, `workshop`, `product`, `service`, `call`, **`ecommerce`**.

**Response** — `{ success: true, items: Array<EligibleItem> }`.

`EligibleItem` shape:
```ts
{
  _id: string,
  title: string,
  price: number,
  currency: string,
  image?: string,
  isRecurring: boolean,           // true → subscription, cycleCount is meaningful
  recurringDetail?: string,       // e.g. "Subscription · monthly"
  status?: string
}
```

`isRecurring` rules:
- `channel`, `course`, `workshop`, `product` → `item.isSubscription`
- `service`, `call`, `ecommerce` → always `false` (no subscription support)

**Per-productType backing query**

| productType | Collection | Filter |
|---|---|---|
| `channel` | `Channel` | `{ storeId: orgObjId, isActive: { $ne: false } }` |
| `course` | `Course` | `{ organizationId: orgObjId, status: { $ne: "archived" } }` |
| `workshop` | `Workshop` | `{ orgId: orgObjId, isActive: { $ne: false } }` |
| `product` | `Product` | `{ organizationId: orgObjId, status: { $ne: "archived" } }` |
| `service` | `Service` | `{ organizationId: orgObjId, status: { $ne: "archived" } }` |
| `call` | `CallOffering` | `{ organizationId: orgObjId, status: { $ne: "archived" } }` |
| **`ecommerce`** | **`StoreProduct`** | **`{ orgId: orgObjId, status: "active" }`** |

---

### `GET /org/:orgId/coupon-eligible-items/all`
Returns sellables across **all** product types in one shot. Each item carries `productType` and `isRecurring`. Used by the rule editor's unified item picker.

**Response** — `{ success: true, items: Array<EligibleItem & { productType }> }`.

---

## 4. Coupon Rules (`/org/:orgId/coupon-rules`)

Mount: `app.use("/org/:orgId/coupon-rules", founderCouponRulesRoutes)`
File: [`routes/founderCouponRules.ts`](src/routes/founderCouponRules.ts)

"When customer buys X, give them coupon Y." Used to chain promotions.

### `GET /org/:orgId/coupon-rules`
List all rules for the org. Each rule is hydrated with `triggerItemTitle`, `triggerItemImage`, and the embedded `rewardCoupon` summary.

**Response** — `{ success: true, rules: [...] }`.

---

### `POST /org/:orgId/coupon-rules`
Create a rule.

**Body**
```ts
{
  name?: string,
  triggerProductType:
    | "channel"
    | "course"
    | "workshop"
    | "product"
    | "service"
    | "call"
    | "ecommerce",                   // storefront item from StoreProduct
  triggerItemId: string,             // _id of the item in the matching collection
  triggerQuantity?: number,          // default 1
  rewardCouponId: string,            // PlatformCoupon._id to grant
  rewardQuantity?: number,           // default 1
  recurrence?: "once" | "every"      // default "once"
}
```

Hydration looks up the trigger item from its respective collection (same mapping as the eligible-items table above) and embeds `triggerItemTitle` + `triggerItemImage` on the response so the FE doesn't need a second lookup.

**Response (201)** — `{ success: true, rule }` (hydrated).

---

### `GET /org/:orgId/coupon-rules/:id`
Fetch a hydrated single rule. Used for the edit form prefill.

---

### `PATCH /org/:orgId/coupon-rules/:id`
Update. Allowed fields: `name`, `isActive`, `recurrence`, `triggerQuantity`, `rewardQuantity`.

---

### `DELETE /org/:orgId/coupon-rules/:id`
Hard-delete the rule.

**Response** — `{ success: true }`.

---

## Common response shapes

**Success**
```json
{ "success": true, "...payload": "..." }
```

**Validation error (Zod)**
```json
{ "success": false, "error": "Invalid body", "details": [/* zod issues */] }
```

**Founder check failure**
```json
{ "success": false, "error": "You must be a founder of this organization" }
```
HTTP 403.

**Not found / wrong-org**
```json
{ "success": false, "error": "Coupon not found" }
```
HTTP 404. Returned both when the row doesn't exist and when it exists but belongs to a different org (anti-enumeration).

---

## Ecommerce coupon — end-to-end flow

### Create (founder)

`POST /org/:orgId/platform-coupons` with `productType: "ecommerce"` plus `specificItemIds: [<storeProductId>]`. The route validates the item is a real `StoreProduct` belonging to this org, infers `isRecurring: false`, and persists with `productType: "ecommerce"`.

```http
POST /org/68f1.../platform-coupons
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "code": "STOREDEAL10",
  "name": "10% off any storefront item",
  "productType": "ecommerce",
  "discountType": "percent",
  "discountValue": 10,
  "currency": "USD",
  "specificItemIds": ["6a17dcd71588d5fe7fdb4d28"],
  "validFrom": "2026-06-10T00:00:00.000Z",
  "validUntil": "2026-09-30T00:00:00.000Z",
  "maxUsageCount": 200,
  "maxUsagePerUser": 1,
  "minOrderAmount": 0
}
```

### Pick the target item (founder UI)

The coupon editor calls:
```
GET /org/:orgId/coupon-eligible-items?productType=ecommerce
```
to populate the storefront-item picker. Returns `EligibleItem[]` with `isRecurring: false`.

### Trigger a rule on storefront purchase

```http
POST /org/68f1.../coupon-rules
{
  "name": "Free shipping after first storefront purchase",
  "triggerProductType": "ecommerce",
  "triggerItemId": "6a17dcd71588d5fe7fdb4d28",
  "rewardCouponId": "6b04...",
  "rewardQuantity": 1,
  "recurrence": "once"
}
```

### Redeem at checkout

The customer enters the code at the storefront. `services/ecommerceInvoice.ts → previewEcommerceCart()` calls `validatePlatformCoupon({ productType: "ecommerce", code, userId, amountCents, invoiceCurrency })`. On success it applies the discount and stamps `appliedCouponCode` / `appliedCouponId` onto the resulting invoice. Mismatched product types fail with `"This coupon is not valid for this item — it only applies to storefront items."`

### Why no schema migration is needed

`PlatformCoupon` and `CouponRule` enums both already include `"ecommerce"`. The redemption path in `ecommerceInvoice.ts` was already validating against `productType: "ecommerce"`. The change set only added the founder-side routes + the lookup-by-`StoreProduct` branches; no existing data is rewritten.

---

## Auth helper recap

All four routers use the same founder gate:

```ts
const user = await User.findById(userId).lean();
const membership = user.organizations?.find(
  (m) => m.organization.toString() === orgId && hasFounderAccess(m)
);
if (!membership) return 403 "You must be a founder of this organization";
```

`hasFounderAccess` in [`utils/accessCheck.ts`](src/utils/accessCheck.ts) accepts a membership and returns `true` when `role === "founder"` (or any equivalent role that should have founder privileges — check the helper for the canonical list).
