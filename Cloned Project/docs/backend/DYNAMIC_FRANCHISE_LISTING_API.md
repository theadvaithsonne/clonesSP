# Dynamic Franchise Listing Marketplace API — System B

_Companion to [`FOUNDER_FRANCHISE_API.md`](./FOUNDER_FRANCHISE_API.md) (per-office franchise: enroll + direct assign) and [`GLOBAL_FRANCHISE_API.md`](./GLOBAL_FRANCHISE_API.md) (System A global franchise)._

## What this is

Endpoints for a **listing marketplace** on top of the per-office franchise program (System B). Instead of the founder having to know the buyer's email ahead of time (direct-assign flow), the founder can now **list entities for sale at a price**, buyers **browse the marketplace**, and any authenticated Garage user can **claim** and pay.

**Mount point**: `/franchise-program`
**Auth**: standard JWT (Bearer token). Founder-only endpoints call `requireOfficeFounder` on the office.

## Lifecycle

```
(none) ──[founder: POST /listings]──▶ listed
listed ──[founder: PATCH /listings/:id]──▶ listed (new price)
listed ──[founder: DELETE /listings/:id]──▶ withdrawn
listed ──[buyer: POST /listings/:id/claim]──▶ pending_payment (owner=buyer, invoice minted)
pending_payment ──[buyer pays]──▶ active (subscription window opens, floor + markup credited)
pending_payment ──[different buyer: /claim]──▶ take-over: prev invoice cancelled, owner flipped
active ──[subscription expires]──▶ paused_lapsed
withdrawn ──[founder: POST /listings again]──▶ listed (re-open in place)
```

**Status meanings** on `FranchiseTerritoryAssignment.status`:
- `listed` — founder created a listing, no buyer yet
- `pending_payment` — buyer has claimed, invoice minted, awaiting payment
- `active` — paid, subscription window open, earning commissions
- `paused_lapsed` — subscription expired, earning paused
- `withdrawn` — founder pulled listing before anyone claimed
- `cancelled` — admin/founder cancelled a claimed assignment

## Auth matrix

| Endpoint | Auth |
|---|---|
| `GET /offices/:officeId/available-entities` | Founder of office |
| `POST /offices/:officeId/listings` | Founder of office |
| `GET /offices/:officeId/assignments?status=…` | Founder of office |
| `PATCH /listings/:assignmentId` | Founder of the row's office |
| `DELETE /listings/:assignmentId` | Founder of the row's office |
| `POST /listings/:assignmentId/claim` | Any signed-in Garage user |
| `GET /marketplace` | Any signed-in Garage user |

---

## Endpoints

### `GET /franchise-program/offices/:officeId/available-entities`

Founder browses the global catalog + sees per-entity availability in ONE call. Extends the existing `/catalog` endpoint by joining `FranchiseTerritoryAssignment` on this program.

**Auth**: founder of office.
**Query**: `?country=<name>&state=<name>` — same drill as `/catalog` (no country → returns countries; country only → territories; country+state → sub-territories).

**Response** (example for `?country=India&state=Karnataka`):
```json
{
  "level": "subTerritory",
  "items": [
    {
      "geoLevel": "subTerritory",
      "geoEntityId": "6a071276091a2a6b79bb0057",
      "name": "Bengaluru Urban",
      "country": "India",
      "parentTerritory": "Karnataka",
      "zipCodesCount": 1,
      "flag": "...", "coverImage": "...",
      "assignmentId": "6a5f...",
      "assignmentStatus": "active",
      "priceUSD": 650,
      "ownerEmail": "varsha@example.com"
    },
    {
      "geoLevel": "subTerritory",
      "geoEntityId": "6a071276091a2a6b79bb0058",
      "name": "Bengaluru Rural",
      "assignmentId": null,
      "assignmentStatus": null,
      "priceUSD": null,
      "ownerEmail": null
    }
  ]
}
```

`assignmentStatus: null` = truly available (no row yet). Any non-null = row exists on this program at that status.

---

### `POST /franchise-program/offices/:officeId/listings`

Founder creates 1..N listings in **bulk** (single is just an array of 1). Each item independently succeeds or fails — partial success is fine.

