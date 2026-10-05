# Global Franchise API — System A (GaragePayFran)

_Companion to [`FOUNDER_FRANCHISE_API.md`](./FOUNDER_FRANCHISE_API.md) (which covers System B — per-office founder franchise). Implementation plan: [`GLOBAL_FRANCHISE_PLAN.md`](./GLOBAL_FRANCHISE_PLAN.md)._

## What this is

Endpoints for selling GLOBAL franchise entities (country / territory / sub-territory from the roam-admin-prod catalog) to buyers via the Garage invoice engine. Ownership lives in a Garage-side `FranchiseGlobalAssignment` collection; the territory commission distributor reads it first and falls back to the catalog's `ownerEmail` for legacy owners.

**Mount point**: `/franchise-global`
**Auth**: standard JWT (Bearer token in `Authorization` header)
**Additional auth**: mutating endpoints (`POST /assignments`, `DELETE /assignments/:id`) require the caller to be the platform founder (`shorupan@gmail.com`). Read endpoints are open to any authenticated Garage user.

## Concepts

- **Assignment**: a row in `FranchiseGlobalAssignment` representing one owner of one global entity. Statuses:
  - `pending_payment` — created but invoice not yet paid; earns nothing
  - `active` — invoice paid, subscription window open; earns commissions on downstream sales in the entity's chain
  - `paused_lapsed` — subscription expired; earns nothing, slice cascades UP to the parent level (no fallback to catalog)
  - `cancelled` — admin cancelled; slot is soft-freed, a new assignment can be created
- **Price**: flat $650/yr floor. Admin may pass a higher `priceUSD` — the entire paid amount goes to Shorupan (no markup middleman like System B).
- **Recurring**: yearly. Cycle N+1 draft mints automatically on payment fulfilment via the standard invoice engine. Missed renewals get flipped to `paused_lapsed` by the daily sweeper.

---

## Endpoints

### `POST /franchise-global/assignments`

Platform admin creates a new assignment + invoice for a buyer.

**Auth**: platform founder only.

