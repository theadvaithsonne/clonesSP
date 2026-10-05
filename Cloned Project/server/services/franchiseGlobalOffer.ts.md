# `server/services/franchiseGlobalOffer.ts`

> Module exporting `daysRemainingUntil`, `computeProratedCents`, `createFranchiseGlobalOffer`, `acceptFranchiseGlobalOffer` and 3 more.

**Kind:** backend service · **Lines:** 652

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `FranchiseGlobalOfferError` | class | `extends Error` — Buyer-initiated resale offer service for GLOBAL (System A) franchise assignments. | 25 |
| `OFFER_TTL_DAYS` | const | `= 7` | 38 |
| `LAST_DAYS_GATE` | const | `= 3` | 39 |
| `OFFER_FLOOR_USD` | const | `= FRANCHISE_PRICE_USD` | 40 |
| `daysRemainingUntil` | function | `daysRemainingUntil(expiresAt: Date, now: Date = new Date()): number` | 47 |
| `computeProratedCents` | function | `computeProratedCents(offerPriceUSD: number, daysRemaining: number): number` | 52 |
| `CreateFranchiseGlobalOfferInput` | interface |  | 157 |
| `createFranchiseGlobalOffer` | function | `async createFranchiseGlobalOffer(input: CreateFranchiseGlobalOfferInput): Promise<IFranchiseGlobalOffer>` | 164 |
| `AcceptFranchiseGlobalOfferOutput` | interface |  | 253 |
| `acceptFranchiseGlobalOffer` | function | `async acceptFranchiseGlobalOffer(input: { ownerUserId: string; offerId: string; }): Promise<AcceptFranchiseGlobalOfferOutput>` | 263 |
| `rejectFranchiseGlobalOffer` | function | `async rejectFranchiseGlobalOffer(input: { ownerUserId: string; offerId: string; }): Promise<IFranchiseGlobalOffer>` | 467 |
| `cancelFranchiseGlobalOffer` | function | `async cancelFranchiseGlobalOffer(input: { buyerUserId: string; offerId: string; }): Promise<IFranchiseGlobalOffer>` | 501 |
| `expireStaleGlobalPendingOffers` | function | `async expireStaleGlobalPendingOffers(): Promise<{ expired: number; }>` | 537 |

## Interfaces

- **Database (Mongoose models used):**
  - `Invoice` (server/models/invoice.model.ts) — reads: `findOne`; **writes:** `updateOne`
  - `FranchiseGlobalAssignment` (server/models/franchiseGlobalAssignment.model.ts) — reads: `findById`; **writes:** `updateOne`
  - `User` (server/models/user.model.ts) — reads: `findById`
  - `FranchiseGlobalOffer` (server/models/franchiseGlobalOffer.model.ts) — reads: `findById`, `find`; **writes:** `create`, `updateMany`
  - `UserNotification` (server/models/userNotification.model.ts) — **writes:** `create`

## Dependencies

- **Internal:**
  - `server/models/franchiseGlobalOffer.model.ts` — `FranchiseGlobalOffer`, `IFranchiseGlobalOffer`
  - `server/models/franchiseGlobalAssignment.model.ts` — `FranchiseGlobalAssignment`, `IFranchiseGlobalAssignment`
  - `server/models/invoice.model.ts` — `Invoice`
  - `server/models/user.model.ts` — `User`
  - `server/models/userNotification.model.ts` — `UserNotification`
  - `server/models/franchiseProgram.model.ts` — `FRANCHISE_PRICE_USD`
  - `server/services/invoice.ts` — `createInvoice`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/franchiseGlobal.ts`
- `server/routes/invoice.ts`
