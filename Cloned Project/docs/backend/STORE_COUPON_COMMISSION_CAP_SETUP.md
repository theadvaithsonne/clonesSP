# StoreCouponCommission cap — setup guide

**Applies to:** the coupon-cascade plan (`StoreCouponCommission`) that fires on paid invoices whose line items are `itemType: "ecommerce_item"` — i.e. store products sold through the Storefront module.

**Does NOT apply to:** any other item type. Products/courses/channels/workshops/services/calls use the money-commission plan (`CombPlan`) — see [COMBPLAN_CAP_SETUP.md](./COMBPLAN_CAP_SETUP.md).

---

## What this system is

Two commission systems live side by side. This is the coupon-side one, not to be confused with `CombPlan`.

| System | Pays out in | Triggers on |
|---|---|---|
| `CombPlan` | Money (% of sale to L1/L2/…) | Product / course / channel / workshop / service / call sales |
| `StoreCouponCommission` (this doc) | Coupon grants (uses of a `PlatformCoupon`) | Store items sold as `ecommerce_item` line items |

A `StoreCouponCommission` rule looks like: *"when a customer buys any of my store products, give my L1 upline 3 uses of SAVE10, and my L2 upline 2 uses of SAVE5."* The reward coupons must be unlimited (both `maxUsageCount` and `maxUsagePerUser` unset).

---

## What the cap adds

Before the cap, every eligible store purchase fired every level's grant, forever. A customer buying 12 store products under the same referral chain triggered 12 rounds of grants to the same L1/L2 uplines — their coupon assignments kept increasing.

With the cap, a founder can say: *"under this rule, each upline earns the grant on at most N of a specific customer's store purchases. Beyond that, that upline is silently skipped."*

Two modes:
| `capType` | Behaviour |
|---|---|
| `"perpetual"` | Every eligible purchase fires the cascade for every recipient. This is the DEFAULT — every rule created before this feature reads as perpetual, so nothing changes for legacy rules. |
| `"per_pair_capped"` | Each recipient earns the grant on at most `capCount` of a given customer's purchases under this rule. |

The cap is **per rule** and **per (recipient, customer) pair**. A capped-out recipient is dropped for future purchases by THAT customer only; they continue earning normally from every other customer.

Each fire still grants the full `quantity` of coupon uses. The cap counts **fires**, not uses.

---

## Setup — via API

The founder endpoint is `/org/:orgId/store-commissions` (create / read / update / delete). The two new fields are:

- `capType`: `"perpetual" | "per_pair_capped"` (optional; default `"perpetual"`)
- `capCount`: number, 1..100 (required when `capType === "per_pair_capped"`)

### Create a capped rule

```http
POST /org/:orgId/store-commissions
Authorization: Bearer <founder jwt>
Content-Type: application/json

{
  "name": "Storefront upline coupons",
  "triggerItemId": "6a89…",         // OR null / omit = wildcard (all store items)
  "levels": [
    { "level": 1, "couponId": "6a89aaa…", "quantity": 3 },
    { "level": 2, "couponId": "6a89bbb…", "quantity": 2 }
  ],
  "capType": "per_pair_capped",
  "capCount": 2
}
```

Result: for each recipient in the buyer's upline chain, the first TWO times a given customer buys a store item that matches this rule, the recipient receives the configured coupon grant. The third purchase pays nothing to the same recipient.

### Convert an existing rule to capped

```http
PATCH /org/:orgId/store-commissions/<ruleId>
Content-Type: application/json

{ "capType": "per_pair_capped", "capCount": 3 }
```

Only NEW purchases after this change fire the counter. Historical grants aren't retroactively counted (the fire-tracking collection only writes rows AFTER the cap is enabled).

### Turn a capped rule back to perpetual

```http
PATCH /org/:orgId/store-commissions/<ruleId>
Content-Type: application/json

{ "capType": "perpetual" }
```

