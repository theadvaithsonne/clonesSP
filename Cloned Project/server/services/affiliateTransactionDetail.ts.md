# `server/services/affiliateTransactionDetail.ts`

> Module exporting `getAffiliateTransactionDetail`.

**Kind:** backend service · **Lines:** 705

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `AffiliateTransactionDetail` | interface |  | 334 |
| `getAffiliateTransactionDetail` | function | `async getAffiliateTransactionDetail(requestingUserId: string, transactionId: string): Promise< \| { ok: true; data: AffiliateTransaction…` | 391 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findById`, `find`
  - `UnilevelPlusPurchase` (server/models/unilevelPlusPurchase.model.ts) — reads: `findOne`
  - `Product` (server/models/product.model.ts) — reads: `findById`
  - `Course` (server/models/course.model.ts) — reads: `findById`
  - `Channel` (server/models/channel.model.ts) — reads: `findById`
  - `Workshop` (server/models/workshop.model.ts) — reads: `findById`
  - `Service` (server/models/service.model.ts) — reads: `findById`
  - `CallOffering` (server/models/callOffering.model.ts) — reads: `findById`
  - `Organization` (server/models/organization.model.ts) — reads: `findById`
  - `WalletTransaction` (server/models/walletTransaction.model.ts) — reads: `findById`
  - `CommissionDistribution` (server/models/commissionDistribution.model.ts) — reads: `findById`
  - `CombPlan` (server/models/combPlan.model.ts) — reads: `findById`
  - `Invoice` (server/models/invoice.model.ts) — reads: `findOne`
  - `UnilevelPlusDistribution` (server/models/unilevelPlusDistribution.model.ts) — reads: `findById`
  - `UnilevelPlusPlan` (server/models/unilevelPlusPlan.model.ts) — reads: `findById`

## Dependencies

- **Internal:**
  - `server/models/walletTransaction.model.ts` — `WalletTransaction`
  - `server/models/commissionDistribution.model.ts` — `CommissionDistribution`
  - `server/models/unilevelPlusDistribution.model.ts` — `UnilevelPlusDistribution`
  - `server/models/unilevelPlusPurchase.model.ts` — `UnilevelPlusPurchase`
  - `server/models/unilevelPlusPlan.model.ts` — `UnilevelPlusPlan`
  - `server/models/invoice.model.ts` — `Invoice`
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/user.model.ts` — `User`
  - `server/models/combPlan.model.ts` — `CombPlan`
  - `server/models/product.model.ts` — `Product`
  - `server/models/course.model.ts` — `Course`
  - `server/models/channel.model.ts` — `Channel`
  - `server/models/workshop.model.ts` — `Workshop`
  - `server/models/service.model.ts` — `Service`
  - `server/models/callOffering.model.ts` — `CallOffering`
- **Packages:**
  - `mongoose`

## Used by

- `server/routes/wallet.ts`
