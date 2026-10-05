# `server/services/deals.ts`

> src/services/deals.ts

**Kind:** backend service · **Lines:** 1050

<!-- docgen:auto -->

## Purpose
src/services/deals.ts

The Deals feed — "every time anyone on Garage got paid", as a social
timeline (Garage Connect → Deals tab).

── Why this is a projection, not a collection ────────────────────────────
Nothing new is written when a deal happens. A deal IS a commission
distribution, and there are two engines that produce them:

  unilevelplusdistributions  Garage's own products ($25 licence, NetworkChain,
                             Founders Office, reserve licences). Pays a direct
                             bonus, 15 levels of level bonus, and two
                             infinity tiers.
  commissiondistributions    Founder comb plans — OTHER people's products sold
                             through a founder's own storefront. Pays the
                             seller, plus an upline of commission levels. […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `DealSource` | type |  | 51 |
| `DealPayoutRole` | type | How someone came to be paid on this sale. | 61 |
| `DealPerson` | interface |  | 68 |
| `DealPayout` | interface |  | 74 |
| `DealTotals` | interface |  | 94 |
| `DealProduct` | interface |  | 104 |
| `Deal` | interface |  | 114 |
| `DealsQuery` | interface |  | 169 |
| `listDeals` | function | `async listDeals(q: DealsQuery = {}): Promise<{ deals: Deal[]; nextCursor: string \| nul…` — One page of the global deals feed, newest first. | 360 |
| `getDeal` | function | `async getDeal(dealId: string, q: Pick<DealsQuery, "viewerId" \| "payouts"> = {}): Promise<Deal \| null>` — One deal by its synthetic id, shaped exactly like a feed row. | 444 |
| `DealStatPoint` | interface |  | 464 |
| `DealStatSeries` | interface |  | 471 |
| `DealStats` | interface |  | 483 |
| `getDealStats` | function | `async getDealStats(): Promise<DealStats>` — Platform-wide totals for the four cards above the Deals feed, each with an all-time running series for its graph. | 597 |
| `isValidDealId` | function | `isValidDealId(id: string): boolean` — Deal ids are synthetic; reject anything that isn't one before it reaches Mongo. | 1035 |
| `dealExists` | function | `async dealExists(dealId: string): Promise<boolean>` — Does this deal actually exist? | 1040 |

## Interfaces

- **Database (Mongoose models used):**
  - `Invoice` (server/models/invoice.model.ts) — reads: `aggregate`
  - `User` (server/models/user.model.ts) — reads: `findOne`, `find`
  - `WalletTransaction` (server/models/walletTransaction.model.ts) — reads: `find`
  - `DealReaction` (server/models/dealReaction.model.ts) — reads: `aggregate`, `find`
  - `DealComment` (server/models/dealComment.model.ts) — reads: `aggregate`
- **Raw collections:** `unilevelplusdistributions`, `commissiondistributions`, `invoices`, `organizations`

## Dependencies

- **Internal:**
  - `server/models/user.model.ts` — `User`
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/invoice.model.ts` — `Invoice`
  - `server/models/walletTransaction.model.ts` — `WalletTransaction`
  - `server/utils/exchangeRate.ts` — `convertToUsd`
  - `server/models/dealReaction.model.ts` — `DealReaction`
  - `server/models/dealComment.model.ts` — `DealComment`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/deals.ts`
