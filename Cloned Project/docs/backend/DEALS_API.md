# Deals API

The **Deals** tab in Garage Connect — a live timeline of every time someone on
Garage got paid. Built on `garagenew-backend`, mounted at `/deals`.

Nothing new is written when a deal happens. A deal **is** a commission
distribution, projected into a card at read time, so the feed can never drift
from what actually paid out and no backfill was needed for the ~800 historical
deals already in the database.

---

## Decisions this API encodes

| | |
|---|---|
| **One card = one sale** | A $25 sale pays up to 22 people. The card is headlined by the biggest earner, and `payouts[]` carries **every** recipient so the card can expand into the full chain. Carding each payout would turn one purchase into 22 near-identical rows. |
| **Everyone's deals are visible** | The feed is global and identical for every viewer. A token adds `reactions.mine` and `viewerPayoutUsd`. |
| **Product-sale commissions only** | Welcome bonuses and plain referral bonuses are excluded — they have no "X bought Y" story. |
| **Product card only for other people's products** | Garage's own products (Unilevel Plus, NetworkChain, Founders Office) render `product: null` and name the product in the subline instead — "it will get too repetitive". |

---

## Endpoints

Base URL: `https://test.garage.app`

| Method | Path | Auth |
|---|---|---|
| `GET` | `/deals` | optional |
| `GET` | `/deals/stats` | none |
| `GET` | `/deals/:dealId` | optional |
| `PUT` | `/deals/:dealId/reaction` | **required** |
| `DELETE` | `/deals/:dealId/reaction` | **required** |
| `GET` | `/deals/:dealId/reactions` | optional |
| `GET` | `/deals/:dealId/comments` | optional |
| `POST` | `/deals/:dealId/comments` | **required** |
| `DELETE` | `/deals/:dealId/comments/:commentId` | **required** |

"optional" means the endpoint works without a token; sending one only
personalises the viewer-specific fields.

Every response is `{ "success": true, "data": … }`, errors are
`{ "success": false, "message": "…" }`.

---

## `GET /deals`

| Query | Type | Default | Notes |
|---|---|---|---|
| `limit` | 1–50 | 20 | |
| `cursor` | ISO date | — | Pass `nextCursor` from the previous page. Returns **older** deals. Malformed → `400`. |
| `earnerId` | user id | — | Deals where this person was paid **anything** — direct, any level, infinity tier, or as the seller. Powers "my deals". |
| `minAmountUsd` | number | — | Hide deals whose headline payout is below this, e.g. `1` to drop 3-cent level bonuses. |
| `payouts` | `full` \| `none` | `full` | `none` drops `payouts[]` and keeps `totals`. See **Payload size**. |

```bash
curl 'https://test.garage.app/deals?limit=20' \
  -H 'Authorization: Bearer <token>'
```

```jsonc
{
  "success": true,
  "data": {
    "deals": [
      {
        "id": "up_6aba0c9574420e9d67429bd2",
        "source": "unilevel_plus",
        "occurredAt": "2026-09-28T06:43:33.884Z",
        "currency": "USD",
        "amountUsd": 9,                 // what the HEADLINE earner got
        "saleAmountUsd": 25,
        "earner": { "id": "6a8d…", "name": "Setharamareddy BM", "avatar": "https://…" },
        "buyer":  { "id": "6ab7…", "name": "Hazrathali B Halageri", "avatar": null },
        "headline": "Setharamareddy BM Earned $9.00",
        "subline":  "When Hazrathali B Halageri bought Unilevel Plus",
        "product": null,

        "payouts": [
          { "user": { "id": "6a8d…", "name": "Setharamareddy BM", "avatar": "https://…" },
            "role": "direct", "level": 1, "tier": null,
            "amountUsd": 9, "allocatedUsd": 9, "forfeitedUsd": 0,
            "points": null, "legMultiplier": null, "percentage": null },

          { "user": { "id": "6ab7…", "name": "Rakesh K", "avatar": null },
            "role": "infinity", "level": null, "tier": 2,
            "amountUsd": 2, "allocatedUsd": 2, "forfeitedUsd": 0,
            "points": null, "legMultiplier": null, "percentage": null },

          { "user": { "id": "6ab6…", "name": "Anitha S", "avatar": null },
            "role": "level", "level": 12, "tier": null,
            "amountUsd": 0.36, "allocatedUsd": 0.72, "forfeitedUsd": 0.36,
            "points": 36, "legMultiplier": 3, "percentage": null }
          // …22 entries in all, biggest share first
        ],

        "totals": {
          "saleUsd": 25,
          "paidOutUsd": 21.23,
          "recipientCount": 22,
          "levelCount": 15,
          "infinityCount": 6
        },

        "viewerPayoutUsd": 0.36,        // null when the viewer earned nothing
        "reactions": { "total": 3, "mine": "like" },
        "comments":  { "total": 1 }
      }
    ],
    "nextCursor": "2026-09-27T18:02:11.004Z"
  }
}
```

