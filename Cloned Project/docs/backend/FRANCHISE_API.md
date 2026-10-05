# Franchise API — Territory Commission Wallets

Read-only HTTP API for the franchise app (roam-admin-prod) to fetch territory-commission wallet balances and transaction history for users who own franchise entities (countries / territories / sub-territories).

- **Base URL (production)**: `https://api.garage.app/franchise-api`
- **Base URL (staging)**: `https://api.test.garage.app/franchise-api`
- **Base URL (local dev)**: `http://localhost:4000/franchise-api`
- **Auth**: every request must include the shared secret in the `X-Franchise-API-Key` header. The Garage team will provide the secret out-of-band; rotate by redeploy on both sides.
- **All endpoints are GET, read-only. No writes from the franchise side.**

## How money lands here

Every paid sale that goes through Garage's commission flow:

1. The platform fee (5% by default, or whatever the org is configured for) is credited 100% to Shorupan's wallet — same as today.
2. Immediately after, in a separate Mongo transaction, Garage:
   - Resolves the seller-org's address to its **leaf entity** in the franchise hierarchy (country / territory / sub-territory).
   - For each level in that leaf chain that has an owner, debits the corresponding slice (country 5% / territory 5% / sub-territory 15%) from Shorupan's wallet and credits it to the owner's `TerritoryWallet`.
3. Each credit becomes one row in `territory_wallet_transactions` (tagged with `entityType`, `entityId`, `originalSliceLevel`).

### Chain-integrity rule

Each level only earns if **every level below it has an owner**. Per Shorupan's spec:

> Country owner earns from territory → sub-territory → office earnings. If any link in the chain is missing, country doesn't earn. Same for territory owner.

Concretely:

| Slice | Pays when |
|---|---|
| Sub-territory 15% | Office's sub-territory has an owner. |
| Territory 5% | Office's sub-territory has an owner **AND** the territory has an owner. |
| Country 5% | Office's sub-territory has an owner **AND** the territory has an owner **AND** the country has an owner. |

**Practical consequences:**

- Office in a fully-owned chain (BU → Karnataka → India, all three with owners): standard 15/5/5 split, Shorupan keeps 75% of the platform fee.
- Office in a sub-territory whose territory has no owner: sub-territory owner gets 15%; the territory and country slices stay with Shorupan.
- Office in a territory leaf (e.g. Maharashtra org — Maharashtra has no sub-territories defined): **no commissions paid anywhere**. The full 100% of the platform fee stays with Shorupan until sub-territories are defined under that territory and given owners.
- Office in a "gap" — e.g. a Karnataka org that doesn't match any of Karnataka's sub-territories: **no commissions paid**. Until that org's location is covered by a sub-territory's zipCodes or city name, no one earns.

**Visibility tracks earnings.** An owner sees an office in their list if and only if they actually earn commission from that office. The offices endpoints below all use the same chain-integrity filter, so a country owner won't see orgs they don't earn from.

## Authentication

```
X-Franchise-API-Key: <shared-secret>
```

Without the header, or with a wrong key:
```http
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{ "error": "Missing X-Franchise-API-Key header", "code": "MISSING_API_KEY" }
```
or
```json
{ "error": "Invalid API key", "code": "INVALID_API_KEY" }
```

If the server has no `FRANCHISE_API_KEY` env var set:
```json
{ "error": "Franchise API not configured on this server", "code": "FRANCHISE_API_NOT_CONFIGURED" }
```

## Common response codes

| Status | Meaning |
|--------|---------|
| `200 OK` | Success |
| `400 Bad Request` | Missing/invalid param (email, userId, entityType, cursor) |
| `401 Unauthorized` | Bad/missing `X-Franchise-API-Key` |
| `404 Not Found` | No matching Garage user for the supplied email/userId |
| `500 Internal Server Error` | Unexpected server-side error (check Garage logs) |

The body is always JSON with at least an `error` field on non-2xx.

## Currency

All amounts are stored and returned in the original sale currency (no FX done on the Garage side). For v1, this is typically `USD` because the platform internally converts all sales to USD before distributing commissions. The `currency` field is present on every wallet and transaction response — always use it instead of assuming.

