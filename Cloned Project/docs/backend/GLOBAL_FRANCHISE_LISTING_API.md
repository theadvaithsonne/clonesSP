# Global Franchise Listing Marketplace API — System A

_Companion to [`GLOBAL_FRANCHISE_API.md`](./GLOBAL_FRANCHISE_API.md) (System A base — direct-assign + self-buy + buyer-initiated offers) and [`DYNAMIC_FRANCHISE_LISTING_API.md`](./DYNAMIC_FRANCHISE_LISTING_API.md) (System B, the per-office founder-program equivalent)._

## What this is

Endpoints for a **listing marketplace** on top of the global (platform-wide) franchise system (System A). Two-track authorship:

- **Platform admin** (Shorupan) can list any unclaimed global catalog entity — country, territory, or sub-territory — at a custom price ≥ $650.
- **Current owner** of an already-`active` global assignment can re-list it for resale at a chosen price ≥ $650.

Any authenticated Garage user can browse the marketplace and claim a listing. On payment, ownership transfers to the claimer, the $650 platform floor is credited to Shorupan, and any excess above the floor is credited to whoever created the listing.

**Mount points**:
- Authed endpoints: `/franchise-global` (behind `requireAuth`).
- Public browse: `/franchise-global-public` (no auth required).

**Auth**: standard JWT (Bearer token). Lister-only endpoints check `listedByUserId === req.user.userId` OR `req.user.email === shorupan@gmail.com`.

## Lifecycle

```
(none) ──[lister: POST /listings]──▶ listed
active ──[owner: POST /listings]────▶ listed  (owner-resale: unsets owner/subscription, sets listedByUserId=owner)
listed ──[lister: PATCH /listings/:id]──▶ listed (new price)
listed ──[lister: DELETE /listings/:id]──▶ withdrawn
listed ──[buyer: POST /listings/:id/claim]──▶ pending_payment (owner=buyer, invoice minted)
pending_payment ──[buyer pays]──▶ active (subscription window opens, floor + markup credited)
pending_payment ──[different buyer: /claim]──▶ take-over: prev invoice cancelled, owner flipped
active ──[subscription expires]──▶ paused_lapsed
withdrawn ──[lister: POST /listings again]──▶ listed (re-open in place)
```

**Status meanings** on `FranchiseGlobalAssignment.status`:
- `listed` — a lister created a listing; no buyer yet. `ownerUserId`/`ownerEmail`/`subscription` are all null.
- `pending_payment` — buyer has claimed, invoice minted, awaiting payment.
- `active` — paid, subscription window open.
- `paused_lapsed` — subscription expired.
- `withdrawn` — lister pulled the listing before anyone claimed.
- `cancelled` — platform admin cancelled a claimed assignment (`DELETE /assignments/:id`).

## Money split on claim

On payment of a `franchise_global` invoice whose `metadata.claimedFromListing === true`:

| Slice | Amount | Recipient | Wallet |
|---|---|---|---|
| Platform floor | `min($650, paidUSD)` | Shorupan (`PLATFORM_USER_EMAIL`) | `StoreWallet(userId=Shorupan, orgId=PLATFORM_ORG_ID)` |
| Markup | `min(priceUSD − $650, paidUSD)` | `assignment.listedByUserId` | `StoreWallet(userId=lister, orgId=PLATFORM_ORG_ID)` |

Both credits are written as separate `WalletTransaction` rows for audit:
- Floor: `metadata.franchiseFloor.kind === "global_floor"` (with `claimedFromListing: true`).
- Markup: `metadata.franchiseGlobal.kind === "franchise_global_sale_markup"`.

If the lister IS Shorupan (fresh admin listing), both credits still route to the platform wallet — net-same total as today's 100%-to-Shorupan path, just two ledger rows instead of one.

Only `paymentPlatform === "store_wallet"` invoices trigger these credits; gateway-paid invoices (Razorpay/Stripe) settle externally.

Legacy paths (`POST /self-buy`, `POST /assignments`, buyer-initiated `/offers/*/accept`) do NOT set `claimedFromListing` — their existing behavior is unchanged.

## Auth matrix

| Endpoint | Auth |
|---|---|
| `GET /franchise-global-public/marketplace` | Public (no auth) |
| `GET /franchise-global-public/assignments/all` | Public (no auth) |
| `POST /franchise-global/listings` | Any signed-in user (per-item routing: admin OR owner) |
| `PATCH /franchise-global/listings/:id` | Lister of the row OR platform admin |
| `DELETE /franchise-global/listings/:id` | Lister of the row OR platform admin |
| `POST /franchise-global/listings/:id/claim` | Any signed-in Garage user |
| `GET /franchise-global/assignments` | Platform admin |
| `GET /franchise-global/assignments/:id` | Any signed-in user |

---

## Full user-flow endpoints