`nextCursor` is `null` on the last page.

---

## `payouts[]` — who got paid

Sorted biggest share first, so the array reads as a hierarchy.

| `role` | Who | `level` | `tier` |
|---|---|---|---|
| `direct` | The buyer's own referrer (the headline earner) | `1` | — |
| `level` | An upline affiliate at depth N | 1–15 | — |
| `infinity` | An infinity-pool recipient (Garage products only) | — | `1` or `2` |
| `seller` | The merchant whose storefront made the sale | — | — |
| `drop_creator` | The drop-attribution carve-out | — | — |

### `amountUsd` vs `allocatedUsd` — read the right one

**`amountUsd` is what actually reached the wallet. Render that one.**

The NetworkChain coverage split forwards half an earner's cut away when they
have no live coverage. `allocatedUsd` is what the comp plan *allocated*;
`forfeitedUsd` is the part that was forwarded on. 94 distributions in the
database carry a forfeiture, so showing `allocatedUsd` would overstate those
people by 2×.

`forfeitedUsd` is `0` on the vast majority of rows — a good "…and lost $X to
no coverage" nudge when it isn't.

### `totals`

`paidOutUsd` is everything that reached a human wallet. It is deliberately
**less than** `saleUsd` — the gap is Garage's own margin and the unallocated
pool, which this API does not expose. If you want those figures on an internal
screen, ask and I'll add them behind an admin flag; they shouldn't go in a
public feed.

---

## Rendering the card

- **Avatars** — `earner.avatar` left, `buyer.avatar` right. `null` means no
  photo; fall back to initials from `name`.
- **Headline / subline** — pre-composed server-side so web and mobile read
  identically. Use them verbatim; `amountUsd`, `earner` and `buyer` are there
  if you need to style parts differently (e.g. the amount in yellow).
- **Product card** — render only when `product !== null`:
  `product.name`, `by {product.brand}`, `${product.priceUsd}`, `product.image`.
  `image` and `brand` may be `null`; the card should survive both.
- **"and N others earned"** — `totals.recipientCount - 1`, expanding into
  `payouts[]`.
- **Date** — `occurredAt` is UTC ISO. Format client-side.

### The two card variants

```
source: "unilevel_plus"        product: null
  "Shorupan Earned $9.00"
  "When Chiranjeeb bought NetworkChain subscription"      ← no product card

source: "comb_plan"            product: { … }
  "Shorupan Earned $9.00"
  "When Chiranjeeb bought this item"                      ← product card below
```

The subline deliberately says *"this item"* when a product card follows, so
the name isn't printed twice.

---

## Payload size

A 50-deal page with full chains is roughly 300 KB; 10 deals is ~58 KB, versus
~6 KB with `payouts=none`.

Suggested split: fetch the feed with **`payouts=none`** and render from
`totals`, then call `GET /deals/:dealId` when someone expands a card. Use
`payouts=full` (the default) if you'd rather have it all up front.

---

## `GET /deals/stats`

The four header cards on the Deals tab: platform-wide totals, each with an
all-time running series for its graph. Same for every viewer; cached for 60s.