---

## Endpoints

### 1. Get wallet by email

```
GET /wallets/by-email/:email
```

Look up a user's territory wallet using their email address (case-insensitive). Email is what the franchise app already has on each entity's `ownerEmail`, so this is the primary lookup.

**Path params:**
- `email` — owner email, URL-encoded (e.g. `alice%40example.com`)

**Response 200:**
```json
{
  "userId": "67a3f80d1b9c2e0011223344",
  "email": "alice@example.com",
  "name": "Alice Owens",
  "balance": 12.50,
  "currency": "USD",
  "isActive": true,
  "totalEarnings": 47.25,
  "totalWithdrawn": 34.75,
  "lastTransactionAt": "2026-05-11T14:32:08.117Z"
}
```

Notes:
- `balance` is the spendable amount.
- `totalEarnings` is the lifetime sum of all credits.
- `totalWithdrawn` reflects withdrawals (v1: no withdrawal endpoint, so this stays at 0 unless we add one later).
- When the user exists in Garage but has never received a territory commission, `balance / totalEarnings / totalWithdrawn` all return `0` and `lastTransactionAt` is `null`. The wallet is materialized on first credit.

**Response 404:**
```json
{ "error": "No Garage user with that email", "email": "alice@example.com" }
```

Returned when the email isn't registered as a Garage user. The franchise app should treat this as "this person hasn't created a Garage account yet — commissions for entities they own will pile up unclaimed at Shorupan until they sign up."

**cURL:**
```bash
curl -H "X-Franchise-API-Key: $FRANCHISE_API_KEY" \
  https://api.garage.app/franchise-api/wallets/by-email/alice@example.com
```

---

### 2. Get wallet by user ID

```
GET /wallets/by-user/:userId
```

Same payload as `by-email` but keyed off the Garage user `_id` (24-char ObjectId hex). Use this when you already have a user reference from a previous call.

**Path params:**
- `userId` — 24-char ObjectId hex

**Response 200:** identical to `by-email`.

**Response 400** (invalid ObjectId):
```json
{ "error": "Invalid userId" }
```

**Response 404:**
```json
{ "error": "User not found" }
```

**cURL:**
```bash
curl -H "X-Franchise-API-Key: $FRANCHISE_API_KEY" \
  https://api.garage.app/franchise-api/wallets/by-user/67a3f80d1b9c2e0011223344
```

---

### 3. List wallet transactions

```
GET /wallets/by-email/:email/transactions
```

Paginated audit trail of every credit/debit/withdrawal on a user's territory wallet. Newest first, cursor-paginated.

**Query params:**

| Name | Type | Default | Description |
|---|---|---|---|
| `limit` | int | `50` | Page size, clamped to `[1, 200]`. |
| `cursor` | string | none | Pass back the `nextCursor` from a previous response to get the next page. |
| `entityType` | enum | none | Filter to `country`, `territory`, or `subTerritory` (the level the user OWNS). |
| `entityId` | string | none | Filter to a specific franchise entity `_id` (string). Combine with `entityType`. |

**Response 200:**
```json
{
  "transactions": [
    {
      "id": "67a40b117f1c9c001122aabb",
      "type": "credit",
      "amount": 0.75,
      "currency": "USD",
      "description": "Commission as territory owner of California",
      "status": "completed",
      "balanceBefore": 11.75,
      "balanceAfter": 12.50,
      "entityType": "territory",
      "entityId": "3d21086ea36c40340c646abf",
      "entityName": "California",
      "originalSliceLevel": "subTerritory",
      "relatedSplitPercentage": 15,
      "relatedSaleAmount": 100,
      "relatedPlatformFeeAmount": 5,
      "relatedPlatformFeePercentage": 5,
      "relatedOrgId": "69a063cc8fadb2ed68b88490",
      "relatedCommissionDistributionId": "67a40b117f1c9c001122aabc",
      "relatedPaymentId": "pay_PqA7yZxK8sLmNb",
      "relatedItemType": "course",
      "relatedItemId": "67a3ff0d8e9c2e0011223344",
      "relatedItemName": "Intro to Network Engineering",
      "createdAt": "2026-05-11T14:32:08.117Z"
    }
  ],
  "nextCursor": "67a40a017f1c9c0011229988"
}
```

