# CombPlan cap — setup guide

**Applies to:** the L1/L2/L3 money-commission plan (`CombPlan`) that fires on sales of these six item types:

- `product` (regular product listings)
- `course`
- `channel`
- `workshop`
- `service`
- `call`

**Does NOT apply to:** store/ecommerce items (`ecommerce_item`) — those use a separate coupon-cascade plan; see [STORE_COUPON_COMMISSION_CAP_SETUP.md](./STORE_COUPON_COMMISSION_CAP_SETUP.md).

**Also does NOT apply to:** whitelabel add-on, cryptosub, office plan, hifi_investment, franchise programs — each of those has its own bespoke commission logic outside CombPlan.

---

## What the cap does

Every CombPlan has a level ladder — L1 (buyer's direct referrer), L2 (referrer's referrer), etc. Each level earns a percentage of the sale.

**Before the cap** every purchase paid every level, forever. A customer who bought the same course 12 times paid the same L1 referrer 12 times.

**With the cap** a founder can say: *"under this plan, an affiliate earns commission on at most N purchases per unique customer. Beyond that, the affiliate is skipped and their share stays with the seller."*

Two modes:
| `capType` | Behaviour |
|---|---|
| `"perpetual"` | Every purchase pays every level, every time. This is the DEFAULT — every plan that existed before this feature reads as perpetual, so nothing changes for legacy plans. |
| `"per_pair_capped"` | Each affiliate earns on at most `capCount` of a given customer's purchases under this plan. |

The cap is **per plan** and **per (affiliate, customer) pair** — a capped-out affiliate is dropped for future purchases by THAT customer, but continues earning normally from every other customer.

---

## Setup — via API

CombPlans are configured through `/comb-plans` (already documented in the founder API). The two new fields are:

- `capType`: `"perpetual" | "per_pair_capped"` (optional; default `"perpetual"`)
- `capCount`: number, 1..100 (required when `capType === "per_pair_capped"`)

### Create a capped plan

```http
POST /comb-plans
Authorization: Bearer <founder jwt>
Content-Type: application/json

{
  "name": "12-Month Course Commission Plan",
  "itemType": "course",
  "itemId": "6a89…",
  "levels": [
    { "level": 1, "percentage": 20, "description": "Direct referrer" },
    { "level": 2, "percentage": 10, "description": "Second level" }
  ],
  "capType": "per_pair_capped",
  "capCount": 2
}
```

Result: for each affiliate in the chain, the first TWO times a given customer buys this course, the affiliate earns their level's percentage. The third purchase pays no affiliate commission on the L1/L2 slots (the seller keeps their share instead).

### Convert an existing plan to capped

```http
PATCH /comb-plans/<planId>
Authorization: Bearer <founder jwt>
Content-Type: application/json

{ "capType": "per_pair_capped", "capCount": 3 }
```

**Important**: only NEW purchases after this change respect the cap. Purchases that already fired stay as-is; their `CommissionDistribution` rows count toward the cap on the counter going forward, so if this customer already had 3 paid commissions on this plan, further purchases pay $0 to the same affiliate right away.

### Turn a capped plan back to perpetual

```http
PATCH /comb-plans/<planId>
Authorization: Bearer <founder jwt>
Content-Type: application/json

{ "capType": "perpetual" }
```

`capCount` is stripped automatically. Existing capped affiliates immediately resume earning on the next purchase.

---

## Setup — via founder UI

The founder-side commission editor at [`components/dashboard/CommissionPlanSection.tsx`](../garage-web-app-nextjs-v1/components/dashboard/CommissionPlanSection.tsx) has a **"Commission cap"** section right above the levels list:

- **Perpetual** (default) — every purchase pays commission
- **Capped per customer** — enter how many purchases per customer earn commission (1..100)

The helper text explains the semantics inline, including the recurring-subscription behaviour (see next section).

Editing an existing perpetual plan doesn't force a cap — the toggle defaults to Perpetual so an untouched plan saves with no cap change.

---

## Behaviour rules to know

### 1. Recurring subscriptions count each cycle

Course / channel / workshop subscriptions distribute commission on **every paid cycle**, not once per subscription. A plan capped at N=2 on a monthly channel sub means:

- Cycle 1 → affiliate earns
- Cycle 2 → affiliate earns
- Cycle 3 and every later renewal → no commission to that affiliate

If you want "N distinct subscriptions" behaviour instead, use a higher N that reflects your expected cycle count — the current design intentionally counts every distribution event, matching how the sales ledger works.

### 2. The capped share stays with the seller

When an affiliate is capped, their percentage is NOT reallocated to the next upline — it stays on the seller side. On a $100 sale with L1=10%, L2=5% and L1 capped:

- Platform: 5% ($5)
- Seller: 95% − 5% (L2 only) = **$90**
- L1: $0 (capped)
- L2: $5

Rationale: matches how "no upline at this level" (short referral chain) already works — those levels are silently skipped and the seller keeps that share.

### 3. Refunded / failed distributions don't consume a slot

The cap counter only counts `CommissionDistribution` rows with `status: "completed"`. A distribution that ended up as a `failed` tombstone (e.g. wallet write raced) is IGNORED by the counter — so a legitimate retry doesn't burn the affiliate's next slot.

### 4. Webhook double-fires don't burn a slot

The existing `{paymentId, itemType, itemId}` unique guard on `CommissionDistribution` catches duplicate distributions before they're written. The cap counter can't be double-advanced by a payment gateway retry.

### 5. Editing rate/term after purchases is disabled

Standard CombPlan behaviour — if a plan has any completed distributions, its `levels` array is frozen. Same rule applies to the cap: bump the cap up (`capCount: 2 → 5`) is allowed and lets already-capped affiliates earn again on future purchases. Bumping down (`5 → 2`) is also allowed and immediately caps affiliates who already crossed the new threshold.

---

## Deploy readiness — nothing to do for existing plans

Zero backfill required. Every plan created before this feature has no `capType` stored on its document; Mongoose returns `undefined` at read time, which the enforcement code treats as `"perpetual"`. The counter query is skipped entirely for legacy plans (zero-cost regression path).

You only need to opt in per plan when you actually want a cap.

---

## Verification

**As a founder**, after you set a cap:

1. Have a test customer buy the capped item under your referral chain (e.g. capCount=1 and A → B → customer).
2. Check the buyer's wallet — B (L1) got their commission.
3. Have the same customer buy the SAME item again.
4. Check B's wallet — no new commission. The seller wallet went up by the L1's would-be share instead.

**As an ops user**, count what actually fired for a specific pair:

```js
// In mongo shell or a script
db.commissiondistributions.countDocuments({
  combPlanId: ObjectId("<planId>"),
  "commissions.userId": ObjectId("<affiliateId>"),
  customerId: ObjectId("<customerId>"),
  status: "completed",
})
```

That's the exact query the runtime enforcement uses.