Everything the frontend needs to build the flow, in call order. Endpoints marked **NEW** shipped with the marketplace feature; everything else is pre-existing infrastructure that plugs into it.

### 1. Lister — deciding what to list

Both a platform admin (`shorupan@gmail.com`) and a current owner can drive this — the endpoint routes per-item internally.

| Purpose | Endpoint | Auth |
|---|---|---|
| List every global assignment I currently own (to pick one for resale) | `GET /franchise-global/assignments/all` (returns `active` + `paused_lapsed`; filter client-side by `ownerUserId === me`) | Signed-in |
| Admin view of all rows across all statuses | `GET /franchise-global/assignments` | Platform admin |
| Browse the global catalog to pick an unclaimed entity | `GET /franchise-api/scope/countries` / `?/territories?country=` / `?/sub-territories?country=&state=` | Signed-in |
| See a single assignment's current state | `GET /franchise-global/assignments/:assignmentId` | Signed-in |

### 2. Create / manage a listing (NEW)

#### `POST /franchise-global/listings` **NEW**

Bulk-create up to 100 listings in one call. Per-item authorization:
- If the row is missing or in `listed`/`withdrawn`/`cancelled` with no owner → **platform admin only**.
- If the row is `active` and `req.user.userId === row.ownerUserId` → **owner-resale** allowed.
- Anything else → skipped with `reason`.

**Body**
```json
{
  "items": [
    { "geoLevel": "country", "geoEntityId": "68f...", "priceUSD": 1000 },
    { "geoLevel": "subTerritory", "geoEntityId": "6a0...", "priceUSD": 2500 }
  ]
}
```

**Constraints**
- `items.length` in `[1, 100]`.
- `geoLevel` ∈ `{ "country" | "territory" | "subTerritory" }`.
- `priceUSD ≥ 650` (else that item is skipped).

**Owner-resale row transition** (CAS: `status=active` AND `ownerUserId=me`):
- `$set`: `status: "listed"`, `priceUSD`, `listedByUserId: me`.
- `$unset`: `ownerUserId`, `ownerEmail`, `subscription`, `pendingReassignment`, `pendingResaleOffer`.

**Fresh listing row transition** (upsert on `(geoLevel, geoEntityId)`):
- `$set`: `status: "listed"`, `priceUSD`, `listedByUserId: admin`, catalog fields.
- `$unset`: owner + subscription fields when re-listing a `withdrawn`/`cancelled` row.
- Skips rows in `pending_payment`/`paused_lapsed` (`already <status>` reason).

**Response `201`**
```json
{
  "created": [ /* assignmentPayload */ ],
  "updated": [ /* assignmentPayload */ ],
  "skipped": [
    { "geoLevel": "country", "geoEntityId": "68f...", "reason": "priceUSD must be ≥ 650" }
  ]
}
```

Common `skipped.reason` values:
- `Invalid geoLevel`
- `geoEntityId required`
- `priceUSD must be ≥ 650`
- `Catalog entity not found`
- `Only the current owner (or platform admin) can list this`
- `Only platform admin can create fresh listings`
- `Already pending_payment — cannot list until released`
- `Already paused_lapsed — cannot list until released`
- `Row changed under us — try again`
- `Concurrent create — try again`

---

#### `PATCH /franchise-global/listings/:assignmentId` **NEW**

Update the price on a listing.

**Auth**: `listedByUserId === me` OR platform admin. Returns `403` otherwise.

**Body**
```json
{ "priceUSD": 1500 }
```

**Precondition**: CAS `status === "listed"`. If a buyer already claimed → `409`.

**Response `200`**
```json
{ "assignment": /* assignmentPayload */ }
```

---

#### `DELETE /franchise-global/listings/:assignmentId` **NEW**

Withdraw a listing (marks `status: "withdrawn"`).

**Auth**: same as PATCH.

**Precondition**: CAS `status === "listed"`. If a buyer already claimed → `409`.

**Response `200`**
```json
{ "assignment": /* assignmentPayload */ }
```

---

### 3. Buyer — browsing the marketplace

#### `GET /franchise-global-public/marketplace` **NEW**

Public browse of every `status: "listed"` global assignment. No auth required.

**Query**
- `?geoLevel=country|territory|subTerritory` — filter by level.
- `?country=<name>` / `?state=<name>` / `?city=<name>` — geo filters (case-insensitive exact).
- `?limit=50` (max `200`).
- `?cursor=<assignmentId>` — cursor pagination (uses `_id < cursor`).