**Auth**: founder of office.
**Body**:
```json
{
  "items": [
    { "geoLevel": "subTerritory", "geoEntityId": "6a…", "priceUSD": 650 },
    { "geoLevel": "territory",    "geoEntityId": "6a…", "priceUSD": 800 },
    { "geoLevel": "country",      "geoEntityId": "6a…", "priceUSD": 10000 }
  ]
}
```

| Field | Type | Notes |
|---|---|---|
| `items[].geoLevel` | `"country" \| "territory" \| "subTerritory"` | Must match the entity's level |
| `items[].geoEntityId` | `string` | Catalog document's `_id` |
| `items[].priceUSD` | `number` | Must be `≥ 650` |

Max **100 items per request**. Items are processed in order.

**Response** (201):
```json
{
  "created": [
    { /* assignmentPayload */ "id": "6a…", "status": "listed", "priceUSD": 650, ... }
  ],
  "updated": [
    { "id": "6a…", "status": "listed", "priceUSD": 800, ... }  // was already listed, price changed
  ],
  "skipped": [
    {
      "geoLevel": "territory",
      "geoEntityId": "6a…",
      "reason": "Already active — cannot list until released"
    }
  ]
}
```

**Behavior per item**:
- No existing row → `create` new listing
- Existing `withdrawn` or `cancelled` → in-place update to `listed` with new price (counted as `created`)
- Existing `listed` → in-place update, new price (counted as `updated`)
- Existing `pending_payment` / `active` / `paused_lapsed` → skipped with reason (buyer has priority)

**Errors**:
- `400` — `items[]` empty or missing, > 100 items
- `409` — program is not active on this office
- `403` — caller is not office founder

---

### `GET /franchise-program/offices/:officeId/assignments`

_Existing endpoint — extended with a status filter._

**Auth**: founder of office.
**Query**: `?status=listed` or `?status=listed,pending_payment` (comma-separated).

Valid statuses: `listed | pending_payment | active | paused_lapsed | withdrawn | cancelled`. Omit param → all rows.

**Response**: `{ assignments: [ ... ] }` — one row per assignment, most recent first.

---

### `PATCH /franchise-program/listings/:assignmentId`

Update the price on a listing. Only allowed when `status: "listed"`.

**Auth**: founder of the row's office.
**Body**: `{ "priceUSD": 800 }` (must be `≥ 650`)

**Response** (200): `{ assignment: { ..., priceUSD: 800 } }`

**Errors**:
- `400` — invalid `priceUSD`
- `403` — not founder
- `404` — listing not found
- `409` — status is not `listed` (already claimed or withdrawn/cancelled). Existing pending_payment invoices keep their locked-in price — this endpoint only affects future buyers.

---

### `DELETE /franchise-program/listings/:assignmentId`