**Body**:
```json
{
  "geoLevel": "subTerritory",
  "geoEntityId": "6a071276091a2a6b79bb0057",
  "ownerEmail": "alice@example.com",
  "priceUSD": 650,
  "couponCode": "LAUNCH50"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `geoLevel` | `"country" \| "territory" \| "subTerritory"` | yes | Must match the entity's level in the catalog |
| `geoEntityId` | `string` | yes | The catalog document's `_id` (string, not ObjectId) |
| `ownerEmail` | `string` | yes | Must be an existing Garage user's email |
| `priceUSD` | `number` | no | Defaults to `650`. Must be `≥ 650` |
| `couponCode` | `string` | no | Applies to the $650 floor only (same rule as `franchise_territory`); markup above $650 is not couponable |

**Response** (201):
```json
{
  "assignment": {
    "id": "6a55...",
    "geoLevel": "subTerritory",
    "geoEntityId": "6a071276091a2a6b79bb0057",
    "geoEntityName": "Bengaluru Urban",
    "geoCountry": "India",
    "geoParentTerritory": "Karnataka",
    "ownerUserId": "68...",
    "ownerEmail": "alice@example.com",
    "priceUSD": 650,
    "status": "pending_payment",
    "acquisitionType": "original",
    "acquiredReassignmentId": null,
    "invoiceId": "6a...",
    "subscription": {
      "invoiceId": "6a...",
      "startedAt": null,
      "expiresAt": null
    },
    "pendingReassignment": null,
    "createdAt": "2026-07-18T14:00:00.000Z",
    "updatedAt": "2026-07-18T14:00:00.000Z"
  },
  "invoiceId": "6a...",
  "invoiceNumber": "INV-MRXXX-XXXX",
  "amountUSD": 650
}
```

**Errors**:
- `400` — invalid `geoLevel`, missing `geoEntityId` / `ownerEmail`, `priceUSD < 650`
- `403` — caller is not the platform founder
- `404` — catalog entity not found, or no Garage user with that email
- `409` — entity is already assigned (any status except `cancelled`); returns existing `assignment` in body

**What the buyer does**: opens the returned invoice URL (`/invoice/{invoiceId}`) and pays via any supported platform. Payment fulfilment flips `status: pending_payment → active`, sets `subscription.expiresAt = now + 1yr`, and credits Shorupan's wallet if paid via `store_wallet`.

---

### `GET /franchise-global/assignments`

List every assignment (any status).

**Auth**: platform founder only.

**Response**:
```json
{
  "assignments": [ /* array of assignment payloads (same shape as above) */ ]
}
```

---

### `GET /franchise-global/assignments/all`

Public listing — every active + paused-lapsed assignment. Any authenticated Garage user can call this (browse who owns what across the global catalog).

**Auth**: any signed-in Garage user.

**Response**: same shape as `GET /assignments`, filtered to `status ∈ {active, paused_lapsed}`.

---

### `GET /franchise-global/assignments/:assignmentId`

Read one assignment by id.

**Auth**: any signed-in Garage user.

**Errors**: `400` (invalid id), `404` (not found).

---

### `DELETE /franchise-global/assignments/:assignmentId`

Cancel an assignment (soft — sets `status: "cancelled"`, keeps the row).

**Auth**: platform founder only.

**Response**: the updated assignment payload.

**Errors**: `400` (invalid id), `404` (not found).

**Note**: cancelling does NOT refund the buyer or cancel their recurring invoice. If you need to also stop future renewal invoices, cancel the recurring parent invoice separately.

---

### `POST /franchise-global/assignments/:id/reassign-request` _(Phase 2 — stubbed)_

**Currently returns**: `501 Not Implemented`.

Will mirror System B's [`POST /franchise-program/assignments/:id/reassign-request`](./FOUNDER_FRANCHISE_API.md) when built — current owner asks to sell to a new buyer at a resale price.

---

### `POST /franchise-global/reassignments/:id/approve` _(Phase 2 — stubbed)_

**Currently returns**: `501 Not Implemented`.

Will mirror System B's approve endpoint — admin approves the resale, invoice is minted for the new buyer, on payment ownership transfers + reseller gets the markup above $650.

The invoice fulfilment case (`franchise_global`) is already resale-aware; only the endpoint wiring is deferred.

---

## Fulfilment behaviour (what happens when the buyer pays)

Handled in [`src/services/invoice.ts`](./src/services/invoice.ts) `case "franchise_global"`:

1. Load `FranchiseGlobalAssignment` by `primaryItem.itemId`.
2. If `pendingReassignment` matches this invoice (resale path): transfer ownership to `newOwnerUserId`, mark reassignment completed, cancel prior owner's recurring invoice, set `acquisitionType: "resale"`.
3. Otherwise (original or renewal): flip `status: "pending_payment" → "active"`, set `subscription.startedAt` if not set, `subscription.expiresAt = getNextChargeDate(base, "yearly")` (extends from later of current expiry / now), stamp `subscription.lastPaymentInvoiceId`.
4. If `paymentPlatform === "store_wallet"`: credit the full paid amount to Shorupan's platform wallet with an idempotent `metadata.franchiseFloor.invoiceId` tag. Skipped for gateway-paid invoices (money already settled externally).

## Commission earning (once assignment is `active`)

Distributor: [`src/services/territoryCommission.ts`](./src/services/territoryCommission.ts).

- The distributor runs on every paid sale (any itemType — community, workshop, product, etc.) at any org.
- For each of the 3 slices (sub-territory 15%, territory 5%, country 5% of the platform fee), it resolves the recipient by:
  1. Looking up the Garage `FranchiseGlobalAssignment` for the entity + level
  2. If found and `status === "active"` → pay this owner (`metadata.ownershipSource: "garage"`)
  3. If found and `status ∈ {paused_lapsed, cancelled, pending_payment}` → NO payout, no fallback to catalog; slice cascades UP per chain-integrity
  4. If no Garage assignment found → fall back to catalog's `ownerEmail` (`metadata.ownershipSource: "catalog"`)

## Lapse behaviour (daily sweeper)

[`src/services/franchiseSubscriptions.ts:expireFranchiseSubscriptions`](./src/services/franchiseSubscriptions.ts) runs daily via `/api/invoices/cron/generate-recurring`. It flips any global assignment whose `subscription.expiresAt < now` from `active → paused_lapsed`. Once paused, the entity earns nothing and the slice cascades up. Buyer can pay the pending renewal child invoice to re-activate at any time (fulfilment flips back to `active`).

## Recurring cycle

Each `franchise_global` invoice is created with `isRecurring: true, recurringPeriod: "yearly"`. On payment, `generateNextChildInvoice` mints the next cycle's draft child invoice with `expiresAt = subscription.expiresAt + 7d`. The daily safety-net cron `generateDueRecurringInvoices` catches any missed mints.

## Data model

**New collection**: `franchise_global_assignments` — see [`src/models/franchiseGlobalAssignment.model.ts`](./src/models/franchiseGlobalAssignment.model.ts).

Key fields:
- `geoLevel` + `geoEntityId` — reference to the catalog document
- `geoEntityName`, `geoCountry`, `geoParentTerritory`, `zipCodes` — denormalized for display and buyer-address matching
- `ownerUserId` (ObjectId), `ownerEmail` (string, lowercase)
- `priceUSD` (default 650)
- `status` (`pending_payment | active | paused_lapsed | cancelled`)
- `subscription: { invoiceId, startedAt, expiresAt, lastPaymentInvoiceId }`
- `pendingReassignment` (Phase 2)
- `acquisitionType` (`original | resale`), `acquiredReassignmentId`
- `soldByUserId` — audit trail (the admin who initiated the sale)

Unique compound index on `(geoLevel, geoEntityId)` — one assignment per global entity, cancelled rows keep the slot for Phase 2 resale writes.

## Not doing (deliberately)

- **Writing to roam-admin catalog** — Garage never modifies `franchise_countries` / `franchise_territorymasters` / `franchise_sub_territories`. If the external UI needs to know about Garage-side ownership changes, either add a push callback here on fulfilment or have roam-admin poll a new endpoint (both are follow-ups).
- **Self-serve buy** — only admin creates assignments in v1. Any Garage user can eventually browse the catalog + trigger a self-purchase via a future FE, but that requires opening the auth on `POST /assignments`.
- **Founder markup** — System B has an office-founder markup routing (excess above $650 → founder's office wallet). Global has none — all revenue is Shorupan's.
- **Frontend catalog browse UI** — no `/franchise-global` page in the web app yet. Buyer flow is: admin runs `POST /assignments` → shares the invoice URL → buyer pays via existing `/invoice/{id}` page.

## Full curl walkthrough

```bash
# 1) Admin (Shorupan) creates an assignment
curl -X POST "https://api.garage.app/franchise-global/assignments" \
  -H "Authorization: Bearer $SHORUPAN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "geoLevel": "subTerritory",
    "geoEntityId": "6a071276091a2a6b79bb0057",
    "ownerEmail": "alice@example.com",
    "priceUSD": 650
  }'
