# Store Coupon Commissions — API

Cascading coupon rewards paid up the **buyer's upline chain** when a
Storefront / offline-store product (invoice `itemType: "ecommerce_item"`)
is sold. Founder-scoped rules, N-level unilevel-style.

## Concept

- A founder configures **1..15 levels** on a rule.
- On any paid store invoice matching the rule:
  - **L1** earner = buyer's direct referrer ("the seller who shared the affiliate link")
  - **L2** = referrer's referrer
  - **L3** = up their chain… up to N.
- Each level gets a **CouponAssignment** for a specific unlimited `PlatformCoupon`
  the founder picked when authoring the rule. The reward is a coupon in
  the earner's "Rewards" tab — NOT a direct payout / not auto-cart-added.
- **Short chain**: if the buyer's upline has fewer people than N levels,
  extra levels are silently skipped (nobody earns them).
- **Every sale fires** (no accumulator like the older `CouponRule`
  system). Quantity semantics are per-fire.

## Why "unlimited" coupons only

The reward `PlatformCoupon` must have **both** `maxUsageCount` and
`maxUsagePerUser` unset (or `0`) — because a cascade grants a fresh
assignment to a different earner on every sale, and a capped coupon
would run dry after a handful of grants and confuse everyone downstream.

- **Write-time**: the API rejects a rule whose level references a capped
  coupon with a 400 + the specific level.
- **Read-time**: the evaluator re-checks on each fire — if a founder
  capped the coupon after the rule shipped, the evaluator SKIPS that
  level with a warn log rather than corrupt-granting a used-up coupon.

## Base URL

All routes are scoped to an org:

```
/org/:orgId/store-commissions
```

Auth: `Authorization: Bearer <userJwt>`. Requires the caller to be a
**founder** of `:orgId` (`hasFounderAccess` on their membership).
Returns:

- `401` — missing/invalid token
- `403` — token valid but not a founder of `:orgId`
- `400` — invalid `:orgId` / body validation failure (Zod)

## Endpoints

### 1. List rules

```
GET /org/:orgId/store-commissions
```

**Response** (200)
```json
{
  "success": true,
  "rules": [
    {
      "_id": "6a...",
      "orgId": "68f1...",
      "name": "3-level product cascade",
      "triggerItemId": "6b...",         // null when wildcard
      "triggerItem": {                   // null when wildcard OR product deleted
        "_id": "6b...",
        "title": "T-shirt XL",
        "image": "https://.../t.png"
      },
      "isWildcard": false,
      "levels": [
        {
          "level": 1,
          "couponId": "6c...",
          "quantity": 1,
          "coupon": {
            "code": "SAVE10",
            "name": "10% off any workshop",
            "discountType": "percent",
            "discountValue": 10,
            "currency": "USD",
            "isCapped": false,          // true → evaluator will skip
            "status": "active"
          }
        },
        { "level": 2, "couponId": "6d...", "quantity": 1, "coupon": { ... } }
      ],
      "isActive": true,
      "effectiveFrom": "2026-08-18T10:00:00.000Z",
      "createdBy": "68f1...",
      "createdAt": "2026-08-18T10:00:00.000Z",
      "updatedAt": "2026-08-18T10:00:00.000Z"
    }
  ]
}
```

Rules are sorted newest-first.

---

### 2. Get a single rule

```
GET /org/:orgId/store-commissions/:id
```

Returns the same hydrated shape as one item in the list. `404` if the
rule doesn't exist on `:orgId`.

---

### 3. Create a rule

```
POST /org/:orgId/store-commissions
```

**Body**
```json
{
  "name": "3-level product cascade",
  "triggerItemId": "6b...",     // OMIT or null = wildcard (any store product on this org)
  "levels": [
    { "level": 1, "couponId": "6c...", "quantity": 1 },
    { "level": 2, "couponId": "6d...", "quantity": 1 },
    { "level": 3, "couponId": "6e...", "quantity": 2 }
  ]
}
```

**Rules on `levels`**
- 1..15 items.
- `level` values MUST be a contiguous 1..N sequence (no duplicates, no gaps).
- Every `couponId` must belong to `:orgId` AND be unlimited (see above).
- `quantity` defaults to 1 (uses granted per fire).