```json
{
  "earnedByAffiliatesUsd": {
    "total": 12840.66,
    "series": [
      { "date": "2026-03-01", "value": 0 },
      { "date": "2026-03-05", "value": 41.5 },
      …oldest first, the last point ends today (UTC)…
    ],
    "bucketDays": 4
  },
  "purchaseVolumeUsd": { "total": 31250.0, "series": […], "bucketDays": 4 },
  "users":             { "total": 5210,    "series": […], "bucketDays": 9 },
  "businesses":        { "total": 388,     "series": […], "bucketDays": 9 },
  "asOf": "2026-09-29T09:12:00.000Z"
}
```

| Metric | What it counts |
|---|---|
| `earnedByAffiliatesUsd` | Every commission credited to an affiliate: direct, level, infinity and drop-creator payouts on both engines, plus the NetworkChain (TPS) bonus, which since 2026-08-11 lives only in `wallettransactions` (`bonusType: "networkchain_direct"`; credits minus forfeiture debits; platform-account and `routedToPlatform` rows excluded). The merchant's own take on a storefront sale (`seller`) is revenue, not an affiliate earning, so it's excluded. |
| `purchaseVolumeUsd` | Every `paid` invoice except store-wallet top-ups, `totalAmount` (GST included) converted to USD — Garage's own products and TPS included. The same rule as the franchise dashboard's `totalSalesVolumeIncludingGarageProductsUsd`. Dated by `paidAt` (else `createdAt`). Legacy $25 purchases that never had an invoice aren't in it, as on the dashboard. |
| `users` | Every `users` document — the same number the admin panel shows. Affiliate-link joins and upline-enrolled members carry `guest: true` and **are** counted: they hold wallets, earn commissions and buy products, so excluding them hid 797 real members. |
| `businesses` | `organizations` documents. |

### Split by side of the house

Six more fields, same `{ total, series, bucketDays }` shape, so each side of
the business can be read on its own card:

| Field | What it counts |
|---|---|
| `garageProductVolumeUsd` | Paid-invoice volume for **Garage's own products** — 1Network (`unilevel_plus`), NetworkChains (`third_party_subscription`), white-label (`whitelabel_addon`, `cryptosub`) and Founders Office (`office_plan`, `office_addon`). |
| `garageProductCommissionsUsd` | Commission credited to affiliates on those sales: the Unilevel Plus engine (direct + 15 levels + infinity tiers) plus the NetworkChain bonus. |
| `founderProductVolumeUsd` | **TPS** — paid-invoice volume for everything sold through a founder's own storefront: `product` (which includes **BAT246**), `course`, `channel`, `workshop`, `event_ticket`, `call`, `service`, `ecommerce_item`, plus `auction_wallet_topup` and `admin_adhoc`. |
| `founderProductCommissionsUsd` | Commission credited to the **upline** on those sales. The seller's own take is their revenue, not a commission, and is excluded. |
| `franchiseVolumeUsd` | Franchise licensing — `franchise_global`, `franchise_territory`, `franchise_program`. |
| `otherVolumeUsd` | Catch-all. **$0 today** — every itemType in the collection is assigned above. A new product type lands here instead of vanishing. |

Two invariants hold, and are worth asserting on the client:

```
garageProductVolumeUsd + founderProductVolumeUsd
  + franchiseVolumeUsd + otherVolumeUsd        == purchaseVolumeUsd

garageProductCommissionsUsd
  + founderProductCommissionsUsd               == earnedByAffiliatesUsd
```

If `otherVolumeUsd` ever goes above zero, a new `itemType` has shipped and
`bucketOf()` needs a line — that is what the field is for.

> **Naming.** The `founderProductVolumeUsd` card is labelled "TPS" in the UI.
> That is NOT `third_party_subscription`, which is NetworkChains and sits
> inside **Garage** products. Two different things share the abbreviation.

Each `series` starts with a zero point the day before its first event, then
one point per `bucketDays` days (1 until that history exceeds 60 days, so at
most 61 points). Every point is the running total at the END of its `date`
(UTC), so lines never fall and the last point equals `total`. The metrics start
on different dates, so their `bucketDays` can differ.

---

## `GET /deals/:dealId`