#   → returns { assignment: {...}, invoiceId: "...", invoiceNumber: "INV-...", amountUSD: 650 }

# 2) Send Alice the invoice link
#    https://my.garage.app/invoice/${invoiceId}
#    (works with any payment platform — Razorpay, store_wallet, Stripe, crypto)

# 3) Alice pays. Fulfilment automatically flips the assignment to `active`
#    and sets subscription.expiresAt = 2027-07-18.

# 4) Verify
curl "https://api.garage.app/franchise-global/assignments/${assignmentId}" \
  -H "Authorization: Bearer $ANY_JWT"
#   → { assignment: { status: "active", subscription: { expiresAt: "2027-07-18..." }, ... } }

# 5) Watch Alice earn. On any paid sale at an org whose postal code maps to
#    Bengaluru Urban, her TerritoryWallet gets credited with the 15% sub-slice.
#    metadata.ownershipSource === "garage" on the credit row.
```

## Related files

| File | Role |
|---|---|
| [`src/models/franchiseGlobalAssignment.model.ts`](./src/models/franchiseGlobalAssignment.model.ts) | Model |
| [`src/routes/franchiseGlobal.ts`](./src/routes/franchiseGlobal.ts) | Route file |
| [`src/services/invoice.ts`](./src/services/invoice.ts) | Fulfilment case `franchise_global` |
| [`src/services/territoryCommission.ts`](./src/services/territoryCommission.ts) | Distributor + Garage-first ownership resolution |
| [`src/services/franchiseSubscriptions.ts`](./src/services/franchiseSubscriptions.ts) | Daily lapse sweeper |
| [`src/models/invoice.model.ts`](./src/models/invoice.model.ts) | `franchise_global` itemType enumeration |
| [`GLOBAL_FRANCHISE_PLAN.md`](./GLOBAL_FRANCHISE_PLAN.md) | Implementation plan |
| [`FOUNDER_FRANCHISE_API.md`](./FOUNDER_FRANCHISE_API.md) | System B API doc (per-office franchise) |
