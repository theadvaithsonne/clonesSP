# Franchise (Global / System A) — Buyer-Initiated Resale Offers

Complete flow reference for the **buyer-initiated resale** feature on
`FranchiseGlobalAssignment` (System A — GaragePayFran). Any authenticated
Garage user can approach the current owner of an `active` global assignment
(country / territory / sub-territory) with a higher-price offer. The
**owner** (not the platform admin) accepts. On acceptance a prorated
invoice is minted for the buyer covering the remaining days of the current
subscription cycle. On payment, ownership transfers, the subscription's
`expiresAt` is **preserved**, and **100 % of the paid amount is credited to
the seller's store wallet at `PLATFORM_ORG_ID`** (platform and Shorupan get
$0 on the resale itself). Future annual renewals fire at the new price via
the normal recurring engine — platform revenue resumes then.

> **Direct mirror of** [FRANCHISE_RESALE_OFFERS_API.md](FRANCHISE_RESALE_OFFERS_API.md)
> (System B / per-office). Same math, same gates, same lifecycle — this
> doc calls out only what's different for System A.

> **Coexists with** the currently-501-stubbed owner-initiated global
> reassignment endpoints (`POST /assignments/:id/reassign-request` +
> `POST /reassignments/:id/approve`). Those stay stubbed until someone
> asks for them.

---

## What's different from System B

| Concern | System B (per-office) | **System A (global)** |
|---|---|---|
| Assignment collection | `FranchiseTerritoryAssignment` | `FranchiseGlobalAssignment` |
| Offer collection | `FranchiseOffer` (`franchise_offers`) | `FranchiseGlobalOffer` (`franchise_global_offers`) |
| Program / office context | `programId`, `officeId` on offer | none — global assignments are platform-scoped |
| Resale invoice `organizationId` | office's `_id` | `PLATFORM_ORG_ID` |
| Resale invoice `sellerId` | current owner | current owner |
| Renewal-parent `sellerId` | office founder (`assignedByUserId`) | platform user (Shorupan) — matches original global sales |
| Seller wallet destination | seller's store wallet at office's `orgId` | seller's store wallet at `PLATFORM_ORG_ID` |
| Founder markup on renewal | flows to office founder | N/A — no founder middleman |
| Platform floor on renewal | $650 platform / rest founder | 100 % to platform (matches original) |
| Notification type | `franchise_offer` | `franchise_global_offer` |
| Route prefix | `/franchise-program/...` | `/franchise-global/...` |
| Invoice metadata id | `franchiseAssignmentId` | `franchiseGlobalAssignmentId` |
| Metadata offer id | `franchiseOfferId` | `franchiseGlobalOfferId` |

Everything else — the 7-day TTL, 3-day expiry gate, `> current AND ≥ $650`
floor, first-accept-wins with auto-reject, prorated cents math, `expiresAt`
preservation, the "resale invoice non-recurring + mint renewal-parent"
pattern — is byte-for-byte identical.

---

## Data models

### `FranchiseGlobalOffer` (new — `src/models/franchiseGlobalOffer.model.ts`)

```ts
{
  _id,
  assignmentId,                                // FranchiseGlobalAssignment
  geoLevel, geoEntityId, geoEntityName,        // territory snapshot

  fromUserId, fromEmail,                       // buyer
  toUserId, toEmail,                           // current owner at submission

  currentPriceUSD,                             // owner's priceUSD at submission
  offerPriceUSD,                               // must exceed currentPriceUSD
  message?,                                    // maxlength 280

  status: 'pending' | 'accepted' | 'rejected'
        | 'cancelled' | 'auto_rejected' | 'expired',
  respondedAt?, expiresAt,                     // TTL = now + 7 days

  invoiceId?,                                  // resale invoice (set on accept)
  resolutionTxRefs?: {
    resaleInvoiceId?,
    renewalParentInvoiceId?,
    sellerWalletTxId?,
  },

  createdAt, updatedAt,
}
```

