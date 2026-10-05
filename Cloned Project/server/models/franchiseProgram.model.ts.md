# `server/models/franchiseProgram.model.ts`

> Mongoose model for a founder-run franchise programme scoped to one office, plus the platform-wide franchise price constant.

**Kind:** Mongoose model · **Lines:** 127

## Purpose
A founder can run their own franchise layer ("System B") on top of the global Shorupan franchise system. Both run on the same sale: the global system still splits the 5% platform fee, while this programme carves founder-configured percentages out of the office's seller-gross and routes them to the territory owners the founder sold to. This file defines the programme document and exports the fixed `FRANCHISE_PRICE_USD` used by several routes and services.

## How it works
- **One programme per office:** `officeId` (ref `Organization`) is `unique`.
- `founderUserId` (ref `User`, indexed) - the programme owner.
- `currency` - default `"USD"`.
- `status`: `pending_payment` (default) | `active` | `suspended` | `cancelled`. The founder pays a yearly subscription to keep it active; lapse pauses earning for the programme's territory owners (the slice reverts to the founder) until renewal.
- `commissionConfig` - percentages (0-100 each, default 0) for `country`, `territory`, `subTerritory`, applied to the office's seller-gross. There is no combined cap in the schema; the header says the distributor guards against overspending the office wallet.
- `subscription` - `priceUSD` (default 650), `period` (only `"yearly"`), `invoiceId`, `startedAt`, `expiresAt`, `lastPaymentInvoiceId`.

Commission attribution is buyer-location based: the buyer's address resolves to a geo leaf and the territory assignment covering it earns (contrast: the global system attributes by seller-office location).

`FRANCHISE_PRICE_USD = 650` is the single source of truth for the yearly fee and for the floor a territory buyer pays; custom prices above it send the excess to the founder.

## Exports
- `FranchiseProgram` - model `"FranchiseProgram"`, collection `franchise_programs`.
- `FRANCHISE_PRICE_USD` - `650`, yearly franchise price and resale floor.
- `IFranchiseProgram` - document interface.
- `FranchiseProgramStatus` - status union.
- `IFranchiseProgramCommissionConfig` - `{ country, territory, subTerritory }` percentages.
- `IFranchiseProgramSubscription` - subscription sub-document shape.

## Interfaces
- **Database:** collection `franchise_programs` (read/write).

## Dependencies
- **Packages:** `mongoose`.

## Used by
`server/routes/franchiseProgram.ts` (`/franchise-program`), `server/routes/franchiseGlobal.ts` (`/franchise-global`, uses `FRANCHISE_PRICE_USD` as its floor), `server/routes/orgCustomers.ts`, `server/services/franchiseGlobalOffer.ts` (`OFFER_FLOOR_USD`), `server/services/franchiseOffer.ts`, `server/services/franchiseProgramCommission.ts`, `server/services/franchiseSubscriptions.ts`, `server/services/invoice.ts`, and the manual scripts `server/scripts/reconcile-franchise-floor-credits.ts` and `scripts/test-franchise-e2e.ts`.

## Notes
- The subscription default `priceUSD: 650` is a literal, not a reference to `FRANCHISE_PRICE_USD`; changing one without the other would make them drift.
- The global catalog collections named in the header are read-only mirrors owned by roam-admin-prod.
