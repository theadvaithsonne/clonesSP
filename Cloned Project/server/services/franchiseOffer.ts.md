# `server/services/franchiseOffer.ts`

> Module exporting `daysRemainingUntil`, `computeProratedCents`, `createFranchiseOffer`, `acceptFranchiseOffer` and 3 more.

**Kind:** backend service · **Lines:** 677

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `FranchiseOfferError` | class | `extends Error` — Buyer-initiated resale offer service. | 26 |
| `OFFER_TTL_DAYS` | const | `= 7` — Pending offers auto-expire after this many days. | 40 |
| `LAST_DAYS_GATE` | const | `= 3` — Block offers when the subscription is expiring within this window (days). | 42 |
| `OFFER_FLOOR_USD` | const | `= FRANCHISE_PRICE_USD` — Reused platform floor — offers must be at or above this. | 44 |
| `daysRemainingUntil` | function | `daysRemainingUntil(expiresAt: Date, now: Date = new Date()): number` — Days remaining from `now` until the subscription's `expiresAt`, rounded UP (ceil) so a partial-day sliver still counts as one day of use. | 56 |
| `computeProratedCents` | function | `computeProratedCents(offerPriceUSD: number, daysRemaining: number): number` — Prorated resale amount in CENTS for the current billing cycle. | 66 |
| `CreateFranchiseOfferInput` | interface |  | 183 |
| `createFranchiseOffer` | function | `async createFranchiseOffer(input: CreateFranchiseOfferInput): Promise<IFranchiseOffer>` | 190 |
| `AcceptFranchiseOfferOutput` | interface |  | 269 |
| `acceptFranchiseOffer` | function | `async acceptFranchiseOffer(input: { ownerUserId: string; offerId: string; }): Promise<AcceptFranchiseOfferOutput>` | 279 |
| `rejectFranchiseOffer` | function | `async rejectFranchiseOffer(input: { ownerUserId: string; offerId: string; }): Promise<IFranchiseOffer>` | 491 |
| `cancelFranchiseOffer` | function | `async cancelFranchiseOffer(input: { buyerUserId: string; offerId: string; }): Promise<IFranchiseOffer>` | 527 |
| `expireStalePendingOffers` | function | `async expireStalePendingOffers(): Promise<{ expired: number; }>` — Flip pending offers past their `expiresAt` to `status: 'expired'`. | 567 |

## Interfaces

- **Database (Mongoose models used):**
  - `Invoice` (server/models/invoice.model.ts) — reads: `findOne`; **writes:** `updateOne`
  - `FranchiseTerritoryAssignment` (server/models/franchiseTerritoryAssignment.model.ts) — reads: `findById`; **writes:** `updateOne`
  - `User` (server/models/user.model.ts) — reads: `findById`
  - `FranchiseOffer` (server/models/franchiseOffer.model.ts) — reads: `findById`, `find`; **writes:** `create`, `updateMany`
  - `UserNotification` (server/models/userNotification.model.ts) — **writes:** `create`

## Dependencies

- **Internal:**
  - `server/models/franchiseOffer.model.ts` — `FranchiseOffer`, `IFranchiseOffer`
  - `server/models/franchiseTerritoryAssignment.model.ts` — `FranchiseTerritoryAssignment`, `IFranchiseTerritoryAssignment`
  - `server/models/invoice.model.ts` — `Invoice`
  - `server/models/user.model.ts` — `User`
  - `server/models/userNotification.model.ts` — `UserNotification`
  - `server/models/franchiseProgram.model.ts` — `FRANCHISE_PRICE_USD`
  - `server/services/invoice.ts` — `createInvoice`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/franchiseProgram.ts`
- `server/routes/invoice.ts`