**Response** (201) — the same hydrated shape as GET single.

**Errors**
- `400 "Coupon at level N has usage caps; only unlimited coupons can be used in a cascade"`
- `400 "Coupon {id} not found on org {orgId} (level N)"`
- `400 "StoreProduct {id} not found on this org"` (when `triggerItemId` set)
- `400 "Levels must be contiguous 1..N (got 1,3)"`
- `400 { error: "Invalid body", details: ZodIssue[] }` — schema validation

---

### 4. Update a rule

```
PATCH /org/:orgId/store-commissions/:id
```

Partial update — send only what you want to change.

**Body** (all optional)
```json
{
  "name": "Renamed cascade",
  "triggerItemId": null,       // null = clear (become wildcard); string = switch trigger
  "levels": [ ... ],           // if present, REPLACES the whole level list
  "isActive": false
}
```

Returns the same hydrated shape. `404` if not found; `400` on validation
failure with the same error catalog as create.

---

### 5. Delete a rule

```
DELETE /org/:orgId/store-commissions/:id
```

Hard delete. `404` if not found. **Existing `CouponAssignment`s already
granted by this rule are NOT revoked** — earners keep the rewards they
already accrued. This is intentional; the rule just stops firing.

**Response** (200)
```json
{ "success": true }
```

---

### 6. Picker: unlimited coupons

```
GET /org/:orgId/store-commissions/available-coupons
```

Returns this org's `PlatformCoupons` with `status: "active"` AND both
usage caps unset. Used to populate the level-row coupon dropdown.

**Response** (200)
```json
{
  "success": true,
  "coupons": [
    {
      "_id": "6c...",
      "code": "SAVE10",
      "name": "10% off any workshop",
      "discountType": "percent",     // "fixed" | "percent"
      "discountValue": 10,
      "currency": "USD",
      "productType": "workshop"
    }
  ]
}
```

**Empty response contract**: `{success:true, coupons: []}` — the FE
should render an empty-state message like *"Create an unlimited-usage
coupon first on the Coupons tab to enable cascading rewards."*

Sorted newest-first, capped at 200.

---

### 7. Picker: store products (trigger)

```
GET /org/:orgId/store-commissions/available-store-products
```

Returns this org's active `StoreProduct`s. Used to populate the
"Trigger item" dropdown alongside the "Any store product" wildcard
option.

**Response** (200)
```json
{
  "success": true,
  "products": [
    {
      "_id": "6b...",
      "title": "T-shirt XL",
      "price": 29.99,
      "currency": "USD",
      "image": "https://.../t.png"
    }
  ]
}
```

Sorted newest-first, capped at 500. **Note**: `StoreProduct.price` is
stored in whole units (dollars/rupees), not smallest unit — different
from the regular `Product` schema. Display as-is.

---

## Trigger / evaluation semantics

The evaluator runs inside `fulfillInvoice` on every paid invoice, right
after the existing `evaluateRulesForInvoice`. It's best-effort — errors
are logged and never propagate to `fulfillInvoice`.

**Fires when ALL are true**:

- `invoice.status === "paid"`
- Invoice has at least one line item with `itemType === "ecommerce_item"` AND an `itemId`
- Buyer's `User.ancestors[]` is non-empty (buyer has at least one referrer)
- A rule matches: `orgId === invoice.organizationId`, `isActive: true`, `effectiveFrom < paidAt`, AND either the rule's `triggerItemId` matches the line's `itemId` OR the rule is a wildcard.

**For each matching rule**:

- Iterate configured levels 1..N.
- Look up `upline[level - 1]` where `upline = [...user.ancestors].reverse()` (so `upline[0]` = direct referrer).
- Skip if that index is undefined (short-chain).
- Re-check the coupon is still unlimited + active; skip that level otherwise.
- Call `assignCoupon` with `assignedByType: "founder"`, `assignerOrgId: rule.orgId`, `availableUses: level.quantity`, `mergeAvailableUses: true`, `reason: "Store commission (LN): <rule name>"`.

**Idempotency**: after a successful cascade the evaluator stamps
`invoice.metadata.storeCommissionsFiredAt = <ISO date>`. A re-fulfill
short-circuits before any grants — so a webhook replay or manual
re-fulfill can't double-grant.