When there's no next page, `nextCursor` is `null`.

#### Reading the fields

Under the leaf-aligned commission model, **`entityType` and `originalSliceLevel` are always equal** on each row — the level the user owns is the level the slice came from. The two fields are kept for forward compatibility but currently always identical.

`entityType` / `entityId` / `entityName` describe the franchise entity the user owns and got paid for. Display it as the headline label on the transaction row: "California (territory)".

`relatedSplitPercentage` tells you the slice size — `5` for country/territory rows, `15` for sub-territory rows.

A single sale at one office produces at most one transaction row per ancestor in the office's leaf chain. For an office in a sub-territory that has all three levels assigned: three rows land on the three respective owners (sub-territory owner gets a 15% row, territory owner gets a 5% row, country owner gets a 5% row).

To filter to a specific entity the user owns:
- `?entityType=territory&entityId=<CA-id>` — only transactions for California
- `?entityType=subTerritory&entityId=<LA-id>` — only transactions for LA

**cURL:**
```bash
# First page
curl -H "X-Franchise-API-Key: $FRANCHISE_API_KEY" \
  "https://api.garage.app/franchise-api/wallets/by-email/alice@example.com/transactions?limit=50"

# Next page
curl -H "X-Franchise-API-Key: $FRANCHISE_API_KEY" \
  "https://api.garage.app/franchise-api/wallets/by-email/alice@example.com/transactions?limit=50&cursor=67a40a017f1c9c0011229988"

# Only transactions for a specific entity Alice owns
curl -H "X-Franchise-API-Key: $FRANCHISE_API_KEY" \
  "https://api.garage.app/franchise-api/wallets/by-email/alice@example.com/transactions?entityType=territory&entityId=3d21086ea36c40340c646abf"
```

---

### 4. Entity summary

```
GET /entities/:entityType/:entityId/summary
```

Aggregate stats across **all credits** that landed on a particular franchise entity, regardless of which user currently owns it. Useful for "this territory has paid out $X total" badges in the franchise UI.

**Path params:**
- `entityType` — `country` | `territory` | `subTerritory`
- `entityId` — franchise `_id` (the string ID used in `franchise_countries` / `franchise_territorymasters` / `franchise_sub_territories`)

**Response 200:**
```json
{
  "entityType": "territory",
  "entityId": "3d21086ea36c40340c646abf",
  "totalCommissions": 47.25,
  "transactionCount": 63,
  "last30Days": {
    "total": 12.50,
    "count": 17
  },
  "currency": "USD"
}
```

Notes:
- `totalCommissions` and `last30Days.total` count **credit-type** rows only (debits and withdrawals are excluded).
- `currency` is the currency of the most recent credit row. If multiple currencies are present in the history (currently rare since Garage internally converts to USD), this is just the latest seen — not a multi-currency breakdown.

**Response 400:** invalid `entityType` or missing `entityId`.

**cURL:**
```bash
curl -H "X-Franchise-API-Key: $FRANCHISE_API_KEY" \
  https://api.garage.app/franchise-api/entities/territory/3d21086ea36c40340c646abf/summary
```

---

### 5. List offices in a single entity

```
GET /entities/:entityType/:entityId/offices
```

Returns every Garage office (organization) that falls under the given franchise entity, with **chain-integrity** enforcement. An office shows up under an entity only if the chain BELOW that entity is fully populated with owners — matching the commission rule (see "Chain-integrity rule" at the top of this doc).

| Entity queried | Returns orgs in |
|---|---|
| `subTerritory` | this sub-territory's matching orgs (by `org.postalCode ∈ zipCodes` or country+state+city CI match). |
| `territory` | sub-territories below this territory **whose ownerEmail is set**. Empty if no sub-territory has an owner. |
| `country` | sub-territories nested under territories of this country, where **both the territory and the sub-territory have owners**. |