**Indexes** (identical to System B):
- `{ assignmentId, fromUserId }` **partial-unique** where `status: 'pending'`
- `{ toUserId, status, createdAt: -1 }` — owner inbox
- `{ fromUserId, status, createdAt: -1 }` — buyer outbox
- `{ status, expiresAt }` — TTL sweeper
- `{ assignmentId, status, offerPriceUSD: -1 }` — "best pending offer" reads

### `FranchiseGlobalAssignment.pendingResaleOffer` (new sub-doc)

Same shape as System B's addition, but the `offerId` refs `FranchiseGlobalOffer`
(not `FranchiseOffer`).

```ts
{
  offerId,          // ref: FranchiseGlobalOffer
  buyerUserId,
  buyerEmail,
  agreedPriceUSD,   // becomes assignment.priceUSD on payment
  resaleInvoiceId,  // the pending prorated invoice
  acceptedAt,
}
```

### `UserNotification.type: 'franchise_global_offer'` (new variant)

New fields, all optional (populated when `type === 'franchise_global_offer'`):

| Field | Purpose |
|---|---|
| `franchiseGlobalOfferId` | ref → `FranchiseGlobalOffer` (deep-link) |
| `franchiseGlobalAssignmentId` | ref → `FranchiseGlobalAssignment` (deep-link) |

**Reused across systems** (already existed for `franchise_offer`):
`franchiseTerritoryName` (works for global entity names too),
`franchiseOfferPriceUsd`, `franchiseOfferEvent` (same 6-value enum),
`franchiseInvoiceId`, plus the sender fields `giftFromUserId / giftFromName /
giftFromPicture / giftFromType / giftMessage`.

---

## Pricing math