**Response `200`**
```json
{
  "limit": 50,
  "nextCursor": "6a5f..." | null,
  "listings": [
    {
      "id": "6a5f...",
      "geoLevel": "subTerritory",
      "geoEntityId": "6a071276091a2a6b79bb0057",
      "geoEntityName": "Bengaluru Urban",
      "geoCountry": "India",
      "geoParentTerritory": "Karnataka",
      "zipCodes": ["560001"],
      "ownerUserId": null,
      "ownerEmail": null,
      "listedByUserId": "68b...",
      "priceUSD": 2500,
      "status": "listed",
      "acquisitionType": "original",
      "createdAt": "...", "updatedAt": "..."
    }
  ]
}
```

#### `GET /franchise-global-public/assignments/all`

Existing public read of `active` + `paused_lapsed` rows — pairs with `/marketplace` for a full "owned + for-sale" view.

---

### 4. Buyer — claim + pay

#### `POST /franchise-global/listings/:assignmentId/claim` **NEW**

Buyer claims a listed entity and receives an invoice.

**Auth**: any signed-in user with an email on their account.

**Body**
```json
{ "couponCode": "OPTIONAL_PLATFORM_COUPON" }
```

**State matrix**

| Current status | Same user? | Behavior |
|---|---|---|
| `listed` | — | CAS transition → `pending_payment`, sets `ownerUserId`, `ownerEmail`, mints invoice, returns `201`. |
| `pending_payment` | yes | Idempotent retry: returns the existing invoice, `retry: true`, `200`. |
| `pending_payment` | no | Take-over: cancels prior draft/pending invoice, reassigns to caller, mints fresh invoice, `201`. |
| `active` / `paused_lapsed` / `withdrawn` / `cancelled` | — | `409` with `error: "Cannot claim — listing is <status>"`. |

**Invoice minted**
- `itemType: "franchise_global"`, `itemId = assignment._id`.
- `unitPrice = priceUSD * 100` (cents).
- `itemCurrency: "USD"`, `isRecurring: true`, `recurringPeriod: "yearly"`.
- `organizationId = PLATFORM_ORG_ID`, `sellerId = platformUser._id`.
- `metadata.claimedFromListing = true` ← the signal the fulfillment handler uses to split the money.
- Immediately promoted `draft` → `pending` so it's payable via `GET /api/invoices/:invoiceId`.

**Response `201` (fresh claim or take-over) / `200` (idempotent retry)**
```json
{
  "assignment": /* assignmentPayload */,
  "invoiceId": "68b...",
  "invoiceNumber": "GAR-25-08-000123",
  "amountUSD": 2500,
  "retry": true   // only on 200 idempotent retry
}
```

---

### 5. Buyer — checkout flow (existing invoice engine)

The invoice minted at claim time is a normal Garage invoice — the frontend uses the standard checkout endpoints.

| Purpose | Endpoint |
|---|---|
| Load the invoice for the checkout page | `GET /api/invoices/:invoiceId` |
| List payment options (currencies + gateways) | `GET /api/invoices/payment-options` |
| Choose currency + gateway (mints Razorpay Order if applicable) | `POST /api/invoices/:invoiceId/select-payment` |
| Apply a platform coupon | `POST /api/invoices/:invoiceId/apply-platform-coupon` |
| Pay from Garage store wallet | `POST /api/invoices/:invoiceId/pay-with-wallet` |
| Verify a Razorpay/Stripe payment callback | `POST /api/invoices/:invoiceId/verify-payment` |
| Fetch the receipt post-payment | `GET /api/invoices/:invoiceId/receipt` |
| Cancel the invoice (abandon the claim) | `POST /api/invoices/:invoiceId/cancel` |

**Note**: only `store_wallet`-paid claims trigger the internal Shorupan-and-lister credit split — gateway-paid claims settle externally (Razorpay / Stripe delivers the money) and the fulfillment handler skips the wallet-credit block.

---

### 6. Post-payment — verify ownership transferred

| Purpose | Endpoint |
|---|---|
| Fetch the updated assignment (status = `active`, ownerUserId = me) | `GET /franchise-global/assignments/:assignmentId` |
| Buyer's list of every active assignment they now hold | `GET /franchise-global-public/assignments/all` (client-filter `ownerUserId === me`) |
| Buyer's invoice history (recurring parent + payments) | `GET /api/invoices/my/list` |
| Recurring-subscription detail (renewal cadence) | `GET /api/invoices/subscriptions/:parentInvoiceId` |
| Lister's markup credit (post-payment reconciliation) | `GET /franchise-api/wallets/by-user/:listerUserId` |

---

## Assignment payload shape

Every endpoint that returns an assignment uses the same shape (called `assignmentPayload` in `routes/franchiseGlobal.ts` and `payload` in `routes/franchiseGlobalPublic.ts` — they match):