`capCount` is stripped by the pre-save hook. From the next purchase onward, all recipients receive the cascade grant again (previous fire rows still exist in the counter collection, but they're never read for a perpetual rule).

---

## Setup — via founder UI

**Not shipped in this pass.** The rule editor for `StoreCouponCommission` doesn't exist on the founder dashboard yet. Configure via API (Postman / cURL) or via a garage-admin script.

When the UI ships, it should mirror the "Commission cap" segmented control from `CommissionPlanSection.tsx` — perpetual vs capped, with a conditional integer input for `capCount`.

---

## Behaviour rules to know

### 1. The cap counts fires, not coupon uses

If a level grants `quantity: 3` uses of a coupon and the cap is `N: 2`:

- Purchase 1 → recipient gets 3 uses (assignment now has 3)
- Purchase 2 → recipient gets 3 uses (assignment merges → total 6)
- Purchase 3 → nothing (cap hit; fire count = 2)

Each fire delivers the rule's full `quantity`. The cap is about **how many fire events happen**, not how many total uses accumulate.

### 2. Wildcard vs specific-product rules count together per rule

The counter is per RULE. If you have a wildcard rule capped at N=1, and the same customer buys THREE different store products that all match the wildcard, that's 3 fires against the same counter → cap hits after the first, so purchases 2 and 3 pay nothing to that recipient.

If you want different caps per product, create separate rules with distinct `triggerItemId`s.

### 3. The reward coupon must stay unlimited

The existing "unlimited coupon" rule at rule-write time still applies: reward coupons must have both `maxUsageCount` and `maxUsagePerUser` unset. If a founder caps the coupon after creating the rule, the evaluator silently skips (warn log) — it won't corrupt-grant. The cap on the RULE and the cap on the COUPON are two independent things.

### 4. Non-store items are completely unaffected

The cascade only ever runs for invoice line items with `itemType === "ecommerce_item"`. Any product/course/channel/workshop/service/call goes through `CombPlan` (see the sibling doc). No cross-contamination.

### 5. Webhook double-fires don't burn a slot

Layered idempotency:

1. **Outer guard** — `invoice.metadata.storeCommissionsFiredAt` — the whole `evaluateStoreCommissionsForInvoice` short-circuits on a re-fulfill. First line of defense.
2. **Inner guard** — new `{ruleId, invoiceId, recipientId}` unique index on the fire collection. If the outer guard is bypassed (e.g. someone re-ran fulfillment manually after clearing the marker), E11000 on the fire insert is caught and treated as success. The cap counter can't advance twice for the same recipient on the same invoice.

### 6. Failed grants don't consume a slot

The fire row is only inserted AFTER `assignCoupon` succeeds. If `assignCoupon` throws for a specific level's recipient, no fire row lands and the cap counter for that (recipient, buyer) pair is unchanged. The next purchase can retry cleanly.

---

## Deploy readiness — nothing to do for existing rules

Zero backfill required. Every existing `StoreCouponCommission` document has no `capType` stored; Mongoose returns `undefined` on read; the enforcement code treats undefined as `"perpetual"` and skips BOTH the count query AND the fire-row insert. Legacy rules behave identically to today with zero perf drift.

You only need to opt in per rule when you want a cap. The new counter collection stays empty until a founder enables a cap on a specific rule.

---

## Verification

**As a founder**, after enabling a cap:

1. Have a test customer buy a store item that matches the rule (once).
2. Check the L1 recipient's `CouponAssignment` — they should have the rule's `quantity` uses of the reward coupon.
3. Have the same customer buy again (still under the cap).
4. Check `CouponAssignment` — uses count went up (merged).
5. Repeat until the cap hits — the next purchase should NOT bump their coupon assignment.

**As an ops user**, count fires for a specific pair:

```js
// In mongo shell or a script
db.storecouponcommissionfires.countDocuments({
  ruleId: ObjectId("<ruleId>"),
  recipientId: ObjectId("<recipientId>"),
  buyerId: ObjectId("<buyerId>"),
})
```

That's the exact query the runtime enforcement uses to gate.

**To audit which purchases fired for a rule**:

```js
db.storecouponcommissionfires
  .find({ ruleId: ObjectId("<ruleId>") })
  .sort({ createdAt: -1 })
  .limit(50)
```

Each row records `ruleId`, `level`, `recipientId`, `buyerId`, `invoiceId`, `couponId`, `quantity`, `createdAt`.

---

## Backfill note (if you ever need one later)

We deliberately do NOT populate the fire collection retroactively when a rule flips from perpetual → capped. If you want past `CouponAssignment` grants to count toward a newly-enabled cap, that's a separate one-shot script — it would read the assignment ledger's `assignedBy` / `assignerOrgId` fields and re-derive fire rows. Not shipped; a future ops decision.

Same in reverse: perpetual → capped doesn't erase past grants; capped → perpetual doesn't erase past fire rows. The tracker just goes dormant.