Withdraw a listing. Only allowed when `status: "listed"` — if a buyer has already claimed (`pending_payment`) or paid (`active/paused_lapsed`), returns 409 (buyer's deal is sacred).

**Auth**: founder of the row's office.

**Response** (200): `{ assignment: { ..., status: "withdrawn" } }`

**Errors**:
- `403` — not founder
- `404` — listing not found
- `409` — listing is already claimed → founder should use `DELETE /offices/:officeId/assignments/:id` (the existing cancel endpoint) for claimed rows

---

### `POST /franchise-program/listings/:assignmentId/claim`

Buyer claims a listed territory → mints their invoice.

**Auth**: any signed-in Garage user.
**Body**: `{ "couponCode": "OPTIONAL_CODE" }` (optional)

**Response** (201 for fresh claim, 200 for retry):
```json
{
  "assignment": { "id": "6a…", "status": "pending_payment", "ownerEmail": "buyer@…", ... },
  "invoiceId": "6a…",
  "invoiceNumber": "INV-MRUHN…",
  "amountUSD": 750,
  "retry": true       // only present on same-user retry (200)
}
```

**State matrix**:

| Existing state | Response |
|---|---|
| `listed` | **201** — transition to `pending_payment`, set owner = self, mint invoice |
| `pending_payment`, owner is SELF | **200** with `retry: true` and SAME invoiceId (idempotent) |
| `pending_payment`, owner is OTHER user | **201** — take-over: cancel their invoice, reassign to self, mint fresh invoice |
| `active` / `paused_lapsed` / `withdrawn` / `cancelled` | **409** with existing assignment payload |

**Errors**:
- `400` — invalid `assignmentId`, no email on user
- `401` — user not found
- `404` — listing not found
- `409` — program not active, or listing in un-claimable state, or race with concurrent state change

The buyer then opens `/invoice/{invoiceId}` to pay via any platform (Razorpay / Stripe / crypto / store_wallet). Fulfilment flips the assignment to `active`.

---

### `GET /franchise-program/marketplace`

Platform-wide browse — every `status: "listed"` row across ALL programs. Buyer picks one, calls `/claim`.

**Auth**: any signed-in Garage user.
**Query params** (all optional):

| Param | Notes |
|---|---|
| `country` | Case-insensitive exact match on `geoCountry` |
| `state` | Case-insensitive exact match on `geoParentTerritory` |
| `city` | Case-insensitive exact match on `geoEntityName` (mainly for sub-territories) |
| `geoLevel` | `country \| territory \| subTerritory` |
| `limit` | Default 50, max 200 |
| `cursor` | Assignment `_id` for cursor pagination (returns rows with `_id < cursor`) |

**Response**:
```json
{
  "limit": 50,
  "nextCursor": "6a5f4495f7834479af289d19",
  "listings": [
    {
      "id": "6a…",
      "programId": "6a…",
      "officeId": "6a…",
      "geoLevel": "territory",
      "geoEntityId": "6a…",
      "geoEntityName": "Karnataka",
      "geoCountry": "India",
      "priceUSD": 800,
      "status": "listed",
      "createdAt": "…",
      "program": {
        "id": "6a…",
        "founderUserId": "6a…"
      },
      "office": {
        "id": "6a…",
        "name": "Chamak",
        "slug": "chamak",
        "icon": "…",
        "country": "India",
        "state": "Karnataka",
        "city": "Bengaluru"
      }
    }
  ]
}
```

Sorted by `_id` descending (newest first). Paginate by passing the last row's `id` as `?cursor=`.

---

## Fulfilment behaviour on claim + pay

Handled by the existing `franchise_territory` case at [`services/invoice.ts:2541`](./src/services/invoice.ts) — **unchanged from the direct-assign flow**. When the buyer pays:

1. Assignment flips `pending_payment → active`
2. `subscription.startedAt = now`, `subscription.expiresAt = now + 1 year` (extended from later of current expiry / now on renewals)
3. `subscription.lastPaymentInvoiceId = <this invoice>`
4. **Platform floor credit** (store_wallet only): min($650, paid) → Shorupan's platform-org StoreWallet, tagged `metadata.franchiseFloor.kind = "territory_floor"` for idempotency
5. **Markup credit**: excess above $650 → founder's office StoreWallet with `metadata.franchiseProgram.kind = "territory_sale_markup"`
6. `generateNextChildInvoice` mints next cycle's draft child with `expiresAt = subscription.expiresAt + 7d`
7. Commission distribution (System B `franchiseProgramCommission.ts`) kicks in on future sales at this office — this territory's owner gets their configured slice per the office's `commissionConfig`

## Race + edge case handling

- **Take-over race**: CAS guard on assignment update — only mutates if status still in `[listed, pending_payment]`. If another buyer's payment fulfilled milliseconds before → 409 with fresh payload.
- **Same-user retry** on `/claim`: returns existing pending invoice with `retry: true`.
- **Bulk create-race**: E11000 duplicate-key catch → skipped item with reason `"Concurrent create — try again"`.
- **Withdraw guard**: CAS filter `status: "listed"`. Anything else → 409.
- **Price update guard**: CAS filter `status: "listed"`. Existing invoices retain their locked-in price.
- **Program-not-active**: claim returns 409. Founder needs to renew their program first.

## Data model

**Model**: [`FranchiseTerritoryAssignment`](./src/models/franchiseTerritoryAssignment.model.ts) — same collection used for direct-assign. Extended with:
- Statuses `"listed"` + `"withdrawn"` added to the enum
- `ownerUserId` + `ownerEmail` now **optional** (null on `listed` / `withdrawn` rows)
- All other fields unchanged: `programId`, `officeId`, `geoLevel`, `geoEntityId`, `geoEntityName`, `priceUSD`, `subscription`, `pendingReassignment`, etc.
- Unique compound index `{programId, geoLevel, geoEntityId}` — one row per entity per program, statuses cycle in place

Any code reading `ownerUserId` / `ownerEmail` must null-guard. `assignmentPayload()` already does.

## Not doing (deliberately)

- **Cross-program price comparison / auction** — two programs can independently list the same entity at different prices (existing pattern — assignments are per-program).
- **Founder email notifications** on claim / withdraw — silent for now.
- **Buyer wishlist / notify-when-listed** — no watchlist. Buyer polls `/marketplace`.
- **Frontend** — API-only ship. Founder + marketplace UIs are separate follow-up work.
- **Bulk withdraw** — one-at-a-time via DELETE. Bulk exists only for CREATE.
- **Rate-limiting** — the $650 subscription is the friction.

## Full curl walkthrough

```bash
# 1) Founder browses catalog with availability status
curl -H "Authorization: Bearer $FOUNDER_JWT" \
  "https://api.garage.app/franchise-program/offices/$OFFICE_ID/available-entities?country=India&state=Karnataka"

# 2) Founder lists Karnataka + Kerala at $650 each (bulk)
curl -X POST -H "Authorization: Bearer $FOUNDER_JWT" -H "Content-Type: application/json" \
  "https://api.garage.app/franchise-program/offices/$OFFICE_ID/listings" \
  -d '{"items":[
        {"geoLevel":"territory","geoEntityId":"KAR_ID","priceUSD":650},
        {"geoLevel":"territory","geoEntityId":"KER_ID","priceUSD":750}
      ]}'
# → { created: [...], updated: [], skipped: [] }

# 3) Founder inspects their listings only
curl -H "Authorization: Bearer $FOUNDER_JWT" \
  "https://api.garage.app/franchise-program/offices/$OFFICE_ID/assignments?status=listed"

# 4) Founder updates Karnataka price
curl -X PATCH -H "Authorization: Bearer $FOUNDER_JWT" -H "Content-Type: application/json" \
  "https://api.garage.app/franchise-program/listings/$ASSIGNMENT_ID" \
  -d '{"priceUSD":800}'

# 5) Founder withdraws Kerala (still listed)
curl -X DELETE -H "Authorization: Bearer $FOUNDER_JWT" \
  "https://api.garage.app/franchise-program/listings/$KER_ASSIGNMENT_ID"

# 6) Buyer browses marketplace
curl -H "Authorization: Bearer $BUYER_JWT" \
  "https://api.garage.app/franchise-program/marketplace?country=India&geoLevel=territory&limit=25"

# 7) Buyer claims Karnataka
curl -X POST -H "Authorization: Bearer $BUYER_JWT" -H "Content-Type: application/json" \
  "https://api.garage.app/franchise-program/listings/$ASSIGNMENT_ID/claim"
# → { assignment: {status:"pending_payment", ...}, invoiceId, invoiceNumber, amountUSD: 800 }

# 8) Buyer pays at /invoice/{invoiceId} via store_wallet / razorpay / stripe / crypto
#    → fulfilment activates the assignment, floor credit to Shorupan, markup to founder

# 9) Owner can now inspect status
curl -H "Authorization: Bearer $BUYER_JWT" \
  "https://api.garage.app/franchise-program/my/assignments"
```

## Related files

| File | Role |
|---|---|
| [`src/models/franchiseTerritoryAssignment.model.ts`](./src/models/franchiseTerritoryAssignment.model.ts) | Extended model (new statuses, optional owner fields) |
| [`src/routes/franchiseProgram.ts`](./src/routes/franchiseProgram.ts) | All 6 new endpoints + status filter on existing list |
| [`src/services/invoice.ts`](./src/services/invoice.ts) | `franchise_territory` fulfilment case — unchanged, reused |
| [`src/services/franchiseProgramCommission.ts`](./src/services/franchiseProgramCommission.ts) | Commission distribution on downstream sales — unchanged |
| [`src/services/franchiseSubscriptions.ts`](./src/services/franchiseSubscriptions.ts) | Daily lapse sweeper — unchanged |
| [`src/scripts/smoke-test-franchise-listings.ts`](./src/scripts/smoke-test-franchise-listings.ts) | End-to-end smoke test covering all 8 lifecycle steps |
| [`FOUNDER_FRANCHISE_API.md`](./FOUNDER_FRANCHISE_API.md) | System B direct-assign + enroll flow |
| [`GLOBAL_FRANCHISE_API.md`](./GLOBAL_FRANCHISE_API.md) | System A global franchise sibling API |
