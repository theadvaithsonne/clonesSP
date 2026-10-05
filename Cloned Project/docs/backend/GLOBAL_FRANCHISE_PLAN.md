# Invoice-based selling for the GLOBAL franchise system (System A)

_Companion doc to [`FOUNDER_FRANCHISE_PLAN.md`](./FOUNDER_FRANCHISE_PLAN.md) (which covers System B — per-office founder franchise)._

## Context

Today, ownership of a global franchise entity (`FranchiseCountry` / `FranchiseTerritory` / `FranchiseSubTerritory`) is a plain `ownerEmail` string on the catalog document, written **exclusively by roam-admin-prod** (Garage backend is read-only against those collections per every model's header comment). No invoice / payment flow exists in Garage backend for someone to purchase a global territory — the entire monetization side happens externally.

The per-office founder franchise (System B) already ships a full invoice-based purchase flow:
- `POST /franchise-program/offices/:officeId/enroll` — office pays $650/yr to unlock program
- `POST /franchise-program/offices/:officeId/assignments` — founder assigns entity to a buyer, buyer pays via minted invoice link
- Buyer→buyer resale via `reassign-request` → `approve`
- Fulfilment upserts `FranchiseTerritoryAssignment` on payment; recurring cron mints next cycle; lapse sweeper flips to `paused_lapsed`

Founder wants the SAME pattern replicated for the global system, using the Garage invoice engine (any payment platform — Razorpay, store_wallet, crypto — all route through `createInvoice` + `fulfillInvoice`, no Razorpay-only fast paths).

Founder decisions confirmed:
- **Source of truth**: new Garage-side `FranchiseGlobalAssignment` table. Commission distributor reads it FIRST, falls back to catalog `ownerEmail` for legacy.
- **APIs**: same shape as System B (admin/platform-founder assigns to buyer email, invoice minted, buyer pays link).
- **Pricing**: flat $650/yr for all levels (country / territory / sub-territory).
- **Legacy owners** already set in roam-admin catalog: keep earning via fallback. No migration needed.

## Approach

Replicate System B's structure exactly, minus the office/program context.

### 1. New model — `FranchiseGlobalAssignment`

File: `src/models/franchiseGlobalAssignment.model.ts` (new).

Mirror `src/models/franchiseTerritoryAssignment.model.ts` with these adaptations:
- **Drop**: `programId`, `officeId`, `assignedByUserId` (or repurpose the last as `soldByUserId = shorupan` if a caller is worth logging).
- **Keep**: `geoLevel`, `geoEntityId`, `geoEntityName`, `geoCountry`, `geoParentTerritory`, `ownerUserId`, `ownerEmail`, `priceUSD` (default 650), `status` (`pending_payment | active | paused_lapsed | cancelled`), `acquisitionType` (`original | resale`), `acquiredReassignmentId`, `subscription` (`{invoiceId, startedAt, expiresAt, lastPaymentInvoiceId}`), `pendingReassignment` sub-doc.
- **Unique compound index**: `{ geoLevel: 1, geoEntityId: 1 }` — one active assignment per global entity.

### 2. New route file — `franchiseGlobal.ts`

File: `src/routes/franchiseGlobal.ts` (new). Mount at `/franchise-global` in `src/app.ts`.

**Auth**: new `requirePlatformFounder` middleware — checks `req.user.email === PLATFORM_USER_EMAIL` (from `services/commission`) OR user has global admin role. Mirrors `requireOfficeFounder` from `src/routes/franchiseProgram.ts:43` but for the platform level.

**Endpoints** (each mirrors the System B analog):

| Endpoint | Mirror of | What it does |
|---|---|---|
| `POST /assignments` | `franchiseProgram.ts:455` | Admin picks `{geoLevel, geoEntityId, buyerEmail, priceUSD?}` → creates `FranchiseGlobalAssignment` with `status: "pending_payment"` → mints invoice with itemType `franchise_global` → returns `{assignment, invoice: {id, url}}` |
| `GET /assignments/:id` | `franchiseProgram.ts:602` | Read state |
| `GET /assignments/all` | analogous to `/offices/.../assignments/all` | Public listing of active assignments (any authed user) |
| `POST /assignments/:id/reassign-request` | `franchiseProgram.ts:1012` | Current owner requests resale; validated + queued as `pendingReassignment` |
| `POST /reassignments/:id/approve` | `franchiseProgram.ts:1211` | Admin approves resale → mints new invoice for new buyer with `metadata.kind = "resale"` |
| `POST /assignments/:id/cancel` | System B cancel | Admin marks cancelled |

Reuse: `assignmentPayload`, `reassignmentPayload`, `loadCatalogEntity` helpers from `franchiseProgram.ts` — extract to a shared util if worth it, or duplicate for simplicity (the shape overlaps ~80%).

### 3. Invoice item type — `franchise_global`

File: `src/models/invoice.model.ts`.

Add `"franchise_global"` to:
- `InvoiceItemType` TS union (line 28-29 area, next to `franchise_program` / `franchise_territory`)
- Mongoose `lineItems.itemType` enum
- Zod schema (line 268-269 area)

One itemType covers all three levels — `geoLevel` lives on `metadata.geoLevel`.

### 4. Fulfilment case — `franchise_global` in `services/invoice.ts`

New `case "franchise_global":` block, mirroring `franchise_territory` case at `invoice.ts:2541`.

Logic:
- Parse `metadata.geoLevel`, `metadata.geoEntityId`, `metadata.assignmentId` (if pre-created).
- If `pendingReassignment` matches (resale path): transfer ownership to `newOwnerUserId`, mark `FranchiseReassignment` completed, cancel prior owner's recurring invoice. **Full copy of the resale block at :2620-2650**.
- Otherwise (original sale): flip assignment `status: "pending_payment" → "active"`, set `subscription.startedAt`, `subscription.expiresAt = getNextChargeDate(now, "yearly")`, `subscription.invoiceId`, `subscription.lastPaymentInvoiceId`.
- **Store wallet floor credit block**: mirror `invoice.ts:2714-2771` — when `paymentPlatform === "store_wallet"`, credit $650 to Shorupan's platform-org StoreWallet with `metadata.franchiseFloor` idempotency key. **No markup routing** (global sales are 100% to Shorupan — no founder middleman).
- Console log the activation.

### 5. Commission distributor update — reads Garage assignment FIRST

File: `src/services/territoryCommission.ts`.

Currently `pickOwner()` at `:108` pulls `ownerEmail` off the catalog entity. Adapt the resolution site to prefer Garage's `FranchiseGlobalAssignment` over the catalog:

New helper (in this file or a small util):
```ts
async function resolveOwnerForEntity(geoLevel, geoEntityId, catalogEntity):
    → FranchiseGlobalAssignment.findOne({geoLevel, geoEntityId, status: "active"})
    → if found and .ownerEmail set → return {ownerEmail, ownerUserId, source: "garage"}
    → else return {ownerEmail: catalogEntity.ownerEmail, source: "catalog"}
```

Called from `distributeTerritoryCommissions` for each of the three slices (country / territory / sub-territory), before `findRecipientUserNoSession`. Tag the wallet transaction metadata with `ownershipSource: "garage" | "catalog"` so audits can distinguish new-flow vs legacy.

**Lapsed assignments (`status: "paused_lapsed"`) return null** — no fallback to catalog when a Garage-tracked owner lapses. Important: once someone buys via Garage, they own it on Garage's terms — expiring means the slice cascades up (via existing chain-integrity logic), NOT reverts to whoever the catalog still lists.

### 6. Lapse sweeper — extend `franchiseSubscriptions.ts`

File: `src/services/franchiseSubscriptions.ts`.

Add a third `updateMany` for the new model:
```ts
FranchiseGlobalAssignment.updateMany(
  { status: "active", "subscription.expiresAt": { $lt: now } },
  { $set: { status: "paused_lapsed" } }
)
```

The existing daily cron webhook at `src/routes/invoice.ts:196` already calls `expireFranchiseSubscriptions` — new sweep runs alongside for free. No cron changes needed.

### 7. Recurring cycle — free from generic engine

`isRecurring: true, recurringPeriod: "yearly"` at invoice creation. `generateNextChildInvoice` at `invoice.ts:3200` mints cycle N+1 on payment. Daily safety-net cron `generateDueRecurringInvoices` at `invoice.ts:3452` catches missed mints. No new cron / no code changes here.

### 8. External sync (deferred — noted, not built)

Roam-admin-prod's catalog `ownerEmail` won't auto-update after a Garage-invoiced purchase (Garage doesn't write the catalog per the read-only contract). Two paths for later:
- **Push**: on `franchise_global` fulfilment, POST to a roam-admin-prod endpoint that flips `ownerEmail` (requires them to expose one).
- **Pull**: expose a Garage endpoint on `/franchise-api/*` (POST or GET) that roam-admin-prod polls for authoritative ownership.

Neither is required for this ship — commission distribution works correctly via the Garage assignment table. Sync only matters for the external UI's display consistency.

## Critical files

**New:**
- `src/models/franchiseGlobalAssignment.model.ts`
- `src/routes/franchiseGlobal.ts`

**Modified:**
- `src/models/invoice.model.ts` — add `franchise_global` itemType
- `src/services/invoice.ts` — new `case "franchise_global"` fulfilment block
- `src/services/territoryCommission.ts` — new `resolveOwnerForEntity` helper + wire into slice resolution
- `src/services/franchiseSubscriptions.ts` — add third `updateMany` for global assignments
- `src/app.ts` — mount `/franchise-global` router

**Reused (no changes):**
- `services/invoice.ts` recurring machinery (`generateNextChildInvoice`, `getNextChargeDate`, `generateDueRecurringInvoices`)
- `services/commission.ts` — territory distributor entry point still calls `distributeTerritoryCommissions`; internal ownership resolution changes but the outside contract stays same
- `models/franchiseReassignment.model.ts` — resale ledger row reused as-is (works across System B + System A)
- `services/wallet.ts` — `creditStoreWallet` for the floor credit block

## Not doing (deliberately)

- **Writing to roam-admin catalog** — the "read-only" contract is respected. External sync is a follow-up.
- **New itemType per level** (`franchise_global_country` / `franchise_global_territory` / `franchise_global_subTerritory`) — one itemType with `geoLevel` in metadata is enough; matches System B's approach.
- **Migration for legacy catalog owners** — they keep earning via fallback. If they want to convert to paid subscription, they go through the standard `POST /assignments` flow like any new buyer.
- **Founder markup on global sales** — global is 100% platform revenue ($650 flat to Shorupan). No middleman like System B's office founder.
- **Frontend buyer-facing catalog** — no Garage FE for browsing/buying yet. Buyer receives an invoice URL from wherever the admin initiated the purchase; iframe payment already works via existing `/invoice/{id}` page.
- **Self-serve buy endpoint** — only admin/platform-founder can assign for now. Matches System B's `requireOfficeFounder` gate.

## Verification

1. **Typecheck**: `cd garagenew-backend && npx tsc --noEmit` clean.
2. **Happy path — original sale**:
   - `POST /franchise-global/assignments` with `{geoLevel: "subTerritory", geoEntityId: "bengaluru-urban-id", buyerEmail: "test@x.com"}` → returns `{assignment: {status: "pending_payment"}, invoice: {id, url}}`.
   - Buyer pays via store_wallet → check `FranchiseGlobalAssignment.status === "active"`, `subscription.expiresAt ≈ now + 1yr`, one Shorupan floor credit of $650 with `metadata.franchiseFloor.invoiceId`.
3. **Commission earning**:
   - Trigger a paid sale (any itemType) at an org whose postal code maps to Bengaluru Urban.
   - Assert the sub-territory slice lands in the buyer's `TerritoryWallet`, not the pre-existing catalog `ownerEmail`.
   - `TerritoryWalletTransaction.metadata.ownershipSource === "garage"`.
4. **Legacy owner fallback**:
   - Pick a catalog entity with `ownerEmail` set but NO `FranchiseGlobalAssignment` row.
   - Trigger a sale that hits it → slice lands with the catalog owner as before. `metadata.ownershipSource === "catalog"`.
5. **Lapse**:
   - Backdate `subscription.expiresAt` to yesterday. Fire the daily cron → assignment flips to `paused_lapsed`.
   - Trigger a sale → slice cascades UP (no fallback to catalog for lapsed-but-tracked entities). Verify chain-integrity gives it to the parent level.
6. **Recurring cycle**:
   - After original payment, verify a draft child invoice was minted (via `generateNextChildInvoice`) with `expiresAt ≈ subscription.expiresAt + 7d`.
7. **Resale**:
   - `POST /assignments/:id/reassign-request` from current owner → returns pending reassignment invoice.
   - New buyer pays → assignment `ownerUserId` flips to new buyer, `pendingReassignment` cleared, `acquisitionType: "resale"`, `FranchiseReassignment.status: "completed"`, prior owner's recurring invoice cancelled.
8. **Idempotency**:
   - Replay the same paid invoice through `fulfillInvoice` (e.g. duplicate webhook) → no duplicate assignment activation, no duplicate floor credit (dedup via `metadata.franchiseFloor.invoiceId`).