Same formula as System B — see
[FRANCHISE_RESALE_OFFERS_API.md#pricing-math-pin-perfect](FRANCHISE_RESALE_OFFERS_API.md#pricing-math-pin-perfect)
for the derivation and the worked $700 → $900 / 183-day / **$451.23**
example.

Implementation lives in
[`services/franchiseGlobalOffer.ts`](src/services/franchiseGlobalOffer.ts)
(`daysRemainingUntil()`, `computeProratedCents()`).

---

## Money flow on resale-invoice payment

Handled by the new `isBuyerResaleG` branch in the `franchise_global` case
of [`services/invoice.ts`](src/services/invoice.ts). Detected by:

```ts
invoice.metadata.kind === "buyer_resale"
  && assignment.pendingResaleOffer
  && String(assignment.pendingResaleOffer.resaleInvoiceId)
       === String(invoice._id)
```

When both are true the fulfilment runs atomically:

1. **Ownership transfers** — `assignment.ownerUserId = buyer`,
   `ownerEmail`, `acquisitionType = "resale"`.
2. **Price flips forward** — `assignment.priceUSD = agreedFullPriceUSD`
   (from `pendingResaleOffer`).
3. **Expiry preserved** — `subscription.expiresAt` untouched.
   `subscription.lastPaymentInvoiceId` re-points to this invoice.
4. **Lock cleared** — `assignment.pendingResaleOffer = null`.
5. **Old recurring parent cancelled** — seller's previous subscription
   invoice `→ cancelled` so it stops minting renewal children.
6. **100 % → seller's store wallet at `PLATFORM_ORG_ID`** — via
   `creditStoreWallet(payer=buyer, recipient=seller, PLATFORM_ORG_ID,
   paidUSD)`. **No $650 floor to Shorupan on the resale itself.** The
   `WalletTransaction` carries
   `metadata.franchiseGlobal.kind = "global_buyer_resale_full"` for audit.
7. **Renewal-parent minted** — a NEW `isRecurring: true` invoice at
   `unitPrice = agreedFullPriceUSD * 100`, `sellerId = platform user`,
   `organizationId = PLATFORM_ORG_ID`, `dueDate = preservedExpiresAt`,
   `metadata.kind = "resale_renewal_parent"`. `subscription.invoiceId`
   re-points to it. On the preserved `expiresAt` the recurring engine
   mints the next annual child at the new full price — platform revenue
   resumes at that point.
8. **Audit trail stamped** —
   `FranchiseGlobalOffer.resolutionTxRefs = {resaleInvoiceId,
   renewalParentInvoiceId, sellerWalletTxId}`.

> The **catalog ownership sync** in the existing `franchise_global`
> fulfilment (which pushes `ownerEmail` to the roam-admin catalog) runs
> for both original-sale and renewal paths; the new buyer_resale branch
> transfers ownership but returns before the sync block — a follow-up
> could either invoke the same sync helper from the resale branch or
> let a downstream `save` hook handle it. Flagged as a nice-to-have.

---

## Gates & error codes

Identical to System B — every code returns via `FranchiseGlobalOfferError`
with the same `{status, code, message}` shape.

| Code | HTTP | Trigger |
|---|---|---|
| `INVALID_ASSIGNMENT` | 400 | `assignmentId` not a valid ObjectId |
| `INVALID_PRICE` | 400 | `priceUSD` missing / not positive |
| `INVALID_OFFER` | 400 | `offerId` not a valid ObjectId |
| `SELF_OFFER` | 400 | Buyer is the current owner |
| `PRICE_TOO_LOW` | 400 | `priceUSD ≤ assignment.priceUSD` OR `priceUSD < 650` |
| `ASSIGNMENT_NOT_FOUND` | 404 | Not found |
| `USER_NOT_FOUND` | 404 | Buyer or owner lookup failed |
| `ASSIGNMENT_NOT_ACTIVE` | 409 | `status !== 'active'` |
| `ASSIGNMENT_LOCKED` | 409 | `pendingResaleOffer` is set |
| `SELLER_INVOICE_PENDING` | 409 | An invoice on this assignment is in `pending / draft` AND its `expiresAt < now` (payment grace window elapsed). Pre-minted future-cycle invoices whose `expiresAt` is still in the future do NOT trip this gate. |
| `SUB_EXPIRING_SOON` | 409 | `daysRemainingUntil(expiresAt) < 3` |
| `DUPLICATE_OFFER` | 409 | Buyer already has a pending offer on this assignment |
| `OFFER_NOT_FOUND` | 404 | Offer id not found |
| `OFFER_NOT_PENDING` | 409 | Offer status not `pending` |
| `OFFER_EXPIRED` | 409 | Offer past `expiresAt` (accept-time check) |
| `NOT_OWNER` | 403 | Caller isn't the current owner (accept/reject) |
| `NOT_BUYER` | 403 | Caller isn't the offer's buyer (cancel) |

Policy constants (in
[`services/franchiseGlobalOffer.ts`](src/services/franchiseGlobalOffer.ts))
match System B: `OFFER_TTL_DAYS = 7`, `LAST_DAYS_GATE = 3`,
`OFFER_FLOOR_USD = 650`.

---

## Endpoints

All under the `/franchise-global` prefix. All require auth.

| Method | Path | Actor | Purpose |
|---|---|---|---|
| POST | `/assignments/:assignmentId/offers` | any auth | Buyer submits an offer |
| GET  | `/offers/outgoing?status=&limit=&cursor=` | any auth | Buyer's own offer list |
| GET  | `/offers/incoming?status=&limit=&cursor=` | any auth | Owner's inbox (pending sort = best price first per assignment) |
| POST | `/offers/:offerId/accept` | owner | Accept; mints prorated invoice, auto-rejects siblings, locks assignment |
| POST | `/offers/:offerId/reject` | owner | Explicit reject |
| POST | `/offers/:offerId/cancel` | buyer | Buyer withdraws |

Request / response shapes are byte-for-byte the same as the System B doc —
substitute the collection/assignment refs mentally.

### Sample `accept` success payload

```json
{
  "offer": { "id": "…", "status": "accepted", "invoiceId": "…", … },
  "assignment": {
    "id": "…",
    "geoLevel": "country",
    "geoEntityName": "Trinidad and Tobago",
    "ownerUserId": "…",
    "priceUSD": 700,
    "status": "active",
    "pendingResaleOffer": {
      "offerId": "…",
      "buyerUserId": "…",
      "buyerEmail": "…",
      "agreedPriceUSD": 900,
      "resaleInvoiceId": "…",
      "acceptedAt": "…"
    },
    …
  },
  "invoiceId": "6a…",
  "invoiceNumber": "INV-MR…",
  "amountUSD": 451.23,
  "daysRemaining": 183,
  "autoRejectedCount": 2
}
```

---

## Notifications

Same lifecycle events as System B but under `type: 'franchise_global_offer'`
so the FE can route deep-links to the global namespace.

| `franchiseOfferEvent` | Recipient | When |
|---|---|---|
| `created` | Owner | Buyer submits a new offer |
| `accepted` | Buyer (winner) | Owner accepts (`franchiseInvoiceId` set) |
| `rejected` | Buyer | Owner explicitly rejects |
| `auto_rejected` | Buyer | Another offer on the same assignment was accepted first |
| `cancelled` | Owner | Buyer withdrew their offer |
| `expired` | Buyer + Owner | Offer hit its TTL without a decision |

Surfaced by the existing generic `GET /user-notifications` endpoints — no
new read routes needed.

---

## TTL sweeper

`expireStaleGlobalPendingOffers()` in
[`services/franchiseGlobalOffer.ts`](src/services/franchiseGlobalOffer.ts)
is wired into the existing daily cron in
[`routes/invoice.ts`](src/routes/invoice.ts) alongside the System B
sweeper:

```ts
POST /api/invoices/cron/generate-recurring
Header: x-cron-secret: <CRON_WEBHOOK_SECRET>
```

Response now returns two offer-sweep blocks:

```json
{
  "success": true,
  "generated": {…},
  "expired": {…},
  "franchise": {…},
  "franchiseOffers": { "expired": 3 },
  "franchiseGlobalOffers": { "expired": 1 }
}
```

Any pending offer whose `expiresAt < now` flips to `status: "expired"` and
fires notifications to buyer + owner.

---

## End-to-end curl walkthrough

Setup: owner already holds an active global territory `$GID` at `$700`
with `expiresAt = 2026-12-01`.

```bash
# 1. Buyer B submits at $900.
curl -X POST -H "Authorization: Bearer $BUYER_B_JWT" \
  -H "Content-Type: application/json" \
  "$API/franchise-global/assignments/$GID/offers" \
  -d '{"priceUSD": 900, "message": "Serious about Karnataka."}'
# → 201 { offer: { id: $OID_B, status: "pending", … } }

# 2. Buyer C submits at $850. Buyer D submits at $920.
# … (same pattern)

# 3. Owner reads inbox — pending sorted by best price first per assignment.
curl -H "Authorization: Bearer $OWNER_JWT" \
  "$API/franchise-global/offers/incoming?status=pending"

# 4. Owner accepts D's offer.
curl -X POST -H "Authorization: Bearer $OWNER_JWT" \
  "$API/franchise-global/offers/$OID_D/accept"
# → 201 {
#     offer: { status: "accepted", invoiceId: $INV },
#     invoiceId: $INV, invoiceNumber: "INV-…", amountUSD: 451.23,
#     daysRemaining: 183, autoRejectedCount: 2
#   }

# 5. D pays via the normal invoice flow.
curl -X POST -H "Authorization: Bearer $BUYER_D_JWT" \
  "$API/invoices/$INV/pay" -d '{"paymentPlatform": "store_wallet"}'

# 6. Fulfilment fires:
#    - assignment.ownerUserId = D
#    - assignment.priceUSD = 900
#    - subscription.expiresAt unchanged (2026-12-01)
#    - old sub-parent invoice → cancelled
#    - Seller's store_wallet @ PLATFORM_ORG_ID credited $451.23
#    - Renewal-parent invoice minted at $900, dueDate 2026-12-01,
#      sellerId = platform (Shorupan), organizationId = PLATFORM_ORG_ID
#    - assignment.pendingResaleOffer cleared

# 7. On 2026-12-01 the recurring cron mints the next annual child at $900.
#    Shorupan is again credited the full $900 on payment (normal path).
```

### Failure examples

```bash
# PRICE_TOO_LOW — must strictly exceed owner's current price
curl -X POST -H "Authorization: Bearer $BUYER_JWT" \
  "$API/franchise-global/assignments/$GID/offers" -d '{"priceUSD": 700}'
# → 400 { code: "PRICE_TOO_LOW" }

# ASSIGNMENT_LOCKED — owner already accepted another offer
curl -X POST -H "Authorization: Bearer $OWNER_JWT" \
  "$API/franchise-global/offers/$OTHER_OID/accept"
# → 409 { code: "ASSIGNMENT_LOCKED" }

# DUPLICATE_OFFER — one live offer per (buyer, assignment)
curl -X POST -H "Authorization: Bearer $BUYER_JWT" \
  "$API/franchise-global/assignments/$GID/offers" -d '{"priceUSD": 950}'
# → 409 { code: "DUPLICATE_OFFER" }

# SUB_EXPIRING_SOON — within 3 days of renewal
curl -X POST -H "Authorization: Bearer $BUYER_JWT" \
  "$API/franchise-global/assignments/$GID/offers" -d '{"priceUSD": 900}'
# → 409 { code: "SUB_EXPIRING_SOON" }
```

---

## Race semantics

Identical to System B — see the [equivalent section in the System B
doc](FRANCHISE_RESALE_OFFERS_API.md#race-semantics). Concurrent buyer
submissions coexist; concurrent accepts resolve via CAS on
`pendingResaleOffer`; take-over of an accepted invoice is not supported
in v1.

---

## What we deliberately don't do (in this v1)

- **Owner-initiated + admin-approved global resale** — still 501-stubbed
  at `/assignments/:id/reassign-request` + `/reassignments/:id/approve`.
- **Auction close dates / bid history stacks**.
- **Refund to old owner for prepaid time beyond what the buyer pays** —
  seller receives 100 % of the prorated resale invoice, nothing else.
- **Platform cut on the resale itself** — $0. Platform revenue resumes at
  the next full annual cycle via the renewal-parent invoice.
- **Currency other than USD**.
- **Push notifications** — in-app `UserNotification` only.
- **Pay-early on the renewal-parent invoice** — visible but not payable
  before `dueDate` in v1.
- **Catalog ownership auto-sync on the resale branch** — the transfer
  happens in the assignment row; the roam-admin catalog `ownerEmail`
  push runs on the non-resale paths only. Flagged as a follow-up if you
  need it.

---

## Key files

| File | Purpose |
|---|---|
| `src/models/franchiseGlobalOffer.model.ts` | **NEW** — offer document, indexes |
| `src/models/franchiseGlobalAssignment.model.ts` | Added `pendingResaleOffer` sub-doc |
| `src/models/userNotification.model.ts` | Added `franchise_global_offer` type + 2 ID refs |
| `src/services/franchiseGlobalOffer.ts` | **NEW** — create / accept / reject / cancel / sweep |
| `src/services/invoice.ts` | Added `buyer_resale` branch to `franchise_global` fulfilment |
| `src/routes/franchiseGlobal.ts` | Added 6 endpoints + `pendingResaleOffer` in payload |
| `src/routes/invoice.ts` | Wired `expireStaleGlobalPendingOffers()` into the daily cron |

---

## Related docs

- [FRANCHISE_RESALE_OFFERS_API.md](FRANCHISE_RESALE_OFFERS_API.md) — System B
  (per-office franchise territories). Same design, more prose detail on
  math + race semantics.
- [GLOBAL_FRANCHISE_API.md](GLOBAL_FRANCHISE_API.md) — the original System A
  API surface (assign / self-buy / list / cancel).
