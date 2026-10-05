# Franchise Territory — Buyer-Initiated Resale Offers

Complete flow reference for the **buyer-initiated resale** feature on
per-office franchise territories (System B). Any authenticated user can
approach the current owner of an `active` territory with a higher-price
offer. The **owner** (not the office founder) accepts. On acceptance a
prorated invoice is minted for the buyer covering the remaining days of the
current subscription cycle. On payment, ownership transfers, the
subscription's `expiresAt` is **preserved**, and **100 % of the paid amount
is credited to the seller** (platform and office founder receive $0 on the
resale itself). Future annual renewals fire at the new price via the normal
recurring engine — platform + founder revenue resumes then.

> **Coexists with the shipped owner-initiated + founder-approved flow**
> (`POST /assignments/:id/reassign-request` + founder approve). That path
> is untouched — the two live side by side.

---

## Contents

1. [Concepts & terminology](#concepts--terminology)
2. [Lifecycle diagram](#lifecycle-diagram)
3. [Data models](#data-models)
4. [Pricing math (pin-perfect)](#pricing-math-pin-perfect)
5. [Money flow on payment](#money-flow-on-payment)
6. [Gates & error codes](#gates--error-codes)
7. [Endpoints](#endpoints)
8. [Notifications](#notifications)
9. [TTL sweeper](#ttl-sweeper)
10. [End-to-end curl walkthrough](#end-to-end-curl-walkthrough)
11. [Race semantics](#race-semantics)
12. [What we deliberately don't do](#what-we-deliberately-dont-do)

---

## Concepts & terminology

| Term | Meaning |
|---|---|
| **Assignment** | A `FranchiseTerritoryAssignment` — one row per (program, geo entity). The `active` ones can receive offers. |
| **Owner / Seller** | The current `assignment.ownerUserId`. Receives offers, accepts/rejects, and (on payment) gets 100 % of the resale money. |
| **Buyer** | Any authenticated Garage user. Submits an offer with a price that must exceed the owner's current `priceUSD`. |
| **Offer** | A `FranchiseOffer` doc: `{fromUser, toUser, offerPriceUSD, status, expiresAt}`. |
| **Resale invoice** | The **prorated, non-recurring** invoice minted at accept-time. Metadata `kind: "buyer_resale"`. |
| **Renewal-parent invoice** | Automatically minted at resale-invoice payment. Recurring, full annual price, `dueDate = preserved expiresAt`. Serves as the next annual cycle's parent. Metadata `kind: "resale_renewal_parent"`. |
| **`pendingResaleOffer`** | Sub-doc on the assignment that locks it to a specific accepted offer until its invoice pays / cancels. Presence blocks accepting further offers. |

---

## Lifecycle diagram

```
                       ┌─────────────────────────────────┐
                       │  Buyer POST /offers             │
                       │  (all gates checked)            │
                       └──────────────┬──────────────────┘
                                      ▼
                              ╔═══════════════╗
                              ║  status:      ║
                              ║  pending      ║◄─── notification → owner
                              ╚═══════╤═══════╝
      ┌───────────────┬───────────────┼─────────────────┬──────────────┐
      ▼               ▼               ▼                 ▼              ▼
 owner accept   owner reject    buyer cancel     another offer    TTL 7d
      │               │               │           was accepted        │
      │               ▼               ▼               ▼               ▼
      │        ┌───────────┐   ┌───────────┐   ┌────────────────┐  ┌─────────┐
      │        │ rejected  │   │ cancelled │   │ auto_rejected  │  │ expired │
      │        └───────────┘   └───────────┘   └────────────────┘  └─────────┘
      │
      ▼
 ┌─────────────┐    mint prorated invoice
 │  accepted   │    set assignment.pendingResaleOffer (lock)
 └─────┬───────┘    auto-reject all sibling offers
       │            → invoice status = pending
       │
       ▼
 buyer pays invoice
       │
       ▼
 invoice fulfilment ► ownership transfers
                    ► assignment.priceUSD = agreedPrice
                    ► subscription.expiresAt PRESERVED
                    ► old sub invoice → cancelled
                    ► 100 % → seller's store wallet
                    ► mint renewal-parent invoice at
                      new price, dueDate = preserved expiresAt
                    ► pendingResaleOffer cleared

 At the preserved expiresAt → normal recurring engine
 mints the next annual child at the NEW full price.
```

---

## Data models

### `FranchiseOffer` (new — `src/models/franchiseOffer.model.ts`)

```ts
{
  _id,
  assignmentId, programId, officeId,          // context
  geoLevel, geoEntityId, geoEntityName,       // territory snapshot

  fromUserId, fromEmail,                      // buyer (snapshot)
  toUserId, toEmail,                          // current owner at submission

  currentPriceUSD,                            // owner's priceUSD at submission
  offerPriceUSD,                              // must exceed currentPriceUSD
  message?,                                   // maxlength 280

  status: 'pending' | 'accepted' | 'rejected'
        | 'cancelled' | 'auto_rejected' | 'expired',
  respondedAt?, expiresAt,                    // TTL = now + 7 days

  invoiceId?,                                 // resale invoice (set on accept)
  resolutionTxRefs?: {
    resaleInvoiceId?,
    renewalParentInvoiceId?,
    sellerWalletTxId?,
  },

  createdAt, updatedAt,
}
```

**Indexes:**
- `{ assignmentId, fromUserId }` **partial-unique** where `status: 'pending'`
  — at most one live offer per (assignment, buyer). Buyer may re-offer after
  cancel/reject/expire.
- `{ toUserId, status, createdAt: -1 }` — owner inbox.
- `{ fromUserId, status, createdAt: -1 }` — buyer outbox.
- `{ status, expiresAt }` — TTL sweeper.
- `{ assignmentId, status, offerPriceUSD: -1 }` — "best offer on this
  territory" reads.

### `FranchiseTerritoryAssignment.pendingResaleOffer` (new sub-doc)

Set when the owner accepts a buyer's offer; cleared on resale-invoice
payment / cancel. Its presence blocks accepting further offers on the same
assignment.

```ts
{
  offerId,          // the accepted FranchiseOffer
  buyerUserId,
  buyerEmail,
  agreedPriceUSD,   // becomes assignment.priceUSD on payment
  resaleInvoiceId,  // the pending prorated invoice
  acceptedAt,
}
```

### `UserNotification.type: 'franchise_offer'` (new variant)

New fields, all optional (populated when `type === 'franchise_offer'`):

| Field | Purpose |
|---|---|
| `franchiseOfferId` | ref → FranchiseOffer, deep-link |
| `franchiseAssignmentId` | ref → assignment |
| `franchiseTerritoryName` | display snapshot |
| `franchiseOfferPriceUsd` | display: "$X was offered" |
| `franchiseOfferEvent` | `created \| accepted \| rejected \| auto_rejected \| cancelled \| expired` — which lifecycle moment |
| `franchiseInvoiceId` | set on `accepted` → click through to pay |

Sender info re-uses the existing `giftFromUserId / giftFromName /
giftFromPicture / giftFromType / giftMessage` fields (same convention as
`reserve_offer`).

---

## Pricing math (pin-perfect)

Server-side, UTC:

```
t              = now
e              = assignment.subscription.expiresAt
msLeft         = e.getTime() - t.getTime()
daysRemaining  = max(0, ceil(msLeft / 86_400_000))
resaleCents    = round(offerPriceUSD * 100 * daysRemaining / 365)
```

Implemented in [`services/franchiseOffer.ts`](src/services/franchiseOffer.ts)
as `daysRemainingUntil()` + `computeProratedCents()`. `Math.ceil` on days
(any partial day is a full day of use). `Math.round` on cents (half-up).

**Worked example**
- Owner's price: `$700`, `expiresAt = 2026-12-01`
- Buyer offers `$900` on `2026-06-01` → `daysRemaining = 183`
- `resaleCents = round(900 × 100 × 183 / 365) = round(45123.287…) = 45123`
- **Buyer pays $451.23** for the remainder of the current cycle
- On payment: subscription stays at `2026-12-01`; new annual bill fires at
  `$900` starting then.

**Additional gate on math**: if `daysRemaining < 3` the offer is refused
with `SUB_EXPIRING_SOON` (see [gates](#gates--error-codes)).

---

## Money flow on payment

Handled in the `franchise_territory` fulfilment branch of
[`services/invoice.ts`](src/services/invoice.ts). The buyer-resale path is
detected by two conditions:

```ts
invoice.metadata.kind === "buyer_resale"
  && assignment.pendingResaleOffer
  && String(assignment.pendingResaleOffer.resaleInvoiceId)
       === String(invoice._id)
```

When both are true the fulfilment does — atomically:

1. **Ownership transfers** — `assignment.ownerUserId = buyer`,
   `ownerEmail`, `acquisitionType = "resale"`.
2. **Price flips forward** — `assignment.priceUSD = agreedFullPriceUSD`
   (from `pendingResaleOffer`).
3. **Expiry preserved** — `subscription.expiresAt` is untouched.
   `subscription.lastPaymentInvoiceId` re-points to this invoice.
4. **Lock cleared** — `assignment.pendingResaleOffer = null`.
5. **Old recurring parent cancelled** — the seller's previous subscription
   invoice is marked `cancelled` so it stops minting renewal children.
6. **100 % → seller's store wallet** — the ENTIRE paid amount is credited
   via `creditStoreWallet(payer=buyer, recipient=seller, orgId=officeId,
   amount=paidUSD)`. No `$650` floor to platform. No markup to founder.
   The wallet transaction carries
   `metadata.franchiseProgram.kind = "territory_buyer_resale_full"` for
   audit.
7. **Renewal parent minted** — a NEW `isRecurring: true` invoice is created
   with `unitPrice = agreedFullPriceUSD * 100`, `dueDate = preservedExpiresAt`,
   `metadata.kind = "resale_renewal_parent"`. The assignment's
   `subscription.invoiceId` re-points to it. When `expiresAt` arrives the
   normal recurring engine mints the next annual child from THIS parent at
   the new full price.
8. **Audit trail stamped** — the `FranchiseOffer.resolutionTxRefs` is
   updated with `resaleInvoiceId`, `renewalParentInvoiceId`, and
   `sellerWalletTxId`.

> **Why not just make the resale invoice `isRecurring: true`?**
> The recurring engine sets `child.subtotal = parent.subtotal`. A prorated
> parent would bill the *prorated* amount forever. Splitting into a
> one-time prorated invoice + a fresh full-price recurring parent fixes
> this cleanly.

---

## Gates & error codes

All gates run at **submit time** and are **re-checked at accept time**
(state can drift). Failures return `4xx` with a `{error, code}` body.

| Code | HTTP | Trigger |
|---|---|---|
| `INVALID_ASSIGNMENT` | 400 | `assignmentId` not a valid ObjectId |
| `INVALID_PRICE` | 400 | `priceUSD` missing / not a positive number |
| `INVALID_OFFER` | 400 | `offerId` not a valid ObjectId |
| `SELF_OFFER` | 400 | Buyer is the current owner |
| `PRICE_TOO_LOW` | 400 | `priceUSD ≤ assignment.priceUSD` OR `priceUSD < 650` |
| `ASSIGNMENT_NOT_FOUND` | 404 | assignmentId doesn't resolve |
| `USER_NOT_FOUND` | 404 | Buyer or owner lookup failed |
| `ASSIGNMENT_NOT_ACTIVE` | 409 | `assignment.status !== 'active'` |
| `ASSIGNMENT_LOCKED` | 409 | `assignment.pendingResaleOffer` is set (accepted offer awaiting payment) |
| `SELLER_INVOICE_PENDING` | 409 | An invoice on this assignment is in `status ∈ {pending, draft}` AND its `expiresAt < now` (payment grace window elapsed). Pre-minted future-cycle invoices whose `expiresAt` is still in the future do NOT trip this gate. |
| `SUB_EXPIRING_SOON` | 409 | `daysRemainingUntil(expiresAt) < 3` |
| `DUPLICATE_OFFER` | 409 | Buyer already has a pending offer on this assignment |
| `OFFER_NOT_FOUND` | 404 | (accept/reject/cancel) offerId doesn't resolve |
| `OFFER_NOT_PENDING` | 409 | Offer status is not `pending` |
| `OFFER_EXPIRED` | 409 | Offer past `expiresAt` (accept-time check) |
| `NOT_OWNER` | 403 | Caller isn't the current owner (accept/reject) |
| `NOT_BUYER` | 403 | Caller isn't the offer's buyer (cancel) |

Policy constants (in [`services/franchiseOffer.ts`](src/services/franchiseOffer.ts)):

```ts
OFFER_TTL_DAYS   = 7     // pending offers auto-expire after 7 days
LAST_DAYS_GATE   = 3     // block offers within 3 days of renewal
OFFER_FLOOR_USD  = 650   // platform floor (reused from FRANCHISE_PRICE_USD)
```

---

## Endpoints

All under the `/franchise-program` prefix. All require auth
(`Authorization: Bearer <jwt>`).

### Buyer surfaces

#### `POST /assignments/:assignmentId/offers`

Submit a new offer.

**Body**
```json
{ "priceUSD": 900, "message": "Serious buyer, ready to pay today." }
```

**Success 201**
```json
{
  "offer": {
    "id": "…", "assignmentId": "…", "programId": "…", "officeId": "…",
    "geoLevel": "territory", "geoEntityId": "…", "geoEntityName": "Karnataka",
    "fromUserId": "…", "fromEmail": "buyer@example.com",
    "toUserId": "…",   "toEmail":   "owner@example.com",
    "currentPriceUSD": 700, "offerPriceUSD": 900,
    "message": "Serious buyer, ready to pay today.",
    "status": "pending",
    "respondedAt": null,
    "expiresAt": "2026-07-30T…Z",
    "invoiceId": null,
    "resolutionTxRefs": null,
    "createdAt": "…", "updatedAt": "…"
  }
}
```

**Common errors:** `SELF_OFFER`, `PRICE_TOO_LOW`, `ASSIGNMENT_NOT_ACTIVE`,
`ASSIGNMENT_LOCKED`, `SELLER_INVOICE_PENDING`, `SUB_EXPIRING_SOON`,
`DUPLICATE_OFFER`.

---

#### `GET /offers/outgoing`

List the caller's own submitted offers.

**Query params** (all optional): `status`, `limit` (default 50, max 200),
`cursor` (last `_id` from previous page).

**Success 200**
```json
{
  "offers": [ { … as above … }, … ],
  "nextCursor": "6a621168af4cc082bf8855a5" | null
}
```

---

#### `POST /offers/:offerId/cancel`

Buyer withdraws a still-pending offer.

**Success 200**: `{ "offer": { …, "status": "cancelled", "respondedAt": "…" } }`
**Errors:** `NOT_BUYER`, `OFFER_NOT_PENDING`, `OFFER_NOT_FOUND`.

---

### Seller / Owner surfaces

#### `GET /offers/incoming`

Owner's inbox of offers received on their assignments.

**Query params**: `status`, `limit`, `cursor` (same as outgoing).

**Sort**:
- `status=pending` → grouped by `assignmentId`, then by `offerPriceUSD` desc
  (best offer per territory first).
- Any other status → newest first.

**Success 200**: same shape as outgoing.

---

#### `POST /offers/:offerId/accept`

Owner accepts the offer. In one atomic step this:
1. Re-runs every submit-time gate.
2. Computes the prorated amount.
3. Mints the resale invoice (non-recurring).
4. CAS-locks the assignment via `pendingResaleOffer`.
5. Auto-rejects every other pending offer on the same assignment.
6. Fires notifications to the winning buyer + losing buyers.

**Success 201**
```json
{
  "offer": { …, "status": "accepted", "invoiceId": "…" },
  "assignment": { …, "pendingResaleOffer": { … } },
  "invoiceId": "6a…",
  "invoiceNumber": "INV-MR…",
  "amountUSD": 451.23,
  "daysRemaining": 183,
  "autoRejectedCount": 2
}
```

**Errors:** `NOT_OWNER`, `OFFER_NOT_PENDING`, `OFFER_EXPIRED`,
`ASSIGNMENT_LOCKED` (concurrent-accept race), plus every submit-time gate.

---

#### `POST /offers/:offerId/reject`

Owner explicitly rejects a pending offer.

**Success 200**: `{ "offer": { …, "status": "rejected" } }`
**Errors:** `NOT_OWNER`, `OFFER_NOT_PENDING`, `OFFER_NOT_FOUND`.

---

## Notifications

Every state transition fires a `UserNotification` row of type
`"franchise_offer"`. The `franchiseOfferEvent` field discriminates which
moment is being surfaced, so the FE can pick copy/icon/deep-link without
querying the offer doc.

| Event | Recipient | When |
|---|---|---|
| `created` | Owner | Buyer submits a new offer |
| `accepted` | Buyer (winner) | Owner accepts (includes `franchiseInvoiceId` for pay-through) |
| `rejected` | Buyer | Owner explicitly rejects |
| `auto_rejected` | Buyer | Another offer on the same assignment was accepted first |
| `cancelled` | Owner | Buyer withdrew their offer |
| `expired` | Buyer + Owner | Offer hit its TTL without a decision |

Notifications are surfaced by the generic `GET
/user-notifications/` endpoint (already exists — no route changes
needed on the read side). Badge counts flow through
`GET /user-notifications/unread-count` unchanged.

---

## TTL sweeper

`expireStalePendingOffers()` in
[`services/franchiseOffer.ts`](src/services/franchiseOffer.ts) is called
from the existing daily cron in
[`routes/invoice.ts`](src/routes/invoice.ts):

```ts
POST /api/invoices/cron/generate-recurring
Header: x-cron-secret: <CRON_WEBHOOK_SECRET>
```

Response now includes a `franchiseOffers: { expired: <n> }` block.
Any pending offer whose `expiresAt < now` flips to `status: "expired"` and
fires notifications to buyer + owner.

---

## End-to-end curl walkthrough

Setup: owner already holds an active territory
`$AID` at `$700` with `expiresAt = 2026-12-01`.

```bash
# 1. Buyer B submits an offer at $900.
curl -X POST \
  -H "Authorization: Bearer $BUYER_B_JWT" \
  -H "Content-Type: application/json" \
  "$API/franchise-program/assignments/$AID/offers" \
  -d '{"priceUSD": 900, "message": "Serious buyer, ready to pay today."}'
# → 201 { offer: { id: $OID_B, status: "pending", … } }

# 2. Buyer C submits an offer at $850.
curl -X POST -H "Authorization: Bearer $BUYER_C_JWT" \
  -H "Content-Type: application/json" \
  "$API/franchise-program/assignments/$AID/offers" \
  -d '{"priceUSD": 850}'
# → 201 { offer: { id: $OID_C, status: "pending", … } }

# 3. Buyer D submits a killer $920 offer.
curl -X POST -H "Authorization: Bearer $BUYER_D_JWT" \
  -H "Content-Type: application/json" \
  "$API/franchise-program/assignments/$AID/offers" \
  -d '{"priceUSD": 920}'
# → 201 { offer: { id: $OID_D, status: "pending", … } }

# 4. Owner views the inbox — sorted by best price first (pending filter).
curl -H "Authorization: Bearer $OWNER_JWT" \
  "$API/franchise-program/offers/incoming?status=pending"
# → { offers: [D($920), B($900), C($850)] }

# 5. Owner accepts D's offer.
curl -X POST -H "Authorization: Bearer $OWNER_JWT" \
  "$API/franchise-program/offers/$OID_D/accept"
# → 201 {
#     offer: { status: "accepted", invoiceId: $INV },
#     invoiceId: $INV, invoiceNumber: "INV-…", amountUSD: 451.23,
#     daysRemaining: 183, autoRejectedCount: 2
#   }
# → B and C's offers now have status "auto_rejected".
# → Assignment has pendingResaleOffer set.
# → New notifications: D=accepted, B=auto_rejected, C=auto_rejected.

# 6. D pays the invoice via the normal invoice flow (store_wallet, gateway, etc.).
curl -X POST -H "Authorization: Bearer $BUYER_D_JWT" \
  "$API/invoices/$INV/pay" -d '{"paymentPlatform": "store_wallet"}'

# 7. Fulfilment fires automatically:
#    - assignment.ownerUserId = D
#    - assignment.priceUSD = 900
#    - subscription.expiresAt unchanged (still 2026-12-01)
#    - old sub-parent invoice → cancelled
#    - Seller's store_wallet credited $451.23
#    - Renewal-parent invoice minted at $900, dueDate 2026-12-01, status pending
#    - assignment.pendingResaleOffer cleared

# 8. On 2026-12-01 the recurring cron mints the next annual child at $900.
```

### Failure examples

```bash
# PRICE_TOO_LOW — offer must strictly exceed owner's current price.
curl -X POST -H "Authorization: Bearer $BUYER_JWT" \
  "$API/franchise-program/assignments/$AID/offers" -d '{"priceUSD": 700}'
# → 400 { error: "Offer must exceed current owner's price ($700)",
#         code: "PRICE_TOO_LOW" }

# SUB_EXPIRING_SOON — refuses within 3 days of renewal.
# (Owner's expiresAt is 2 days away.)
curl -X POST -H "Authorization: Bearer $BUYER_JWT" \
  "$API/franchise-program/assignments/$AID/offers" -d '{"priceUSD": 900}'
# → 409 { code: "SUB_EXPIRING_SOON" }

# DUPLICATE_OFFER — one live offer per (buyer, assignment).
curl -X POST -H "Authorization: Bearer $BUYER_JWT" \
  "$API/franchise-program/assignments/$AID/offers" -d '{"priceUSD": 950}'
# → 409 { code: "DUPLICATE_OFFER" }
# → Fix: cancel the prior offer, then resubmit.

# ASSIGNMENT_LOCKED — owner already accepted another offer.
curl -X POST -H "Authorization: Bearer $OWNER_JWT" \
  "$API/franchise-program/offers/$OTHER_OID/accept"
# → 409 { code: "ASSIGNMENT_LOCKED" }
# → Fix: wait for the pending resale invoice to pay or cancel.

# SELLER_INVOICE_PENDING — a renewal CHILD invoice is unpaid (overdue).
curl -X POST -H "Authorization: Bearer $BUYER_JWT" \
  "$API/franchise-program/assignments/$AID/offers" -d '{"priceUSD": 900}'
# → 409 { code: "SELLER_INVOICE_PENDING" }
```

---

## Race semantics

- **Two concurrent buyer submissions on the same assignment** — both
  succeed. Multiple pending offers coexist by design; the partial-unique
  index only blocks the SAME buyer from double-submitting.
- **Two concurrent accepts on different offers** (same owner) — one wins
  via the CAS on `pendingResaleOffer`. The loser rolls back: the freshly
  minted invoice is cancelled and the loser receives `ASSIGNMENT_LOCKED`.
- **Buyer submits during accept** — if the accept lands first, the
  submission proceeds and creates a `pending` offer, but the accept
  auto-rejected everyone in flight → next accept attempt from owner would
  be blocked by `ASSIGNMENT_LOCKED` until the resale invoice settles.
- **Resale invoice cancels / expires unpaid** — the `pendingResaleOffer`
  lock currently only clears on payment. If you need to reopen the
  assignment after an abandoned invoice, cancel the invoice + manually
  clear the sub-doc, OR have the offer's `respondedAt+TTL` sweep also
  release the lock (not implemented in v1 — flagged as a future
  enhancement).
- **Take-over of an accepted invoice** — not supported in v1. Once accepted,
  the assignment is locked. Other pending offers stay pending; a fresh
  accept becomes possible only after the current resale invoice cancels or
  expires.

---

## What we deliberately don't do

- **Auction close dates / bid history stacks** — a plain queue is enough.
- **Refund to old owner for prepaid time beyond what the buyer pays** —
  seller receives 100 % of the prorated resale invoice, nothing else.
- **Founder cut on the resale itself** — $0 on the resale. Founder revenue
  resumes at the next full annual cycle via the normal recurring engine.
- **Currency other than USD** — matches the existing franchise_territory
  line-item convention.
- **Push notifications** — in-app `UserNotification` + email are the only
  channels (matches the coupon-gift + reserve-offer conventions).
- **Cross-office bidding UI stacks** — the endpoint set supports it; UI is
  FE work.
- **Pay-early on the renewal-parent invoice** — visible in listings but not
  payable before `dueDate` in v1.

---

## Key files

| File | Purpose |
|---|---|
| `src/models/franchiseOffer.model.ts` | **NEW** — offer document, indexes |
| `src/models/franchiseTerritoryAssignment.model.ts` | Added `pendingResaleOffer` sub-doc |
| `src/models/userNotification.model.ts` | Added `franchise_offer` type + fields |
| `src/services/franchiseOffer.ts` | **NEW** — create / accept / reject / cancel / sweep |
| `src/services/invoice.ts` | Added `buyer_resale` branch to `franchise_territory` fulfilment |
| `src/services/franchiseSubscriptions.ts` | (unchanged — sweeper lives in franchiseOffer.ts) |
| `src/routes/franchiseProgram.ts` | Added 6 endpoints + `pendingResaleOffer` in payload |
| `src/routes/invoice.ts` | Wired `expireStalePendingOffers()` into the daily cron |