**Cross-scope guards**

- A rule fires only on invoices for its own `orgId`. Buyers referred by
  someone across a different org do NOT double-earn.
- Rules never retro-fire — an invoice paid before the rule's
  `effectiveFrom` (= `createdAt`) is ignored.
- Recurring child invoices (cycles 2+) DO fire this cascade — unlike
  the existing `CouponRule` which skips child cycles. Story-level
  intent: a founder who wants renewals to keep paying commissions to
  the upline gets that here by default. If you want the opposite, gate
  on `invoice.recurringPaymentNumber === 1` before mounting.

---

## Interaction with other systems

- **Does NOT interfere with the existing `CouponRule` system** (which
  grants the buyer themselves after N purchases). Both evaluators run,
  they hit disjoint collections (`CouponRuleProgress` vs
  `Invoice.metadata.storeCommissionsFiredAt`) and grant into the same
  `CouponAssignment` collection — the `mergeAvailableUses: true` flag
  means if both rules happen to grant the same coupon, uses stack
  rather than clobber.
- **Does NOT affect commission distributions** (`unilevel_plus`, rank
  bonus, ecommerce commissions). This is a coupon reward, not a
  money movement.
- **Coupon assignments are visible** in the recipient's `/rewards` tab
  and consumable at checkout by presenting the assignment id.

---

## Auditing

Every grant produces a `CouponAssignment` row that carries:

- `userId` — the earner (recipient at that level).
- `couponId` + `couponSource: "platform"` — the reward coupon.
- `assignedBy` — the rule's `createdBy` (the founder who authored it).
- `assignedByType: "founder"`.
- `assignerOrgId` — the rule's `orgId`.
- `reason: "Store commission (LN): <rule.name>"` — the string shown to
  the earner on their rewards card + carried in the assignment notification email.

To audit "which store sale created this reward", cross-reference the
recipient's assignment `createdAt` against `Invoice` where
`metadata.storeCommissionsFiredAt` is close in time on the same org.

---

## Data model reference

- `src/models/storeCouponCommission.model.ts` — the rule + level sub-schema.
- `src/services/storeCouponCommission.ts` — CRUD + evaluator +
  picker helpers.
- `src/routes/founderStoreCommissions.ts` — 7 HTTP endpoints
  documented above.
- Hooked into `src/services/invoice.ts::fulfillInvoice` right after
  `evaluateRulesForInvoice`.
- Mounted in `src/app.ts` at `/org/:orgId/store-commissions`.
- `MAX_STORE_COMMISSION_LEVELS = 15` — level cap constant.

---

## Verification checklist (manual)

1. **Empty state**: `GET /available-coupons` on an org with no unlimited coupons returns `coupons: []`. FE should show the empty state.
2. **Create rejects capped coupon**: any level referencing a coupon with `maxUsageCount > 0` OR `maxUsagePerUser > 0` returns 400.
3. **Wildcard**: create with `triggerItemId: null` — fires on any store sale in the org.
4. **Happy path**: buyer with a 5-deep upline buys the triggering store product on org O; rule has L1/L2/L3 configured — three `CouponAssignment` rows land (one per level's earner); L4/L5 don't exist so nothing dropped there.
5. **Short chain**: buyer with 2 uplines on a 5-level rule — L1+L2 granted; L3-L5 silently skipped.
6. **Idempotency**: manually re-run `fulfillInvoice` on the same paid invoice — no duplicate grants; `invoice.metadata.storeCommissionsFiredAt` set on the first pass.
7. **effectiveFrom**: create a rule, then find an older paid invoice with a matching product — the rule does NOT retroactively grant.
8. **Capped after ship**: create a rule with an unlimited coupon, then cap that coupon (add `maxUsageCount`), then trigger a sale — the level's grant is skipped with `[storeCommission] rule ... coupon ... has usage caps` warn log.
9. **Cross-org guard**: rule on org A; invoice on org B for the same buyer — rule does NOT fire.
10. **Delete keeps prior grants**: delete the rule after grants have been issued — `CouponAssignment` rows survive; only future grants stop.
