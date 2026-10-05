# Founder Franchise System — Implementation Plan

> **Status tracker.** Update the checkboxes as each phase lands. APIs only (no frontend). Phase 1 must not break the existing global franchise system.

---

## 1. Context

Garage already has a **global franchise system** owned by Shorupan/platform:

- Read-only mirrors of `franchise_countries`, `franchise_territorymasters`, `franchise_sub_territories` (owned by the external `roam-admin-prod` app).
- A resolver (`src/utils/territoryResolver.ts`) maps an **office's** address → a leaf in the country→territory→sub-territory hierarchy.
- On every paid sale, `src/services/commission.ts` runs a 4-step distribution; **STEP 4** (`src/services/territoryCommission.ts`) carves 5%/5%/15% **out of the platform's 5% fee** (Shorupan's `StoreWallet`) to country/territory/sub-territory owners' `TerritoryWallet`s, under a **chain-integrity** rule.

**New request:** let a **Garage founder** run their *own* franchise program over an office they founded — independent of Shorupan's global one:

1. Founder opts in for **$650/year** per office (paid to platform via the invoice system).
2. Founder sets **per-level commission %** carved from **their own ~95% seller-gross share** (not the platform's 5%).
3. Founder **assigns/sells territories** to buyers. Buyer pays **$650/yr** (or a custom price ≥ $650 — **$650 → platform, excess → founder**).
4. Buyers may later **reassign** territories to other users (Phase 2).

---

## 2. Confirmed decisions (from Q&A)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Territory source | **Reuse the existing geo catalog** (`franchise_countries`/`franchise_territorymasters`/`franchise_sub_territories`) as read-only pick-list + for address matching. Ownership/commission live in **new** collections. |
| 2 | Earning rule | **Chain-integrity**, identical to global (sub earns if sub owned; territory only if sub+territory owned; country only if all three). |
| 3 | Phase 1 scope | Opt-in + set commissions + assign/sell territories + pay commissions. **Reassignment/resale deferred to Phase 2.** |
| 4 | Lapse | Subscription lapse → **pause earnings, keep the slot** (slice reverts to founder until renewed). |
| 5 | Layering | **Both layers run.** Global Shorupan 5%-fee split untouched; the founder layer is *additional*, carved from the office's seller-gross. |
| 6 | Wallet | **Reuse `TerritoryWallet`**, tag transactions with `source` + program/assignment refs (additive fields). Existing `/franchise-api` reads filtered to `source:"global"` so roam-admin numbers stay unchanged. |
| 7 | Cap | No fixed cap — **founder sets any per-level % out of his ~95% gross**; distribution **guards against overspend** (clip/skip a slice if the office's `StoreWallet` can't cover it; never negative). |
| 8 | Buyer/activation | Founder assigns by **email** (must resolve to an existing Garage user). The territory's **$650/yr invoice being PAID** activates earning. Unpaid = pending. |
| 9 | Program scope | **Per-office, independent.** Each enrolled office = its own program, its own $650/yr, own config, own assignments. |
| 10 | Commission source (crux) | On each sale at an enrolled office, the **BUYER's address/zipcode** is resolved to a geo leaf; the founder-program territory owner covering that buyer location earns their %, **carved from the selling office's seller-gross.** (Buyer-location attribution — different input from the global system's seller-office attribution.) |

---

## 3. Architecture

### 3.1 New collections (prefixed `franchise`)

**`franchise_programs`** — one per enrolled office.
- `officeId` (orgId, **unique**), `founderUserId`, `currency:"USD"`
- `status`: `pending_payment | active | suspended | cancelled`
- `commissionConfig`: `{ country:Number, territory:Number, subTerritory:Number }` (% of gross, founder-set)
- `subscription`: `{ priceUSD:650, period:"yearly", invoiceId, startedAt, expiresAt, lastPaymentInvoiceId }`
- timestamps

**`franchise_territory_assignments`** — territories sold/assigned within a program.
- `programId`, `officeId` (denorm)
- `geoLevel`: `country|territory|subTerritory`; `geoEntityId` (string `_id` from the catalog); denorm `geoEntityName`, `geoCountry`, `geoParentTerritory`, `zipCodes?`
- `ownerUserId`, `ownerEmail`
- `priceUSD` (≥650), `assignedByUserId`
- `status`: `pending_payment | active | paused_lapsed | cancelled`
- `subscription`: `{ invoiceId, startedAt, expiresAt, lastPaymentInvoiceId }`
- timestamps; **unique index** `(programId, geoLevel, geoEntityId)` — one owner per geo entity per program

### 3.2 Reused, extended additively (no breaking change)

- **`TerritoryWalletTransaction`** — add optional `source:"global"|"founder_program"` (**default `"global"`**), `franchiseProgramId`, `franchiseAssignmentId`, `franchiseOfficeId`, `buyerUserId`. Old rows read as `global`.
- **`Invoice` line-item enum** — add `franchise_program` (founder opt-in) and `franchise_territory` (buyer purchase).
- **`/franchise-api` read routes** — add `source:"global"` to wallet/transaction aggregations (safeguard against the reused-wallet mixing balances).

### 3.3 New code

- `src/models/franchiseProgram.model.ts`, `src/models/franchiseTerritoryAssignment.model.ts`
- `src/services/franchiseProgramCommission.ts` — STEP 5 distributor (mirrors `territoryCommission.ts`: own Mongo txn, non-blocking, chain-integrity plan builder, overspend guard)
- `src/utils/franchiseGeoResolver.ts` — `resolveGeoChainFromAddress(addr)` → `{country,territory,subTerritory}` **catalog entities** (pure geography, leaf-aware, no `ownerEmail` read). Reuse address-matching helpers from `territoryResolver.ts`.
- `src/utils/buyerAddress.ts` — `resolveBuyerAddress(invoice, buyerUser)`: invoice shipping → invoice billing → buyer `User` profile → `null` (no-op)
- `src/routes/franchiseProgram.ts` — new authed router, mounted in `app.ts`

### 3.4 Money flow on a sale at an enrolled office (additive STEP 5)

After `commission.ts` STEP 4 commits, call `distributeFranchiseProgramCommissions(...)` in its own try/catch (same non-blocking pattern as STEP 4):

1. Find active `franchise_program` for `sellerOrgId`; subscription not expired. Else no-op.
2. `resolveBuyerAddress` → `resolveGeoChainFromAddress` → catalog leaf chain for the **buyer**.
3. Match the program's assignments to those geo entity IDs per level; apply **chain-integrity**; drop levels whose assignment is not `active` (slice stays with founder).
4. Per earning level: `amount = sellerGross * cfgPct/100`. **Guard:** clip/skip if the office's `StoreWallet` balance can't cover (never negative).
5. **Debit** office `StoreWallet` (`WalletTransaction`), **credit** owner `TerritoryWallet` (`TerritoryWalletTransaction` with `source:"founder_program"` + program/assignment/office/buyer tags).

### 3.5 Invoice fulfilment (`services/invoice.ts` `fulfillInvoice`)

- `franchise_program` paid → program `status=active`, set subscription dates. $650 → platform org `StoreWallet`. **Skip `distributeCommissions`** (platform subscription, not a marketplace sale).
- `franchise_territory` paid → assignment `status=active`, set dates. **Split:** $650 → platform `StoreWallet`; `(priceUSD − 650)` → founder's office `StoreWallet`.
- Recurring: reuse the yearly recurring-invoice cron; renewal extends `expiresAt`. A daily check flips past-due assignments/programs to `paused_lapsed`/`suspended`.

### 3.6 API surface — router `/franchise-program`, `requireAuth` + founder-of-office checks

**Founder (must be founder of `:officeId`):**
- `POST /offices/:officeId/enroll` → create program (`pending_payment`) + $650/yr invoice
- `GET /offices/:officeId` → program, config, subscription status
- `PATCH /offices/:officeId/commissions` → set per-level %
- `GET /offices/:officeId/catalog?country=&state=` → browse geo catalog to assign
- `POST /offices/:officeId/assignments` → `{geoLevel, geoEntityId, ownerEmail, priceUSD≥650}`; creates assignment (`pending_payment`) + buyer $650/yr invoice
- `GET /offices/:officeId/assignments` → list + statuses
- `DELETE /offices/:officeId/assignments/:id` → cancel
- `GET /offices/:officeId/summary` → totals paid out, per-territory earnings, active/lapsed owners

**Territory owner:**
- `GET /my/assignments` → territories I own + status
- `GET /my/earnings` → `TerritoryWalletTransaction` filtered by owner + `source:"founder_program"` (cursor pagination)

**(Phase 2)** `POST /assignments/:id/reassign`, resale pricing, renewal reminders.

---

## 4. Phases & checklist

### Phase 0 — Data model & safety (no behavior change)
- [x] `franchiseProgram.model.ts`
- [x] `franchiseTerritoryAssignment.model.ts`
- [x] Additive fields on `TerritoryWalletTransaction` (`source` default `global` + program/assignment/office/buyer refs)
- [x] Invoice line-item enum values (`franchise_program`, `franchise_territory`)
- [x] `/franchise-api` reads exclude founder-program rows (`source:{$ne:"founder_program"}`; wallet payload subtracts the founder layer from authoritative wallet figures)
- [x] Verify existing commission/invoice flows unchanged — full `tsc --noEmit` clean (0 errors); all edits additive; STEP 5 no-ops for non-enrolled offices

### Phase 1 — Core feature
- [x] `franchiseGeoResolver.ts` + `buyerAddress.ts`
- [x] `franchiseProgramCommission.ts` (STEP 5 distributor — own txn, chain-integrity, overspend guard)
- [x] Wire STEP 5 into `commission.ts` (post-commit, non-blocking; buyer address from invoice shipping/billing → buyer profile fallback)
- [x] `franchiseProgram.ts` routes + mount in `app.ts` + `FRANCHISE_PRICE_USD=650` constant in `franchiseProgram.model.ts`
- [x] Invoice fulfilment handlers (program activate + territory activate & markup split) in `fulfillInvoice`; franchise types added to commission skip-list
- [x] Lapse cron (`expireFranchiseSubscriptions` wired into `/api/invoices/cron/generate-recurring`)
- [x] Founder + owner read APIs

#### Phase 1 — verification done
- [x] Pure money-logic unit checks — `scripts/verify-franchise-logic.ts` (14/14 pass, no DB): chain-integrity plan, buyer-address priority, overspend/clip arithmetic
- [x] Full `tsc --noEmit` clean (0 errors) after the chain-plan extraction refactor
- [x] e2e harness written — `scripts/test-franchise-e2e.ts` (guarded: refuses prod, self-cleaning). Seeds office/program/assignments → runs STEP 5 → asserts 15/5/5 payout + office debit

#### Phase 1 — remaining before production
- [ ] **Run** `scripts/test-franchise-e2e.ts` against a dev DB: `MONGODB_URI_TEST="mongodb+srv://.../roam-admin-dev" npx tsx scripts/test-franchise-e2e.ts`
- [ ] Confirm payment settlement direction for the territory markup ($650 floor → platform vs founder excess → office wallet) matches the gateway setup
- [ ] Decide cron auth/schedule: franchise lapse sweep rides the existing `/api/invoices/cron/generate-recurring` (daily)

### Add-on — Franchise coupons (admin platform coupon)
- [x] New `franchise_program` platform-coupon product type (model union + enum + `SUBSCRIPTION_PRODUCT_TYPES`; redemption enum)
- [x] `couponProductTypeForItem` maps `franchise_program` → `franchise_program`
- [x] Admin create route + validation route accept `franchise_program` (founders cannot create it)
- [x] Guard: coupons rejected on `franchise_territory` invoices (createInvoice + apply-platform-coupon)
- [x] `couponCode` passthrough on enroll; enroll `amountUSD` reflects the discount
- [x] Verifier extended (22/22): $650-base discount math (percent, fixed-cap, max-cap, 100% off)
- **Scope:** discounts the founder's $650/yr enroll only (flat fee, no markup → no split math touched). Territory purchases stay full price. Renewals discounted per `cycleCount`.

### Phase 2 — Resale & polish
- [x] Buyer→buyer reassignment/resale (request → founder approval → invoice → payment transfers ownership + reseller markup)
- [x] **Renewal model = RECURRING FULL PRICE:** the custom/resale price recurs every year. Each year $650 → platform, **excess → the founder** (the territory's ongoing annual rate). `assignedByUserId` stays the founder for the life of the assignment, so renewals always credit the program owner.
- [x] Resale economics: new owner pays the resale price (≥$650); at the transfer payment **$650 → platform, excess → reseller (one-time)**; thereafter the resale price recurs yearly with the excess going to the founder. Old owner's recurring subscription is cancelled on transfer.
- [x] Pure-logic verifier extended (18/18): markup split + renewal-floor.
- [ ] Auction pricing (not requested yet)
- [ ] Renewal reminders
- [ ] Richer founder reporting

**Phase 2 decisions (confirmed):** new owner pays a fresh $650/yr subscription where the resale price **is** the year-1 charge ($650 floor → platform, excess → reseller); founder **must approve** each reassignment. New endpoints: `POST /assignments/:id/reassign-request` (owner), `GET|POST /offices/:officeId/reassignments[...]/approve|reject` (founder).

**New e2e to run on a dev DB before production:** resale path (request → approve → pay → assert ownership transferred + reseller credited + old sub cancelled + renewal bills $650).

---

## 5. Critical files

- **New:** `models/franchiseProgram.model.ts`, `models/franchiseTerritoryAssignment.model.ts`, `services/franchiseProgramCommission.ts`, `utils/franchiseGeoResolver.ts`, `utils/buyerAddress.ts`, `routes/franchiseProgram.ts`
- **Edit (additive only):** `models/territoryWalletTransaction.model.ts`, `models/invoice.model.ts`, `routes/invoice.ts` + `services/invoice.ts` (`fulfillInvoice`, recurring cron), `services/commission.ts` (STEP 5 call), `routes/franchiseApi.ts` (source filter), `app.ts` (mount), `config/env.ts` (price)
- **Reuse:** `territoryResolver.ts` helpers, `requireAuth`/`requireFounder`, `hasFounderAccess`, `StoreWallet`/`WalletTransaction`/`TerritoryWallet`, `exchangeRate.convertToUsd`

---

## 6. Verification

- **Unit:** buyer-address→geo-chain resolver; chain-integrity plan builder; overspend guard (insufficient gross → slice skipped/clipped).
- **Integration:** paid invoice at an enrolled office with a buyer in an assigned sub-territory → owner `TerritoryWallet` credited correct %, office `StoreWallet` debited, txn `source=founder_program`; **assert global STEP 4 still runs identically** (both layers).
- **Regression:** sale at a NON-enrolled office → STEP 5 no-ops, STEP 1–4 outputs unchanged; `/franchise-api` wallet numbers unchanged (source filter).
- **Lapse:** owner with expired sub → slice not carved (stays with founder).
- **Payments:** $650 program invoice → platform credited; custom $800 territory invoice → $650 platform + $150 founder office.
- **DB:** validate against a **dev DB** with read-only scripts; never run writes against prod without explicit approval.
