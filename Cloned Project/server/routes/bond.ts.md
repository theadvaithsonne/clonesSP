# `server/routes/bond.ts`

> HiFi bonds — founder instrument management + investor purchase.

**Kind:** Express router · **Lines:** 995 · **Mounted at:** `/bonds` (browser: `/backend/bonds`)

<!-- docgen:auto -->

## Purpose
HiFi bonds — founder instrument management + investor purchase.

Crypto offices only: every route asserts
`Organization.officeCreatedFromCryptobrand === true`.

The purchase route is deliberately "silent": it mints an invoice AND
settles it from the buyer's store wallet inside one request, then
returns the already-paid invoice as a receipt. The investor never
sees a checkout page.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (15)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/instruments/preview` | `/backend/bonds/instruments/preview` | `requireAuth` | inline | 175 |
| POST | `/instruments` | `/backend/bonds/instruments` | `requireAuth` | inline | 216 |
| GET | `/instruments` | `/backend/bonds/instruments` | `requireAuth` | inline | 277 |
| GET | `/instruments/:id` | `/backend/bonds/instruments/:id` | `requireAuth` | inline | 301 |
| PATCH | `/instruments/:id` | `/backend/bonds/instruments/:id` | `requireAuth` | inline | 320 |
| POST | `/instruments/:id/publish` | `/backend/bonds/instruments/:id/publish` | `requireAuth` | inline | 393 |
| POST | `/instruments/:id/close` | `/backend/bonds/instruments/:id/close` | `requireAuth` | inline | 466 |
| GET | `/instruments/:id/quote` | `/backend/bonds/instruments/:id/quote` | `requireAuth` | inline | 488 |
| POST | `/instruments/:id/purchase` | `/backend/bonds/instruments/:id/purchase` | `requireAuth` | inline | 530 |
| GET | `/holdings` | `/backend/bonds/holdings` | `requireAuth` | inline | 702 |
| GET | `/holdings/by-hash/:bondHash` | `/backend/bonds/holdings/by-hash/:bondHash` | `requireAuth` | inline | 737 |
| GET | `/holdings/:id` | `/backend/bonds/holdings/:id` | `requireAuth` | inline | 790 |
| POST | `/holdings/:id/redeem` | `/backend/bonds/holdings/:id/redeem` | `requireAuth` | inline | 848 |
| GET | `/instruments/:id/obligations` | `/backend/bonds/instruments/:id/obligations` | `requireAuth` | inline | 890 |
| GET | `/organizations/:orgId/ledger` | `/backend/bonds/organizations/:orgId/ledger` | `requireAuth` | inline | 956 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 994 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findOne`, `findById`
  - `Organization` (server/models/organization.model.ts) — reads: `findById`
  - `BondInstrument` (server/models/bondInstrument.model.ts) — reads: `find`, `findById`; **writes:** `create`
  - `CombPlan` (server/models/combPlan.model.ts) — reads: `findById`
  - `StoreWallet` (server/models/storeWallet.model.ts) — reads: `findOne`
  - `BondHolding` (server/models/bondHolding.model.ts) — reads: `findOne`, `find`, `findById`
  - `Invoice` (server/models/invoice.model.ts) — reads: `findById`
  - `BondPayoutEvent` (server/models/bondPayoutEvent.model.ts) — reads: `find`
  - `BondLedgerEntry` (server/models/bondLedgerEntry.model.ts) — reads: `find`, `countDocuments`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/user.model.ts` — `User`
  - `server/models/storeWallet.model.ts` — `StoreWallet`
  - `server/models/combPlan.model.ts` — `CombPlan`
  - `server/models/bondInstrument.model.ts` — `BondInstrument`
  - `server/models/bondHolding.model.ts` — `BondHolding`
  - `server/models/bondPayoutEvent.model.ts` — `BondPayoutEvent`
  - `server/models/bondLedgerEntry.model.ts` — `BondLedgerEntry`
  - `server/services/invoice.ts` — `createInvoice`, `fulfillInvoice`
  - `server/services/wallet.ts` — `debitStoreWallet`
  - `server/config/bondMoney.ts` — `BOND_CURRENCIES`, `BondCurrency`, `fromAtomic`, `toAtomic`, `mulUnits`, `toWalletAmount`
  - `server/services/bondMath.ts` — `PAYOUT_FREQUENCIES`, `PayoutFrequency`, `deriveInstrumentFigures`
  - `server/services/bondValidation.ts` — `validateInstrument`, `validateAcknowledgement`, `validateLevelsAgainstRate`, `toInvoiceMinorUnits`
  - `server/services/bondPayoutEngine.ts` — `redeemHolding`
  - `server/models/invoice.model.ts` — `Invoice`
  - `server/services/bondHash.ts` — `normalizeBondHash`
  - `server/services/bondView.ts` — `buildPublicBondView`, `buildHoldingListItem`, `loadViewSources`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `mongoose` — `Types`
  - `zod` — `z`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/bonds`.