```json
{
  "id": "6a5f...",
  "geoLevel": "subTerritory",
  "geoEntityId": "6a071276091a2a6b79bb0057",
  "geoEntityName": "Bengaluru Urban",
  "geoCountry": "India",
  "geoParentTerritory": "Karnataka",
  "zipCodes": ["560001"],
  "ownerUserId": "68b..." | null,
  "ownerEmail": "buyer@example.com" | null,
  "listedByUserId": "68b..." | null,
  "priceUSD": 2500,
  "status": "listed" | "pending_payment" | "active" | "paused_lapsed" | "withdrawn" | "cancelled",
  "acquisitionType": "original" | "resale",
  "acquiredReassignmentId": null,
  "invoiceId": "68c..." | null,
  "subscription": {
    "invoiceId": "68c..." | null,
    "startedAt": "2026-08-03T...Z" | null,
    "expiresAt": "2027-08-03T...Z" | null
  },
  "pendingReassignment": null,
  "pendingResaleOffer": null,
  "createdAt": "...",
  "updatedAt": "..."
}
```

- `ownerUserId` / `ownerEmail` / `subscription.*` are null while `status === "listed"` (pre-owner) or `"withdrawn"`.
- `listedByUserId` is populated whenever a listing was created and persists through the eventual `active` status — it's the audit trail for who earned the markup.
- `pendingResaleOffer` / `pendingReassignment` refer to the OTHER two resale paths (buyer-initiated offers, and the 501-stubbed owner-initiated reassignment) — always `null` on rows that came through the marketplace-listing flow.

---

## Interaction with the other resale paths

System A has three distinct ways to change ownership. They are mutually exclusive by state:

| Path | Trigger | Requires status | Endpoints |
|---|---|---|---|
| **Marketplace listing** (this doc) | lister sets a fixed price, any buyer claims | `listed` (for claim) | `POST/PATCH/DELETE /listings*`, `POST /listings/:id/claim` |
| **Buyer-initiated offer** | buyer bids on an owned assignment, owner accepts | `active` (assignment has an owner) | `POST /assignments/:id/offers`, `POST /offers/:id/accept\|reject\|cancel` |
| **Owner-initiated reassignment** | owner names a specific new-owner, admin approves | Phase 2 — **not implemented** | `POST /assignments/:id/reassign-request` → `501` |

- An `active` assignment can either be listed (which unsets the owner) OR receive offers — not both simultaneously.
- A `listed` row rejects incoming offers because `assertOfferAllowed` requires `status === "active"`.
- A `pendingResaleOffer` lock on an `active` row does NOT block owner-listing today; if you list while an offer is in-flight, the `$unset: pendingResaleOffer` on the listing transition cancels the offer's grip (the buyer's prorated invoice is left in `pending` and needs manual cancellation by the buyer via `POST /offers/:id/cancel` before listing — call out this housekeeping in the UI).

---

## Verification checklist

Every path a frontend touches, end-to-end:

1. **Public browse** — `GET /franchise-global-public/marketplace` returns the row created by `POST /listings`; filter by geo works.
2. **Fresh admin listing** — Shorupan `POST /listings` with an unclaimed subTerritory at `priceUSD: 1000` → row appears in marketplace → any user `POST /listings/:id/claim` → invoice minted with `metadata.claimedFromListing: true` and `unitPrice: 100000` (cents) → pay via store_wallet → row flips to `active`, `ownerUserId` = claimer, `subscription.expiresAt` ≈ +1yr; Shorupan's platform wallet credited $650 with `metadata.franchiseFloor.kind: "global_floor"`, Shorupan's platform wallet ALSO credited $350 with `metadata.franchiseGlobal.kind: "franchise_global_sale_markup"` (net $1000 to Shorupan, two ledger rows because he was both floor recipient and lister).
3. **Owner resale** — pick an already-`active` row, as its owner `POST /listings` at `priceUSD: 2000` → row now `listed`, `ownerUserId` = null, `subscription` = empty, `listedByUserId` = prior owner → third user `POST /listings/:id/claim` → pay via store_wallet → prior owner's StoreWallet at `PLATFORM_ORG_ID` credited $1350 (`franchise_global_sale_markup`), Shorupan credited $650 (`global_floor`), new owner has a fresh 1-year subscription.
4. **Guard checks** — non-owner listing an `active` row → `skipped.reason: "Only the current owner (or platform admin) can list this"`. Non-admin listing an unowned row → `skipped.reason: "Only platform admin can create fresh listings"`. Owner listing a `paused_lapsed` row → `skipped.reason: "Already paused_lapsed — cannot list until released"`. `priceUSD < 650` → `skipped.reason: "priceUSD must be ≥ 650"`. Claim of `withdrawn`/`cancelled` → `409`.
5. **No regression on legacy paths** — `POST /self-buy` and `POST /assignments` do NOT set `claimedFromListing`, so the fulfillment handler runs the original 100%-to-Shorupan branch with no `franchise_global_sale_markup` row. Buyer-initiated offer `POST /offers/:id/accept` → pay → 100%-to-seller path (existing `isBuyerResaleG` branch) unchanged.