Returns a single deal in the same shape, always with full `payouts`. Deal ids
are synthetic and stable: `up_<id>` for a Garage-product sale, `cp_<id>` for a
founder-plan sale. Any deal in history is fetchable — there's no recency
window.

---

## Reactions

One reaction per user per deal. Reacting again **replaces** the type rather
than adding a second — the count doesn't move.

```bash
# react / change reaction
curl -X PUT 'https://test.garage.app/deals/up_6aba…/reaction' \
  -H 'Authorization: Bearer <token>' -H 'Content-Type: application/json' \
  -d '{"type":"like"}'

# remove
curl -X DELETE 'https://test.garage.app/deals/up_6aba…/reaction' \
  -H 'Authorization: Bearer <token>'
```

Both return `{ "dealId", "total", "mine" }` — use `total` to update the counter
without refetching the feed.

`type` is free text (max 32 chars), so emoji reactions can be added without a
backend change. Default `"like"`.

`GET /deals/:dealId/reactions?limit=50` lists who reacted, for the tap-through
sheet.

---

## Comments

```bash
curl -X POST 'https://test.garage.app/deals/up_6aba…/comments' \
  -H 'Authorization: Bearer <token>' -H 'Content-Type: application/json' \
  -d '{"body":"Congrats!","parentId":null}'
```

- `body` 1–2000 chars, trimmed. Empty/whitespace → `400`.
- `parentId` gives **one** level of threading. A reply whose parent belongs to
  a different deal is rejected with `400`.
- `GET /deals/:dealId/comments?limit=20&cursor=<ISO>` — newest first, same
  cursor convention as the feed.
- `DELETE /deals/:dealId/comments/:commentId` — **author only** (`403`
  otherwise). Soft delete: the row survives so replies keep their anchor, and
  it stops appearing in listings and counts.

---

## Errors

| Code | When |
|---|---|
| `400` | bad cursor, malformed deal id, bad `payouts` value, empty comment, cross-deal `parentId` |
| `401` | missing/expired token on a write |
| `403` | deleting someone else's comment |
| `404` | deal or comment doesn't exist, or the distribution never completed |
| `500` | unexpected — logged server-side with a `[deals]` prefix |

---

## Where the data comes from

| Engine | Collection | Pays | Product card |
|---|---|---|---|
| Garage's own products | `unilevelplusdistributions` | direct bonus + 15 levels + 2 infinity tiers | no |
| Founder comb plans | `commissiondistributions` | the seller + an upline of commission levels | yes |

Only `status: "completed"` distributions become deals — failed and reversed
rows never moved money and are never shown.

Product names for Garage's own products are read from the invoice each
distribution points at (`metadata.invoiceId` → `lineItems[0].itemName`), which
is why the subline says *"bought NetworkChain subscription"* rather than
*"bought a Garage product"*.

Reactions and comments are the only new collections: `dealreactions` and
`dealcomments`, keyed by the synthetic deal id.

---

## Notes for the client

1. **Poll, don't stream.** There's no socket yet. `GET /deals?limit=20` on
   pull-to-refresh is enough — real volume is a few deals an hour.
2. **Optimistic reactions are safe.** `PUT` is idempotent, so firing on tap and
   reconciling with the returned `total` won't double count.
3. **Never build the deal id yourself.** Always use the `id` from the feed.
4. **Amounts are USD** and already rounded to cents.
5. **Both names can be `null`** for a deleted account. The pre-composed
   `headline`/`subline` already fall back to "Someone".
6. **Earner and buyer can be the same person** on a self-purchase from one's
   own storefront. Worth a special-cased subline on the client if it looks odd.

---

## Open items

- **No notifications.** Reacting or commenting notifies nobody yet. Say the
  word and I'll wire it into the existing push channels.
- **Product images** resolve from `products` / `storeproducts` / `courses` /
  `workshops`. If comb plans start selling another item type, send me the
  collection and I'll add it.
- **No moderation.** Only the comment's author can delete it; there's no
  admin delete or report/block on deals yet.
- **Garage's own margin** (`companyAmount`, `managerBonusAmount`,
  `unallocatedAmount`, `platformFeeAmount`) is stored but deliberately not
  returned.
