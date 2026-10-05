# `scripts/test-franchise-e2e.ts`

> End-to-end test of the founder franchise-program commission distributor: seeds throwaway data in a non-production database, runs `distributeFranchiseProgramCommissions`, asserts the payouts, then deletes what it created.

**Kind:** backend helper/test script (writes to a test DB only) · **Lines:** 191

## Purpose
A founder's "office" (organisation) can run a franchise program in which owners of the buyer's country, territory (state) and sub-territory (city/zip) earn a share of each sale out of the office's store wallet. The pure decision logic is tested by `scripts/verify-franchise-logic.ts`; this script tests the real database path, including wallet debits and credits. It is run by hand and imported by nothing.

## How it works
**Safety gate (L23-L33):** reads `MONGODB_URI_TEST` only (not `MONGODB_URI`, and it does not call dotenv, so the variable must be set in the shell). If unset, prints `SKIPPED` and exits 0. If the URI string contains "prod" anywhere (case-insensitive), it refuses and exits 1.

**Fixtures:** a fixed tag `fr_e2e_<n>` and freshly generated ObjectIds for a founder, three owners, the office and the program; string ids `fr_e2e_country`, `fr_e2e_territory`, `fr_e2e_sub` for the geo catalogue.

**`seed()`:** creates four `User`s (`<tag>_*@test.local`), an `Organization` at Testland/TestState/TestCity/99999, a USD `StoreWallet` for the founder in that office with a $100 balance, the catalogue chain `FranchiseCountry` -> `FranchiseTerritory` -> `FranchiseSubTerritory` (status `taken`), an active `FranchiseProgram` with `commissionConfig { country: 5, territory: 5, subTerritory: 15 }` and a yearly $650 subscription, plus one active `FranchiseTerritoryAssignment` per level.

**`run()`:** calls `distributeFranchiseProgramCommissions` for a $20 sale by the sub-territory owner shipped to the seeded address, then checks:
- 3 payouts applied and $5 paid in total (15% + 5% + 5% of $20);
- `TerritoryWallet` balances: sub owner $3, territory owner $1, country owner $1;
- office `StoreWallet` debited from $100 to $95.

**`cleanup()`:** runs before seeding (removes residue) and in `finally`: deletes the users by email prefix, the organisation, its store wallets, the three territory wallets, the program, its assignments, the catalogue rows, and `territorywallettransactions` with this `franchiseProgramId`.

Prints `RESULT: N passed, M failed` and exits 1 if anything failed.

Run: `MONGODB_URI_TEST="<non-prod URI>" npx tsx scripts/test-franchise-e2e.ts`.

## Exports
None. Local `check(name, ok, extra)` assertion helper, `seed()`, `run()`, `cleanup()`; an async IIFE drives them.

## Interfaces
- **Database (test DB from `MONGODB_URI_TEST`):** creates and deletes `User`, `Organization`, `StoreWallet`, `TerritoryWallet`, `FranchiseProgram`, `FranchiseTerritoryAssignment`, `FranchiseCountry`, `FranchiseTerritory`, `FranchiseSubTerritory`; the distributor also writes a `WalletTransaction` (office debit) and `TerritoryWalletTransaction` rows.
- **Environment variables:** `MONGODB_URI_TEST` - the only database it will touch.

## Dependencies
- **Internal:** the nine models that the file imports under `server/models/` (user, organization, storeWallet, territoryWallet, franchiseProgram, franchiseTerritoryAssignment, franchiseCountry, franchiseTerritory, franchiseSubTerritory); `server/services/franchiseProgramCommission.ts` - `distributeFranchiseProgramCommissions`, the code under test.
- **Packages:** `mongoose` - connection, `Types.ObjectId`, raw collection for cleanup.

## Used by
Nothing imports it. Run manually with `npx tsx`; not wired into `npm test` (Jest).

## Notes
- The "prod" check is a substring test on the whole URI, not a verified database name; a production cluster whose URI lacks "prod" would pass. Double-check the URI before running.
- The distributor runs inside a Mongo transaction, so the test database must be a replica set (Atlas is).
- Cleanup does not delete the office-debit `WalletTransaction` row the distributor writes, so each run leaves one behind in the test DB.
- The seeded `StoreWallet` sets `currency: "USD"` explicitly; store wallets are unique per `{userId, orgId, currency}`.