Sub-territory match details:

| | How offices match |
|---|---|
| By zipCode | `org.postalCode ∈ subTerritory.zipCodes` |
| By name | `org.country` + `org.state` + `org.city` (CI) equal `subTerritory.country` + `subTerritory.parentTerritory` + `subTerritory.name` |

A sub-territory matches by EITHER method (OR'd at the query level).

**Worked example.** Karnataka has two sub-territories (`Bengaluru Urban`, `Bengaluru Rural`), each with an owner. Querying `/entities/territory/<karnataka-id>/offices` returns the orgs in those owned sub-territories. Orgs elsewhere in Karnataka (zip 560035 etc.) are in a "gap" — they don't match any sub-territory leaf and are invisible. Maharashtra has no sub-territories → querying its offices returns an empty list. India country owner gets the union: orgs in BU or BR (full chain owned), nothing more — Maharashtra orgs are excluded because Maharashtra has no owned sub-territories below it.

**Gap & territory-leaf orgs.** Orgs in a "gap" (e.g. zip 560035 in Karnataka with no matching sub-territory) or in a territory without sub-territories defined (Maharashtra) are invisible to every owner and generate **no commissions** until the franchise team adds zipCodes / defines sub-territories that cover them.

**Path params:**
- `entityType` — `country` | `territory` | `subTerritory`
- `entityId` — franchise entity `_id` (string)

**Query params:**

| Name | Type | Default | Description |
|---|---|---|---|
| `limit` | int | `50` | Page size, clamped to `[1, 200]` |
| `cursor` | string | none | Pass back `nextCursor` for the next page |

**Response 200:**
```json
{
  "entity": {
    "type": "subTerritory",
    "id": "6323c46a8f7693e56a2ad5f8",
    "name": "Los Angeles",
    "country": "United States",
    "parentTerritory": "California",
    "region": "North America",
    "status": "taken",
    "ownerEmail": "alice@example.com",
    "parentId": "3d21086ea36c40340c646abf",
    "zipCodesCount": 89
  },
  "offices": [
    {
      "id": "69a063cc8fadb2ed68b88490",
      "name": "Acme Studio",
      "slug": "acme-studio",
      "icon": "https://utfs.io/f/...",
      "country": "United States",
      "state": "California",
      "city": "Los Angeles",
      "postalCode": "90001",
      "latitude": 33.987,
      "longitude": -118.265,
      "createdAt": "2026-02-12T08:15:22.001Z"
    }
  ],
  "nextCursor": null
}
```

**Response 404:** `{ "error": "Entity not found", ... }` when the franchise entity doesn't exist.

Notes:
- The response always echoes the resolved entity for context.
- Sorted by `_id` descending (newest first). Cursor is the last returned `id`.

**cURL:**
```bash
# All offices in the LA sub-territory
curl -H "X-Franchise-API-Key: $FRANCHISE_API_KEY" \
  https://api.garage.app/franchise-api/entities/subTerritory/6323c46a8f7693e56a2ad5f8/offices

# All offices in India (country level)
curl -H "X-Franchise-API-Key: $FRANCHISE_API_KEY" \
  https://api.garage.app/franchise-api/entities/country/f8c8d6006ee610bd94dbee82/offices

# Paginated
curl -H "X-Franchise-API-Key: $FRANCHISE_API_KEY" \
  "https://api.garage.app/franchise-api/entities/territory/<state-id>/offices?limit=100&cursor=69a063cc8fadb2ed68b88490"
```

---

### 6. List entities owned by an email

```
GET /owners/by-email/:email/entities
```

Returns every franchise entity (country / territory / sub-territory) whose `ownerEmail` matches the given address (case-insensitive). Useful when you need to know what someone owns before fetching offices per entity.

**Path params:**
- `email` — owner email, URL-encoded

**Response 200:**
```json
{
  "email": "alice@example.com",
  "countries": [
    {
      "type": "country",
      "id": "f8c8d6006ee610bd94dbee82",
      "name": "India",
      "region": "Asia",
      "status": "taken",
      "ownerEmail": "alice@example.com"
    }
  ],
  "territories": [
    {
      "type": "territory",
      "id": "3d21086ea36c40340c646abf",
      "name": "California",
      "country": "United States",
      "region": "North America",
      "status": "taken",
      "ownerEmail": "alice@example.com",
      "parentId": "753cdc8a5d18acd92a1605da"
    }
  ],
  "subTerritories": [
    {
      "type": "subTerritory",
      "id": "6323c46a8f7693e56a2ad5f8",
      "name": "Los Angeles",
      "country": "United States",
      "parentTerritory": "California",
      "region": "North America",
      "status": "taken",
      "ownerEmail": "alice@example.com",
      "parentId": "3d21086ea36c40340c646abf",
      "zipCodesCount": 89
    }
  ],
  "totalCount": 3
}
```

Empty arrays when the owner has nothing at that level. `totalCount: 0` means they own nothing — different from a 404, which only fires for missing endpoints, not for "no results."

**cURL:**
```bash
curl -H "X-Franchise-API-Key: $FRANCHISE_API_KEY" \
  https://api.garage.app/franchise-api/owners/by-email/alice@example.com/entities
```

---

### 7. List all offices across all entities owned by an email

```
GET /owners/by-email/:email/offices
```

Convenience endpoint that merges offices across every entity the email owns. **Same chain-integrity visibility as endpoint #5** — an office is included only if the chain below the owner is fully populated. Each office is tagged (`matchedAt`) with the **most-specific owned entity** that contains it, so the franchise UI can group by region.

For example, if Mohith owns the Karnataka territory and Karnataka has two sub-territories (BU + BR, both with owners), Mohith's response includes orgs that fall in BU or BR. Each office's `matchedAt` is the Karnataka territory (his owned entity), not the sub-territory.

For Parijat (India country owner): the response only includes orgs in sub-territories where both the sub-territory AND its parent territory have owners. Currently that's the same 2 orgs as Mohith sees (BU + BR are owned, Karnataka is owned). India orgs in Maharashtra, Telangana, etc. don't show under Parijat because those territories have no owned sub-territory chain below them.

**Path params:**
- `email` — owner email

**Query params:**

| Name | Type | Default | Description |
|---|---|---|---|
| `limit` | int | `50` | Page size, clamped to `[1, 200]` |
| `cursor` | string | none | Pass back `nextCursor` for the next page |

**Response 200:**
```json
{
  "email": "alice@example.com",
  "offices": [
    {
      "id": "69a063cc8fadb2ed68b88490",
      "name": "Acme Studio",
      "slug": "acme-studio",
      "icon": "https://utfs.io/f/...",
      "country": "United States",
      "state": "California",
      "city": "Los Angeles",
      "postalCode": "90001",
      "latitude": 33.987,
      "longitude": -118.265,
      "createdAt": "2026-02-12T08:15:22.001Z",
      "matchedAt": {
        "entityType": "subTerritory",
        "entityId": "6323c46a8f7693e56a2ad5f8",
        "entityName": "Los Angeles"
      }
    },
    {
      "id": "69a18d870737560ed38089ef",
      "name": "DigitalMark",
      "slug": "digitalmark",
      "icon": null,
      "country": "India",
      "state": "Uttar pradesh",
      "city": "Noida",
      "postalCode": "20102",
      "latitude": 28.5355,
      "longitude": 77.3910,
      "createdAt": "2026-03-04T11:02:08.117Z",
      "matchedAt": {
        "entityType": "country",
        "entityId": "f8c8d6006ee610bd94dbee82",
        "entityName": "India"
      }
    }
  ],
  "nextCursor": null
}
```

The `matchedAt` field tells you which of Alice's owned entities this office falls under:
- If Alice owns LA + California + USA and an office is in LA → `matchedAt.entityType: "subTerritory"`.
- If Alice owns only USA (not California) and an office is in LA → `matchedAt.entityType: "country"`.

**Note**: the office list is deduplicated by org `_id` automatically (so the same office never appears twice even if it matches multiple owned entities). It's tagged with the **most specific** owned entity it matched.

**cURL:**
```bash
curl -H "X-Franchise-API-Key: $FRANCHISE_API_KEY" \
  "https://api.garage.app/franchise-api/owners/by-email/alice@example.com/offices?limit=100"
```

---

## Field reference

### Wallet

| Field | Type | Description |
|---|---|---|
| `userId` | string (ObjectId) | Garage `User._id` |
| `email` | string | Lowercase email |
| `name` | string \| null | Display name from the user's profile |
| `balance` | number | Spendable amount |
| `currency` | string | ISO currency code (typically `USD`) |
| `isActive` | bool | Wallet enabled flag (always true in v1) |
| `totalEarnings` | number | Lifetime sum of credits |
| `totalWithdrawn` | number | Lifetime sum of withdrawals (0 in v1) |
| `lastTransactionAt` | ISO date \| null | Timestamp of most recent change |

### Transaction

| Field | Type | Description |
|---|---|---|
| `id` | string (ObjectId) | Transaction `_id` (use as cursor) |
| `type` | enum | `credit` \| `debit` \| `withdrawal` |
| `amount` | number | Always positive |
| `currency` | string | ISO code |
| `description` | string | Human-readable summary |
| `status` | enum | `completed` \| `pending` \| `failed` \| `reversed` |
| `balanceBefore` | number | Wallet balance before this transaction |
| `balanceAfter` | number | Wallet balance after this transaction |
| `entityType` | enum | `country` \| `territory` \| `subTerritory` — what the owner owns |
| `entityId` | string | Franchise entity `_id` (string) |
| `entityName` | string | Denormalized entity name for display |
| `originalSliceLevel` | enum | `country` \| `territory` \| `subTerritory` — which 5/5/15 slice this represents |
| `relatedSplitPercentage` | number | `5` (country/territory) or `15` (sub-territory) |
| `relatedSaleAmount` | number | Sale principal (in USD after internal conversion) |
| `relatedPlatformFeeAmount` | number | Full platform fee for that sale |
| `relatedPlatformFeePercentage` | number | Org's effective platform fee % (5 by default, custom if overridden) |
| `relatedOrgId` | string (ObjectId) \| null | The seller's org `_id` |
| `relatedCommissionDistributionId` | string (ObjectId) \| null | Link to the parent commission distribution doc |
| `relatedPaymentId` | string \| null | The payment-gateway id (e.g. Razorpay `pay_...`) when available |
| `relatedItemType` | string \| null | `course`, `product`, `channel`, `workshop`, `service`, `call`, `ecommerce_item`, etc. |
| `relatedItemId` | string (ObjectId) \| null | The id of the product/course/etc. that was sold |
| `relatedItemName` | string \| null | Display name of the sold item |
| `createdAt` | ISO date | When this transaction was written |

### Entity summary

| Field | Type | Description |
|---|---|---|
| `entityType` | enum | Echoed from the path |
| `entityId` | string | Echoed from the path |
| `totalCommissions` | number | Sum of all `credit` rows for this entity, all-time |
| `transactionCount` | number | Count of `credit` rows for this entity, all-time |
| `last30Days.total` | number | Sum of credits in the trailing 30 days |
| `last30Days.count` | number | Count of credits in the trailing 30 days |
| `currency` | string | Currency of the most recent credit |

### Office (Organization)

| Field | Type | Description |
|---|---|---|
| `id` | string (ObjectId) | Garage `Organization._id` (use as cursor) |
| `name` | string | Office display name |
| `slug` | string \| null | URL slug |
| `icon` | string \| null | Logo URL |
| `country` | string | Country (as stored on the org) |
| `state` | string | State / region |
| `city` | string | City |
| `postalCode` | string \| null | Postal code (~65% coverage today) |
| `latitude` | number \| null | Google-geocoded lat |
| `longitude` | number \| null | Google-geocoded lng |
| `createdAt` | ISO date | When the office was created |
| `matchedAt` | object \| null | **Only present** on `/owners/by-email/:email/offices`. The most-specific entity owned by the queried email that this office matched. Shape: `{ entityType, entityId, entityName }` |

### Owned entity

Shape of items in the `countries[]` / `territories[]` / `subTerritories[]` arrays returned by `/owners/by-email/:email/entities`:

| Field | Type | Description |
|---|---|---|
| `type` | enum | `country` \| `territory` \| `subTerritory` |
| `id` | string | Franchise entity `_id` |
| `name` | string | Entity name |
| `country` | string | (territory + subTerritory only) parent country |
| `parentTerritory` | string | (subTerritory only) parent state name |
| `region` | string \| null | Geographic region |
| `status` | string \| null | Lifecycle (`available`, `taken`, `resale`, `auction`) |
| `ownerEmail` | string \| null | Currently always the queried email |
| `parentId` | string \| null | (territory + subTerritory only) parent entity `_id` |
| `zipCodesCount` | number | (subTerritory only) count of postal codes registered to this sub-territory |

---

## Examples by use case

### "Show me Alice's dashboard"

1. `GET /wallets/by-email/alice@example.com` → headline balance + lifetime stats
2. `GET /wallets/by-email/alice@example.com/transactions?limit=50` → recent activity feed
3. For each unique `entityId` in the response, group rows to show per-entity rollups in Alice's UI.

### "How much has the California territory generated in the last 30 days?"

`GET /entities/territory/3d21086ea36c40340c646abf/summary`
→ `last30Days.total`

### "Show only LA sub-territory transactions for the current owner"

1. `GET /wallets/by-email/<la-owner-email>/transactions?entityType=subTerritory&entityId=<la-id>&limit=50`
2. Paginate by passing `nextCursor` back as `cursor`.

### "Show all businesses in the California territory"

`GET /entities/territory/3d21086ea36c40340c646abf/offices?limit=100`
→ `offices[]` with name/icon/location for each, plus the entity itself echoed for header display.

### "Alice's dashboard — every business she earns from"

Option A (one call, pre-merged + tagged):
`GET /owners/by-email/alice@example.com/offices`
→ Group `offices[]` by `matchedAt.entityType` + `matchedAt.entityId` for a tree view.

Option B (two-step, more flexible):
1. `GET /owners/by-email/alice@example.com/entities` → her owned entities
2. For each entity → `GET /entities/:type/:id/offices` → its offices

Option A is one round-trip; option B lets you fetch on demand and re-paginate per region.

### "An owner is about to log in for the first time — show $0 if no wallet"

The wallet endpoints return `200` with `balance: 0` if the user exists in Garage but has never received commission (wallet hasn't been materialized). `404` only fires when the user doesn't exist in Garage at all — that's your signal to ask them to sign up first.

---

## Edge cases

- **Owner email doesn't match a Garage user**: commissions silently skip that level (Shorupan keeps the slice). The franchise app won't see a row for that entity until the owner creates a Garage account, at which point new sales start flowing — historical sales are NOT retroactively credited.
- **Multi-level ownership**: if Alice owns both California and Los Angeles, a sale at an org in LA produces two rows on Alice's wallet (one with `entityType: subTerritory, entityId: LA-id, amount: 15%`, one with `entityType: territory, entityId: CA-id, amount: 5%`). Filter or aggregate accordingly.
- **Pagination stability**: `_id` is monotonic so the cursor is stable even with concurrent writes. Newer rows that arrive between pages just won't appear until you re-issue a fresh page-1 call.
- **Status filter**: v1 only writes `status: "completed"` rows. Filtering by `failed` or `reversed` returns nothing for now.
- **Time zone**: all timestamps are ISO-8601 UTC. The franchise app is responsible for displaying in the owner's local time.

## Rate limits

No explicit rate limits in v1. Server-side caching is minimal — please don't poll faster than once per minute per wallet. If you need higher throughput, ask the Garage team and we'll either add caching or websocket push.

## Versioning

There is no version segment in the URL today. The endpoints will not introduce breaking changes without coordination — additive fields may appear in responses, so ignore unknown fields rather than rejecting them.

## Contact

Issues, schema gaps, missing fields → ping the Garage backend team in `#garage-backend` on Slack, or open a ticket referencing this doc.
